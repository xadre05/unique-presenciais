-- Hotmart: assinaturas e Parcelamento Hotmart (a área "Recuperação") e o CPF/telefone de quem está devendo (20/10/2026).
-- Só leitura da Hotmart, gravado pela integração (edge function hotmart, ações "assinaturas" e "tudo").
-- O CPF é dado sensível: só o administrador vê (serve para negativar e para conferir quem é quem).
create table if not exists public.hotmart_assinaturas (
  id text primary key,
  integracao_id text,
  assinante text,
  status text,
  transacao text,
  produto_id bigint,
  produto_nome text,
  plano text,
  ciclos integer,
  valor numeric(12,2),
  adesao timestamptz,
  fim timestamptz,
  proxima_cobranca timestamptz,
  email text,
  nome text,
  bruto jsonb,
  sincronizado_em timestamptz not null default now()
);
create index if not exists hotmart_assinaturas_email on public.hotmart_assinaturas (email, produto_id);
create index if not exists hotmart_assinaturas_status on public.hotmart_assinaturas (status);
alter table public.hotmart_assinaturas enable row level security;
create policy hass_ver on public.hotmart_assinaturas for select using (is_admin());

create table if not exists public.hotmart_compradores (
  email text primary key,
  documento text,
  telefone text,
  nome text,
  consultado_em timestamptz not null default now()
);
alter table public.hotmart_compradores enable row level security;
create policy hcomp_ver on public.hotmart_compradores for select using (is_admin());

-- quem está devendo e ainda não teve o CPF consultado (a transação mais recente de cada e-mail serve para a consulta)
create or replace function public.compradores_sem_documento(p_integracao text, p_limite integer default 150)
returns table (email text, transacao text) language sql stable security definer set search_path = public as $$
  with devendo as (
    select distinct a.email from public.hotmart_assinaturas a
    where a.integracao_id = p_integracao and a.email is not null and upper(a.status) not in ('ACTIVE', 'STARTED')
    union
    select distinct oc.em from public.v_online_compras oc where oc.integracao_id = p_integracao and oc.situacao in ('atrasado', 'desistiu')
  )
  select d.email, (select h.transacao from public.hotmart_pagamentos h where lower(h.comprador_email) = d.email and h.integracao_id = p_integracao order by h.data_aprovacao desc nulls last limit 1)
  from devendo d
  where not exists (select 1 from public.hotmart_compradores c where c.email = d.email)
    and exists (select 1 from public.hotmart_pagamentos h where lower(h.comprador_email) = d.email and h.integracao_id = p_integracao)
  limit p_limite
$$;
revoke all on function public.compradores_sem_documento(text, integer) from public, anon, authenticated;
grant execute on function public.compradores_sem_documento(text, integer) to service_role;

-- (007c) o resumo de assinaturas da Hotmart (/subscriptions/summary) traz o tipo (SMART_INSTALLMENT = Parcelamento Hotmart,
-- SMART_RECOVERY = Recuperação, SUBSCRIPTION = assinatura de verdade) e a lista de parcelas não pagas.
-- As colunas transacao, plano, valor e fim ficaram sem uso (a Hotmart não manda no resumo).
alter table public.hotmart_assinaturas
  add column if not exists oferta_codigo text,
  add column if not exists tipo text,
  add column if not exists ultima_parcela integer,
  add column if not exists ultima_parcela_status text,
  add column if not exists nao_pagas integer,
  add column if not exists primeira_nao_paga timestamptz;
