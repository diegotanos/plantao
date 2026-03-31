'use strict';

const { INTENCOES, CATEGORIAS_GASTO, STATUS_PLANTAO } = require('../config/constants');

// ---------------------------------------------------------------------------
// Formatadores de data e valores
// ---------------------------------------------------------------------------

/**
 * Formata uma data ISO (YYYY-MM-DD) para exibição brasileira (DD/MM/YYYY).
 * @param {string} dataIso
 * @returns {string}
 */
function formatarData(dataIso) {
  if (!dataIso) return '';
  try {
    const [ano, mes, dia] = dataIso.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
  } catch {
    return dataIso;
  }
}

/**
 * Formata um valor monetário para exibição (ex: R$ 1.200,00).
 * @param {number} valor
 * @returns {string}
 */
function formatarMoeda(valor) {
  if (typeof valor !== 'number') return 'R$ --';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Formata um timestamp ISO para "DD/MM às HH:mm".
 * @param {string} timestamp
 * @returns {string}
 */
function formatarDataHora(timestamp) {
  if (!timestamp) return '';
  try {
    const dt = new Date(timestamp);
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const hora = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} às ${hora}h${min > '00' ? min : ''}`;
  } catch {
    return timestamp;
  }
}

// ---------------------------------------------------------------------------
// Ícones por categoria
// ---------------------------------------------------------------------------

const ICONES_CATEGORIA = {
  alimentacao: '🍽️',
  saude: '💊',
  transporte: '🚗',
  lazer: '🎬',
  moradia: '🏠',
  educacao: '📚',
  vestuario: '👕',
  investimentos: '📈',
  outros: '💡',
};

const ICONES_RECEITA = {
  salario: '💼',
  honorario: '🩺',
  plantao: '🏥',
  freelance: '💻',
  investimento: '📈',
  outros: '💰',
};

// ---------------------------------------------------------------------------
// Formatadores por intenção
// ---------------------------------------------------------------------------

/**
 * Formata a confirmação de registro de gasto.
 * @param {object} dados
 * @param {object} registro - registro salvo no banco
 * @returns {string}
 */
function formatarConfirmacaoGasto(dados, registro) {
  const icone = ICONES_CATEGORIA[dados.categoria] ?? '💸';
  const valor = formatarMoeda(dados.valor);
  const data = formatarData(dados.data);
  const desc = dados.descricao ? ` (${dados.descricao})` : '';
  const metodo = dados.metodo_pagamento ? ` · ${dados.metodo_pagamento}` : '';

  return `${icone} *${valor}* em ${dados.categoria}${desc}\n📅 ${data}${metodo}`;
}

/**
 * Formata a confirmação de registro de receita.
 * @param {object} dados
 * @returns {string}
 */
function formatarConfirmacaoReceita(dados) {
  const icone = ICONES_RECEITA[dados.tipo] ?? '💰';
  const valor = formatarMoeda(dados.valor);
  const data = formatarData(dados.data);
  const desc = dados.descricao ? ` (${dados.descricao})` : '';
  const status = dados.status === 'pendente' ? ' · *PENDENTE*' : '';

  return `${icone} *${valor}* — ${dados.tipo}${desc}\n📅 ${data}${status}`;
}

/**
 * Formata a confirmação de registro de plantão.
 * @param {object} dados
 * @returns {string}
 */
function formatarConfirmacaoPlantao(dados) {
  const dataInicio = formatarDataHora(dados.data_inicio);
  const dataFim = dados.data_fim ? ` até ${formatarDataHora(dados.data_fim)}` : '';
  const valor = dados.valor_combinado
    ? `\n💵 ${formatarMoeda(dados.valor_combinado)}`
    : '';

  return `🏥 *Plantão registrado!*\n📍 ${dados.local}\n📅 ${dataInicio}${dataFim}${valor}`;
}

/**
 * Formata a confirmação de criação de compromisso.
 * @param {object} dados
 * @returns {string}
 */
function formatarConfirmacaoCompromisso(dados) {
  const dataInicio = formatarDataHora(dados.data_inicio);
  const local = dados.local ? `\n📍 ${dados.local}` : '';
  const lembrete = dados.lembrete_minutos
    ? `\n⏰ Lembrete ${dados.lembrete_minutos} min antes`
    : '';

  return `📅 *${dados.titulo}*\n🕐 ${dataInicio}${local}${lembrete}`;
}

/**
 * Formata lista de itens para exibição.
 * @param {object[]} itens
 * @param {string} nomeLista
 * @returns {string}
 */
function formatarLista(itens, nomeLista) {
  if (!itens || itens.length === 0) {
    return `📋 *${nomeLista}*\n\nLista vazia! ✅`;
  }

  const linhas = itens.map((item) => {
    const qtd = item.quantidade && item.quantidade !== 1
      ? ` (${item.quantidade}${item.unidade ? ' ' + item.unidade : ''})`
      : '';
    return `• ${item.descricao}${qtd}`;
  });

  return `📋 *${nomeLista}* (${itens.length} item${itens.length > 1 ? 's' : ''})\n\n${linhas.join('\n')}`;
}

/**
 * Formata resumo financeiro de um período.
 * @param {object[]} gastos
 * @param {object[]} receitas
 * @param {string} periodo - descrição do período (ex: "março/2026")
 * @returns {string}
 */
function formatarResumoFinanceiro(gastos, receitas, periodo) {
  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0);
  const totalReceitas = receitas.reduce((s, r) => s + Number(r.valor), 0);
  const saldo = totalReceitas - totalGastos;

  // Agrupa gastos por categoria
  const porCategoria = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] ?? 0) + Number(g.valor);
    return acc;
  }, {});

  const categoriasOrdenadas = Object.entries(porCategoria)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const linhasCategorias = categoriasOrdenadas.map(([cat, val]) => {
    const icone = ICONES_CATEGORIA[cat] ?? '•';
    const pct = totalGastos > 0 ? Math.round((val / totalGastos) * 100) : 0;
    return `  ${icone} ${cat}: ${formatarMoeda(val)} (${pct}%)`;
  });

  const saldoEmoji = saldo >= 0 ? '📈' : '📉';

  return `📊 *Resumo — ${periodo}*

💚 Receitas: ${formatarMoeda(totalReceitas)}
🔴 Gastos: ${formatarMoeda(totalGastos)}
${saldoEmoji} Saldo: *${formatarMoeda(saldo)}*

*Top gastos por categoria:*
${linhasCategorias.join('\n') || '  Nenhum gasto registrado'}`;
}

/**
 * Formata agenda de plantões e compromissos.
 * @param {object[]} plantoes
 * @param {object[]} compromissos
 * @param {string} periodo
 * @returns {string}
 */
function formatarAgenda(plantoes, compromissos, periodo) {
  const linhas = [];

  // Combina e ordena por data
  const eventos = [
    ...plantoes.map((p) => ({
      tipo: 'plantao',
      data: new Date(p.data_inicio),
      texto: `🏥 *Plantão* — ${p.local} (${formatarDataHora(p.data_inicio)})`,
      valor: p.valor_combinado,
    })),
    ...compromissos.map((c) => ({
      tipo: 'compromisso',
      data: new Date(c.data_inicio),
      texto: `📅 *${c.titulo}* (${formatarDataHora(c.data_inicio)})`,
    })),
  ].sort((a, b) => a.data - b.data);

  if (eventos.length === 0) {
    return `📅 *Agenda — ${periodo}*\n\nNenhum evento registrado.`;
  }

  eventos.forEach((e) => {
    let linha = e.texto;
    if (e.valor) linha += ` · ${formatarMoeda(e.valor)}`;
    linhas.push(linha);
  });

  return `📅 *Agenda — ${periodo}*\n\n${linhas.join('\n')}`;
}

/**
 * Formata mensagem de solicitação de confirmação para ação destrutiva.
 * @param {string} descricao - o que vai ser feito
 * @returns {string}
 */
function formatarPedidoConfirmacao(descricao) {
  return `⚠️ Confirma?\n\n${descricao}\n\nResponda *sim* para confirmar ou *não* para cancelar.`;
}

/**
 * Mensagem padrão de erro de validação.
 * @param {string} campo
 * @param {string} motivo
 * @returns {string}
 */
function formatarErroCampo(campo, motivo) {
  return `Não consegui entender o campo *${campo}*: ${motivo}. Pode repetir?`;
}

module.exports = {
  formatarData,
  formatarMoeda,
  formatarDataHora,
  formatarConfirmacaoGasto,
  formatarConfirmacaoReceita,
  formatarConfirmacaoPlantao,
  formatarConfirmacaoCompromisso,
  formatarLista,
  formatarResumoFinanceiro,
  formatarAgenda,
  formatarPedidoConfirmacao,
  formatarErroCampo,
  ICONES_CATEGORIA,
  ICONES_RECEITA,
};
