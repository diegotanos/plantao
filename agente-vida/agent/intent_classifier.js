'use strict';

const fs = require('fs');
const path = require('path');
const { classificarIntencao } = require('../integrations/openai');
const { obterContexto } = require('../database/redis_client');
const { buscarMemoriasSimilares } = require('../database/supabase_client');
const { gerarEmbedding } = require('../integrations/openai');
const { INTENCOES, LIMITES } = require('../config/constants');
const logger = require('../api/logger');

// ---------------------------------------------------------------------------
// Carrega o prompt de sistema do arquivo Markdown
// ---------------------------------------------------------------------------

const PROMPT_SISTEMA = fs.readFileSync(
  path.join(__dirname, 'prompt_system.md'),
  'utf-8'
);

// ---------------------------------------------------------------------------
// Classificação de intenção principal
// ---------------------------------------------------------------------------

/**
 * Classifica a intenção de uma mensagem e retorna o JSON estruturado.
 *
 * @param {object} params
 * @param {string} params.mensagem      - texto da mensagem do usuário
 * @param {string} params.userId        - ID do usuário no Supabase
 * @param {Date}   [params.dataHoje]    - data atual (para injetar no prompt)
 * @returns {Promise<object>}           - JSON estruturado com intencao, dados, etc.
 */
async function classificar({ mensagem, userId, dataHoje = new Date() }) {
  const inicio = Date.now();

  // Formata data atual para o contexto do prompt
  const dataFormatada = dataHoje.toISOString().split('T')[0];
  const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado'][dataHoje.getDay()];

  // Contexto da data para o modelo
  const contextData = `\n\n---\nCONTEXTO ATUAL:\n- data_hoje: ${dataFormatada} (${diaSemana})\n- timezone: America/Sao_Paulo\n---`;

  // Busca histórico de conversa no Redis
  const historico = await obterContexto(userId);

  // Monta as mensagens para o GPT-4o
  const mensagens = [
    ...historico.slice(-6), // últimas 6 mensagens do histórico
    { role: 'user', content: mensagem },
  ];

  // Prompt com contexto de data injetado
  const promptComContexto = PROMPT_SISTEMA + contextData;

  let resultado;
  try {
    resultado = await classificarIntencao(mensagens, promptComContexto);
  } catch (err) {
    logger.error('Falha na classificação de intenção', { userId, error: err.message });
    return criarRespostaErro();
  }

  // Valida e normaliza o resultado
  resultado = normalizarResultado(resultado, mensagem);

  const duracao = Date.now() - inicio;
  logger.info('Intenção classificada', {
    userId,
    intencao: resultado.intencao,
    confianca: resultado.confianca,
    duracao_ms: duracao,
  });

  return resultado;
}

// ---------------------------------------------------------------------------
// Classificação com contexto de memória vetorial (para consultas complexas)
// ---------------------------------------------------------------------------

/**
 * Versão enriquecida que injeta memórias relevantes do usuário antes da classificação.
 * Use para consultas como "quanto gastei em março?" onde histórico importa.
 *
 * @param {object} params
 * @param {string} params.mensagem
 * @param {string} params.userId
 * @param {Date}   [params.dataHoje]
 * @returns {Promise<object>}
 */
async function classificarComMemoria({ mensagem, userId, dataHoje = new Date() }) {
  let memorias = [];

  // Tenta buscar memórias relevantes (não bloqueia em caso de falha)
  try {
    const embedding = await gerarEmbedding(mensagem);
    memorias = await buscarMemoriasSimilares(userId, embedding, 3);
  } catch (err) {
    logger.warn('Falha ao buscar memórias — classificação sem contexto vetorial', {
      userId,
      error: err.message,
    });
  }

  // Injeta memórias relevantes na mensagem de contexto
  let mensagemEnriquecida = mensagem;
  if (memorias.length > 0) {
    const contextoMemoria = memorias
      .map((m) => `• ${m.conteudo}`)
      .join('\n');
    mensagemEnriquecida = `[CONTEXTO RELEVANTE DO HISTÓRICO]\n${contextoMemoria}\n\n[MENSAGEM ATUAL]\n${mensagem}`;
  }

  return classificar({ mensagem: mensagemEnriquecida, userId, dataHoje });
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Normaliza e valida o JSON retornado pelo GPT-4o.
 * @param {object} resultado
 * @param {string} mensagemOriginal
 * @returns {object}
 */
function normalizarResultado(resultado, mensagemOriginal) {
  // Garante que todos os campos obrigatórios existam
  const normalizado = {
    intencao: resultado.intencao ?? INTENCOES.DESCONHECIDO,
    confianca: typeof resultado.confianca === 'number'
      ? Math.min(1, Math.max(0, resultado.confianca))
      : 0.5,
    dados: resultado.dados ?? {},
    acao_requerida: resultado.acao_requerida ?? '',
    resposta_usuario: resultado.resposta_usuario ?? 'Não entendi. Pode reformular?',
    precisa_confirmacao: resultado.precisa_confirmacao ?? false,
  };

  // Se confiança baixa, força confirmação
  if (normalizado.confianca < LIMITES.MIN_CONFIANCA_INTENCAO) {
    normalizado.precisa_confirmacao = true;
    normalizado.intencao = INTENCOES.DESCONHECIDO;
    normalizado.resposta_usuario = gerarRespostaAmbiguidade(mensagemOriginal, resultado);
  }

  return normalizado;
}

/**
 * Gera mensagem de pedido de esclarecimento quando a intenção não está clara.
 * @param {string} mensagem
 * @param {object} resultadoParcial
 * @returns {string}
 */
function gerarRespostaAmbiguidade(mensagem, resultadoParcial) {
  if (resultadoParcial.resposta_usuario) {
    return resultadoParcial.resposta_usuario;
  }
  return `Não ficou claro o que você quis dizer com "${mensagem.slice(0, 50)}". Pode ser mais específico?`;
}

/**
 * Cria uma resposta de erro padrão para falhas na API.
 * @returns {object}
 */
function criarRespostaErro() {
  return {
    intencao: INTENCOES.DESCONHECIDO,
    confianca: 0,
    dados: {},
    acao_requerida: '',
    resposta_usuario: 'Ops, tive um problema técnico. Tenta de novo em instantes.',
    precisa_confirmacao: false,
    erro: true,
  };
}

module.exports = {
  classificar,
  classificarComMemoria,
};
