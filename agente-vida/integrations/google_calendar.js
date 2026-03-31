'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const { getOAuthClient, googleConfigurado } = require('./google_auth');
const logger = require('../api/logger');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getOAuthClient() });
}

/**
 * Converte "YYYY-MM-DD HH:mm" (São Paulo) para objeto dateTime do Calendar.
 * @param {string} dataHora - "2026-04-04 07:00" ou "2026-04-04"
 * @returns {{ dateTime?: string, date?: string, timeZone: string }}
 */
function formatarDataCalendar(dataHora) {
  if (!dataHora) return null;

  const temHora = dataHora.includes(':');
  if (temHora) {
    // Formata como ISO 8601 com timezone
    const [data, hora] = dataHora.trim().split(' ');
    return {
      dateTime: `${data}T${hora}:00`,
      timeZone: 'America/Sao_Paulo',
    };
  }

  return { date: dataHora, timeZone: 'America/Sao_Paulo' };
}

// ---------------------------------------------------------------------------
// Operações do Google Calendar
// ---------------------------------------------------------------------------

/**
 * Cria um evento no Google Calendar.
 * @param {object} params
 * @param {string} params.titulo
 * @param {string} [params.descricao]
 * @param {string} params.dataInicio  - "YYYY-MM-DD HH:mm"
 * @param {string} [params.dataFim]   - "YYYY-MM-DD HH:mm"
 * @param {string} [params.local]
 * @param {number} [params.lembreteMinutos] - padrão: 30
 * @param {string[]} [params.cores]   - colorId (1-11)
 * @returns {Promise<{ id: string, link: string }>}
 */
async function criarEvento({
  titulo,
  descricao = '',
  dataInicio,
  dataFim,
  local = '',
  lembreteMinutos = 30,
  colorId = '1',       // azul (padrão)
}) {
  if (!googleConfigurado()) {
    logger.warn('Google Calendar não configurado — evento não criado');
    return null;
  }

  const calendar = getCalendar();
  const inicio = formatarDataCalendar(dataInicio);
  const fim = dataFim ? formatarDataCalendar(dataFim) : inicio;

  const evento = {
    summary: titulo,
    description: descricao,
    location: local,
    start: inicio,
    end: fim,
    colorId,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: lembreteMinutos },
        { method: 'popup', minutes: lembreteMinutos * 2 },
      ],
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: evento,
    });

    logger.info('Evento criado no Google Calendar', {
      id: response.data.id,
      titulo,
      dataInicio,
    });

    return {
      id: response.data.id,
      link: response.data.htmlLink,
    };
  } catch (err) {
    logger.error('Erro ao criar evento no Calendar', { error: err.message, titulo });
    throw err;
  }
}

/**
 * Cria evento específico de plantão (cor verde = "Sage").
 * @param {object} params - igual ao criarEvento, com 'local' e 'valor_combinado' opcionais
 * @returns {Promise<{ id: string, link: string }>}
 */
async function criarEventoPlantao({ local, dataInicio, dataFim, valorCombinado }) {
  const valor = valorCombinado
    ? ` | R$ ${Number(valorCombinado).toFixed(2)}`
    : '';

  return criarEvento({
    titulo: `🏥 Plantão — ${local}`,
    descricao: `Plantão médico em ${local}${valor}`,
    dataInicio,
    dataFim,
    local,
    lembreteMinutos: 60,
    colorId: '2',   // verde
  });
}

/**
 * Busca eventos do calendário em um período.
 * @param {string} dataInicio - ISO 8601 (ex: "2026-04-01T00:00:00-03:00")
 * @param {string} dataFim    - ISO 8601
 * @param {number} maxResultados
 * @returns {Promise<object[]>}
 */
async function listarEventos(dataInicio, dataFim, maxResultados = 50) {
  if (!googleConfigurado()) return [];

  const calendar = getCalendar();

  try {
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: dataInicio,
      timeMax: dataFim,
      maxResults: maxResultados,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items ?? [];
  } catch (err) {
    logger.error('Erro ao listar eventos do Calendar', { error: err.message });
    return [];
  }
}

/**
 * Cancela (deleta) um evento pelo ID.
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
async function cancelarEvento(eventId) {
  if (!googleConfigurado() || !eventId) return false;

  const calendar = getCalendar();

  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    });
    logger.info('Evento removido do Calendar', { eventId });
    return true;
  } catch (err) {
    logger.error('Erro ao cancelar evento', { error: err.message, eventId });
    return false;
  }
}

/**
 * Cria um lembrete rápido (evento de 15 minutos) para vencimento de boleto.
 * @param {object} params
 * @param {string} params.descricao
 * @param {number} params.valor
 * @param {string} params.dataVencimento - "YYYY-MM-DD"
 * @returns {Promise<{ id: string, link: string }>}
 */
async function criarLembreteBoleto({ descricao, valor, dataVencimento }) {
  return criarEvento({
    titulo: `📄 Boleto: ${descricao}`,
    descricao: `Vencimento: R$ ${Number(valor).toFixed(2)} — ${descricao}`,
    dataInicio: `${dataVencimento} 09:00`,
    dataFim: `${dataVencimento} 09:15`,
    colorId: '11',    // vermelho
    lembreteMinutos: 60 * 24, // 1 dia antes
  });
}

module.exports = {
  criarEvento,
  criarEventoPlantao,
  criarLembreteBoleto,
  listarEventos,
  cancelarEvento,
};
