-- ════════════════════════════════════════════════════════════════════
-- Comissão da Black 2026: R$ 250 fixos por venda com vendedora (decisão de 20/10/2026, no lugar dos 10%/5%),
-- igual ao presencial. Só a primeira cobrança de cada venda gera comissão; reembolso/chargeback cancela.
-- Nova coluna hotmart_ofertas_cursos.comissao_fixa (vale quando comissao_online = true).
-- ════════════════════════════════════════════════════════════════════
alter table public.hotmart_ofertas_cursos add column if not exists comissao_fixa numeric(10,2);
comment on column public.hotmart_ofertas_cursos.comissao_fixa is 'Comissão fixa por venda desta oferta (só na primeira cobrança). Se vazia, usa os % da regra do online.';
update public.hotmart_ofertas_cursos set comissao_fixa = 250 where oferta_codigo in ('9r0jcoeg', '54utqf4b');

CREATE OR REPLACE FUNCTION interno.gerar_comissao_online(p_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  hp hotmart_pagamentos; r comissao_online_regras; v_vend uuid; v_tipo text; v_origem text; v_base numeric; v_pct numeric; v_comp date; v_atual comissoes_online;
  v_fixa numeric; v_valor numeric;
begin
  select * into hp from hotmart_pagamentos where id = p_id;
  if not found then return 'nao_encontrado'; end if;
  select * into v_atual from comissoes_online where pagamento_id = p_id;

  if upper(coalesce(hp.status,'')) not in ('APPROVED','COMPLETE','COMPLETED') then
    if v_atual.id is not null and v_atual.status in ('pendente','liberada') and upper(coalesce(hp.status,'')) in ('REFUNDED','CHARGEBACK','CANCELLED','CANCELED','PROTESTED','DISPUTE') then
      update comissoes_online set status = 'cancelada', observacao = trim(coalesce(observacao || ' · ', '') || 'Pagamento ' || hp.status || ' na Hotmart') where id = v_atual.id;
      return 'cancelada';
    end if;
    return 'sem_comissao';
  end if;
  if hotmart_curso_do_pagamento(hp.produto_id, hp.oferta_codigo) is not null
     and not coalesce((select o.comissao_online from hotmart_ofertas_cursos o where o.oferta_codigo = hp.oferta_codigo limit 1), false) then return 'presencial'; end if;
  if hp.data_aprovacao is null or coalesce(hp.valor_liquido, 0) <= 0 then return 'sem_valor'; end if;
  -- oferta com comissão fixa (Black 2026: R$ 250 por venda): só a primeira cobrança da venda gera comissão
  select o.comissao_fixa into v_fixa from hotmart_ofertas_cursos o where o.oferta_codigo = hp.oferta_codigo and o.comissao_fixa is not null limit 1;
  if v_fixa is not null and p_id like '%#%' and coalesce(nullif(split_part(p_id, '#', 2), '')::int, 1) > 1 then return 'parcela_seguinte'; end if;

  select * into r from comissao_online_regras where vigente_desde <= (hp.data_aprovacao at time zone 'America/Sao_Paulo')::date order by vigente_desde desc limit 1;
  if r.id is null then return 'antes_do_inicio'; end if;

  select a.vendedora_id, a.tipo_lead into v_vend, v_tipo from atribuicoes_online a
   where a.status = 'aprovada' and lower(a.comprador_email) = lower(hp.comprador_email) and (a.produto_id is null or a.produto_id = hp.produto_id)
   order by (a.produto_id is null), a.decidido_em desc limit 1;
  if v_vend is not null then v_origem := 'atribuicao';
  else
    select x.vendedora_id, x.tipo_lead into v_vend, v_tipo from rastreios x
     where hp.rastreio is not null and lower(x.valor) = lower(hp.rastreio) and not x.nao_e_vendedora and x.vendedora_id is not null;
    if v_vend is not null then v_origem := 'rastreio'; end if;
  end if;

  if v_vend is null then
    if v_atual.id is not null and v_atual.status = 'pendente' then
      update comissoes_online set status = 'cancelada', observacao = trim(coalesce(observacao || ' · ', '') || 'Venda deixou de estar ligada a uma vendedora') where id = v_atual.id;
    end if;
    return 'sem_vendedora';
  end if;

  v_tipo := coalesce(v_tipo, 'proprio');
  v_pct := case when v_tipo = 'proprio' then r.pct_proprio else r.pct_campanha end;
  v_base := hp.valor_liquido;
  v_comp := date_trunc('month', hp.data_aprovacao at time zone 'America/Sao_Paulo')::date;
  if v_fixa is not null then v_pct := 0; v_valor := v_fixa; else v_valor := round(v_base * v_pct / 100, 2); end if;

  if v_atual.id is null then
    insert into comissoes_online (pagamento_id, vendedora_id, tipo_lead, origem, rastreio, base, percentual, valor, competencia)
    values (p_id, v_vend, v_tipo, v_origem, hp.rastreio, v_base, v_pct, v_valor, v_comp);
    return 'criada';
  elsif v_atual.status in ('pendente','cancelada') then
    update comissoes_online set vendedora_id = v_vend, tipo_lead = v_tipo, origem = v_origem, rastreio = hp.rastreio, base = v_base,
      percentual = v_pct, valor = v_valor, competencia = v_comp, status = 'pendente'
     where id = v_atual.id;
    return 'atualizada';
  end if;
  return 'mantida';
end $function$;
