'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const router = express.Router();

const { processarNovosEmails } = require('../../integrations/gmail');
const { criarLembreteBoleto } = require('../../integrations/google_calendar');
const { salvarGasto, salvarConversa } = require('../../database/supabase_client');
const { registrarGasto: sheetsGasto } = require('../../integrations/google_sheets');
const { enviarMensagem } = require('../../integrations/telegram');
const logger = require('../logger');

const TELEGRAM_ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID;

// ---------------------------------------------------------------------------
// POST /webhooks/gmail/push
// Recebe notificações do Gmail Pub/Sub (Cloud Push)
// ---------------------------------------------------------------------------

router.post('/push', async (req, res) => {
  // Responde imediatamente ao Google (evita reenvio)
  res.sendStatus(200);

  try {
    // Extrai o payload da mensagem Pub/Sub
    const data = req.body?.message?.data;
    if (!data) return;

    // Decodifica o payload base64
    const decoded = Buffer.from(data, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    logger.info('Gmail Pub/Sub recebido', { emailAddress: payload.emailAddress });

    // Processa os e-mails não lidos
    await processarEmailsENotificar();
  } catch (err) {
    logger.error('Erro no handler Gmail Pub/Sub', { error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /webhooks/gmail/poll
// Endpoint manual para acionar o processamento de e-mails (polling)
// Útil para usar com cron do n8n ou chamada manual
// ---------------------------------------------------------------------------

router.post('/poll', async (req, res) => {
  try {
    const resultados = await processarEmailsENotificar();
    res.json({
      processados: resultados.length,
      itens: resultados.map((r) => ({
        tipo: r.classificacao.tipo,
        assunto: r.email.assunto,
        resumo: r.classificacao.resumo,
      })),
    });
  } catch (err) {
    logger.error('Erro no poll de Gmail', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Lógica de processamento e notificação
// ---------------------------------------------------------------------------

/**
 * Processa os e-mails não lidos e executa as ações correspondentes.
 * @returns {Promise<Array>}
 */
async function processarEmailsENotificar() {
  const emailsRelevantes = await processarNovosEmails(15);

  for (const { email, classificacao } of emailsRelevantes) {
    try {
      await processarEmailClassificado(email, classificacao);
    } catch (err) {
      logger.error('Erro ao processar e-mail classificado', {
        assunto: email.assunto,
        error: err.message,
      });
    }
  }

  return emailsRelevantes;
}

/**
 * Executa a ação para um e-mail classificado.
 * @param {object} email
 * @param {object} classificacao
 */
async function processarEmailClassificado(email, classificacao) {
  const chatId = TELEGRAM_ALLOWED_USER_ID;
  if (!chatId) return;

  switch (classificacao.tipo) {
    case 'boleto': {
      const { valor, data_vencimento, beneficiario } = classificacao.dados;

      // Cria lembrete no Calendar
      if (valor && data_vencimento) {
        const evento = await criarLembreteBoleto({
          descricao: beneficiario ?? email.assunto,
          valor,
          dataVencimento: data_vencimento,
        }).catch((e) => {
          logger.warn('Falha ao criar lembrete de boleto', { error: e.message });
          return null;
        });

        const aviso =
          `📄 *Boleto detectado no e-mail!*\n` +
          `🏢 ${beneficiario ?? 'Beneficiário não identificado'}\n` +
          `💵 R$ ${Number(valor).toFixed(2)}\n` +
          `📅 Vencimento: ${formatarDataBR(data_vencimento)}\n` +
          (evento ? `\n⏰ Lembrete adicionado ao Calendar.` : '');

        await enviarMensagem(chatId, aviso);
      } else {
        await enviarMensagem(
          chatId,
          `📄 *Boleto identificado:* "${email.assunto}"\n_Não consegui extrair valor/vencimento. Verifique manualmente._`
        );
      }
      break;
    }

    case 'nfe': {
      const { valor_total, data_emissao, emitente } = classificacao.dados;

      if (valor_total) {
        // Registra automaticamente como gasto
        const gastoData = {
          user_id: null, // será preenchido quando tivermos multi-usuário
          valor: valor_total,
          categoria: 'outros',
          descricao: emitente ?? 'Nota Fiscal',
          data: data_emissao ?? new Date().toISOString().split('T')[0],
          fonte: 'gmail',
        };

        // Por enquanto, apenas notifica para confirmação manual
        const aviso =
          `🧾 *NFe recebida por e-mail!*\n` +
          `🏪 ${emitente ?? 'Emitente não identificado'}\n` +
          `💵 R$ ${Number(valor_total).toFixed(2)}\n` +
          `📅 ${formatarDataBR(data_emissao)}\n\n` +
          `_Responda_ *"registrar nfe"* _para salvar como gasto._`;

        await enviarMensagem(chatId, aviso);
      }
      break;
    }

    case 'honorario': {
      const { valor, descricao, periodo } = classificacao.dados;

      const aviso =
        `💊 *Honorário detectado!*\n` +
        `${descricao ?? email.assunto}\n` +
        (valor ? `💵 R$ ${Number(valor).toFixed(2)}\n` : '') +
        (periodo ? `📅 ${periodo}\n` : '') +
        `\n_Responda_ *"recebi honorário X"* _para registrar._`;

      await enviarMensagem(chatId, aviso);
      break;
    }

    default:
      // Outros tipos relevantes: apenas loga, sem notificação
      logger.info('E-mail relevante sem ação automática', {
        tipo: classificacao.tipo,
        assunto: email.assunto,
      });
  }

  // Salva o evento de conversa para histórico
  await salvarConversa({
    user_id: null,
    canal: 'gmail',
    mensagem_usuario: `[EMAIL] ${email.assunto}`,
    resposta_agente: classificacao.resumo,
    intencao: `email_${classificacao.tipo}`,
    dados_json: classificacao,
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function formatarDataBR(dataIso) {
  if (!dataIso) return '?';
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

module.exports = router;
