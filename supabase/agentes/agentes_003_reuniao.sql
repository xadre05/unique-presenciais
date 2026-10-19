-- Reunião de pauta do Agente de Marketing (19/10/2026): a conversa com a equipe antes de gerar conteúdo.
-- Guarda o escopo (hoje, próximos dias, semana, mês, campanha), as mensagens, a ata e o plano que saiu dela.
-- Aplicada no Supabase como "agentes_reuniao_pauta". Só administradores leem e gravam.
create table if not exists public.agentes_reunioes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  agente_id text not null default 'marketing',
  titulo text not null,
  escopo jsonb not null default '{}'::jsonb,
  mensagens jsonb not null default '[]'::jsonb,
  ata jsonb not null default '{}'::jsonb,
  plano_id text,
  status text not null default 'aberta' check (status in ('aberta', 'plano', 'fechada')),
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists agentes_reunioes_empresa on public.agentes_reunioes (empresa_id, agente_id, criado_em desc);
alter table public.agentes_reunioes enable row level security;
create policy agreun_ver on public.agentes_reunioes for select using (is_admin());
create policy agreun_ins on public.agentes_reunioes for insert with check (is_admin());
create policy agreun_upd on public.agentes_reunioes for update using (is_admin()) with check (is_admin());
