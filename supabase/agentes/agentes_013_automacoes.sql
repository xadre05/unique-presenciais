-- Automação de comentário → direct (19/10/2026), o "ManyChat nosso". Quem comenta a palavra-chave num post recebe
-- uma mensagem privada (resposta privada do Instagram: só texto, o link vai dentro; até 7 dias depois do comentário;
-- uma por comentário). Opcional: responder também em público no comentário.
-- Funciona de dois jeitos, com a mesma regra: (1) a cada 2 minutos o sistema lê os comentários novos dos posts
-- escolhidos (não depende da aprovação da Meta); (2) avisos instantâneos (webhook), quando o app estiver aprovado.
create table if not exists public.marca_automacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  rede text not null default 'instagram',
  nome text not null,
  ativa boolean not null default true,
  -- onde vale: qualquer post recente, um post já publicado (media_id) ou uma peça do agente (vale quando for publicada)
  alvo text not null default 'post' check (alvo in ('todos', 'post', 'peca')),
  media_id text,
  peca_id uuid,
  palavras text[] not null default '{}',
  qualquer_comentario boolean not null default false,
  respostas_publicas text[] not null default '{}',
  mensagem text not null,
  link text,
  -- só comentários feitos depois disto (ligar a automação não dispara para comentários antigos)
  desde timestamptz not null default now(),
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists marca_automacoes_empresa on public.marca_automacoes (empresa_id, rede, ativa);
alter table public.marca_automacoes enable row level security;
create policy maut_ver on public.marca_automacoes for select using (is_admin());
create policy maut_ins on public.marca_automacoes for insert with check (is_admin());
create policy maut_upd on public.marca_automacoes for update using (is_admin()) with check (is_admin());
create policy maut_del on public.marca_automacoes for delete using (is_admin());

-- cada comentário tratado (enviado, erro ou ignorado); comentario_id único = nunca manda duas vezes
create table if not exists public.marca_automacao_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  automacao_id uuid references public.marca_automacoes(id) on delete set null,
  comentario_id text not null unique,
  media_id text,
  usuario text,
  usuario_id text,
  texto text,
  status text not null default 'enviando' check (status in ('enviando', 'enviado', 'erro')),
  erro text,
  respondeu_em_publico boolean not null default false,
  via text not null default 'leitura' check (via in ('leitura', 'aviso')),
  criado_em timestamptz not null default now()
);
create index if not exists marca_automacao_envios_empresa on public.marca_automacao_envios (empresa_id, criado_em desc);
alter table public.marca_automacao_envios enable row level security;
create policy maue_ver on public.marca_automacao_envios for select using (is_admin());

-- código de verificação dos avisos instantâneos (webhook) que a equipe cola no painel da Meta
alter table public.marca_conexoes add column if not exists webhook_token text;
alter table public.marca_conexoes add column if not exists webhook_em timestamptz;

-- a cada 2 minutos, só quando há automação ligada
select cron.schedule('instagram-automacoes', '*/2 * * * *', $cron$
  select net.http_post(
    url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-chave', public.crm_chave_cron()),
    body := '{"acao":"automacoes_todas"}'::jsonb,
    timeout_milliseconds := 110000)
  where exists (select 1 from public.marca_automacoes where ativa)
$cron$);
