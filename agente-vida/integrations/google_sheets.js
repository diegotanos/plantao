'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const { getOAuthClient, googleConfigurado } = require('./google_auth');
const logger = require('../api/logger');

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

// ---------------------------------------------------------------------------
// Estrutura esperada na planilha:
//
// Aba "Gastos":    Data | Valor | Categoria | Descrição | Método | Fonte
// Aba "Receitas":  Data | Valor | Tipo      | Descrição | Status
// Aba "Plantões":  Data Início | Data Fim | Local | Valor Combinado | Valor Recebido | Status
// ---------------------------------------------------------------------------

function getSheets() {
  return google.sheets({ version: 'v4', auth: getOAuthClient() });
}

/**
 * Adiciona uma linha no final de uma aba da planilha.
 * @param {string} aba   - nome da aba (ex: "Gastos")
 * @param {any[]} linha  - array de valores
 * @returns {Promise<boolean>}
 */
async function adicionarLinha(aba, linha) {
  if (!googleConfigurado() || !SHEETS_ID) {
    logger.warn('Google Sheets não configurado — linha não inserida');
    return false;
  }

  const sheets = getSheets();

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_ID,
      range: `${aba}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [linha] },
    });

    logger.debug('Linha adicionada ao Sheets', { aba, colunas: linha.length });
    return true;
  } catch (err) {
    logger.error('Erro ao adicionar linha no Sheets', { error: err.message, aba });
    return false;
  }
}

/**
 * Registra um gasto na aba "Gastos".
 * @param {object} gasto
 * @returns {Promise<boolean>}
 */
async function registrarGasto(gasto) {
  const linha = [
    gasto.data ?? new Date().toISOString().split('T')[0],
    Number(gasto.valor).toFixed(2),
    gasto.categoria ?? 'outros',
    gasto.descricao ?? '',
    gasto.metodo_pagamento ?? '',
    gasto.fonte ?? 'manual',
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  ];
  return adicionarLinha('Gastos', linha);
}

/**
 * Registra uma receita na aba "Receitas".
 * @param {object} receita
 * @returns {Promise<boolean>}
 */
async function registrarReceita(receita) {
  const linha = [
    receita.data ?? new Date().toISOString().split('T')[0],
    Number(receita.valor).toFixed(2),
    receita.tipo ?? 'outros',
    receita.descricao ?? '',
    receita.status ?? 'recebido',
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  ];
  return adicionarLinha('Receitas', linha);
}

/**
 * Registra um plantão na aba "Plantões".
 * @param {object} plantao
 * @returns {Promise<boolean>}
 */
async function registrarPlantao(plantao) {
  const linha = [
    plantao.data_inicio ?? '',
    plantao.data_fim ?? '',
    plantao.local ?? '',
    plantao.valor_combinado ? Number(plantao.valor_combinado).toFixed(2) : '',
    plantao.valor_recebido ? Number(plantao.valor_recebido).toFixed(2) : '',
    plantao.status ?? 'agendado',
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  ];
  return adicionarLinha('Plantões', linha);
}

/**
 * Lê os valores de um intervalo da planilha.
 * @param {string} aba
 * @param {string} [range] - ex: "A2:F100"
 * @returns {Promise<any[][]>}
 */
async function lerIntervalo(aba, range = 'A:Z') {
  if (!googleConfigurado() || !SHEETS_ID) return [];

  const sheets = getSheets();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range: `${aba}!${range}`,
    });
    return response.data.values ?? [];
  } catch (err) {
    logger.error('Erro ao ler Sheets', { error: err.message, aba });
    return [];
  }
}

module.exports = {
  registrarGasto,
  registrarReceita,
  registrarPlantao,
  adicionarLinha,
  lerIntervalo,
};
