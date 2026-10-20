-- 008h (20/10/2026): parcela do presencial vendida pelo Parcelado Hotmart é cobrada pela Hotmart: o atraso aparece na
-- cobrança online, não na do presencial. Antes contava duas vezes (a mesma aluna nas duas filas) e uma parcela paga na
-- Hotmart sem baixa na matrícula virava dívida falsa. As 3 cobranças do presencial que existiam eram todas desse tipo.
with f as (
  update public.cobrancas c set etapa = 'encerrada', atualizado_em = now()
  where c.origem = 'presencial' and c.etapa not in ('paga', 'sem_acordo', 'encerrada')
    and not exists (select 1 from public.v_parcelas q where q.matricula_id = c.matricula_id and q.situacao = 'atrasada' and q.forma <> 'hotmart_parcelado')
  returning c.id
)
insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
select id, 'sistema', 'Saiu da cobrança do presencial: as parcelas são do Parcelado Hotmart e o atraso é acompanhado pela Hotmart (cobrança online)', null, 'Sistema' from f;

create or replace view public.v_cobranca_presencial as
 SELECT ('presencial|'::text || matricula_id) AS chave,
    matricula_id,
    max(aluno_nome) AS aluno_nome,
    max(aluno_whatsapp) AS telefone,
    max(turma_nome) AS produto,
    sum(valor) AS valor_vencido,
    (count(*))::integer AS vencidas,
    min(vencimento) AS parou_em,
    ( SELECT sum(q.valor) AS sum
           FROM v_parcelas q
          WHERE q.matricula_id = p.matricula_id AND q.forma <> 'hotmart_parcelado'
            AND q.situacao = ANY (ARRAY['atrasada'::text, 'a_vencer'::text, 'sem_vencimento'::text])) AS valor_restante,
    ( SELECT max(q.data_recebimento) AS max
           FROM v_parcelas q
          WHERE q.matricula_id = p.matricula_id AND q.considerada_paga) AS ultimo_pagamento_em
   FROM v_parcelas p
  WHERE situacao = 'atrasada'::text AND forma <> 'hotmart_parcelado'
  GROUP BY matricula_id;
