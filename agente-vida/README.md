# Agente Pessoal de Organização de Vida

Sistema inteligente de organização pessoal para médicos, acessível via Telegram com linguagem natural. Integra GPT-4o, Supabase, Google Calendar e mais.

## Arquitetura

```
Telegram Bot → Express Webhook → GPT-4o (classificação) → Supabase/Calendar/Todoist
```

**Stack:**
- **Runtime:** Node.js 20 + Express
- **IA:** OpenAI API (GPT-4o, Whisper, Vision, text-embedding-3-small)
- **Banco:** Supabase (PostgreSQL + pgvector)
- **Cache:** Redis (sessão + contexto de conversa)
- **Interface:** Telegram Bot
- **Orquestração:** n8n (automações)

## Fase 1 — MVP (implementado)

- [x] Bot Telegram (texto, áudio, fotos)
- [x] Classificação de intenções via GPT-4o
- [x] Registro de gastos e receitas
- [x] Registro de plantões e compromissos
- [x] Listas de compras e tarefas
- [x] Consulta de saldo/resumo financeiro
- [x] Consulta de agenda de plantões
- [x] Memória de curto prazo (Redis)
- [x] Memória de longo prazo vetorial (pgvector)
- [x] Sistema de confirmação para ações críticas

## Setup

### 1. Pré-requisitos

- Node.js 20+
- Redis (ou Docker)
- Conta Supabase
- Conta OpenAI
- Bot Telegram criado via @BotFather

### 2. Instalação

```bash
cd agente-vida
npm install
cp config/.env.example .env
# Edite o .env com suas credenciais
```

### 3. Banco de dados

Execute o schema no Supabase SQL Editor:

```bash
# Cole o conteúdo de database/schema.sql no Supabase SQL Editor
# OU via CLI:
supabase db push
```

### 4. Seed inicial

```bash
node scripts/seed_db.js
```

### 5. Iniciar

**Desenvolvimento (polling):**
```bash
npm run dev
```

**Produção (webhook):**
```bash
# Configure TELEGRAM_WEBHOOK_URL no .env
NODE_ENV=production npm start
```

**Docker Compose:**
```bash
docker-compose up -d
```

### 6. Configurar webhook (produção)

O servidor configura o webhook automaticamente ao iniciar em produção. Certifique-se de que `TELEGRAM_WEBHOOK_URL` aponta para seu domínio com HTTPS.

---

## Variáveis de Ambiente Obrigatórias (Fase 1)

| Variável | Descrição |
|---|---|
| `OPENAI_API_KEY` | Chave da API OpenAI |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram |
| `TELEGRAM_ALLOWED_USER_ID` | Seu ID numérico no Telegram |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service key do Supabase |
| `REDIS_URL` | URL do Redis |

---

## Uso

Fale naturalmente com o bot no Telegram:

```
"gastei 80 no almoço"
→ 💸 R$ 80,00 em alimentação registrado

"tenho plantão sábado das 7 às 19 no HU, 1200 reais"
→ 🏥 Plantão registrado com evento no Calendar

"coloca leite, ovos e pão na lista do mercado"
→ 🛒 3 itens adicionados

"resumo do mês"
→ 📊 Resumo financeiro completo

"o que tenho essa semana?"
→ 📅 Agenda da semana

[manda foto de nota fiscal]
→ Extrai valor/data/estabelecimento e confirma registro
```

---

## Estrutura do Projeto

```
agente-vida/
├── agent/
│   ├── prompt_system.md         # Prompt do GPT-4o
│   ├── intent_classifier.js     # Classificação de intenções
│   ├── response_formatter.js    # Formatação de respostas
│   └── memory_manager.js        # Memória vetorial + Redis
├── integrations/
│   ├── openai.js                # GPT-4o, Whisper, Vision, Embeddings
│   └── telegram.js              # Bot Telegram
├── database/
│   ├── schema.sql               # Schema PostgreSQL + pgvector
│   ├── supabase_client.js       # Cliente Supabase + helpers
│   └── redis_client.js          # Cache e contexto de sessão
├── api/
│   ├── server.js                # Express server
│   ├── logger.js                # Winston logger
│   ├── routes/
│   │   ├── telegram.js          # Handler principal do bot
│   │   └── health.js            # Health check
│   └── middleware/
│       ├── auth.js              # Autenticação de webhooks
│       └── rate_limit.js        # Rate limiting
├── config/
│   ├── .env.example             # Variáveis de ambiente
│   └── constants.js             # Constantes do sistema
├── scripts/
│   └── seed_db.js               # Dados iniciais
├── n8n/                         # Workflows n8n (Fases 2+)
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Fases de Implementação

| Fase | Status | Descrição |
|---|---|---|
| **Fase 1** | ✅ Concluída | MVP: Telegram + GPT-4o + Supabase |
| **Fase 2** | Planejada | Whisper (áudio) + Vision (fotos) + Gmail + n8n |
| **Fase 3** | Planejada | Crons (resumos) + Alertas + Google Sheets |
| **Fase 4** | Planejada | Pluggy (Open Finance) + pgvector + Dashboard |
