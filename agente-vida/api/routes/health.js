'use strict';

const express = require('express');
const router = express.Router();
const { redis } = require('../../database/redis_client');
const { supabase } = require('../../database/supabase_client');
const logger = require('../logger');

/**
 * GET /health
 * Verifica o status dos serviços críticos.
 */
router.get('/', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Verifica Redis
  try {
    await redis.ping();
    checks.services.redis = 'ok';
  } catch (err) {
    checks.services.redis = 'error';
    checks.status = 'degraded';
    logger.error('Health check Redis falhou', { error: err.message });
  }

  // Verifica Supabase (query simples)
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    checks.services.supabase = error ? 'error' : 'ok';
    if (error) {
      checks.status = 'degraded';
      logger.error('Health check Supabase falhou', { error: error.message });
    }
  } catch (err) {
    checks.services.supabase = 'error';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(checks);
});

module.exports = router;
