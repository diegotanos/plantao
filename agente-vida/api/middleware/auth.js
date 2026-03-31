'use strict';

const logger = require('../logger');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

/**
 * Middleware de autenticação de webhooks.
 * Valida o header X-Webhook-Secret se WEBHOOK_SECRET estiver configurado.
 */
function webhookAuth(req, res, next) {
  if (!WEBHOOK_SECRET) {
    // Sem segredo configurado — permitir (apenas em desenvolvimento)
    return next();
  }

  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== WEBHOOK_SECRET) {
    logger.warn('Requisição de webhook rejeitada — segredo inválido', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { webhookAuth };
