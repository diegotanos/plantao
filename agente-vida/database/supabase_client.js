'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const logger = require('../api/logger');

// ---------------------------------------------------------------------------
// Validação das variáveis de ambiente
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias. ' +
    'Verifique seu arquivo .env.'
  );
}

// ---------------------------------------------------------------------------
// Cliente Supabase com service_key (bypassa RLS — uso exclusivo do servidor)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers reutilizáveis
// ---------------------------------------------------------------------------

/**
 * Retorna o user_id a partir do telegram_id.
 * @param {string} telegramId
 * @returns {Promise<string|null>}
 */
async function getUserIdByTelegramId(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', String(telegramId))
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    logger.error('Erro ao buscar usuário por telegram_id', { telegramId, error });
    throw error;
  }
  return data?.id ?? null;
}

/**
 * Busca ou cria um usuário pelo telegram_id.
 * @param {{ telegramId: string, nome: string }} params
 * @returns {Promise<{ id: string, nome: string, preferencias: object }>}
 */
async function upsertUserByTelegramId({ telegramId, nome }) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { telegram_id: String(telegramId), nome },
      { onConflict: 'telegram_id', ignoreDuplicates: false }
    )
    .select('id, nome, preferencias')
    .single();

  if (error) {
    logger.error('Erro ao upsert usuário', { telegramId, error });
    throw error;
  }
  return data;
}

/**
 * Salva um registro de gasto.
 * @param {object} dados
 * @returns {Promise<object>}
 */
async function salvarGasto(dados) {
  const { data, error } = await supabase
    .from('gastos')
    .insert(dados)
    .select()
    .single();

  if (error) {
    logger.error('Erro ao salvar gasto', { dados, error });
    throw error;
  }
  return data;
}

/**
 * Salva um registro de receita.
 * @param {object} dados
 * @returns {Promise<object>}
 */
async function salvarReceita(dados) {
  const { data, error } = await supabase
    .from('receitas')
    .insert(dados)
    .select()
    .single();

  if (error) {
    logger.error('Erro ao salvar receita', { dados, error });
    throw error;
  }
  return data;
}

/**
 * Salva um plantão.
 * @param {object} dados
 * @returns {Promise<object>}
 */
async function salvarPlantao(dados) {
  const { data, error } = await supabase
    .from('plantoes')
    .insert(dados)
    .select()
    .single();

  if (error) {
    logger.error('Erro ao salvar plantão', { dados, error });
    throw error;
  }
  return data;
}

/**
 * Salva um compromisso.
 * @param {object} dados
 * @returns {Promise<object>}
 */
async function salvarCompromisso(dados) {
  const { data, error } = await supabase
    .from('compromissos')
    .insert(dados)
    .select()
    .single();

  if (error) {
    logger.error('Erro ao salvar compromisso', { dados, error });
    throw error;
  }
  return data;
}

/**
 * Busca gastos de um usuário em um período.
 * @param {string} userId
 * @param {string} dataInicio - formato 'YYYY-MM-DD'
 * @param {string} dataFim    - formato 'YYYY-MM-DD'
 * @returns {Promise<object[]>}
 */
async function buscarGastosPeriodo(userId, dataInicio, dataFim) {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', userId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: false });

  if (error) {
    logger.error('Erro ao buscar gastos', { userId, dataInicio, dataFim, error });
    throw error;
  }
  return data ?? [];
}

/**
 * Busca receitas de um usuário em um período.
 * @param {string} userId
 * @param {string} dataInicio
 * @param {string} dataFim
 * @returns {Promise<object[]>}
 */
async function buscarReceitasPeriodo(userId, dataInicio, dataFim) {
  const { data, error } = await supabase
    .from('receitas')
    .select('*')
    .eq('user_id', userId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: false });

  if (error) {
    logger.error('Erro ao buscar receitas', { userId, dataInicio, dataFim, error });
    throw error;
  }
  return data ?? [];
}

/**
 * Busca plantões de um usuário em um período.
 * @param {string} userId
 * @param {string} dataInicio
 * @param {string} dataFim
 * @returns {Promise<object[]>}
 */
