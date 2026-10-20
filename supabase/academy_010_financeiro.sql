-- Financeiro (20/10/2026): a área do dinheiro da empresa, só para o administrador.
-- Junta num lugar só o que entrou (Hotmart, presencial fora da Hotmart, cobranças pagas fora da Hotmart), o que ainda vai
-- entrar mês a mês, e o que tem para pagar (despesas lançadas à mão + comissões das vendedoras).
-- Regras para não contar duas vezes:
--   * parcela do presencial vendida pelo Parcelado Hotmart entra pela Hotmart (não pela tabela de parcelas);
--   * parcela "considerada paga" (baixa sem comprovante) não é dinheiro: fica de fora;
--   * a receber da Hotmart sai das assinaturas ATIVAS com a última cobrança recente (até 45 dias); contrato atrasado
--     é dívida e está na fila de cobrança, não aqui.

-- despesas lançadas à mão (contas a pagar)
create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null,
  fornecedor text,
  valor numeric not null check (valor > 0),
  vencimento date not null,
  pago_em date,
  conta_id uuid references public.contas(id),
  grupo uuid,                         -- despesas repetidas (mensais) lançadas juntas
  parcela integer,
  parcelas integer,
  observacao text,
  comprovante text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists despesas_vencimento on public.despesas (vencimento);
create index if not exists despesas_grupo on public.despesas (grupo);
alter table public.despesas enable row level security;
create policy despesas_admin on public.despesas for all using (is_admin()) with check (is_admin());

-- % que a Hotmart adianta no Parcelado Hotmart, por conta (regra que o dono informou: 20% na conta Unique, 50% na outra)
create table if not exists public.financeiro_config (
  id boolean primary key default true check (id),
  antecipacao jsonb not null default '{"hotmart_unique": 20, "hotmart_pra": 50}',
  atualizado_em timestamptz not null default now()
);
insert into public.financeiro_config (id) values (true) on conflict do nothing;
alter table public.financeiro_config enable row level security;
create policy fincfg_admin on public.financeiro_config for all using (is_admin()) with check (is_admin());

-- tudo o que entrou
create or replace view public.v_fin_entradas with (security_invoker = true) as
  select 'h:' || h.id id, (h.data_aprovacao at time zone 'America/Sao_Paulo')::date data, 'hotmart'::text origem,
    i.conta_id, h.integracao_id, h.produto_nome descricao, h.comprador_nome pessoa, lower(h.comprador_email) email,
    coalesce(h.valor_liquido, h.valor) + t.taxa bruto, t.taxa, coalesce(h.valor_liquido, h.valor) liquido,
    case when coalesce(h.recorrencia, 1) > 1 then 'parcela' else 'venda' end tipo, h.forma,
    case when h.parcela_id is not null or hotmart_curso_do_pagamento(h.produto_id, h.oferta_codigo) is not null then 'presencial' else 'online' end area,
    case when coalesce(h.recorrencia, 0) > 0 then h.recorrencia || '/' || coalesce(h.parcelas_cartao, 0) end parcela
  from hotmart_pagamentos h left join integracoes i on i.id = h.integracao_id
  -- taxa = a que a Hotmart informa na venda; no Parcelado o "valor" inclui os juros pagos pelo comprador, que não são custo nosso
  cross join lateral (select case when coalesce(h.moeda, 'BRL') = 'BRL' and h.bruto->'purchase'->'hotmart_fee'->>'total' is not null
      then (h.bruto->'purchase'->'hotmart_fee'->>'total')::numeric else greatest(coalesce(h.valor, 0) - coalesce(h.valor_liquido, 0), 0) end taxa) t
  where h.status in ('APPROVED', 'COMPLETE') and h.data_aprovacao is not null
  union all
  select 'p:' || p.id, p.data_recebimento, 'presencial', p.conta_id, null, coalesce(p.curso_nome, 'Curso presencial'), p.aluno_nome, null,
    coalesce(p.valor_recebido, p.valor), 0, coalesce(p.valor_recebido, p.valor), 'parcela', p.forma, 'presencial',
    p.numero || '/' || p.total_parcelas
  from v_parcelas p
  where p.status = 'confirmada' and not coalesce(p.considerada_paga, false) and p.forma <> 'hotmart_parcelado'
    and p.hotmart_transacao is null and p.data_recebimento is not null
  union all
  select 'c:' || r.id, r.recebido_em, 'cobranca', null, k.integracao_id, coalesce(k.produto, 'Cobrança') || ' (dívida recuperada)', k.aluno_nome, lower(k.email),
    r.valor, 0, r.valor, 'recebimento', r.forma, coalesce(k.origem, 'online'), null
  from cobranca_recebimentos r join cobrancas k on k.id = r.cobranca_id
  where r.conferido and coalesce(r.forma, '') not ilike '%hotmart%';

