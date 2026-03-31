'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const { getOAuthClient, googleConfigurado } = require('./google_auth');
const { gerarResposta } = require('./openai');
const logger = require('../api/logger');

// ---------------------------------------------------------------------------
// Gmail API — captura e classificação de e-mails financeiros
// ---------------------------------------------------------------------------

function getGmail() {
  return google.gmail({ version: 'v1', auth: getOAuthClient() });
}

// ---------------------------------------------------------------------------
// Leitura de e-mails
// ---------------------------------------------------------------------------

/**
 * Lista e-mails não lidos da caixa de entrada.
 * @param {number} maxResults
 * @param {string} [query]   - filtro Gmail (ex: "is:unread subject:boleto")
 * @returns {Promise<string[]>} - lista de IDs de mensagens
 */
async function listarNaoLidos(maxResults = 20, query = 'is:unread') {
  if (!googleConfigurado()) return [];

  const gmail = getGmail();
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });
    return (response.data.messages ?? []).map((m) => m.id);
  } catch (err) {
    logger.error('Erro ao listar e-mails', { error: err.message });
    return [];
  }
}

/**
 * Busca o conteúdo completo de um e-mail pelo ID.
 * @param {string} messageId
 * @returns {Promise<{ id, assunto, remetente, data, corpo, attachments }>}
 */
async function lerEmail(messageId) {
  const gmail = getGmail();

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const msg = response.data;
  const headers = msg.payload?.headers ?? [];

  const obterHeader = (nome) =>
    headers.find((h) => h.name.toLowerCase() === nome.toLowerCase())?.value ?? '';

  // Extrai o corpo do e-mail (suporta text/plain e text/html)
  let corpo = '';
  const partes = msg.payload?.parts ?? [msg.payload];

  function extrairCorpo(partes) {
    for (const parte of partes) {
      if (parte?.mimeType === 'text/plain' && parte?.body?.data) {
        corpo = Buffer.from(parte.body.data, 'base64').toString('utf-8');
        return;
      }
      if (parte?.parts) extrairCorpo(parte.parts);
    }
    // Fallback para text/html se não tiver plain text
    for (const parte of partes) {
      if (parte?.mimeType === 'text/html' && parte?.body?.data) {
        const html = Buffer.from(parte.body.data, 'base64').toString('utf-8');
        corpo = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return;
      }
    }
  }
  extrairCorpo(partes);

  // Lista de anexos (nome e tamanho)
  const anexos = [];
  function extrairAnexos(partes) {
    for (const parte of partes) {
      if (parte?.filename && parte.filename.length > 0) {
        anexos.push({ nome: parte.filename, attachmentId: parte.body?.attachmentId });
      }
      if (parte?.parts) extrairAnexos(parte.parts);
    }
  }
  extrairAnexos(partes);

  return {
    id: messageId,
    assunto: obterHeader('subject'),
    remetente: obterHeader('from'),
    data: obterHeader('date'),
    corpo: corpo.slice(0, 4000), // limita para não estourar o contexto do GPT
    anexos,
    threadId: msg.threadId,
  };
}

/**
 * Marca um e-mail como lido.
 * @param {string} messageId
 */
async function marcarComoLido(messageId) {
  const gmail = getGmail();
  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      resource: { removeLabelIds: ['UNREAD'] },
    });
  } catch (err) {
    logger.warn('Erro ao marcar e-mail como lido', { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Classificação de e-mails com GPT-4o
// ---------------------------------------------------------------------------

const PROMPT_CLASSIFICACAO_EMAIL = `Você é um sistema de classificação de e-mails financeiros.
Analise o assunto e corpo do e-mail e retorne um JSON:

{
  "tipo": "<boleto|nfe|honorario|extrato|outros>",
  "relevante": <true|false>,  // true se contém informação financeira acionável
  "dados": {
    // Para boleto:
    "valor": <número ou null>,
    "data_vencimento": "<YYYY-MM-DD ou null>",
    "beneficiario": "<nome ou null>",
    "linha_digitavel": "<string ou null>",

    // Para nfe:
    "valor_total": <número ou null>,
    "data_emissao": "<YYYY-MM-DD ou null>",
    "emitente": "<nome ou null>",
    "cnpj": "<string ou null>",

    // Para honorario:
    "valor": <número ou null>,
    "descricao": "<string ou null>",
    "periodo": "<string ou null>",

    // Para extrato:
    "banco": "<string ou null>",
    "periodo": "<string ou null>"
  },
  "resumo": "<frase curta descrevendo o e-mail>",
  "confianca": <0.0 a 1.0>
}

Retorne APENAS o JSON.`;

/**
 * Classifica um e-mail usando GPT-4o para identificar tipo e extrair dados.
 * @param {{ assunto: string, remetente: string, corpo: string }} email
 * @returns {Promise<object>}
 */
async function classificarEmail(email) {
  const conteudo = `
REMETENTE: ${email.remetente}
ASSUNTO: ${email.assunto}
CORPO:
${email.corpo}
`.trim();

  try {
    const resposta = await gerarResposta(
      [{ role: 'user', content: conteudo }],
      PROMPT_CLASSIFICACAO_EMAIL
    );

    // Remove markdown code blocks se presentes
    const json = resposta
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(json);
  } catch (err) {
    logger.error('Erro ao classificar e-mail com GPT-4o', { error: err.message });
    return { tipo: 'outros', relevante: false, dados: {}, resumo: '', confianca: 0 };
  }
}

// ---------------------------------------------------------------------------
// Processamento em lote
// ---------------------------------------------------------------------------

/**
 * Processa novos e-mails não lidos e retorna os classificados como relevantes.
 * @param {number} limite
 * @returns {Promise<Array<{ email: object, classificacao: object }>>}
 */
async function processarNovosEmails(limite = 10) {
  if (!googleConfigurado()) {
    logger.warn('Gmail não configurado — processamento ignorado');
    return [];
  }

  const ids = await listarNaoLidos(limite, 'is:unread category:primary');
  if (ids.length === 0) return [];

  logger.info(`Processando ${ids.length} e-mail(s) não lido(s)`);

  const resultados = [];

  for (const id of ids) {
    try {
      const email = await lerEmail(id);
      const classificacao = await classificarEmail(email);

      if (classificacao.relevante) {
        resultados.push({ email, classificacao });
        logger.info('E-mail financeiro detectado', {
          tipo: classificacao.tipo,
          assunto: email.assunto,
          resumo: classificacao.resumo,
        });
      }

      // Marca como lido independentemente
      await marcarComoLido(id);
    } catch (err) {
      logger.error('Erro ao processar e-mail', { id, error: err.message });
    }
  }

  return resultados;
}

/**
 * Configura o Gmail Push Notification via Pub/Sub.
 * Necessário para receber atualizações em tempo real (alternativa ao polling).
 * @param {string} topicName - formato "projects/PROJECT_ID/topics/TOPIC_NAME"
 * @returns {Promise<object>}
 */
async function configurarWatch(topicName) {
  if (!googleConfigurado() || !topicName) return null;

  const gmail = getGmail();
  try {
    const response = await gmail.users.watch({
      userId: 'me',
      resource: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      },
    });
    logger.info('Gmail watch configurado', {
      historyId: response.data.historyId,
      expiration: response.data.expiration,
    });
    return response.data;
  } catch (err) {
    logger.error('Erro ao configurar Gmail watch', { error: err.message });
    return null;
  }
}

module.exports = {
  listarNaoLidos,
  lerEmail,
  marcarComoLido,
  classificarEmail,
  processarNovosEmails,
  configurarWatch,
};
