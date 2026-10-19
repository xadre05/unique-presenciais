-- Instagram ligado à Base da marca (19/10/2026): a conta profissional da empresa, os posts com as métricas
-- e a análise do que funcionou. Os segredos (chave secreta do app e o token de acesso) ficam no Vault.
-- Aplicada no Supabase como "agentes_instagram". Só administradores leem; a função instagram grava.

-- conexão de cada empresa com cada rede (hoje só Instagram)
create table if not exists public.marca_conexoes (
  empresa_id uuid not null,
  rede text not null check (rede in ('instagram')),
  app_id text,
  status text not null default 'sem_app' check (status in ('sem_app', 'pronta', 'conectado', 'erro', 'desligado')),
  estado text,                -- código de segurança do login (dura até voltar do Instagram)
  voltar text,                -- endereço da tela para voltar depois do login
  conta_id text, usuario text, nome text, foto text,
  seguidores integer, publicacoes integer,
  token_expira_em timestamptz, token_renovado_em timestamptz,
  conectado_em timestamptz, sincronizado_em timestamptz,
  analise jsonb,              -- última análise do agente: o que funcionou, o que não, recomendações
  erro text,
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, rede)
);
alter table public.marca_conexoes enable row level security;
create policy mcon_ver on public.marca_conexoes for select using (is_admin());
create policy mcon_upd on public.marca_conexoes for update using (is_admin()) with check (is_admin());

-- posts publicados, com as métricas da última leitura
create table if not exists public.marca_posts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  rede text not null default 'instagram',
  externo_id text not null,
  tipo text not null,          -- imagem, carrossel, reels, video
  legenda text, link text, miniatura text,
  publicado_em timestamptz not null,
  metricas jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, rede, externo_id)
);
create index if not exists marca_posts_empresa on public.marca_posts (empresa_id, rede, publicado_em desc);
alter table public.marca_posts enable row level security;
create policy mpost_ver on public.marca_posts for select using (is_admin());

-- o administrador cadastra o app do Instagram (ID e chave secreta); a chave vai para o Vault
create or replace function public.marca_salvar_app_instagram(p_empresa uuid, p_app_id text, p_segredo text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_nome text := 'agentes:' || p_empresa || ':instagram_app'; v_id uuid; v_seg text := trim(coalesce(p_segredo, ''));
begin
  if not is_admin() then raise exception 'Só o administrador pode ligar o Instagram.'; end if;
  if coalesce(trim(p_app_id), '') !~ '^[0-9]{6,25}$' then raise exception 'O ID do app do Instagram tem só números (copie em Instagram → Configuração da API com login do Instagram).'; end if;
  if v_seg <> '' then
    if v_seg !~ '^[0-9a-f]{20,64}$' then raise exception 'A chave secreta do app do Instagram tem letras de a a f e números (copie de novo, sem espaços).'; end if;
    select id into v_id from vault.secrets where name = v_nome;
    if v_id is null then perform vault.create_secret(v_seg, v_nome); else perform vault.update_secret(v_id, v_seg); end if;
  end if;
  insert into marca_conexoes (empresa_id, rede, app_id, status) values (p_empresa, 'instagram', trim(p_app_id), 'pronta')
    on conflict (empresa_id, rede) do update set app_id = excluded.app_id,
      status = case when marca_conexoes.status = 'conectado' then 'conectado' else 'pronta' end, erro = null, atualizado_em = now();
end $$;

-- só a função instagram (service_role) grava o token de acesso
create or replace function public.marca_guardar_token(p_empresa uuid, p_rede text, p_token text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_nome text := 'agentes:' || p_empresa || ':' || p_rede || '_token'; v_id uuid;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then raise exception 'Acesso negado.'; end if;
  if p_rede not in ('instagram') then raise exception 'Rede desconhecida.'; end if;
  select id into v_id from vault.secrets where name = v_nome;
  if v_id is null then perform vault.create_secret(coalesce(p_token, ''), v_nome); else perform vault.update_secret(v_id, coalesce(p_token, '')); end if;
end $$;
revoke all on function public.marca_guardar_token(uuid, text, text) from public, anon, authenticated;

-- leitura diária dos posts (06:13 de Brasília), só se houver Instagram conectado. Criado à parte com cron.schedule:
-- select cron.schedule('instagram-diario', '13 9 * * *', $$ select net.http_post(
--   url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/instagram',
--   headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-chave', public.crm_chave_cron()),
--   body := '{"acao":"sincronizar_todas"}'::jsonb, timeout_milliseconds := 120000)
--   where exists (select 1 from public.marca_conexoes where rede = 'instagram' and status = 'conectado') $$);