-- tudo o que sai: despesas lançadas + comissões (presencial, online e da cobrança) liberadas ou pagas
create or replace view public.v_fin_saidas with (security_invoker = true) as
  select 'd:' || d.id id, 'despesa'::text origem, d.id despesa_id, d.descricao, d.categoria, d.fornecedor pessoa, d.valor,
    d.vencimento, d.pago_em, d.conta_id, d.parcela, d.parcelas, d.grupo, d.observacao
  from despesas d
  union all
  select 'cp:' || c.id, 'comissao', null, 'Comissão do presencial' || coalesce(' · ' || v.aluno_nome, ''), 'Comissões', vd.nome, c.valor,
    coalesce(c.liberada_em, c.competencia), c.paga_em, null, null, null, null, c.observacao
  from comissoes c left join vendedoras vd on vd.id = c.vendedora_id left join v_matriculas v on v.id = c.matricula_id
  where c.status in ('liberada', 'paga')
  union all
  select 'co:' || c.id, 'comissao', null, 'Comissão do online · ' || coalesce(c.comprador_nome, c.produto_nome, ''), 'Comissões', vd.nome, c.valor,
    coalesce(c.liberada_em, c.competencia), c.paga_em, null, null, null, null, c.observacao
  from comissoes_online c left join vendedoras vd on vd.id = c.vendedora_id
  where c.status in ('liberada', 'paga')
  union all
  select 'cc:' || r.id, 'comissao', null, 'Comissão da cobrança · ' || coalesce(k.aluno_nome, ''), 'Comissões', vd.nome, r.comissao_valor,
    coalesce(r.conferido_em::date, r.recebido_em), r.comissao_paga_em::date, null, null, null, null, null
  from cobranca_recebimentos r join cobrancas k on k.id = r.cobranca_id left join vendedoras vd on vd.id = r.vendedora_id
  where r.comissao_status in ('liberada', 'paga') and coalesce(r.comissao_valor, 0) > 0;

