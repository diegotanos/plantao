'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const router = express.Router();

const { buscarGastosPeriodo, buscarReceitasPeriodo, buscarPlantoesPeriodo } = require('../../database/supabase_client');
const { listarEventos } = require('../../integrations/google_calendar');
const { gerarResposta } = require('../../integrations/openai');
const { enviarMensagem } = require('../../integrations/telegram');
const { getUserIdByTelegramId } = require('../../database/supabase_client');
const logger = require('../logger');

const TELEGRAM_ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID;

// ---------------------------------------------------------------------------
// POST /internal/resumo-diario — disparado pelo cron das 20h (n8n)
// ---------------------------------------------------------------------------

router.post('/resumo-diario', async (req, res) => {
  try {
    if (!TELEGRAM_ALLOWED_USER_ID) {
      return res.status(400).json({ error: 'TELEGRAM_ALLOWED_USER_ID não configurado' });
    }

    const userId = await getUserIdByTelegramId(TELEGRAM_ALLOWED_USER_ID);
    if (!userId) {
      logger.warn('Resumo diário: usuário não encontrado');
      return res.json({ success: false, motivo: 'usuario_nao_encontrado' });
    }

    const hoje = new Date().toISOString().split('T')[0];
    const [gastos, receitas, plantoes] = await Promise.all([
      buscarGastosPeriodo(userId, hoje, hoje),
      buscarReceitasPeriodo(userId, hoje, hoje),
      buscarPlantoesPeriodo(userId, hoje, hoje),
    ]);

    const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0);
    const totalReceitas = receitas.reduce((s, r) => s + Number(r.valor), 0);

    // Gera resumo inteligente com GPT-4o
    const contexto = `
Data: ${hoje}
Gastos do dia (${gastos.length}): ${JSON.stringify(gastos.map((g) => ({ valor: g.valor, categoria: g.categoria, descricao: g.descricao })))}
Receitas do dia (${receitas.length}): ${JSON.stringify(receitas.map((r) => ({ valor: r.valor, tipo: r.tipo })))}
Plantões do dia (${plantoes.length}): ${JSON.stringify(plantoes.map((p) => ({ local: p.local, data_inicio: p.data_inicio, valor: p.valor_combinado })))}
`.trim();

    const prompt = `Gere um resumo diário conciso e amigável em português para um médico.
Máximo 150 palavras. Use emojis discretos. Destaque o balanço do dia (receitas - gastos).
Se não houve movimentação, diga isso de forma positiva.
Contexto: ${contexto}`;

    const resumo = await gerarResposta(
      [{ role: 'user', content: prompt }],
      'Você é um assistente pessoal que gera resumos diários.'
    );

    const mensagem = `📊 *Resumo do dia — ${formatarDataBR(hoje)}*\n\n${resumo}`;
    await enviarMensagem(TELEGRAM_ALLOWED_USER_ID, mensagem);

    logger.info('Resumo diário enviado', { userId, gastos: gastos.length, receitas: receitas.length });
    res.json({ success: true, gastos: gastos.length, receitas: receitas.length });
  } catch (err) {
    logger.error('Erro no resumo diário', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /internal/agenda-manha — disparado pelo cron das 7h (n8n)
// ---------------------------------------------------------------------------

router.post('/agenda-manha', async (req, res) => {
  try {
    if (!TELEGRAM_ALLOWED_USER_ID) {
      return res.status(400).json({ error: 'TELEGRAM_ALLOWED_USER_ID não configurado' });
    }

    const userId = await getUserIdByTelegramId(TELEGRAM_ALLOWED_USER_ID);
    if (!userId) {
      return res.json({ success: false, motivo: 'usuario_nao_encontrado' });
    }

    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // Busca plantões e eventos do Calendar para hoje
    const [plantoes, eventosCalendar] = await Promise.all([
      buscarPlantoesPeriodo(userId, hoje, hoje),
      listarEventos(
        `${hoje}T00:00:00-03:00`,
        `${hoje}T23:59:59-03:00`,
        20
      ).catch(() => []),
    ]);

    const contexto = `
Data de hoje: ${hoje}
Dia da semana: ${diaSemana(new Date())}
Plantões hoje (${plantoes.length}): ${JSON.stringify(plantoes.map((p) => ({ local: p.local, inicio: p.data_inicio, fim: p.data_fim, valor: p.valor_combinado })))}
Eventos no Calendar hoje (${eventosCalendar.length}): ${JSON.stringify(eventosCalendar.map((e) => ({ titulo: e.summary, inicio: e.start?.dateTime ?? e.start?.date })))}
`.trim();

    const prompt = `Gere uma mensagem de bom dia com a agenda do dia para um médico.
Máximo 120 palavras. Tom motivador mas direto. Liste os compromissos de forma clara.
Se não houver compromissos, incentive o dia livre.
Contexto: ${contexto}`;

    const agendaMensagem = await gerarResposta(
      [{ role: 'user', content: prompt }],
      'Você é um assistente pessoal que envia alertas de agenda matinal.'
    );

    const mensagem = `🌅 *Bom dia!*\n\n${agendaMensagem}`;
    await enviarMensagem(TELEGRAM_ALLOWED_USER_ID, mensagem);

    logger.info('Agenda matinal enviada', { userId, plantoes: plantoes.length });
    res.json({ success: true, plantoes: plantoes.length, eventos: eventosCalendar.length });
  } catch (err) {
    logger.error('Erro na agenda matinal', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarDataBR(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function diaSemana(data) {
  return ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
    'quinta-feira', 'sexta-feira', 'sábado'][data.getDay()];
}

module.exports = router;
