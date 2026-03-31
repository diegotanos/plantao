'use strict';

/**
 * Seed inicial do banco de dados.
 * Cria o usuário padrão e as categorias iniciais.
 * Execute: node scripts/seed_db.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { supabase } = require('../database/supabase_client');

const TELEGRAM_ID = process.env.TELEGRAM_ALLOWED_USER_ID;
const NOME_USUARIO = process.env.NOME_USUARIO || 'Diego';

const CATEGORIAS_PADRAO = [
  { nome: 'Alimentação',   tipo: 'gasto',   limite_mensal: 1500, cor: '#FF6B6B', icone: '🍽️' },
  { nome: 'Saúde',         tipo: 'gasto',   limite_mensal: 500,  cor: '#4ECDC4', icone: '💊' },
  { nome: 'Transporte',    tipo: 'gasto',   limite_mensal: 600,  cor: '#45B7D1', icone: '🚗' },
  { nome: 'Lazer',         tipo: 'gasto',   limite_mensal: 800,  cor: '#96CEB4', icone: '🎬' },
  { nome: 'Moradia',       tipo: 'gasto',   limite_mensal: 3000, cor: '#FFEAA7', icone: '🏠' },
  { nome: 'Educação',      tipo: 'gasto',   limite_mensal: 400,  cor: '#DDA0DD', icone: '📚' },
  { nome: 'Vestuário',     tipo: 'gasto',   limite_mensal: 300,  cor: '#98D8C8', icone: '👕' },
  { nome: 'Outros',        tipo: 'gasto',   limite_mensal: null, cor: '#B0C4DE', icone: '💡' },
  { nome: 'Honorários',    tipo: 'receita', limite_mensal: null, cor: '#90EE90', icone: '🩺' },
  { nome: 'Plantão',       tipo: 'receita', limite_mensal: null, cor: '#87CEEB', icone: '🏥' },
  { nome: 'Salário',       tipo: 'receita', limite_mensal: null, cor: '#FFD700', icone: '💼' },
];

async function seed() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  if (!TELEGRAM_ID) {
    console.error('❌ TELEGRAM_ALLOWED_USER_ID não está definido no .env');
    process.exit(1);
  }

  // Cria ou atualiza usuário
  console.log(`👤 Criando usuário: ${NOME_USUARIO} (Telegram ID: ${TELEGRAM_ID})`);
  const { data: usuario, error: errUser } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: String(TELEGRAM_ID),
        nome: NOME_USUARIO,
        preferencias: {
          resumo_hora: '20:00',
          agenda_hora: '07:00',
          timezone: 'America/Sao_Paulo',
          moeda: 'BRL',
          nome_preferido: NOME_USUARIO,
        },
      },
      { onConflict: 'telegram_id' }
    )
    .select('id, nome')
    .single();

  if (errUser) {
    console.error('❌ Erro ao criar usuário:', errUser.message);
    process.exit(1);
  }
  console.log(`✅ Usuário criado: ${usuario.nome} (ID: ${usuario.id})\n`);

  // Cria categorias padrão
  console.log('📂 Criando categorias padrão...');
  for (const cat of CATEGORIAS_PADRAO) {
    const { error } = await supabase
      .from('categorias')
      .upsert(
        { ...cat, user_id: usuario.id },
        { onConflict: 'user_id,nome' }
      );

    if (error) {
      console.warn(`  ⚠️  ${cat.nome}: ${error.message}`);
    } else {
      console.log(`  ✅ ${cat.icone} ${cat.nome}`);
    }
  }

  // Cria listas padrão
  console.log('\n📋 Criando listas padrão...');
  const listas = [
    { nome: 'Lista do Mercado', tipo: 'mercado' },
    { nome: 'Lista da Farmácia', tipo: 'farmacia' },
    { nome: 'Tarefas', tipo: 'tarefas' },
  ];

  for (const lista of listas) {
    const { error } = await supabase
      .from('listas')
      .upsert({ ...lista, user_id: usuario.id }, { onConflict: 'user_id,tipo' });

    if (error) {
      console.warn(`  ⚠️  ${lista.nome}: ${error.message}`);
    } else {
      console.log(`  ✅ ${lista.nome}`);
    }
  }

  // Cria alerta de limite de gastos padrão
  console.log('\n🔔 Criando alertas padrão...');
  const { error: errAlerta } = await supabase.from('alertas').insert({
    user_id: usuario.id,
    tipo: 'limite_gasto',
    condicao: { categoria: 'alimentacao', valor_limite: 1500, periodo: 'mensal' },
    canal_notificacao: 'telegram',
  });

  if (!errAlerta) console.log('  ✅ Alerta de limite de alimentação (R$ 1.500/mês)');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\nPróximo passo: inicie o servidor com `npm run dev`');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erro fatal no seed:', err);
  process.exit(1);
});
