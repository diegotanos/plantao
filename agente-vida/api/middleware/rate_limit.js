'use strict';

const rateLimit = require('express-rate-limit');
const logger = require('../logger');

/**
 * Rate limiter para webhooks — evita abuso e loops de mensagens.
 * 60 requisições por minuto por IP.
 */
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    logger.warn('Rate limit atingido', { ip: req.ip, path: req.path });
    res.status(429).json({ error: 'Too many requests' });
  },
});

module.exports = { webhookRateLimit };