async function buscarPlantoesPeriodo(userId, dataInicio, dataFim) {
  const { data, error } = await supabase
    .from('plantoes')
    .select('*')
    .eq('user_id', userId)
    .gte('data_inicio', dataInicio)
    .lte('data_inicio', dataFim)
    .order('data_inicio', { ascending: true });

  if (error) {
    logger.error('Erro ao buscar plantões', { userId, dataInicio, dataFim, error });
    throw error;
  }
  return data ?? [];
}

/**
 * Salva o histórico de uma conversa.
 * @param {object} dados
 * @returns {Promise<object>}
 */
async function salvarConversa(dados) {
  const { data, error } = await supabase
    .from('conversas')
    .insert(dados)
    .select('id')
    .single();

  if (error) {
    logger.warn('Erro ao salvar conversa (não crítico)', { error });
    return null;
  }
  return data;
}

/**
 * Busca as últimas N conversas de um usuário para contexto.
 * @param {string} userId
 * @param {number} limite
 * @returns {Promise<object[]>}
 */
async function buscarUltimasConversas(userId, limite = 10) {
  const { data, error } = await supabase
    .from('conversas')
    .select('mensagem_usuario, resposta_agente, intencao, criado_em')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
    .limit(limite);

  if (error) {
    logger.warn('Erro ao buscar histórico de conversas', { error });
    return [];
  }
  return (data ?? []).reverse(); // ordem cronológica
}

/**
 * Chama a função SQL de busca de memórias similares.
 * @param {string} userId
 * @param {number[]} embedding - vetor float32 com 1536 dimensões
 * @param {number} limite
 * @returns {Promise<object[]>}
 */
async function buscarMemoriasSimilares(userId, embedding, limite = 5) {
  const { data, error } = await supabase.rpc('buscar_memorias_similares', {
    p_user_id: userId,
    p_embedding: embedding,
    p_limite: limite,
    p_threshold: 0.7,
  });

  if (error) {
    logger.warn('Erro na busca semântica de memórias', { error });
    return [];
  }
  return data ?? [];
}

/**
 * Salva uma memória vetorial.
 * @param {object} dados - { user_id, conteudo, embedding, tipo, metadados }
 * @returns {Promise<object>}
 */
async function salvarMemoria(dados) {
  const { data, error } = await supabase
    .from('memorias')
    .insert(dados)
    .select('id')
    .single();

  if (error) {
    logger.warn('Erro ao salvar memória vetorial', { error });
    return null;
  }
  return data;
}

/**
 * Busca ou cria a lista padrão de um tipo para um usuário.
 * @param {string} userId
 * @param {string} tipo - 'mercado' | 'farmacia' | 'tarefas' | 'geral'
 * @returns {Promise<{ id: string, nome: string }>}
 */
async function obterOuCriarLista(userId, tipo) {
  const nomes = {
    mercado: 'Lista do Mercado',
    farmacia: 'Lista da Farmácia',
    tarefas: 'Tarefas',
    geral: 'Lista Geral',
  };

  const { data: existente } = await supabase
    .from('listas')
    .select('id, nome')
    .eq('user_id', userId)
    .eq('tipo', tipo)
    .limit(1)
    .single();

  if (existente) return existente;

  const { data, error } = await supabase
    .from('listas')
    .insert({ user_id: userId, nome: nomes[tipo] ?? 'Lista', tipo })
    .select('id, nome')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Adiciona um item a uma lista.
 * @param {object} dados - { lista_id, descricao, quantidade, unidade, prioridade, prazo }
 * @returns {Promise<object>}
 */
async function adicionarItemLista(dados) {
  const { data, error } = await supabase
    .from('itens_lista')
    .insert(dados)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Lista os itens não concluídos de uma lista.
 * @param {string} listaId
 * @returns {Promise<object[]>}
 */
async function listarItensPendentes(listaId) {
  const { data, error } = await supabase
    .from('itens_lista')
    .select('*')
    .eq('lista_id', listaId)
    .eq('concluido', false)
    .order('prioridade', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

module.exports = {
  supabase,
  getUserIdByTelegramId,
  upsertUserByTelegramId,
  salvarGasto,
  salvarReceita,
  salvarPlantao,
  salvarCompromisso,
  buscarGastosPeriodo,
  buscarReceitasPeriodo,
  buscarPlantoesPeriodo,
  salvarConversa,
  buscarUltimasConversas,
  buscarMemoriasSimilares,
  salvarMemoria,
  obterOuCriarLista,
  adicionarItemLista,
  listarItensPendentes,
};
