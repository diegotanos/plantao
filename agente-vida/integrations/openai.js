'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const OpenAI = require('openai');
const fs = require('fs');
const logger = require('../api/logger');
const { OPENAI_MODELS, LIMITES } = require('../config/constants');

// ---------------------------------------------------------------------------
// Inicialização do cliente OpenAI
// ---------------------------------------------------------------------------

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY é obrigatória. Verifique seu arquivo .env.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: LIMITES.TIMEOUT_OPENAI_MS,
  maxRetries: 2,
});

// ---------------------------------------------------------------------------
// GPT-4o — Classificação de intenção e geração de resposta
// ---------------------------------------------------------------------------

/**
 * Envia mensagens para o GPT-4o e retorna o JSON estruturado do agente.
 * @param {Array<{ role: string, content: string }>} mensagens
 * @param {string} systemPrompt - prompt de sistema
 * @returns {Promise<object>} - JSON parseado da resposta
 */
async function classificarIntencao(mensagens, systemPrompt) {
  const inicio = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.CHAT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...mensagens,
      ],
      response_format: { type: 'json_object' },
      max_tokens: LIMITES.MAX_TOKENS_CLASSIFICACAO,
      temperature: 0.1, // baixa temperatura para consistência na classificação
    });

    const duracao = Date.now() - inicio;
    const conteudo = response.choices[0]?.message?.content;

    logger.debug('GPT-4o classificação concluída', {
      duracao_ms: duracao,
      tokens_prompt: response.usage?.prompt_tokens,
      tokens_resposta: response.usage?.completion_tokens,
    });

    if (!conteudo) throw new Error('GPT-4o retornou resposta vazia');

    return JSON.parse(conteudo);
  } catch (err) {
    logger.error('Erro na classificação GPT-4o', { error: err.message });
    throw err;
  }
}

/**
 * Gera uma resposta em texto livre (ex: resumos, insights).
 * @param {Array<{ role: string, content: string }>} mensagens
 * @param {string} systemPrompt
 * @returns {Promise<string>}
 */
async function gerarResposta(mensagens, systemPrompt) {
  const inicio = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.CHAT,
      messages: [
        { role: 'system', content: systemPrompt },
        ...mensagens,
      ],
      max_tokens: LIMITES.MAX_TOKENS_RESPOSTA,
      temperature: 0.7,
    });

    const duracao = Date.now() - inicio;
    logger.debug('GPT-4o resposta gerada', { duracao_ms: duracao });

    return response.choices[0]?.message?.content ?? '';
  } catch (err) {
    logger.error('Erro ao gerar resposta GPT-4o', { error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Whisper — Transcrição de áudio
// ---------------------------------------------------------------------------

/**
 * Transcreve um arquivo de áudio usando Whisper.
 * @param {string} caminhoArquivo - caminho local do arquivo de áudio
 * @returns {Promise<string>} - texto transcrito
 */
async function transcreverAudio(caminhoArquivo) {
  const inicio = Date.now();

  try {
    const fileStream = fs.createReadStream(caminhoArquivo);
    const response = await openai.audio.transcriptions.create({
      model: OPENAI_MODELS.TRANSCRICAO,
      file: fileStream,
      language: 'pt',
      response_format: 'text',
    });

    const duracao = Date.now() - inicio;
    logger.debug('Áudio transcrito pelo Whisper', {
      duracao_ms: duracao,
      arquivo: caminhoArquivo,
    });

    return response;
  } catch (err) {
    logger.error('Erro na transcrição Whisper', { error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GPT-4o Vision — Extração de dados de notas fiscais
// ---------------------------------------------------------------------------

/**
 * Extrai dados de uma nota fiscal ou cupom a partir de uma imagem (base64 ou URL).
 * @param {string} imagemBase64 - conteúdo da imagem em base64
 * @param {string} [mimeType='image/jpeg']
 * @returns {Promise<object>} - { valor, data, estabelecimento, categoria, itens, confianca }
 */
async function extrairDadosNF(imagemBase64, mimeType = 'image/jpeg') {
  const inicio = Date.now();

  const promptExtracao = `Você é um sistema de extração de dados de notas fiscais e cupons.
Analise a imagem e retorne um JSON com a seguinte estrutura:
{
  "valor_total": <número ou null>,
  "data": "<YYYY-MM-DD ou null>",
  "estabelecimento": "<nome ou null>",
  "cnpj": "<CNPJ ou null>",
  "categoria_sugerida": "<alimentacao|saude|transporte|lazer|moradia|outros>",
  "itens": [
    { "descricao": "<item>", "valor": <numero>, "quantidade": <numero> }
  ],
  "confianca": <0.0 a 1.0>,
  "observacoes": "<texto opcional>"
}
Retorne APENAS o JSON, sem texto adicional.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODELS.CHAT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptExtracao },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imagemBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      temperature: 0.1,
    });

    const duracao = Date.now() - inicio;
    const conteudo = response.choices[0]?.message?.content;
    logger.debug('GPT-4o Vision extração concluída', { duracao_ms: duracao });

    if (!conteudo) throw new Error('GPT-4o Vision retornou resposta vazia');
    return JSON.parse(conteudo);
  } catch (err) {
    logger.error('Erro no GPT-4o Vision', { error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// text-embedding-3-small — Geração de embeddings para memória vetorial
// ---------------------------------------------------------------------------

/**
 * Gera embedding vetorial para um texto.
 * @param {string} texto
 * @returns {Promise<number[]>} - vetor com 1536 dimensões
 */
async function gerarEmbedding(texto) {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_MODELS.EMBEDDING,
      input: texto.slice(0, 8191), // limite do modelo
    });

    return response.data[0].embedding;
  } catch (err) {
    logger.error('Erro ao gerar embedding', { error: err.message });
    throw err;
  }
}

/**
 * Gera embeddings para múltiplos textos em uma única chamada (mais eficiente).
 * @param {string[]} textos
 * @returns {Promise<number[][]>}
 */
async function gerarEmbeddingsLote(textos) {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_MODELS.EMBEDDING,
      input: textos.map((t) => t.slice(0, 8191)),
    });

    return response.data.map((d) => d.embedding);
  } catch (err) {
    logger.error('Erro ao gerar embeddings em lote', { error: err.message });
    throw err;
  }
}

module.exports = {
  openai,
  classificarIntencao,
  gerarResposta,
  transcreverAudio,
  extrairDadosNF,
  gerarEmbedding,
  gerarEmbeddingsLote,
};
