-- Resultados do Instagram, parte 3 (19/10/2026):
-- 1) marca_analises: toda análise fica guardada (antes uma substituía a outra), com a decisão da equipe sobre cada
--    aprendizado proposto ({"texto": "ensinado" | "recusado"}).
-- 2) marca_marcos: datas em que algo mudou ("novo jeito de postar"), para comparar antes e depois.
-- 3) marca_posts.origem/peca_id: post feito pelo agente (ligado à peça) ou feito fora.
-- 4) marca_conexoes.revisao_semanal: liga a revisão automática de toda segunda (cron instagram-revisao-semanal).
create table if not exists public.marca_analises (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  rede text not null default 'instagram',
  tipo text not null check (tipo in ('filtro', 'periodos', 'marco', 'semanal')),
  titulo text,
  filtro jsonb not null default '{}'::jsonb,
  resultado jsonb not null,
  decisoes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists marca_analises_empresa on public.marca_analises (empresa_id, rede, criado_em desc);
alter table public.marca_analises enable row level security;
create policy man_ver on public.marca_analises for select using (is_admin());
create policy man_upd on public.marca_analises for update using (is_admin()) with check (is_admin());

create table if not exists public.marca_marcos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  rede text not null default 'instagram',
  dia date not null,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists marca_marcos_empresa on public.marca_marcos (empresa_id, rede, dia);
alter table public.marca_marcos enable row level security;
create policy mmar_ver on public.marca_marcos for select using (is_admin());
create policy mmar_ins on public.marca_marcos for insert with check (is_admin());
create policy mmar_upd on public.marca_marcos for update using (is_admin()) with check (is_admin());

alter table public.marca_posts add column if not exists peca_id uuid;
alter table public.marca_posts add column if not exists origem text check (origem in ('agente', 'fora'));
create policy mpost_upd on public.marca_posts for update using (is_admin()) with check (is_admin());

alter table public.marca_conexoes add column if not exists revisao_semanal boolean not null default false;

-- toda segunda às 07:07 (Brasília), depois da leitura diária das 06:13
select cron.schedule('instagram-revisao-semanal', '7 10 * * 1', $cron$
  select net.http_post(
    url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-chave', public.crm_chave_cron()),
    body := '{"acao":"revisao_semanal_todas"}'::jsonb,
    timeout_milliseconds := 150000)
  where exists (select 1 from public.marca_conexoes where rede = 'instagram' and status = 'conectado' and revisao_semanal)
$cron$);
