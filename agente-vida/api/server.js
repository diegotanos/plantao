'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const logger = require('./logger');

const { webhookAuth } = require('./middleware/auth');
const { webhookRateLimit } = require('./middleware/rate_limit');

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ---------------------------------------------------------------------------
// Inicialização do app Express
// ---------------------------------------------------------------------------

const app = express();

// Parse JSON para webhooks
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Log de todas as requisições
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

// Health check — sem autenticação
app.use('/health', require('./routes/health'));

// Webhooks — com rate limit e autenticação de segredo
app.use('/webhooks', webhookRateLimit);
app.use('/webhooks/telegram', webhookAuth, require('./routes/telegram'));
app.use('/webhooks/gmail', webhookAuth, require('./routes/gmail'));

// Rotas internas (crons do n8n — protegidas pelo mesmo segredo)
app.use('/internal', webhookAuth, require('./routes/internal'));

// Rota padrão
app.get('/', (req, res) => {
  res.json({
    app: 'Agente Vida',
    version: '1.0.0',
    status: 'running',
    env: NODE_ENV,
  });
});

// ---------------------------------------------------------------------------
// Error handler global
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Erro não tratado no Express', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ---------------------------------------------------------------------------
// Inicialização do servidor
// ---------------------------------------------------------------------------

const server = app.listen(PORT, () => {
  logger.info(`Agente Vida iniciado`, {
    porta: PORT,
    ambiente: NODE_ENV,
    modo: NODE_ENV === 'production' ? 'webhook' : 'polling',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido — encerrando servidor...');
  server.close(() => {
    logger.info('Servidor encerrado.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejeitada não tratada', { reason: String(reason) });
});

module.exports = app;
