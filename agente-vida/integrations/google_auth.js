'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');
const logger = require('../api/logger');

// ---------------------------------------------------------------------------
// Cliente OAuth2 unificado para todas as APIs Google
// ---------------------------------------------------------------------------

let _oauthClient = null;

/**
 * Retorna o cliente OAuth2 autenticado (singleton).
 * Usa o refresh_token para obter access_token automaticamente.
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
function getOAuthClient() {
  if (_oauthClient) return _oauthClient;

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN são obrigatórios.'
    );
  }

  _oauthClient = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'  // redirect URI para apps de servidor
  );

  _oauthClient.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

  // Atualiza o access_token automaticamente antes de expirar
  _oauthClient.on('tokens', (tokens) => {
    if (tokens.access_token) {
      logger.debug('Google OAuth: access_token renovado');
    }
  });

  return _oauthClient;
}

/**
 * Verifica se as credenciais Google estão configuradas.
 * @returns {boolean}
 */
function googleConfigurado() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

module.exports = { getOAuthClient, googleConfigurado };
