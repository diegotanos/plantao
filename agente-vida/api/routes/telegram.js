'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const router = express.Router();

const {
  processarWebhook,
  isAutorizado,
  enviarMensagem,
  enviarDigitando,
  enviarConfirmacao,
  baixarArquivo,
  baixarFoto,
  imagemParaBase64,
  limparArquivoTemp,
  extrairMensagem,
} = require('../../integrations/telegram');

const { transcreverAudio, extrairDadosNF } = require('../../integrations/openai');
const { classificar } = require('../../agent/intent_classifier');
const { registrarTroca, detectarEsalvarPadrao } = require('../../agent/memory_manager');
const {
  upsertUserByTelegramId,
  salvarGasto,
  salvarReceita,
  salvarPlantao,
  salvarCompromisso,
  buscarGastosPeriodo,
  buscarReceitasPeriodo,
  buscarPlantoesPeriodo,
  salvarConversa,
  obterOuCriarLista,
  adicionarItemLista,
  listarItensPendentes,
} = require('../../database/supabase_client');
const {
  definirEstado,
  obterEstado,
  limparEstado,
  verificarRateLimit,
} = require('../../database/redis_client');
const {
  formatarConfirmacaoGasto,
  formatarConfirmacaoReceita,
  formatarConfirmacaoPlantao,
  formatarConfirmacaoCompromisso,
  formatarLista,
  formatarResumoFinanceiro,
  formatarAgenda,
  formatarPedidoConfirmacao,
} = require('../../agent/response_formatter');
const { INTENCOES, MENSAGENS } = require('../../config/constants');
const logger = require('../logger');

// ---------------------------------------------------------------------------
// POST /webhooks/telegram — recebe atualizações do Telegram
// ---------------------------------------------------------------------------

router.post('/', (req, res) => {
  // Responde imediatamente ao Telegram (evita timeout de 5s)
  res.sendStatus(200);

  // Processa de forma assíncrona
  processarWebhook(req.body);
});

// ---------------------------------------------------------------------------
// Handler principal de mensagens de texto
// ---------------------------------------------------------------------------

async function handleMensagemTexto(msg) {
  const { chatId, userId: telegramId, nome, conteudo: texto } = extrairMensagem(msg);
  const inicio = Date.now();

  try {
    // Verifica autorização
    if (!isAutorizado(telegramId)) {
      logger.warn('Usuário não autorizado tentou usar o agente', { telegramId });
      return;
    }

    // Rate limit por usuário
    const permitido = await verificarRateLimit(String(telegramId));
    if (!permitido) {
      await enviarMensagem(chatId, 'Calma aí! Muitas mensagens em pouco tempo. Aguarda um minuto.');
      return;
    }

    // Verifica se é um comando especial
    if (texto.startsWith('/')) {
      return handleComando(chatId, telegramId, texto, nome);
    }

    // Verifica se há estado pendente (ex: aguardando confirmação)
    const estadoPendente = await obterEstado(String(telegramId));
    if (estadoPendente) {
      return handleRespostaConfirmacao(chatId, telegramId, texto, estadoPendente);
    }

    // Indica que está processando
    await enviarDigitando(chatId);

    // Busca ou cria usuário no Supabase
    const usuario = await upsertUserByTelegramId({ telegramId: String(telegramId), nome });

    // Classifica a intenção
    const resultado = await classificar({
      mensagem: texto,
      userId: usuario.id,
    });

    // Executa a ação correspondente
    const resposta = await executarAcao(resultado, usuario.id, chatId, telegramId);

    // Registra a conversa no histórico
    const duracao = Date.now() - inicio;
    await Promise.all([
      registrarTroca(usuario.id, texto, resultado.resposta_usuario),
      salvarConversa({
        user_id: usuario.id,
        canal: 'telegram',
        mensagem_usuario: texto,
        resposta_agente: resultado.resposta_usuario,
        intencao: resultado.intencao,
        confianca: resultado.confianca,
        dados_json: resultado,
        duracao_ms: duracao,
      }),
    ]);

    // Detecta padrões para memória de longo prazo
    await detectarEsalvarPadrao(usuario.id, resultado.dados, resultado.intencao);

  } catch (err) {
    logger.error('Erro no handler de mensagem', {
      telegramId,
      error: err.message,
      stack: err.stack,
    });
    await enviarMensagem(chatId, MENSAGENS.ERRO_GENERICO);
  }
}

// ---------------------------------------------------------------------------
// Handler de mensagens de áudio
// ---------------------------------------------------------------------------

