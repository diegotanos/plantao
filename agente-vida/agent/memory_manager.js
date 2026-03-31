'use strict';

const { gerarEmbedding } = require('../integrations/openai');
const { salvarMemoria, buscarMemoriasSimilares } = require('../database/supabase_client');
const { adicionarAoContexto, obterContexto } = require('../database/redis_client');
const { TIPOS_MEMORIA, LIMITES } = require('../config/constants');
const logger = require('../api/logger');

// ---------------------------------------------------------------------------
// Gerenciamento de memória de curto prazo (Redis) e longo prazo (pgvector)
// ---------------------------------------------------------------------------

/**
 * Adiciona uma troca de mensagem ao contexto de curto prazo (Redis).
 * Mantém as últimas N mensagens para contexto da conversa.
 *
 * @param {string} userId
 * @param {string} mensagemUsuario
 * @param {string} respostaAgente
 */
async function registrarTroca(userId, mensagemUsuario, respostaAgente) {
  try {
    await Promise.all([
      adicionarAoContexto(
        userId,
        { role: 'user', content: mensagemUsuario },
        LIMITES.CONTEXTO_MENSAGENS_REDIS
      ),
      adicionarAoContexto(
        userId,
        { role: 'assistant', content: respostaAgente },
        LIMITES.CONTEXTO_MENSAGENS_REDIS
      ),
    ]);
  } catch (err) {
    logger.warn('Falha ao registrar troca no Redis', { userId, error: err.message });
  }
}

/**
 * Salva uma memória de longo prazo com embedding vetorial.
 * Use para preferências, padrões de comportamento e fatos importantes.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.conteudo   - texto a ser memorizado
 * @param {string} params.tipo       - TIPOS_MEMORIA.*
 * @param {object} [params.metadados]
 * @returns {Promise<object|null>}
 */
async function salvarMemoriaLongoPrazo({ userId, conteudo, tipo = TIPOS_MEMORIA.CONVERSA, metadados = {} }) {
  try {
    // Gera embedding do conteúdo
    const embedding = await gerarEmbedding(conteudo);

    const memoria = await salvarMemoria({
      user_id: userId,
      conteudo,
      embedding,
      tipo,
      metadados,
    });

    logger.debug('Memória de longo prazo salva', { userId, tipo, id: memoria?.id });
    return memoria;
  } catch (err) {
    logger.warn('Falha ao salvar memória de longo prazo', { userId, error: err.message });
    return null;
  }
}

/**
 * Busca memórias relevantes para uma consulta usando similaridade semântica.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.consulta   - texto de busca
 * @param {number} [params.limite]
 * @returns {Promise<object[]>}
 */
async function buscarMemoriasRelevantes({ userId, consulta, limite = 5 }) {
  try {
    const embedding = await gerarEmbedding(consulta);
    const memorias = await buscarMemoriasSimilares(userId, embedding, limite);
    return memorias;
  } catch (err) {
    logger.warn('Falha na busca semântica', { userId, error: err.message });
    return [];
  }
}

/**
 * Retorna o contexto de curto prazo do usuário (Redis).
 * @param {string} userId
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
async function obterContextoCurto(userId) {
  try {
    return await obterContexto(userId);
  } catch (err) {
    logger.warn('Falha ao obter contexto Redis', { userId, error: err.message });
    return [];
  }
}

/**
 * Estratégia de memória híbrida: combina contexto Redis com memórias vetoriais.
 * Retorna um objeto com o contexto completo para o agente.
 *
 * @param {string} userId
 * @param {string} mensagemAtual
 * @returns {Promise<{ historico: object[], memorias: object[] }>}
 */
async function obterContextoCompleto(userId, mensagemAtual) {
  const [historico, memorias] = await Promise.allSettled([
    obterContextoCurto(userId),
    buscarMemoriasRelevantes({ userId, consulta: mensagemAtual, limite: 3 }),
  ]);

  return {
    historico: historico.status === 'fulfilled' ? historico.value : [],
    memorias: memorias.status === 'fulfilled' ? memorias.value : [],
  };
}

/**
 * Detecta e salva padrões de comportamento do usuário.
 * Chamada periodicamente após registros financeiros ou de agenda.
 *
 * @param {string} userId
 * @param {object} dados     - dados do registro (gasto, plantão, etc.)
 * @param {string} intencao
 */
async function detectarEsalvarPadrao(userId, dados, intencao) {
  // Padrões que valem a pena memorizar
  const padroesMemoraveis = {
    registrar_gasto: () => {
      if (dados.valor > 500) {
        return `Usuário fez gasto alto de ${dados.valor} em ${dados.categoria}: ${dados.descricao}`;
      }
      return null;
    },
    registrar_plantao: () =>
      `Plantão registrado em ${dados.local} — valor: R$ ${dados.valor_combinado ?? 'não informado'}`,
    definir_preferencia: () =>
      `Preferência definida: ${dados.chave} = ${dados.valor}`,
  };

  const gerador = padroesMemoraveis[intencao];
  if (!gerador) return;

  const conteudo = gerador();
  if (!conteudo) return;

  await salvarMemoriaLongoPrazo({
    userId,
    conteudo,
    tipo: intencao === 'definir_preferencia'
      ? TIPOS_MEMORIA.PREFERENCIA
      : TIPOS_MEMORIA.PADRAO,
    metadados: { intencao, dados_originais: dados },
  });
}

module.exports = {
  registrarTroca,
  salvarMemoriaLongoPrazo,
  buscarMemoriasRelevantes,
  obterContextoCurto,
  obterContextoCompleto,
  detectarEsalvarPadrao,
};
