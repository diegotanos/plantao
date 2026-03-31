'use strict';

/**
 * Constantes globais do sistema Agente Vida.
 * Valores fixos que não dependem de variáveis de ambiente.
 */

// ---------------------------------------------------------------------------
// Intenções do agente
// ---------------------------------------------------------------------------

/** @enum {string} */
const INTENCOES = {
  // Financeiro
  REGISTRAR_GASTO: 'registrar_gasto',
  REGISTRAR_RECEITA: 'registrar_receita',
  CONSULTAR_SALDO: 'consultar_saldo',
  DEFINIR_LIMITE: 'definir_limite',

  // Agenda
  REGISTRAR_PLANTAO: 'registrar_plantao',
  CRIAR_COMPROMISSO: 'criar_compromisso',
  CONSULTAR_AGENDA: 'consultar_agenda',
  CANCELAR_EVENTO: 'cancelar_evento',

  // Listas
  ADICIONAR_ITEM: 'adicionar_item',
  VER_LISTA: 'ver_lista',
  CONCLUIR_ITEM: 'concluir_item',
  CRIAR_TAREFA: 'criar_tarefa',

  // Relatórios
  RESUMO_FINANCEIRO: 'resumo_financeiro',
  RESUMO_AGENDA: 'resumo_agenda',
  INSIGHT: 'insight',

  // Configuração
  DEFINIR_PREFERENCIA: 'definir_preferencia',
  AJUDA: 'ajuda',

  // Desconhecido
  DESCONHECIDO: 'desconhecido',
};

// ---------------------------------------------------------------------------
// Categorias financeiras
// ---------------------------------------------------------------------------

/** @enum {string} */
const CATEGORIAS_GASTO = {
  ALIMENTACAO: 'alimentacao',
  SAUDE: 'saude',
  TRANSPORTE: 'transporte',
  LAZER: 'lazer',
  MORADIA: 'moradia',
  EDUCACAO: 'educacao',
  VESTUARIO: 'vestuario',
  INVESTIMENTOS: 'investimentos',
  OUTROS: 'outros',
};

/** @enum {string} */
const TIPOS_RECEITA = {
  SALARIO: 'salario',
  HONORARIO: 'honorario',
  PLANTAO: 'plantao',
  FREELANCE: 'freelance',
  INVESTIMENTO: 'investimento',
  OUTROS: 'outros',
};

/** @enum {string} */
const METODOS_PAGAMENTO = {
  DINHEIRO: 'dinheiro',
  DEBITO: 'debito',
  CREDITO: 'credito',
  PIX: 'pix',
  TRANSFERENCIA: 'transferencia',
  BOLETO: 'boleto',
  OUTROS: 'outros',
};

// ---------------------------------------------------------------------------
// Status de registros
// ---------------------------------------------------------------------------

/** @enum {string} */
const STATUS_PLANTAO = {
  AGENDADO: 'agendado',
  REALIZADO: 'realizado',
  CANCELADO: 'cancelado',
};

/** @enum {string} */
const STATUS_HONORARIO = {
  PENDENTE: 'pendente',
  RECEBIDO: 'recebido',
  CANCELADO: 'cancelado',
};

// ---------------------------------------------------------------------------
// Tipos de lista / tarefa
// ---------------------------------------------------------------------------

/** @enum {string} */
const TIPOS_LISTA = {
  MERCADO: 'mercado',
  FARMACIA: 'farmacia',
  TAREFAS: 'tarefas',
  GERAL: 'geral',
};

/** @enum {string} */
const PRIORIDADE_TAREFA = {
  BAIXA: 1,
  MEDIA: 2,
  ALTA: 3,
  URGENTE: 4,
};

// ---------------------------------------------------------------------------
// Canais de comunicação
// ---------------------------------------------------------------------------

/** @enum {string} */
const CANAIS = {
  TELEGRAM: 'telegram',
  WHATSAPP: 'whatsapp',
  GMAIL: 'gmail',
  SISTEMA: 'sistema',
};

// ---------------------------------------------------------------------------
// Tipos de memória vetorial
// ---------------------------------------------------------------------------

/** @enum {string} */
const TIPOS_MEMORIA = {
  CONVERSA: 'conversa',
  PREFERENCIA: 'preferencia',
  PADRAO: 'padrao',
  FATO_PESSOAL: 'fato_pessoal',
};

// ---------------------------------------------------------------------------
// Modelos OpenAI
// ---------------------------------------------------------------------------

const OPENAI_MODELS = {
  CHAT: 'gpt-4o',
  TRANSCRICAO: 'whisper-1',
  EMBEDDING: 'text-embedding-3-small',
  EMBEDDING_DIM: 1536,
};

// ---------------------------------------------------------------------------
// Limites e timeouts
// ---------------------------------------------------------------------------

const LIMITES = {
  MAX_TOKENS_RESPOSTA: 1024,
  MAX_TOKENS_CLASSIFICACAO: 512,
  TIMEOUT_OPENAI_MS: 30_000,
  TIMEOUT_SUPABASE_MS: 10_000,
  MAX_AUDIO_SIZE_MB: 25,
  MAX_FOTO_SIZE_MB: 20,
  MIN_CONFIANCA_INTENCAO: 0.6,
  CONTEXTO_MENSAGENS_REDIS: 10, // últimas N mensagens mantidas em contexto
};

// ---------------------------------------------------------------------------
// Mensagens padrão do agente
// ---------------------------------------------------------------------------

const MENSAGENS = {
  BEM_VINDO: `Olá! Sou seu assistente pessoal de organização. 👋

Posso te ajudar com:
• 💸 Registrar gastos e receitas
• 🏥 Gerenciar plantões e agenda médica
• 📅 Criar compromissos e lembretes
• 🛒 Listas de compras e tarefas
• 📊 Relatórios e insights financeiros

Manda uma mensagem de texto ou áudio — pode falar naturalmente!`,

  AJUDA: `O que consigo fazer por você:

💰 *Financeiro*
• "Gastei 80 reais no almoço"
• "Recebi o plantão do dia 15, R$ 1.200"
• "Quanto gastei essa semana?"
• "Me avisa se passar de R$ 3.000 no mês"

🏥 *Plantões e Agenda*
• "Tenho plantão sábado das 7h às 19h no HU"
• "Reunião com contador sexta às 14h"
• "O que tenho essa semana?"

🛒 *Listas*
• "Coloca leite e ovos na lista do mercado"
• "Mostra minha lista de compras"
• "Já comprei o leite"

📊 *Relatórios*
• "Resumo do mês"
• "Onde estou gastando mais?"

Pode mandar áudio ou foto de nota fiscal também!`,

  ERRO_GENERICO: 'Ops, algo deu errado. Tenta de novo em instantes.',
  AGUARDE: 'Processando... ⏳',
  CONFIRMACAO_SOLICITADA: 'Confirma?',
};

module.exports = {
  INTENCOES,
  CATEGORIAS_GASTO,
  TIPOS_RECEITA,
  METODOS_PAGAMENTO,
  STATUS_PLANTAO,
  STATUS_HONORARIO,
  TIPOS_LISTA,
  PRIORIDADE_TAREFA,
  CANAIS,
  TIPOS_MEMORIA,
  OPENAI_MODELS,
  LIMITES,
  MENSAGENS,
};