async function handleMensagemAudio(msg) {
  const { chatId, userId: telegramId, nome } = extrairMensagem(msg);
  const audio = msg.voice ?? msg.audio;

  try {
    if (!isAutorizado(telegramId)) return;

    await enviarDigitando(chatId);

    // Baixa o arquivo de áudio
    const caminhoAudio = await baixarArquivo(audio.file_id, 'ogg');

    let textoTranscrito;
    try {
      textoTranscrito = await transcreverAudio(caminhoAudio);
    } finally {
      limparArquivoTemp(caminhoAudio);
    }

    if (!textoTranscrito || textoTranscrito.trim().length === 0) {
      await enviarMensagem(chatId, 'Não consegui entender o áudio. Pode repetir ou mandar por texto?');
      return;
    }

    logger.info('Áudio transcrito', { telegramId, texto: textoTranscrito.slice(0, 100) });

    // Processa o texto transcrito como mensagem normal
    await handleMensagemTexto({
      ...msg,
      text: textoTranscrito,
      voice: undefined,
      audio: undefined,
    });

  } catch (err) {
    logger.error('Erro no handler de áudio', { telegramId, error: err.message });
    await enviarMensagem(chatId, MENSAGENS.ERRO_GENERICO);
  }
}

// ---------------------------------------------------------------------------
// Handler de fotos (notas fiscais)
// ---------------------------------------------------------------------------

async function handleFoto(msg) {
  const { chatId, userId: telegramId, nome, conteudo: photos } = extrairMensagem(msg);

  try {
    if (!isAutorizado(telegramId)) return;

    await enviarMensagem(chatId, '📷 Processando a imagem...');
    await enviarDigitando(chatId);

    // Baixa a foto
    const caminhoFoto = await baixarFoto(photos);

    let dadosNF;
    try {
      const base64 = imagemParaBase64(caminhoFoto);
      dadosNF = await extrairDadosNF(base64, 'image/jpeg');
    } finally {
      limparArquivoTemp(caminhoFoto);
    }

    if (!dadosNF.valor_total) {
      await enviarMensagem(chatId, 'Não consegui extrair o valor da imagem. É uma nota fiscal ou cupom? Tenta uma foto mais nítida.');
      return;
    }

    // Busca ou cria usuário
    const usuario = await upsertUserByTelegramId({ telegramId: String(telegramId), nome });

    // Formata para confirmação
    const resumo =
      `*Dados extraídos da nota:*\n` +
      `💵 Valor: R$ ${dadosNF.valor_total.toFixed(2)}\n` +
      `🏪 ${dadosNF.estabelecimento ?? 'Estabelecimento não identificado'}\n` +
      `📅 ${dadosNF.data ?? 'Data não identificada'}\n` +
      `🏷️ Categoria sugerida: ${dadosNF.categoria_sugerida ?? 'outros'}`;

    // Salva estado de confirmação
    await definirEstado(String(telegramId), {
      acao: 'confirmar_gasto_nf',
      dados: {
        valor: dadosNF.valor_total,
        categoria: dadosNF.categoria_sugerida ?? 'outros',
        descricao: dadosNF.estabelecimento ?? 'Nota fiscal',
        data: dadosNF.data ?? new Date().toISOString().split('T')[0],
        fonte: 'foto_nfe',
        user_id: usuario.id,
      },
    });

    await enviarConfirmacao(chatId, resumo + '\n\nRegistrar esse gasto?', 'nf');

  } catch (err) {
    logger.error('Erro no handler de foto', { telegramId, error: err.message });
    await enviarMensagem(chatId, MENSAGENS.ERRO_GENERICO);
  }
}

// ---------------------------------------------------------------------------
// Executa a ação com base na intenção classificada
// ---------------------------------------------------------------------------

