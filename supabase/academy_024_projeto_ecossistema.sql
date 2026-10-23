-- Controle → Projeto: desenvolvimento do ecossistema como uma fábrica de software.
-- Épico (projeto grande, numa fase) → entregas (cabem numa semana, testáveis) → tarefas. Ideias chegam na caixa e são triadas.
create table if not exists public.proj_epicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  fase int not null default 1 check (fase between 1 and 9),
  ordem int not null default 0,
  status text not null default 'planejado' check (status in ('planejado', 'andamento', 'concluido', 'pausado')),
  criado_em timestamptz not null default now()
);
create table if not exists public.proj_entregas (
  id uuid primary key default gen_random_uuid(),
  epico_id uuid not null references public.proj_epicos(id) on delete cascade,
  nome text not null,
  pronto_quando text,
  status text not null default 'espera' check (status in ('espera', 'semana', 'construindo', 'testar', 'publicado')),
  semana date,
  ordem int not null default 0,
  resumo text,
  publicado_em timestamptz,
  criado_em timestamptz not null default now()
);
create table if not exists public.proj_tarefas (
  id uuid primary key default gen_random_uuid(),
  entrega_id uuid not null references public.proj_entregas(id) on delete cascade,
  titulo text not null,
  quem text not null default 'claude' check (quem in ('claude', 'alexandre', 'equipe')),
  feito boolean not null default false,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create table if not exists public.proj_ideias (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  status text not null default 'nova' check (status in ('nova', 'triada', 'descartada')),
  epico_id uuid references public.proj_epicos(id) on delete set null,
  entrega_id uuid references public.proj_entregas(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists proj_entregas_epico on public.proj_entregas (epico_id, ordem);
create index if not exists proj_tarefas_entrega on public.proj_tarefas (entrega_id, ordem);
alter table public.proj_epicos enable row level security;
alter table public.proj_entregas enable row level security;
alter table public.proj_tarefas enable row level security;
alter table public.proj_ideias enable row level security;
drop policy if exists proj_epicos_admin on public.proj_epicos;
create policy proj_epicos_admin on public.proj_epicos for all using (is_admin()) with check (is_admin());
drop policy if exists proj_entregas_admin on public.proj_entregas;
create policy proj_entregas_admin on public.proj_entregas for all using (is_admin()) with check (is_admin());
drop policy if exists proj_tarefas_admin on public.proj_tarefas;
create policy proj_tarefas_admin on public.proj_tarefas for all using (is_admin()) with check (is_admin());
drop policy if exists proj_ideias_admin on public.proj_ideias;
create policy proj_ideias_admin on public.proj_ideias for all using (is_admin()) with check (is_admin());
