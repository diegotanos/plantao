'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Redis = require('ioredis');
const logger = require('../api/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SESSION_TTL = parseInt(process.env.REDIS_SESSION_TTL || '1800', 10);

// ---------------------------------------------------------------------------
// Cliente Redis com retry automático
// ---------------------------------------------------------------------------

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      logger.error('Redis: número máximo de reconexões atingido');
      return null; // para de tentar
    }
    return Math.min(times * 200, 2000); // backoff progressivo
  },
});

redis.on('connect', () => logger.info('Redis conectado'));
redis.on('error', (err) => logger.error('Erro no Redis', { err: err.message }));

// ---------------------------------------------------------------------------
// Chaves de contexto de sessão
// ---------------------------------------------------------------------------

/**
 * Retorna a chave Redis para o contexto de conversa de um usuário.
 * @param {string} userId
 */
function chaveContexto(userId) {
  return `agente:ctx:${userId}`;
}

/**
 * Retorna a chave Redis para estado de conversa (ex: aguardando confirmação).
 * @param {string} userId
 */
function chaveEstado(userId) {
  return `agente:estado:${userId}`;
}

// ---------------------------------------------------------------------------
// Gerenciamento de contexto de conversa
// ---------------------------------------------------------------------------

/**
 * Salva o contexto de conversa no Redis (lista das últimas mensagens).
 * @param {string} userId
 * @param {{ role: string, content: string }} mensagem
 * @param {number} maxMensagens - mantém apenas as últimas N mensagens
 */
async function adicionarAoContexto(userId, mensagem, maxMensagens = 10) {
  const chave = chaveContexto(userId);
  const serializado = JSON.stringify(mensagem);

  const pipeline = redis.pipeline();
  pipeline.rpush(chave, serializado);
  pipeline.ltrim(chave, -maxMensagens, -1);
  pipeline.expire(chave, SESSION_TTL);
  await pipeline.exec();
}

/**
 * Retorna o contexto de conversa atual do usuário.
 * @param {string} userId
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
async function obterContexto(userId) {
  const chave = chaveContexto(userId);
  const itens = await redis.lrange(chave, 0, -1);
  return itens.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return { role: 'user', content: item };
    }
  });
}

/**
 * Limpa o contexto de conversa de um usuário.
 * @param {string} userId
 */
async function limparContexto(userId) {
  await redis.del(chaveContexto(userId));
}

// ---------------------------------------------------------------------------
// Estado de conversa (aguardando confirmação, etc.)
// ---------------------------------------------------------------------------

/**
 * Define um estado temporário para o usuário (ex: aguardando confirmação).
 * @param {string} userId
 * @param {object} estado - objeto serializável
 * @param {number} ttl - em segundos (padrão: 5 minutos)
 */
async function definirEstado(userId, estado, ttl = 300) {
  await redis.setex(chaveEstado(userId), ttl, JSON.stringify(estado));
}

/**
 * Retorna o estado atual do usuário.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function obterEstado(userId) {
  const valor = await redis.get(chaveEstado(userId));
  if (!valor) return null;
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
}

/**
 * Remove o estado do usuário.
 * @param {string} userId
 */
async function limparEstado(userId) {
  await redis.del(chaveEstado(userId));
}

// ---------------------------------------------------------------------------
// Cache genérico
// ---------------------------------------------------------------------------

/**
 * Salva um valor no cache com TTL.
 * @param {string} chave
 * @param {*} valor
 * @param {number} ttl - em segundos
 */
async function setCache(chave, valor, ttl = 300) {
  await redis.setex(`agente:cache:${chave}`, ttl, JSON.stringify(valor));
}

/**
 * Busca um valor no cache.
 * @param {string} chave
 * @returns {Promise<*|null>}
 */
async function getCache(chave) {
  const valor = await redis.get(`agente:cache:${chave}`);
  if (!valor) return null;
  try {
    return JSON.parse(valor);
  } catch {
    return valor;
  }
}

/**
 * Rate limiting simples por usuário.
 * @param {string} userId
 * @param {number} maxReqs - máximo de requisições no janela
 * @param {number} janela - janela em segundos
 * @returns {Promise<boolean>} - true se permitido, false se bloqueado
 */
async function verificarRateLimit(userId, maxReqs = 20, janela = 60) {
  const chave = `agente:rl:${userId}`;
  const count = await redis.incr(chave);
  if (count === 1) await redis.expire(chave, janela);
  return count <= maxReqs;
}

module.exports = {
  redis,
  adicionarAoContexto,
  obterContexto,
  limparContexto,
  definirEstado,
  obterEstado,
  limparEstado,
  setCache,
  getCache,
  verificarRateLimit,
};