async function executarAcao(resultado, userId, chatId, telegramId) {
  const { intencao, dados, resposta_usuario, precisa_confirmacao, acao_requerida } = resultado;

  // Se precisa de confirmação, salva estado e pede ao usuário
  if (precisa_confirmacao && intencao !== INTENCOES.DESCONHECIDO) {
    await definirEstado(String(telegramId), {
      acao: intencao,
      dados: { ...dados, user_id: userId },
    });

    const descricaoAcao = gerarDescricaoAcao(intencao, dados);
    const pergunta = formatarPedidoConfirmacao(descricaoAcao);
    await enviarConfirmacao(chatId, pergunta, `acao_${intencao}`);
    return;
  }

  try {
    switch (intencao) {
      case INTENCOES.REGISTRAR_GASTO:
        await salvarGasto({ ...dados, user_id: userId });
        await enviarMensagem(chatId, resposta_usuario);
        break;

      case INTENCOES.REGISTRAR_RECEITA:
        await salvarReceita({ ...dados, user_id: userId });
        await enviarMensagem(chatId, resposta_usuario);
        break;

      case INTENCOES.REGISTRAR_PLANTAO:
        await salvarPlantao({ ...dados, user_id: userId });
        await enviarMensagem(chatId, resposta_usuario);
        // TODO Fase 2: criar evento no Google Calendar
        break;

      case INTENCOES.CRIAR_COMPROMISSO:
        await salvarCompromisso({ ...dados, user_id: userId });
        await enviarMensagem(chatId, resposta_usuario);
        // TODO Fase 2: criar evento no Google Calendar
        break;

      case INTENCOES.CONSULTAR_SALDO:
      case INTENCOES.RESUMO_FINANCEIRO: {
        const { dataInicio, dataFim } = calcularPeriodo(dados.periodo);
        const [gastos, receitas] = await Promise.all([
          buscarGastosPeriodo(userId, dataInicio, dataFim),
          buscarReceitasPeriodo(userId, dataInicio, dataFim),
        ]);
        const periodoDesc = formatarNomePeriodo(dados.periodo);
        const resumo = formatarResumoFinanceiro(gastos, receitas, periodoDesc);
        await enviarMensagem(chatId, resumo);
        break;
      }

      case INTENCOES.CONSULTAR_AGENDA:
      case INTENCOES.RESUMO_AGENDA: {
        const { dataInicio, dataFim } = calcularPeriodo(dados.periodo ?? 'semana');
        const plantoes = await buscarPlantoesPeriodo(userId, dataInicio, dataFim);
        const periodoDesc = formatarNomePeriodo(dados.periodo ?? 'semana');
        const agenda = formatarAgenda(plantoes, [], periodoDesc);
        await enviarMensagem(chatId, agenda);
        break;
      }

      case INTENCOES.ADICIONAR_ITEM: {
        const tipoLista = dados.tipo_lista ?? 'geral';
        const lista = await obterOuCriarLista(userId, tipoLista);
        const itensAdicionados = [];
        for (const item of (dados.itens ?? [])) {
          const itemSalvo = await adicionarItemLista({
            lista_id: lista.id,
            descricao: item.descricao,
            quantidade: item.quantidade ?? 1,
            unidade: item.unidade ?? null,
          });
          itensAdicionados.push(itemSalvo);
        }
        await enviarMensagem(chatId, resposta_usuario);
        break;
      }

      case INTENCOES.VER_LISTA: {
        const tipoLista = dados.tipo_lista ?? 'geral';
        const lista = await obterOuCriarLista(userId, tipoLista);
        const itens = await listarItensPendentes(lista.id);
        const textoLista = formatarLista(itens, lista.nome);
        await enviarMensagem(chatId, textoLista);
        break;
      }

      case INTENCOES.AJUDA:
        await enviarMensagem(chatId, MENSAGENS.AJUDA);
        break;

      case INTENCOES.DESCONHECIDO:
      default:
        await enviarMensagem(chatId, resposta_usuario || 'Não entendi. Pode reformular?');
        break;
    }
  } catch (err) {
    logger.error('Erro ao executar ação', { intencao, userId, error: err.message });
    await enviarMensagem(chatId, 'Entendi o que você quer, mas tive um problema ao salvar. Tenta de novo?');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Handler de respostas de confirmação (texto: "sim" / "não")
// ---------------------------------------------------------------------------

async function handleRespostaConfirmacao(chatId, telegramId, texto, estado) {
  const resposta = texto.toLowerCase().trim();
  const confirmou = ['sim', 's', 'yes', 'y', 'confirma', 'confirmar', 'ok'].includes(resposta);
  const cancelou = ['não', 'nao', 'n', 'no', 'cancela', 'cancelar'].includes(resposta);

  if (!confirmou && !cancelou) {
    // Resposta ambígua — mantém estado e pede novamente
    await enviarMensagem(chatId, 'Responde *sim* para confirmar ou *não* para cancelar.');
    return;
  }

  await limparEstado(String(telegramId));

  if (cancelou) {
    await enviarMensagem(chatId, 'Cancelado! ✋ Pode mandar outra mensagem quando quiser.');
    return;
  }

  // Executa a ação confirmada
  try {
    const { acao, dados } = estado;

    switch (acao) {
      case 'confirmar_gasto_nf':
      case INTENCOES.REGISTRAR_GASTO:
        await salvarGasto(dados);
        await enviarMensagem(chatId, `✅ Gasto de R$ ${Number(dados.valor).toFixed(2)} registrado!`);
        break;

      case INTENCOES.REGISTRAR_RECEITA:
        await salvarReceita(dados);
        await enviarMensagem(chatId, `✅ Receita de R$ ${Number(dados.valor).toFixed(2)} registrada!`);
        break;

      case INTENCOES.REGISTRAR_PLANTAO:
        await salvarPlantao(dados);
        await enviarMensagem(chatId, `✅ Plantão em ${dados.local} registrado!`);
        break;

      case INTENCOES.CANCELAR_EVENTO:
        // TODO: implementar cancelamento real
        await enviarMensagem(chatId, '✅ Evento cancelado.');
        break;

      default:
        await enviarMensagem(chatId, '✅ Feito!');
    }
  } catch (err) {
    logger.error('Erro ao executar ação confirmada', { estado, error: err.message });
    await enviarMensagem(chatId, MENSAGENS.ERRO_GENERICO);
  }
}

// ---------------------------------------------------------------------------
// Handler de callback_query (botões inline)
// ---------------------------------------------------------------------------

async function handleCallbackQuery(query) {
  const { id, from, message, data } = query;
  const chatId = message.chat.id;
  const telegramId = from.id;

  // Responde ao Telegram para remover o "loading" do botão
  // (será feito via API — aqui apenas processamos)
  try {
    const [prefixo, resposta] = data.split(':');
    const confirmou = resposta === 'sim';

    const estado = await obterEstado(String(telegramId));
    if (!estado) {
      await enviarMensagem(chatId, 'Esta confirmação expirou. Por favor, repita a ação.');
      return;
    }

    if (!confirmou) {
      await limparEstado(String(telegramId));
      await enviarMensagem(chatId, 'Cancelado! ✋');
      return;
    }

    // Processa como confirmação positiva
    await handleRespostaConfirmacao(chatId, telegramId, 'sim', estado);

  } catch (err) {
    logger.error('Erro no callback query', { telegramId, data, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Comandos especiais (/start, /help, /limpar)
// ---------------------------------------------------------------------------

async function handleComando(chatId, telegramId, texto, nome) {
  const comando = texto.split(' ')[0].toLowerCase();

  switch (comando) {
    case '/start':
      await enviarMensagem(chatId, `Olá, ${nome}! ${MENSAGENS.BEM_VINDO}`);
      break;

    case '/help':
    case '/ajuda':
      await enviarMensagem(chatId, MENSAGENS.AJUDA);
      break;

    case '/limpar':
      await limparEstado(String(telegramId));
      await enviarMensagem(chatId, '🧹 Contexto limpo! Pode começar de novo.');
      break;

    default:
      await enviarMensagem(chatId, 'Comando não reconhecido. Use /ajuda para ver o que consigo fazer.');
  }
}

// ---------------------------------------------------------------------------
// Helpers de período
// ---------------------------------------------------------------------------

/**
 * Calcula as datas de início e fim de um período.
 * @param {string} periodo - 'hoje' | 'semana' | 'mes' | 'ano'
 * @returns {{ dataInicio: string, dataFim: string }}
 */
function calcularPeriodo(periodo) {
  const hoje = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];

  switch (periodo) {
    case 'hoje':
      return { dataInicio: fmt(hoje), dataFim: fmt(hoje) };

    case 'semana': {
      const inicio = new Date(hoje);
      inicio.setDate(hoje.getDate() - hoje.getDay());
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + 6);
      return { dataInicio: fmt(inicio), dataFim: fmt(fim) };
    }

    case 'mes': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { dataInicio: fmt(inicio), dataFim: fmt(fim) };
    }

    case 'ano': {
      const inicio = new Date(hoje.getFullYear(), 0, 1);
      const fim = new Date(hoje.getFullYear(), 11, 31);
      return { dataInicio: fmt(inicio), dataFim: fmt(fim) };
    }

    default:
      return { dataInicio: fmt(hoje), dataFim: fmt(hoje) };
  }
}

function formatarNomePeriodo(periodo) {
  const nomes = {
    hoje: 'Hoje',
    semana: 'Esta semana',
    mes: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    ano: String(new Date().getFullYear()),
  };
  return nomes[periodo] ?? periodo;
}

function gerarDescricaoAcao(intencao, dados) {
  switch (intencao) {
    case INTENCOES.REGISTRAR_GASTO:
      return `Registrar gasto de R$ ${dados.valor?.toFixed(2)} em ${dados.categoria}`;
    case INTENCOES.REGISTRAR_RECEITA:
      return `Registrar receita de R$ ${dados.valor?.toFixed(2)} (${dados.tipo})`;
    case INTENCOES.REGISTRAR_PLANTAO:
      return `Registrar plantão em ${dados.local} — ${dados.data_inicio}`;
    case INTENCOES.CANCELAR_EVENTO:
      return `Cancelar evento: ${dados.descricao_evento}`;
    default:
      return `Executar ação: ${intencao}`;
  }
}

// ---------------------------------------------------------------------------
// Registra os handlers no bot
// ---------------------------------------------------------------------------

const { bot } = require('../../integrations/telegram');

bot.on('message', async (msg) => {
  if (msg.text) return handleMensagemTexto(msg);
  if (msg.voice || msg.audio) return handleMensagemAudio(msg);
  if (msg.photo) return handleFoto(msg);
});

bot.on('callback_query', handleCallbackQuery);

module.exports = router;
