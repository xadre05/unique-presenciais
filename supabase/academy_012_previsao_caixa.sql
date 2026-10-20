-- 012 (20/10/2026): Previsão de caixa — "quanto entra até o fim do mês, quanto sai, quanto falta".
--  * saldos informados à mão (Carteira da Hotmart: disponível e a liberar; banco: saldo), com data e quem informou;
--  * v_fin_previsao: cada entrada esperada com o valor que de fato chega (no Parcelado Hotmart com antecipação,
--    as primeiras parcelas ficam com a Hotmart até cobrir o adiantamento) e a situação: a vencer, atrasada,
--    sem data ou a conferir (aluno avisou que pagou e ninguém conferiu no banco);
--    forma (cartão, Pix, boleto…) e automatico = a Hotmart cobra sozinha todo mês (Parcelado Hotmart / recuperação);
--    data_credito = quando o dinheiro fica disponível (Hotmart: dia 1º do mês seguinte ao pagamento da parcela).
alter table public.financeiro_config
  add column if not exists saldos jsonb not null default '{}'::jsonb;

create or replace view public.v_fin_previsao with (security_invoker = true) as
  select 'h:' || p.id || ':' || k.k as id,
    (p.proxima + ((k.k - 1) || ' month')::interval)::date as data,
    'hotmart'::text as origem, p.integracao_id, p.conta_id,
    p.produto_nome as descricao, p.nome as pessoa, p.email,
    (p.pagas + k.k) || '/' || p.np as parcela,
    p.liquido_parcela as valor_aluno,
    case when p.tipo = 'SMART_INSTALLMENT'
      then least(p.liquido_parcela, greatest(0, (p.pagas + k.k) * p.liquido_parcela - p.antecipado_estimado))
      else p.liquido_parcela end as valor,
    case when (p.proxima + ((k.k - 1) || ' month')::interval)::date < current_date then 'atrasada' else 'a_vencer' end as situacao,
    coalesce(f.forma, 'BILLET') as forma, true as automatico, p.tipo as plano,
    -- a Hotmart junta as parcelas pagas no mês e libera tudo no dia 1º do mês seguinte ("Saldo de parcelas" no Extrato)
    (date_trunc('month', greatest((p.proxima + ((k.k - 1) || ' month')::interval)::date, current_date)) + interval '1 month')::date as data_credito
  from v_fin_parcelado p cross join lateral generate_series(1, p.faltam) k(k)
  left join lateral (select h.forma from hotmart_pagamentos h where lower(h.comprador_email) = p.email and h.produto_nome = p.produto_nome
    and h.recorrencia is not null and h.status in ('APPROVED', 'COMPLETE') order by h.data_aprovacao desc nulls last limit 1) f on true
  union all
  select 'p:' || p.id, p.vencimento, 'presencial', null, p.conta_id,
    coalesce(p.curso_nome, 'Curso presencial'), p.aluno_nome, null,
    p.numero || '/' || p.total_parcelas, p.valor, p.valor,
    case when p.status = 'informada' then 'a_conferir' when p.vencimento is null then 'sem_data'
      when p.vencimento < current_date then 'atrasada' else 'a_vencer' end,
    p.forma, false, null, p.vencimento
  from v_parcelas p
  where p.status in ('prevista', 'informada') and p.forma <> 'hotmart_parcelado' and not coalesce(p.considerada_paga, false)
  union all
  select 'a:' || k.id || ':' || n.n, (k.acordo_primeiro_venc + ((n.n - 1) || ' month')::interval)::date, 'acordo', k.integracao_id, null,
    coalesce(k.produto, 'Acordo') || ' (acordo de dívida)', k.aluno_nome, k.email,
    n.n || '/' || greatest(k.acordo_parcelas, 1),
    round(k.acordo_valor / greatest(k.acordo_parcelas, 1), 2), round(k.acordo_valor / greatest(k.acordo_parcelas, 1), 2), 'a_vencer',
    'acordo', false, null, (k.acordo_primeiro_venc + ((n.n - 1) || ' month')::interval)::date
  from cobrancas k cross join lateral generate_series(1, greatest(k.acordo_parcelas, 1)) n(n)
  where k.etapa = 'acordo' and k.acordo_valor > 0 and k.acordo_primeiro_venc is not null
    and (k.acordo_primeiro_venc + ((n.n - 1) || ' month')::interval)::date >= current_date;
revoke all on public.v_fin_previsao from anon;
grant select on public.v_fin_previsao to authenticated;
