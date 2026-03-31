'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const logger = require('../api/logger');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID
  ? parseInt(process.env.TELEGRAM_ALLOWED_USER_ID, 10)
  : null;

if (!TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN é obrigatório. Verifique o .env.');
}

// ---------------------------------------------------------------------------
// Inicialização do bot
// ---------------------------------------------------------------------------

// Em produção: usa webhook. Em desenvolvimento: usa polling.
const isProd = process.env.NODE_ENV === 'production';

const bot = new TelegramBot(TOKEN, {
  polling: !isProd,    // polling apenas em dev
  webHook: isProd,     // webhook apenas em prod
});

if (isProd && WEBHOOK_URL) {
  bot.setWebHook(`${WEBHOOK_URL}/webhooks/telegram`)
    .then(() => logger.info('Webhook Telegram configurado', { url: WEBHOOK_URL }))
    .catch((err) => logger.error('Erro ao configurar webhook', { error: err.message }));
}

// ---------------------------------------------------------------------------
// Segurança: whitelist de usuários autorizados
// ---------------------------------------------------------------------------

/**
 * Verifica se o usuário está autorizado a usar o agente.
 * @param {number} telegramUserId
 * @returns {boolean}
 */
function isAutorizado(telegramUserId) {
  if (!ALLOWED_USER_ID) return true; // sem restrição se não configurado
  return telegramUserId === ALLOWED_USER_ID;
}

// ---------------------------------------------------------------------------
// Envio de mensagens
// ---------------------------------------------------------------------------

/**
 * Envia uma mensagem de texto para um chat do Telegram.
 * Suporta Markdown (MarkdownV2 escapado automaticamente).
 *
 * @param {number|string} chatId
 * @param {string} texto
 * @param {object} [opcoes]
 * @returns {Promise<object>}
 */
async function enviarMensagem(chatId, texto, opcoes = {}) {
  try {
    return await bot.sendMessage(chatId, texto, {
      parse_mode: 'Markdown',
      ...opcoes,
    });
  } catch (err) {
    logger.error('Erro ao enviar mensagem Telegram', {
      chatId,
      error: err.message,
    });
    // Tenta enviar sem formatação em caso de erro de Markdown
    try {
      return await bot.sendMessage(chatId, texto.replace(/[*_`]/g, ''));
    } catch (err2) {
      logger.error('Falha no fallback de envio', { error: err2.message });
      throw err2;
    }
  }
}

/**
 * Envia um indicador de "digitando..." para feedback visual.
 * @param {number|string} chatId
 */
async function enviarDigitando(chatId) {
  try {
    await bot.sendChatAction(chatId, 'typing');
  } catch {
    // Não crítico — ignora silenciosamente
  }
}

/**
 * Envia uma mensagem com botões inline (teclado inline).
 * @param {number|string} chatId
 * @param {string} texto
 * @param {Array<Array<{ text: string, callback_data: string }>>} botoes
 * @returns {Promise<object>}
 */
async function enviarComBotoes(chatId, texto, botoes) {
  return bot.sendMessage(chatId, texto, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: botoes,
    },
  });
}

/**
 * Envia botões de confirmação (Sim / Não).
 * @param {number|string} chatId
 * @param {string} pergunta
 * @param {string} callbackPrefix - prefixo para identificar a ação
 * @returns {Promise<object>}
 */
async function enviarConfirmacao(chatId, pergunta, callbackPrefix) {
  return enviarComBotoes(chatId, pergunta, [
    [
      { text: '✅ Sim', callback_data: `${callbackPrefix}:sim` },
      { text: '❌ Não', callback_data: `${callbackPrefix}:nao` },
    ],
  ]);
}

// ---------------------------------------------------------------------------
// Download de arquivos (áudio e imagens)
// ---------------------------------------------------------------------------

/**
 * Faz download de um arquivo do Telegram e salva localmente.
 * @param {string} fileId - ID do arquivo no Telegram
 * @param {string} [extensao='bin'] - extensão do arquivo
 * @returns {Promise<string>} - caminho local do arquivo baixado
 */
async function baixarArquivo(fileId, extensao = 'bin') {
  const fileInfo = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.file_path}`;

  const destino = path.join(os.tmpdir(), `tg_${fileId}.${extensao}`);
  const writer = fs.createWriteStream(destino);

  const response = await axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  });

  await new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  logger.debug('Arquivo baixado', { fileId, destino });
  return destino;
}

/**
 * Faz download de uma foto do Telegram (maior resolução disponível).
 * @param {object[]} photos - array de PhotoSize do Telegram
 * @returns {Promise<string>} - caminho local do arquivo
 */
async function baixarFoto(photos) {
  // Pega a foto de maior resolução
  const maiorFoto = photos.reduce((max, foto) =>
    (foto.file_size ?? 0) > (max.file_size ?? 0) ? foto : max
  );
  return baixarArquivo(maiorFoto.file_id, 'jpg');
}

/**
 * Converte imagem local para base64.
 * @param {string} caminhoArquivo
 * @returns {string}
 */
function imagemParaBase64(caminhoArquivo) {
  const buffer = fs.readFileSync(caminhoArquivo);
  return buffer.toString('base64');
}

/**
 * Remove arquivo temporário após processamento.
 * @param {string} caminho
 */
function limparArquivoTemp(caminho) {
  try {
    fs.unlinkSync(caminho);
  } catch {
    // Não crítico
  }
}

// ---------------------------------------------------------------------------
// Extração de metadados da mensagem
// ---------------------------------------------------------------------------

/**
 * Extrai informações relevantes de uma mensagem do Telegram.
 * @param {object} msg - objeto de mensagem do Telegram
 * @returns {{ tipo: string, chatId: number, userId: number, nome: string, conteudo: any }}
 */
function extrairMensagem(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const nome = msg.from?.first_name ?? 'Usuário';

  if (msg.text) {
    return { tipo: 'texto', chatId, userId, nome, conteudo: msg.text };
  }

  if (msg.voice || msg.audio) {
    const audio = msg.voice ?? msg.audio;
    return { tipo: 'audio', chatId, userId, nome, conteudo: audio };
  }

  if (msg.photo) {
    return { tipo: 'foto', chatId, userId, nome, conteudo: msg.photo };
  }

  if (msg.document) {
    return { tipo: 'documento', chatId, userId, nome, conteudo: msg.document };
  }

  return { tipo: 'desconhecido', chatId, userId, nome, conteudo: null };
}

// ---------------------------------------------------------------------------
// Acesso ao bot (para uso no webhook do Express)
// ---------------------------------------------------------------------------

/**
 * Processa uma atualização recebida via webhook.
 * @param {object} update - objeto Update do Telegram
 */
function processarWebhook(update) {
  bot.processUpdate(update);
}

module.exports = {
  bot,
  isAutorizado,
  enviarMensagem,
  enviarDigitando,
  enviarComBotoes,
  enviarConfirmacao,
  baixarArquivo,
  baixarFoto,
  imagemParaBase64,
  limparArquivoTemp,
  extrairMensagem,
  processarWebhook,
};