-- contratos do Parcelado Hotmart em dia: quantas parcelas faltam e quanto a Hotmart ainda segura da antecipação (estimativa)
create or replace view public.v_fin_parcelado with (security_invoker = true) as
  with s as (
    select a.id, a.integracao_id, lower(a.email) email, a.nome, a.oferta_codigo, a.produto_nome, a.tipo,
      (a.bruto->'last_recurrency'->>'number')::int ult, a.bruto->'last_recurrency'->>'status' ult_st,
      (to_timestamp((a.bruto->'last_recurrency'->>'request_date')::bigint / 1000) at time zone 'America/Sao_Paulo')::date ult_data
    from hotmart_assinaturas a
    where a.tipo <> 'SUBSCRIPTION' and a.status = 'ACTIVE' and a.bruto->'last_recurrency'->>'request_date' is not null
  ), np as (
    select lower(comprador_email) email, oferta_codigo, max(parcelas_cartao) np,
      -- valor que mais se repete: um pagamento pode quitar várias parcelas de uma vez
      mode() within group (order by valor_liquido) filter (where status in ('APPROVED', 'COMPLETE')) liq,
      mode() within group (order by valor) filter (where status in ('APPROVED', 'COMPLETE')) bruto,
      count(*) filter (where status in ('REFUNDED', 'CHARGEBACK')) estornos
    from hotmart_pagamentos where recorrencia is not null group by 1, 2
  ), b as (
    select s.*, np.np, np.liq, np.bruto,
      case when s.ult_st = 'PAID' then s.ult else s.ult - 1 end pagas,
      coalesce((select (c.antecipacao->>s.integracao_id)::numeric from financeiro_config c), 0) pct
    from s join np on np.email = s.email and np.oferta_codigo = s.oferta_codigo
    where np.estornos = 0 and s.ult_data >= current_date - 45 and np.np > case when s.ult_st = 'PAID' then s.ult else s.ult - 1 end
  )
  select b.id, b.integracao_id, i.conta_id, b.email, b.nome, b.produto_nome, b.tipo, b.np, b.pagas, b.np - b.pagas faltam,
    b.liq liquido_parcela, b.bruto bruto_parcela,
    case when b.ult_st = 'PAID' then (b.ult_data + interval '1 month')::date else b.ult_data end proxima,
    round((b.np - b.pagas) * b.liq, 2) a_receber,
    case when b.tipo = 'SMART_INSTALLMENT' then round(b.pct / 100 * b.np * b.liq, 2) else 0 end antecipado_estimado,
    case when b.tipo = 'SMART_INSTALLMENT' then round(greatest(0, b.pct / 100 * b.np * b.liq - b.pagas * b.liq), 2) else 0 end retido_estimado
  from b left join integracoes i on i.id = b.integracao_id;

-- o que ainda vai entrar, parcela por parcela (para o calendário mês a mês)
create or replace view public.v_fin_a_receber with (security_invoker = true) as
  select 'h:' || p.id || ':' || k id, (p.proxima + ((k - 1) || ' month')::interval)::date data, 'hotmart'::text origem,
    p.integracao_id, p.conta_id, p.produto_nome descricao, p.nome pessoa, p.liquido_parcela valor,
    (p.pagas + k) || '/' || p.np parcela
  from v_fin_parcelado p cross join lateral generate_series(1, p.faltam) k
  union all
  select 'p:' || p.id, p.vencimento, 'presencial', null, p.conta_id, coalesce(p.curso_nome, 'Curso presencial'), p.aluno_nome, p.valor,
    p.numero || '/' || p.total_parcelas
  from v_parcelas p
  where p.status in ('prevista', 'informada') and p.forma <> 'hotmart_parcelado' and not coalesce(p.considerada_paga, false)
    and (p.vencimento is null or p.vencimento >= current_date)
  union all
  select 'a:' || k.id || ':' || n, (k.acordo_primeiro_venc + ((n - 1) || ' month')::interval)::date, 'acordo', k.integracao_id, null,
    coalesce(k.produto, 'Acordo') || ' (acordo de dívida)', k.aluno_nome, round(k.acordo_valor / greatest(k.acordo_parcelas, 1), 2),
    n || '/' || greatest(k.acordo_parcelas, 1)
  from cobrancas k cross join lateral generate_series(1, greatest(k.acordo_parcelas, 1)) n
  where k.etapa = 'acordo' and k.acordo_valor > 0 and k.acordo_primeiro_venc is not null
    and (k.acordo_primeiro_venc + ((n - 1) || ' month')::interval)::date >= current_date;

revoke all on public.v_fin_entradas, public.v_fin_saidas, public.v_fin_parcelado, public.v_fin_a_receber from anon;
grant select on public.v_fin_entradas, public.v_fin_saidas, public.v_fin_parcelado, public.v_fin_a_receber to authenticated;
