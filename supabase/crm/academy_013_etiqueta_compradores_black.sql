-- Avisos da Hotmart: quem compra (ou gera Pix/abandona) numa oferta da Black ganha a etiqueta black-2026; quem compra, também black-2026-comprou.
create or replace function crm_evento_hotmart(p_corpo jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ev text := p_corpo->>'event';
  d jsonb := coalesce(p_corpo->'data', '{}');
  b jsonb := coalesce(d->'buyer', '{}');
  pu jsonb := coalesce(d->'purchase', '{}');
  v_tel text := crm_tel_br(coalesce(b->>'checkout_phone', b->>'phone', ''));
  v_email text := lower(nullif(trim(b->>'email'), ''));
  v_rec int := coalesce((pu->>'recurrence_number')::int, (pu->>'recurrency_number')::int, 1);
  v_evento text; v_contato uuid;
begin
  v_evento := case ev
    when 'PURCHASE_APPROVED' then 'compra_aprovada'
    when 'PURCHASE_COMPLETE' then null
    when 'PURCHASE_BILLET_PRINTED' then 'aguardando_pagamento'
    when 'PURCHASE_OUT_OF_SHOPPING_CART' then 'carrinho_abandonado'
    when 'PURCHASE_EXPIRED' then 'pagamento_expirou'
    when 'PURCHASE_CANCELED' then 'compra_cancelada'
    when 'PURCHASE_DELAYED' then 'pagamento_atrasado'
    when 'PURCHASE_REFUNDED' then 'reembolso'
    when 'PURCHASE_CHARGEBACK' then 'reembolso'
    when 'PURCHASE_PROTEST' then 'reembolso'
    else null end;
  if v_evento is null then return jsonb_build_object('ignorado', ev); end if;
  if v_evento = 'compra_aprovada' and v_rec > 1 then return jsonb_build_object('ignorado', 'parcela de assinatura'); end if;
  if v_tel is null and v_email is null then return jsonb_build_object('ignorado', 'sem contato'); end if;

  perform crm_mesclar_contato(empresa_unique(), jsonb_build_object(
    'nome', b->>'name', 'telefone', v_tel, 'emails', case when v_email is not null then jsonb_build_array(v_email) else '[]'::jsonb end,
    'tags', jsonb_build_array('hotmart'), 'cidade', b->'address'->>'city', 'uf', b->'address'->>'state'), 'hotmart');
  -- e-mail primeiro (é o que a pessoa digita no checkout), depois telefone
  select id into v_contato from crm_contatos
   where empresa_id = empresa_unique() and ((v_tel is not null and telefone = v_tel) or (v_email is not null and v_email = any (emails)))
   order by (v_email is not null and v_email = any (emails)) desc, (telefone = v_tel) desc nulls last limit 1;
  if v_contato is null then return jsonb_build_object('ignorado', 'contato não achado'); end if;
  -- ofertas da Black (cadastradas em hotmart_ofertas_cursos com observação "Black…"): etiqueta black-2026, e black-2026-comprou na compra
  if exists (select 1 from hotmart_ofertas_cursos o where o.oferta_codigo = pu->'offer'->>'code' and o.observacao ilike 'black%') then
    update crm_contatos set tags = (select array_agg(distinct t) from unnest(tags || array['black-2026']
        || case when v_evento = 'compra_aprovada' then array['black-2026-comprou'] else '{}'::text[] end) t)
     where id = v_contato;
  end if;
  -- quem comprou sem passar pela página: a origem é a da Hotmart
  update crm_contatos set primeira_origem = jsonb_strip_nulls(jsonb_build_object('canal', 'hotmart-direto', 'quando', now(),
      'utm_source', nullif(pu->'origin'->>'src', ''), 'turma', nullif(pu->'origin'->>'sck', '')))
   where id = v_contato and primeira_origem is null;

  perform crm_evento(empresa_unique(), v_contato, v_evento, jsonb_strip_nulls(jsonb_build_object(
    'produto', d->'product'->>'name', 'transacao', pu->>'transaction', 'forma', pu->'payment'->>'type',
    'link_pagamento', coalesce(pu->'payment'->>'billet_url', pu->'payment'->>'pix_url', pu->>'sckPaymentLink', d->>'checkout_url'),
    'valor', pu->'price'->>'value', 'parcelas', pu->'payment'->>'installments_number',
    'origem', nullif(pu->'origin'->>'src', ''), 'turma', nullif(pu->'origin'->>'sck', ''), 'oferta', pu->'offer'->>'code')));
  return jsonb_build_object('evento', v_evento, 'contato', v_contato);
end $$;
