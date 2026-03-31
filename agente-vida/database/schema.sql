-- =============================================================================
-- AGENTE VIDA — Schema completo do Supabase (PostgreSQL + pgvector)
-- Execute no Supabase SQL Editor ou via CLI: supabase db push
-- =============================================================================

-- Habilita a extensão pgvector para memória semântica
CREATE EXTENSION IF NOT EXISTS vector;

-- Habilita UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABELA: users (perfil do usuário)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  telegram_id     TEXT UNIQUE,
  whatsapp        TEXT,
  email           TEXT UNIQUE,
  preferencias    JSONB NOT NULL DEFAULT '{}',
  -- preferencias_exemplo:
  -- {
  --   "resumo_hora": "20:00",
  --   "agenda_hora": "07:00",
  --   "timezone": "America/Sao_Paulo",
  --   "moeda": "BRL",
  --   "nome_preferido": "Diego"
  -- }
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para lookup rápido por telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- =============================================================================
-- TABELA: categorias (categorias financeiras personalizáveis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS categorias (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('gasto', 'receita')),
  limite_mensal NUMERIC(12, 2),
  cor           TEXT,            -- ex: "#FF5733"
  icone         TEXT,            -- ex: "🍔"
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_user_id ON categorias(user_id);

-- =============================================================================
-- TABELA: gastos
-- =============================================================================

CREATE TABLE IF NOT EXISTS gastos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valor            NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  categoria        TEXT NOT NULL DEFAULT 'outros',
  descricao        TEXT,
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pagamento TEXT CHECK (metodo_pagamento IN
                    ('dinheiro','debito','credito','pix','transferencia','boleto','outros')),
  comprovante_url  TEXT,          -- URL no Google Drive
  fonte            TEXT NOT NULL DEFAULT 'manual'
                   CHECK (fonte IN ('manual','foto_nfe','pluggy','gmail','importacao')),
  dados_extras     JSONB,         -- dados brutos da extração por visão
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_user_id      ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_data         ON gastos(data);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria    ON gastos(categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_user_data    ON gastos(user_id, data);

-- =============================================================================
-- TABELA: receitas
-- =============================================================================

CREATE TABLE IF NOT EXISTS receitas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  valor       NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  tipo        TEXT NOT NULL DEFAULT 'outros'
              CHECK (tipo IN ('salario','honorario','plantao','freelance','investimento','outros')),
  descricao   TEXT,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'recebido'
              CHECK (status IN ('pendente','recebido','cancelado')),
  plantao_id  UUID,               -- referência ao plantão gerador (opcional)
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receitas_user_id   ON receitas(user_id);
CREATE INDEX IF NOT EXISTS idx_receitas_data      ON receitas(data);
CREATE INDEX IF NOT EXISTS idx_receitas_status    ON receitas(status);

-- =============================================================================
-- TABELA: plantoes (turnos/plantões médicos)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plantoes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local             TEXT NOT NULL,
  data_inicio       TIMESTAMPTZ NOT NULL,
  data_fim          TIMESTAMPTZ,
  valor_combinado   NUMERIC(12, 2),
  valor_recebido    NUMERIC(12, 2),
  status            TEXT NOT NULL DEFAULT 'agendado'
                    CHECK (status IN ('agendado','realizado','cancelado')),
  observacoes       TEXT,
  calendar_event_id TEXT,         -- ID do evento no Google Calendar
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantoes_user_id     ON plantoes(user_id);
CREATE INDEX IF NOT EXISTS idx_plantoes_data_inicio ON plantoes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_plantoes_status      ON plantoes(status);

-- Adiciona FK de receitas para plantoes (após criação das tabelas)
ALTER TABLE receitas
  ADD CONSTRAINT fk_receitas_plantao
  FOREIGN KEY (plantao_id) REFERENCES plantoes(id) ON DELETE SET NULL;

-- =============================================================================
-- TABELA: compromissos (eventos gerais da agenda)
-- =============================================================================

CREATE TABLE IF NOT EXISTS compromissos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  data_inicio       TIMESTAMPTZ NOT NULL,
  data_fim          TIMESTAMPTZ,
  local             TEXT,
  lembrete_minutos  INT NOT NULL DEFAULT 30,
  calendar_event_id TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compromissos_user_id     ON compromissos(user_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_data_inicio ON compromissos(data_inicio);

-- =============================================================================
-- TABELA: listas
-- =============================================================================

CREATE TABLE IF NOT EXISTS listas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'geral'
               CHECK (tipo IN ('mercado','farmacia','tarefas','geral')),
  compartilhada BOOLEAN NOT NULL DEFAULT false,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listas_user_id ON listas(user_id);

-- =============================================================================
-- TABELA: itens_lista (itens de lista / tarefas)
-- =============================================================================

CREATE TABLE IF NOT EXISTS itens_lista (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lista_id    UUID NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  quantidade  NUMERIC(10, 2),
  unidade     TEXT,               -- "kg", "unidade", "litro"
  concluido   BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  prioridade  INT NOT NULL DEFAULT 2 CHECK (prioridade BETWEEN 1 AND 4),
  prazo       DATE,
  todoist_id  TEXT,               -- ID da tarefa no Todoist
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itens_lista_lista_id  ON itens_lista(lista_id);
CREATE INDEX IF NOT EXISTS idx_itens_lista_concluido ON itens_lista(concluido);

-- =============================================================================
-- TABELA: conversas (histórico de interações com o agente)
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canal            TEXT NOT NULL DEFAULT 'telegram'
                   CHECK (canal IN ('telegram','whatsapp','gmail','sistema')),
  mensagem_usuario TEXT,
  resposta_agente  TEXT,
  intencao         TEXT,
  confianca        NUMERIC(4, 3),
  dados_json       JSONB,          -- JSON completo retornado pelo GPT
  duracao_ms       INT,            -- tempo de processamento
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversas_user_id   ON conversas(user_id);
CREATE INDEX IF NOT EXISTS idx_conversas_criado_em ON conversas(criado_em);
CREATE INDEX IF NOT EXISTS idx_conversas_intencao  ON conversas(intencao);

-- =============================================================================
-- TABELA: memorias (memória vetorial de longo prazo — pgvector)
-- =============================================================================

CREATE TABLE IF NOT EXISTS memorias (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conteudo  TEXT NOT NULL,
  embedding VECTOR(1536),          -- text-embedding-3-small da OpenAI
  tipo      TEXT NOT NULL DEFAULT 'conversa'
            CHECK (tipo IN ('conversa','preferencia','padrao','fato_pessoal')),
  metadados JSONB,                 -- dados adicionais de contexto
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memorias_user_id ON memorias(user_id);
-- Índice HNSW para busca vetorial eficiente (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_memorias_embedding
  ON memorias USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- TABELA: alertas (configurações de alertas automáticos)
-- =============================================================================

CREATE TABLE IF NOT EXISTS alertas (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo                TEXT NOT NULL,
  -- tipos: 'limite_gasto', 'honorario_pendente', 'plantao_proximo', 'lembrete_custom'
  condicao            JSONB NOT NULL,
  -- exemplo: {"categoria": "alimentacao", "valor_limite": 1500, "periodo": "mensal"}
  canal_notificacao   TEXT NOT NULL DEFAULT 'telegram'
                      CHECK (canal_notificacao IN ('telegram','whatsapp','email')),
  ativo               BOOLEAN NOT NULL DEFAULT true,
  ultimo_disparo      TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_user_id ON alertas(user_id);
CREATE INDEX IF NOT EXISTS idx_alertas_ativo   ON alertas(ativo);

-- =============================================================================
-- FUNÇÃO: buscar_memorias_similares
-- Busca semântica nas memórias do usuário usando cosine similarity
-- =============================================================================

CREATE OR REPLACE FUNCTION buscar_memorias_similares(
  p_user_id   UUID,
  p_embedding VECTOR(1536),
  p_limite    INT DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id        UUID,
  conteudo  TEXT,
  tipo      TEXT,
  metadados JSONB,
  criado_em TIMESTAMPTZ,
  similaridade FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    m.id,
    m.conteudo,
    m.tipo,
    m.metadados,
    m.criado_em,
    1 - (m.embedding <=> p_embedding) AS similaridade
  FROM memorias m
  WHERE
    m.user_id = p_user_id
    AND 1 - (m.embedding <=> p_embedding) >= p_threshold
  ORDER BY m.embedding <=> p_embedding
  LIMIT p_limite;
$$;

-- =============================================================================
-- FUNÇÃO: resumo_financeiro_periodo
-- Retorna totais agrupados por categoria em um intervalo de datas
-- =============================================================================

CREATE OR REPLACE FUNCTION resumo_financeiro_periodo(
  p_user_id    UUID,
  p_data_inicio DATE,
  p_data_fim    DATE
)
RETURNS TABLE (
  categoria    TEXT,
  total_gastos NUMERIC,
  qtd_gastos   BIGINT,
  total_receitas NUMERIC,
  qtd_receitas   BIGINT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(g.categoria, r.tipo) AS categoria,
    COALESCE(SUM(g.valor), 0)     AS total_gastos,
    COALESCE(COUNT(g.id), 0)      AS qtd_gastos,
    COALESCE(SUM(r.valor), 0)     AS total_receitas,
    COALESCE(COUNT(r.id), 0)      AS qtd_receitas
  FROM
    (SELECT categoria, valor, id FROM gastos
     WHERE user_id = p_user_id AND data BETWEEN p_data_inicio AND p_data_fim) g
  FULL OUTER JOIN
    (SELECT tipo, valor, id FROM receitas
     WHERE user_id = p_user_id AND data BETWEEN p_data_inicio AND p_data_fim
       AND status = 'recebido') r
    ON g.categoria = r.tipo
  GROUP BY COALESCE(g.categoria, r.tipo);
$$;

-- =============================================================================
-- TRIGGER: atualizar_timestamp (atualiza 'atualizado_em' automaticamente)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_atualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_atualizado_em
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_atualizar_timestamp();

CREATE TRIGGER trg_plantoes_atualizado_em
  BEFORE UPDATE ON plantoes
  FOR EACH ROW EXECUTE FUNCTION trigger_atualizar_timestamp();

-- =============================================================================
-- DADOS INICIAIS: categorias padrão (serão criadas no seed por user_id)
-- =============================================================================
-- Ver: scripts/seed_db.js
-- =============================================================================

-- Row Level Security (RLS) — cada usuário acessa apenas seus próprios dados
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compromissos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_lista   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas       ENABLE ROW LEVEL SECURITY;

-- Nota: Como o agente usa a SERVICE_KEY do Supabase (que bypassa RLS),
-- as policies abaixo são para acesso seguro via client-side (futuro dashboard).

CREATE POLICY "users_proprios" ON users
  FOR ALL USING (id::text = current_setting('app.user_id', true));

CREATE POLICY "gastos_proprios" ON gastos
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "receitas_proprias" ON receitas
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "plantoes_proprios" ON plantoes
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "compromissos_proprios" ON compromissos
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "listas_proprias" ON listas
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "conversas_proprias" ON conversas
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "memorias_proprias" ON memorias
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "alertas_proprios" ON alertas
  FOR ALL USING (user_id::text = current_setting('app.user_id', true));
