-- Publicar e agendar no Instagram (19/10/2026, liberado pelo Alexandre): cada agendamento é uma linha em
-- marca_publicacoes (peça, formato, mídias em ordem, legenda, quando). O cron instagram-publicar roda a cada 5 minutos,
-- cria o post no Instagram na hora marcada e guarda o link. Nada sai sem alguém da equipe ter clicado em Agendar.
-- Vídeos dos Reels ficam no armazenamento privado "videos" (até 300 MB); as artes continuam em "arquivos".
create table if not exists public.marca_publicacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  rede text not null default 'instagram',
  peca_id uuid,
  formato text not null check (formato in ('imagem', 'carrossel', 'reels', 'stories')),
  midias jsonb not null default '[]'::jsonb,
  legenda text,
  quando timestamptz not null,
  status text not null default 'agendada' check (status in ('agendada', 'publicando', 'publicada', 'erro', 'cancelada')),
  tentativas integer not null default 0,
  container_id text,
  media_id text,
  link text,
  erro text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  publicado_em timestamptz
);
create index if not exists marca_publicacoes_fila on public.marca_publicacoes (status, quando);
create index if not exists marca_publicacoes_peca on public.marca_publicacoes (peca_id);
alter table public.marca_publicacoes enable row level security;
create policy mpub_ver on public.marca_publicacoes for select using (is_admin());
create policy mpub_ins on public.marca_publicacoes for insert with check (is_admin());
create policy mpub_upd on public.marca_publicacoes for update using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 314572800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;
create policy videos_enviar on storage.objects for insert with check (bucket_id = 'videos' and is_admin());
create policy videos_ver on storage.objects for select using (bucket_id = 'videos' and is_admin());

select cron.schedule('instagram-publicar', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/instagram',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-chave', public.crm_chave_cron()),
    body := '{"acao":"publicar_pendentes"}'::jsonb,
    timeout_milliseconds := 150000)
  where exists (select 1 from public.marca_publicacoes where (status = 'agendada' and quando <= now()) or (status = 'publicando' and container_id is not null))
$cron$);

-- permissões que o dono da conta aceitou no último login (a tela avisa quando falta a de publicar)
alter table public.marca_conexoes add column if not exists permissoes text;
