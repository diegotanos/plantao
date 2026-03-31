'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getOAuthClient, googleConfigurado } = require('./google_auth');
const logger = require('../api/logger');

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDrive() {
  return google.drive({ version: 'v3', auth: getOAuthClient() });
}

/**
 * Detecta o mimeType pelo caminho/extensão do arquivo.
 * @param {string} caminhoArquivo
 * @returns {string}
 */
function detectarMimeType(caminhoArquivo) {
  const ext = path.extname(caminhoArquivo).toLowerCase();
  const mimes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
  };
  return mimes[ext] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Operações do Google Drive
// ---------------------------------------------------------------------------

/**
 * Faz upload de um arquivo para o Google Drive.
 * @param {object} params
 * @param {string} params.caminhoLocal     - caminho local do arquivo
 * @param {string} params.nomeArquivo      - nome no Drive
 * @param {string} [params.mimeType]       - auto-detectado se omitido
 * @param {string} [params.pastaId]        - ID da pasta destino
 * @returns {Promise<{ id: string, webViewLink: string, webContentLink: string }>}
 */
async function uploadArquivo({ caminhoLocal, nomeArquivo, mimeType, pastaId }) {
  if (!googleConfigurado()) {
    logger.warn('Google Drive não configurado — upload ignorado');
    return null;
  }

  const drive = getDrive();
  const mime = mimeType ?? detectarMimeType(caminhoLocal);
  const pasta = pastaId ?? DRIVE_FOLDER_ID;

  const metadata = {
    name: nomeArquivo,
    ...(pasta && { parents: [pasta] }),
  };

  try {
    const response = await drive.files.create({
      resource: metadata,
      media: {
        mimeType: mime,
        body: fs.createReadStream(caminhoLocal),
      },
      fields: 'id,webViewLink,webContentLink',
    });

    logger.info('Arquivo enviado ao Drive', {
      nome: nomeArquivo,
      id: response.data.id,
    });

    return {
      id: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (err) {
    logger.error('Erro no upload para Drive', { error: err.message, nomeArquivo });
    throw err;
  }
}

/**
 * Faz upload de um buffer de imagem diretamente (sem salvar em disco).
 * @param {object} params
 * @param {Buffer} params.buffer
 * @param {string} params.nomeArquivo
 * @param {string} [params.mimeType]
 * @param {string} [params.pastaId]
 * @returns {Promise<{ id: string, webViewLink: string }>}
 */
async function uploadBuffer({ buffer, nomeArquivo, mimeType = 'image/jpeg', pastaId }) {
  if (!googleConfigurado()) return null;

  const drive = getDrive();
  const pasta = pastaId ?? DRIVE_FOLDER_ID;

  const { Readable } = require('stream');
  const stream = Readable.from(buffer);

  try {
    const response = await drive.files.create({
      resource: {
        name: nomeArquivo,
        ...(pasta && { parents: [pasta] }),
      },
      media: { mimeType, body: stream },
      fields: 'id,webViewLink',
    });

    return {
      id: response.data.id,
      webViewLink: response.data.webViewLink,
    };
  } catch (err) {
    logger.error('Erro no upload de buffer para Drive', { error: err.message });
    throw err;
  }
}

/**
 * Gera nome de arquivo padronizado para comprovantes.
 * @param {string} tipo        - "nf" | "boleto" | "comprovante"
 * @param {string} descricao   - nome do estabelecimento ou descrição
 * @param {string} [data]      - "YYYY-MM-DD"
 * @returns {string}
 */
function gerarNomeArquivo(tipo, descricao, data) {
  const hoje = data ?? new Date().toISOString().split('T')[0];
  const descSanitizada = descricao
    .replace(/[^a-zA-Z0-9À-ú\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return `${tipo}_${hoje}_${descSanitizada}.jpg`;
}

module.exports = {
  uploadArquivo,
  uploadBuffer,
  gerarNomeArquivo,
};
