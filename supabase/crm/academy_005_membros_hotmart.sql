-- 066: área de membros da Hotmart (Club), lida pela função hotmart (acao "membros", só leitura).
create table if not exists hotmart_membros (
  subdominio text not null, user_id text not null, email text, nome text, status text, papel text,
  primeiro_acesso timestamptz, ultimo_acesso timestamptz, progresso numeric, engajamento text, bruto jsonb,
  sincronizado_em timestamptz not null default now(), primary key (subdominio, user_id)
);
create index if not exists hotmart_membros_email on hotmart_membros (lower(email));
alter table hotmart_membros enable row level security;
create policy hotmart_membros_admin on hotmart_membros for select using ((select is_admin()));

-- 067: contato_resumo.acesso / acesso_ate — acesso à plataforma pela regra (Black HOF Infinita e Unique Black Club
-- Vitalício = vitalício; o resto 1 ano a partir da data da compra; apostila/planilha não contam). Faixas:
-- vitalicio · em_dia · vence_60 · vencido_recente (até 1 ano) · vencido_antigo. Filtro "acesso" em contatos_filtrados
-- (aceita também 'tem' e 'vencido'); buscar_contatos devolve acesso e acesso_ate. Recalcula no cron crm-resumo (de hora em hora).
-- Definição completa: pg_get_functiondef('atualizar_resumo_contatos()').

-- 068: crm_proximos_envios — com ritmo até 60/hora já sai uma mensagem por vez; agora o intervalo varia
-- entre ~85% e ~130% do intervalo do ritmo:
--   make_interval(secs => (3600.0 / k.ritmo_por_hora) * (0.85 + random() * 0.45) - 20)

-- 069: hotmart_ofertas_cursos.curso_id aceita vazio (oferta desligada = venda do online).
-- 17/10: produto "Unique HOF Academy" (3562773) voltou a ficar sem curso (mistura online e presencial);
-- ligadas por oferta: Black Mini Residência (54utqf4b, q5zciiqf), Valor especial aluna Mini Residência (5vf26zpc)
-- → Mini Residência Unique; Black Unique Codes (9r0jcoeg, dvyijwes) → Unique Codes Experience.

-- 070 · Grupos de links (ex.: "Black Friday Limited Edition") e link já com o rastreio (src) da vendedora logada
create table if not exists public.links_grupos (
  id uuid primary key default gen_random_uuid(), nome text not null unique, descricao text,
  ordem int not null default 10, ativo boolean not null default true, criado_em timestamptz not null default now()
);
alter table public.links_grupos enable row level security;
create policy grupos_ver on public.links_grupos for select to authenticated using (is_ativo());
create policy grupos_ins on public.links_grupos for insert to authenticated with check (is_admin());
create policy grupos_upd on public.links_grupos for update to authenticated using (is_admin()) with check (is_admin());
alter table public.links_pagamento add column if not exists grupo_id uuid references public.links_grupos(id) on delete set null;
create or replace function public.meu_rastreio()
returns text language sql stable security definer set search_path to 'public' as $$
  select r.valor from rastreios r join vendedoras v on v.id = r.vendedora_id
  where v.perfil_id = auth.uid() and v.ativa and not coalesce(r.nao_e_vendedora, false)
  order by (select count(*) from hotmart_pagamentos h where h.rastreio = r.valor) desc, length(r.valor) desc, r.valor
  limit 1
$$;
revoke all on function public.meu_rastreio() from public, anon;
grant execute on function public.meu_rastreio() to authenticated;
-- + motivo do "sem ação" em processar_pagamento_hotmart passa a citar a oferta (Integrações → Ofertas)
