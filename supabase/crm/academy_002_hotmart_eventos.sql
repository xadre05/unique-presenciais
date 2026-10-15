-- ════════════════════════════════════════════════════════════════════
-- CRM — CAMADA DA UNIQUE: avisos da Hotmart viram eventos no motor,
-- follow-ups de recuperação, motivos de perda e rodízio entre vendedoras.
-- ════════════════════════════════════════════════════════════════════

-- aviso da Hotmart (webhook) → contato (com telefone do checkout) + evento no motor
create function crm_evento_hotmart(p_corpo jsonb) returns jsonb
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
    when 'PURCHASE_COMPLETE' then null                       -- já contou no APPROVED
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
  select id into v_contato from crm_contatos
   where empresa_id = empresa_unique() and ((v_tel is not null and telefone = v_tel) or (v_email is not null and v_email = any (emails)))
   order by (telefone = v_tel) desc nulls last limit 1;
  if v_contato is null then return jsonb_build_object('ignorado', 'contato não achado'); end if;

  perform crm_evento(empresa_unique(), v_contato, v_evento, jsonb_build_object(
    'produto', d->'product'->>'name', 'transacao', pu->>'transaction', 'forma', pu->'payment'->>'type',
    'link_pagamento', coalesce(pu->'payment'->>'billet_url', pu->'payment'->>'pix_url', pu->>'sckPaymentLink', d->>'checkout_url'),
    'valor', pu->'price'->>'value'));
  return jsonb_build_object('evento', v_evento, 'contato', v_contato);
end $$;
revoke execute on function crm_evento_hotmart(jsonb) from public, anon, authenticated;
grant execute on function crm_evento_hotmart(jsonb) to service_role;

-- configuração da Unique: rodízio ligado; administradores fora do rodízio
update crm_empresas set config = config || '{"rodizio": true, "prazo_primeiro_contato_min": 5}' where id = empresa_unique();
update crm_membros set recebe_leads = false where empresa_id = empresa_unique() and papel = 'admin';

-- motivos de perda (curtos, como na pesquisa)
insert into crm_motivos_perda (empresa_id, nome, ordem) values
  (empresa_unique(), 'Preço', 1), (empresa_unique(), 'Sem tempo agora', 2), (empresa_unique(), 'Comprou de outro', 3),
  (empresa_unique(), 'Não é da área (dentista, biomédica...)', 4), (empresa_unique(), 'Não respondeu ao follow-up', 5),
  (empresa_unique(), 'Só curiosidade', 6), (empresa_unique(), 'Outro', 7);

-- etapas: funil curto da pesquisa (Novo → Em conversa → Interessado → Aguardando pagamento → Comprou / Perdido)
update crm_etapas set nome = 'Aguardando pagamento' where empresa_id = empresa_unique() and nome = 'Negociando';

-- follow-ups (cadências)
with c as (
  insert into crm_cadencias (empresa_id, nome, passos, tipo_tarefa) values
  (empresa_unique(), 'Recuperação — Pix ou boleto gerado', '[
     {"apos_horas": 0,  "tipo": "tarefa", "titulo": "Gerou Pix/boleto e não pagou: chamar agora", "texto": "Pergunte se ficou alguma dúvida. Não fale de pagamento logo de cara."},
     {"apos_horas": 24, "tipo": "tarefa", "titulo": "Recuperação dia 2: viu minha mensagem?", "texto": "Retome a conversa e mande o link de pagamento."},
     {"apos_horas": 72, "tipo": "tarefa", "titulo": "Recuperação dia 3: último contato", "texto": "Encerramento: o que muda se deixar para depois + link."}
   ]', 'recuperacao'),
  (empresa_unique(), 'Recuperação — carrinho abandonado', '[
     {"apos_horas": 0,  "tipo": "tarefa", "titulo": "Abandonou o carrinho: chamar agora", "texto": "Pergunte se ficou alguma dúvida sobre o curso."},
     {"apos_horas": 24, "tipo": "tarefa", "titulo": "Carrinho dia 2: viu minha mensagem?", "texto": "Retome e mande o link."},
     {"apos_horas": 72, "tipo": "tarefa", "titulo": "Carrinho dia 3: último contato", "texto": "Encerramento com o link."}
   ]', 'recuperacao'),
  (empresa_unique(), 'Lead novo — 4 toques', '[
     {"apos_horas": 0,   "tipo": "tarefa", "titulo": "Lead novo: primeiro contato", "texto": "Apresente-se e pergunte o que procura."},
     {"apos_horas": 24,  "tipo": "tarefa", "titulo": "Lead novo dia 2", "texto": "Retome com um conteúdo ou depoimento."},
     {"apos_horas": 72,  "tipo": "tarefa", "titulo": "Lead novo dia 4", "texto": "Pergunte se quer saber valores e condições."},
     {"apos_horas": 168, "tipo": "tarefa", "titulo": "Lead novo dia 8: último toque", "texto": "Último contato antes de marcar como perdido."}
   ]', 'follow_up')
  returning id, nome)
insert into crm_regras (empresa_id, evento, acao, parametros, ordem)
select empresa_unique(), r.evento, r.acao, r.parametros, r.ordem from (values
  ('compra_aprovada', 'marcar_ganho', '{}'::jsonb, 1),
  ('compra_aprovada', 'etiqueta', '{"tag": "comprou-hotmart"}'::jsonb, 2),
  ('aguardando_pagamento', 'iniciar_cadencia', jsonb_build_object('cadencia_id', (select id from c where nome like 'Recuperação — Pix%')), 1),
  ('carrinho_abandonado', 'iniciar_cadencia', jsonb_build_object('cadencia_id', (select id from c where nome like 'Recuperação — carrinho%')), 1),
  ('reembolso', 'etiqueta', '{"tag": "reembolso"}'::jsonb, 1),
  ('reembolso', 'criar_tarefa', '{"titulo": "Pediu reembolso: entender o motivo", "tipo": "contato", "horas": 0}'::jsonb, 2)
) r(evento, acao, parametros, ordem);
