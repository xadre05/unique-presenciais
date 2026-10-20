-- 013 (20/10/2026): o que aconteceu de verdade na Carteira da Hotmart, importado dos arquivos que a Hotmart exporta.
--  * hotmart_extrato: cada linha do Extrato (Carteira → Extrato → Exportar CSV): vendas, tarifas, antecipações,
--    "Pagamento mensal - Parcelado Hotmart" (o dia 1º), saques e compras no cartão Hotmart. Ligada à venda pelo código HP.
--  * hotmart_parcelado_vendas: Vendas → Gestão do Parcelado Hotmart → vendas aprovadas: o faturamento líquido de cada
--    contrato e quanto a Hotmart ADIANTOU dele (valor exato, no lugar da estimativa por percentual).
--  Importar de novo o mesmo arquivo não duplica (chave por linha).
create table if not exists public.hotmart_extrato (
  id bigint generated always as identity primary key,
  integracao_id text not null,
  data_lancamento date,
  data_efetivacao date not null,
  status text,
  transacao text,
  antecipacao_id text,
  status_transacao text,
  descricao text not null,
  parcela text,
  valor numeric not null,
  produto text,
  saldo numeric,
  categoria text,
  chave text not null unique,
  importado_em timestamptz not null default now(),
  importado_por uuid default auth.uid()
);
create index if not exists hotmart_extrato_efetivacao on public.hotmart_extrato (integracao_id, data_efetivacao);
create index if not exists hotmart_extrato_transacao on public.hotmart_extrato (transacao) where transacao is not null;
alter table public.hotmart_extrato enable row level security;
create policy hextrato_admin on public.hotmart_extrato for all using (is_admin()) with check (is_admin());

create table if not exists public.hotmart_parcelado_vendas (
  id bigint generated always as identity primary key,
  integracao_id text not null,
  comprador text not null,
  produto text,
  data_pagamento timestamp not null,
  faturamento numeric not null,
  antecipacao numeric not null default 0,
  parcelas integer,
  valor_parcela numeric,
  pagamento text,
  status text,
  chave text not null unique,
  importado_em timestamptz not null default now()
);
alter table public.hotmart_parcelado_vendas enable row level security;
create policy hparc_admin on public.hotmart_parcelado_vendas for all using (is_admin()) with check (is_admin());

-- o extrato por mês (data em que o lançamento foi efetivado) e por grupo, para o Financeiro
create or replace view public.v_fin_extrato_mes with (security_invoker = true) as
  select integracao_id, date_trunc('month', data_efetivacao)::date mes,
    case
      when categoria in ('Compra com cartão ou saldo', 'Reembolso cartão hotmart') then 'cartao'
      when categoria = 'Saque' and descricao = 'Saque' then 'saque'
      when categoria = 'Saque' then 'tarifa_saque'
      when descricao = 'Tarifa de antecipação' or descricao ilike '%Taxa de Antecipação%' then 'custo_antecipacao'
      when categoria = 'Antecipação' then 'antecipacao_fluxo'
      when descricao ilike '%Estorno da antecipação - Parcelado%' then 'parcelado_estorno'
      when descricao ilike '%Antecipação - Parcelado%' then 'parcelado_adiantamento'
      when descricao ilike '%Pagamento mensal - Parcelado%' then 'parcelado_mensal'
      when descricao ilike '%Tarifa Hotmart%' or descricao ilike '%Tarifa Streaming%' or descricao ilike '%Tarifa de Parcelamento%' then 'tarifa_hotmart'
      when descricao ilike '%Co-Produtor%' or descricao ilike '%Afiliado%' or descricao ilike '%Doação%' then 'repasses'
      when descricao ilike '%Reserva%' then 'reserva'
      when descricao in ('Comissão de Venda', 'Recálculo de Comissões - Comissão de Venda') then 'vendas'
      when descricao ilike '%Comissão de Venda%' then 'estornos'
      when categoria in ('Bloqueio', 'Lançamento geral') then 'bloqueio'
      else 'outros'
    end grupo,
    count(*) n, sum(valor) valor
  from public.hotmart_extrato group by 1, 2, 3;
revoke all on public.v_fin_extrato_mes from anon;
grant select on public.v_fin_extrato_mes to authenticated;
