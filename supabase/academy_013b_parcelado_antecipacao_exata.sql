-- 013b (20/10/2026): no Parcelado Hotmart, o adiantamento de cada contrato passa a ser o valor EXATO do arquivo
-- "vendas aprovadas" (hotmart_parcelado_vendas), ligado pelo nome do comprador e pela data da compra (até 3 dias).
-- Sem o arquivo, continua a estimativa pelo percentual da conta (financeiro_config.antecipacao).
-- Descoberto no arquivo da Unique: a Hotmart adianta 50% do líquido do contrato (42,5% nas vendas mais novas).
create or replace view public.v_fin_parcelado with (security_invoker = true) as
 WITH s AS (
         SELECT a.id, a.integracao_id, lower(a.email) AS email, a.nome, a.oferta_codigo, a.produto_nome, a.tipo, a.adesao,
            (((a.bruto -> 'last_recurrency'::text) ->> 'number'::text))::integer AS ult,
            ((a.bruto -> 'last_recurrency'::text) ->> 'status'::text) AS ult_st,
            ((to_timestamp((((((a.bruto -> 'last_recurrency'::text) ->> 'request_date'::text))::bigint / 1000))::double precision) AT TIME ZONE 'America/Sao_Paulo'::text))::date AS ult_data
           FROM hotmart_assinaturas a
          WHERE ((a.tipo <> 'SUBSCRIPTION'::text) AND (a.status = 'ACTIVE'::text) AND (((a.bruto -> 'last_recurrency'::text) ->> 'request_date'::text) IS NOT NULL))
        ), np AS (
         SELECT lower(hotmart_pagamentos.comprador_email) AS email, hotmart_pagamentos.oferta_codigo,
            max(hotmart_pagamentos.parcelas_cartao) AS np,
            mode() WITHIN GROUP (ORDER BY hotmart_pagamentos.valor_liquido) FILTER (WHERE (hotmart_pagamentos.status = ANY (ARRAY['APPROVED'::text, 'COMPLETE'::text]))) AS liq,
            mode() WITHIN GROUP (ORDER BY hotmart_pagamentos.valor) FILTER (WHERE (hotmart_pagamentos.status = ANY (ARRAY['APPROVED'::text, 'COMPLETE'::text]))) AS bruto,
            count(*) FILTER (WHERE (hotmart_pagamentos.status = ANY (ARRAY['REFUNDED'::text, 'CHARGEBACK'::text]))) AS estornos
           FROM hotmart_pagamentos
          WHERE (hotmart_pagamentos.recorrencia IS NOT NULL)
          GROUP BY (lower(hotmart_pagamentos.comprador_email)), hotmart_pagamentos.oferta_codigo
        ), b AS (
         SELECT s.id, s.integracao_id, s.email, s.nome, s.oferta_codigo, s.produto_nome, s.tipo, s.ult, s.ult_st, s.ult_data,
            np.np, np.liq, np.bruto,
                CASE WHEN (s.ult_st = 'PAID'::text) THEN s.ult ELSE (s.ult - 1) END AS pagas,
            COALESCE(( SELECT ((c.antecipacao ->> s.integracao_id))::numeric FROM financeiro_config c), (0)::numeric) AS pct,
            ( SELECT pv.antecipacao FROM hotmart_parcelado_vendas pv
               WHERE pv.integracao_id = s.integracao_id
                 AND lower(extensions.unaccent(btrim(pv.comprador))) = lower(extensions.unaccent(btrim(s.nome)))
                 AND abs(pv.data_pagamento::date - s.adesao::date) <= 3
               ORDER BY abs(pv.data_pagamento::date - s.adesao::date) LIMIT 1) AS antecipado_real
           FROM (s JOIN np ON (((np.email = s.email) AND (np.oferta_codigo = s.oferta_codigo))))
          WHERE ((np.estornos = 0) AND (s.ult_data >= (CURRENT_DATE - 45)) AND (np.np > CASE WHEN (s.ult_st = 'PAID'::text) THEN s.ult ELSE (s.ult - 1) END))
        )
 SELECT b.id, b.integracao_id, i.conta_id, b.email, b.nome, b.produto_nome, b.tipo, b.np, b.pagas,
    (b.np - b.pagas) AS faltam,
    b.liq AS liquido_parcela,
    b.bruto AS bruto_parcela,
        CASE WHEN (b.ult_st = 'PAID'::text) THEN ((b.ult_data + '1 mon'::interval))::date ELSE b.ult_data END AS proxima,
    round((((b.np - b.pagas))::numeric * b.liq), 2) AS a_receber,
        CASE WHEN (b.tipo = 'SMART_INSTALLMENT'::text) THEN round(COALESCE(b.antecipado_real, (((b.pct / (100)::numeric) * (b.np)::numeric) * b.liq)), 2) ELSE (0)::numeric END AS antecipado_estimado,
        CASE WHEN (b.tipo = 'SMART_INSTALLMENT'::text) THEN round(GREATEST((0)::numeric, (COALESCE(b.antecipado_real, (((b.pct / (100)::numeric) * (b.np)::numeric) * b.liq)) - ((b.pagas)::numeric * b.liq))), 2) ELSE (0)::numeric END AS retido_estimado,
    b.antecipado_real IS NOT NULL AS antecipacao_exata
   FROM (b LEFT JOIN integracoes i ON ((i.id = b.integracao_id)));
