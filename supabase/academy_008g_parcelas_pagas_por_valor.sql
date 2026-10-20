-- 008g (20/10/2026): parcelas pagas contadas pelo VALOR pago, não pelo número de pagamentos.
-- Na Hotmart um pagamento pode quitar várias parcelas atrasadas de uma vez (ex.: uma linha de R$ 592 = 2 parcelas de R$ 296).
-- Antes: pagas = nº de linhas aprovadas e valor da parcela = valor da última linha → se a última linha era um pagamento
-- duplo, a parcela ficava dobrada e a dívida inflada (71 de 233 contratos afetados). Negativar valor a mais é risco de
-- dano moral e devolução em dobro (orientação do advogado), então a conta tem que ser pelo valor:
--   valor da parcela = o valor que mais se repete entre os pagamentos aprovados (no empate, o menor)
--   parcelas pagas   = total pago ÷ valor da parcela (arredondado), limitado ao total de parcelas
-- Mesmas colunas, mesma ordem e tipos da versão 008f (create or replace view não deixa mudar).
create or replace view public.v_cobranca_online as
 WITH ass AS (
         SELECT a.integracao_id, a.email, a.produto_id,
            max(a.produto_nome) AS produto_nome, max(a.nome) AS nome, max(a.oferta_codigo) AS oferta_codigo,
            (max(a.nao_pagas))::bigint AS nao_pagas, (min(a.primeira_nao_paga))::date AS primeira_nao_paga,
            string_agg(DISTINCT a.status, ', '::text) AS status, false AS so_ativa
           FROM hotmart_assinaturas a
          WHERE a.tipo IS DISTINCT FROM 'SUBSCRIPTION'::text AND a.email IS NOT NULL AND a.nao_pagas > 0
            AND (a.status = 'DELAYED'::text OR a.status ~~ 'CANCELLED%'::text)
          GROUP BY a.integracao_id, a.email, a.produto_id
        ), pg AS (
         SELECT lower(h.comprador_email) AS email, h.produto_id, h.parcelas_cartao, h.valor, h.data_aprovacao,
            upper(h.status) = ANY (ARRAY['APPROVED'::text, 'COMPLETE'::text, 'COMPLETED'::text]) AS aprovado,
            upper(h.status) = ANY (ARRAY['REFUNDED'::text, 'CHARGEBACK'::text, 'PARTIALLY_REFUNDED'::text]) AS estorno
           FROM hotmart_pagamentos h
          WHERE h.recorrencia IS NOT NULL
        ), parc0 AS (
         SELECT pg.email, pg.produto_id,
            max(pg.parcelas_cartao) AS np,
            count(*) FILTER (WHERE pg.estorno) AS estornos,
            sum(pg.valor) FILTER (WHERE pg.aprovado) AS soma,
            mode() WITHIN GROUP (ORDER BY pg.valor) FILTER (WHERE pg.aprovado) AS parcela,
            max(pg.data_aprovacao) FILTER (WHERE pg.aprovado) AS ultima_data
           FROM pg
          GROUP BY pg.email, pg.produto_id
        ), parc AS (
         SELECT parc0.email, parc0.produto_id, parc0.np, parc0.estornos, parc0.parcela, parc0.ultima_data,
            (LEAST(COALESCE(parc0.np, 0), round(parc0.soma / NULLIF(parc0.parcela, 0))))::bigint AS pagas
           FROM parc0
        ), base AS (
         SELECT a.integracao_id, a.email, a.produto_id, a.produto_nome AS produto,
            COALESCE(a.nome, (SELECT max(h.comprador_nome) FROM hotmart_pagamentos h WHERE lower(h.comprador_email) = a.email)) AS nome,
            a.status AS status_hotmart, p.parcela AS valor_parcela, p.pagas, p.np, p.ultima_data,
                CASE
                    WHEN a.status ~~ '%DELAYED%'::text THEN COALESCE(p.np - p.pagas, a.nao_pagas)
                    ELSE LEAST(a.nao_pagas, COALESCE(p.np - p.pagas, a.nao_pagas))
                END AS faltam,
            a.primeira_nao_paga AS parou_em, false AS valor_estimado
           FROM ass a JOIN parc p ON p.email = a.email AND p.produto_id = a.produto_id
          WHERE p.estornos = 0 AND p.pagas >= 1 AND p.pagas < COALESCE(p.np::bigint, p.pagas + 1)
        ), datas AS (
         SELECT b.*,
            (SELECT count(*) FROM generate_series(0::bigint, GREATEST(b.faltam, 1::bigint) - 1) k(k)
              WHERE (b.parou_em + make_interval(months => k.k::integer))::date < CURRENT_DATE) AS vencidas
           FROM base b
        )
 SELECT 'online|'::text || d.email || '|'::text || COALESCE(d.produto_id::text, ''::text) AS chave,
    d.integracao_id, d.email, d.produto_id, d.produto, d.nome, d.status_hotmart, d.valor_parcela, d.pagas, d.np,
    d.ultima_data, d.vencidas, d.parou_em,
    round(d.valor_parcela * LEAST(d.vencidas, d.faltam)::numeric, 2) AS valor_vencido,
    round(d.valor_parcela * d.faltam::numeric, 2) AS valor_restante,
    d.valor_estimado
   FROM datas d;
