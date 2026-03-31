-- ================================================
-- PLANTÃO APP — Schema Supabase (PostgreSQL)
-- ================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ================================================
-- PERFIS DE USUÁRIO (médicos)
-- ================================================
create table public.perfis (
  id uuid references auth.users(id) on delete cascade primary key,
  nome text not null,
  crm text,
  especialidade text,
  hospital text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.perfis enable row level security;

create policy "Usuário vê apenas seu perfil"
  on public.perfis for select using (auth.uid() = id);

create policy "Usuário atualiza apenas seu perfil"
  on public.perfis for update using (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao cadastrar
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================
-- PLANTÕES
-- ================================================
create table public.plantoes (
  id uuid default uuid_generate_v4() primary key,
  medico_id uuid references public.perfis(id) on delete cascade not null,
  medico_recebeu_id uuid references public.perfis(id),
  setor text not null,
  hospital text,
  inicio timestamptz not null default now(),
  fim timestamptz,
  status text not null default 'ativo' check (status in ('ativo', 'passagem_pendente', 'encerrado')),
  observacoes_gerais text,
  confirmado_em timestamptz,
  created_at timestamptz default now()
);

alter table public.plantoes enable row level security;

create policy "Médico vê seus plantões"
  on public.plantoes for select
  using (auth.uid() = medico_id or auth.uid() = medico_recebeu_id);

create policy "Médico cria plantões"
  on public.plantoes for insert
  with check (auth.uid() = medico_id);

create policy "Médico atualiza seus plantões"
  on public.plantoes for update
  using (auth.uid() = medico_id or auth.uid() = medico_recebeu_id);

-- ================================================
-- PACIENTES
-- ================================================
create table public.pacientes (
  id uuid default uuid_generate_v4() primary key,
  plantao_id uuid references public.plantoes(id) on delete cascade not null,
  medico_id uuid references public.perfis(id) not null,
  nome text not null,
  leito text not null,
  idade integer,
  diagnostico_principal text not null,
  diagnosticos_secundarios text[],
  status text not null default 'estavel' check (status in ('estavel', 'atencao', 'critico')),
  sbar_situacao text,
  sbar_background text,
  sbar_avaliacao text,
  sbar_recomendacao text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pacientes enable row level security;

create policy "Médico vê pacientes de seus plantões"
  on public.pacientes for select
  using (
    exists (
      select 1 from public.plantoes p
      where p.id = plantao_id
      and (p.medico_id = auth.uid() or p.medico_recebeu_id = auth.uid())
    )
  );

create policy "Médico gerencia pacientes de seus plantões"
  on public.pacientes for all
  using (medico_id = auth.uid());

-- ================================================
-- CHECKLIST DE PENDÊNCIAS
-- ================================================
create table public.pendencias (
  id uuid default uuid_generate_v4() primary key,
  paciente_id uuid references public.pacientes(id) on delete cascade not null,
  plantao_id uuid references public.plantoes(id) on delete cascade not null,
  descricao text not null,
  tipo text default 'geral' check (tipo in ('exame', 'conduta', 'retorno', 'medicacao', 'geral')),
  concluida boolean default false,
  concluida_em timestamptz,
  created_at timestamptz default now()
);

alter table public.pendencias enable row level security;

create policy "Médico gerencia pendências de seus pacientes"
  on public.pendencias for all
  using (
    exists (
      select 1 from public.pacientes p
      where p.id = paciente_id and p.medico_id = auth.uid()
    )
  );

-- ================================================
-- INTERCORRÊNCIAS
-- ================================================
create table public.intercorrencias (
  id uuid default uuid_generate_v4() primary key,
  paciente_id uuid references public.pacientes(id) on delete cascade not null,
  plantao_id uuid references public.plantoes(id) on delete cascade not null,
  medico_id uuid references public.perfis(id) not null,
  descricao text not null,
  conduta text not null,
  resultado text,
  gravidade text default 'leve' check (gravidade in ('leve', 'moderada', 'grave')),
  horario timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.intercorrencias enable row level security;

create policy "Médico gerencia suas intercorrências"
  on public.intercorrencias for all
  using (medico_id = auth.uid());

create policy "Médico receptor vê intercorrências do plantão recebido"
  on public.intercorrencias for select
  using (
    exists (
      select 1 from public.plantoes p
      where p.id = plantao_id and p.medico_recebeu_id = auth.uid()
    )
  );

-- ================================================
-- NOTIFICAÇÕES
-- ================================================
create table public.notificacoes (
  id uuid default uuid_generate_v4() primary key,
  usuario_id uuid references public.perfis(id) on delete cascade not null,
  titulo text not null,
  mensagem text not null,
  tipo text default 'info' check (tipo in ('info', 'alerta', 'critico', 'passagem')),
  lida boolean default false,
  plantao_id uuid references public.plantoes(id),
  paciente_id uuid references public.pacientes(id),
  created_at timestamptz default now()
);

alter table public.notificacoes enable row level security;

create policy "Usuário vê suas notificações"
  on public.notificacoes for all using (usuario_id = auth.uid());

-- ================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pacientes_updated_at
  before update on public.pacientes
  for each row execute procedure update_updated_at();

-- ================================================
-- RPC: buscar user_id pelo email (para passagem)
-- Requer service_role em produção; alternativa: usar lookup por email no perfil
-- ================================================
-- Adicionar campo email no perfil para lookup por passagem:
alter table public.perfis add column if not exists email text;

-- Trigger para sincronizar email no perfil
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    new.email
  )
  on conflict (id) do update set
    nome = coalesce(new.raw_user_meta_data->>'nome', new.email),
    email = new.email;
  return new;
end;
$$ language plpgsql security definer;

-- RPC para buscar ID por email (usado na passagem)
create or replace function public.get_user_id_by_email(email text)
returns uuid as $$
  select id from public.perfis where perfis.email = $1 limit 1;
$$ language sql security definer;

-- ================================================
-- REALTIME: habilitar para notificações ao vivo
-- ================================================
alter publication supabase_realtime add table public.notificacoes;
alter publication supabase_realtime add table public.pacientes;
