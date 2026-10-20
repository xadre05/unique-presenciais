-- ════════════════════════════════════════════════════════════════════
-- Página da Black → CRM, no formato que a página já envia.
-- 1) passos da página antes do formulário (abriu, escolheu turma, continuou…) por "visitante";
--    quando o lead chega com o mesmo visitante, os passos são ligados ao contato e resumidos na tarefa da vendedora;
-- 2) código "zap-<nome>" de vendedora nova (/v/nome) é reconhecido pelo primeiro nome, mesmo sem cadastro em rastreios;
-- 3) os avisos da Hotmart passam a guardar a origem (src), a turma (sck) e a oferta no histórico do contato.
-- Só acrescenta (tabela e funções novas) e amplia as duas funções do checkout/Hotmart sem mudar o que já faziam.
-- ════════════════════════════════════════════════════════════════════
create table crm_pagina_eventos (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references crm_empresas on delete cascade,
  formulario text not null,
  visitante text not null,
  evento text not null,
  dados jsonb not null default '{}',
  contato_id uuid references crm_contatos on delete set null,
  criado_em timestamptz not null default now()
);
create index crm_pagina_eventos_visitante on crm_pagina_eventos (empresa_id, visitante);
alter table crm_pagina_eventos enable row level security;
create policy crm_pagina_eventos_ver on crm_pagina_eventos for select to authenticated using (crm_sou_membro(empresa_id));

create function crm_registrar_evento_pagina(p_slug text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f crm_formularios; v_vis text := left(nullif(btrim(p_dados->>'visitante'), ''), 64); v_ev text := left(nullif(btrim(p_dados->>'evento'), ''), 40);
begin
  select * into f from crm_formularios where slug = lower(p_slug) and ativo;
  if f.id is null or v_vis is null or v_ev is null then return jsonb_build_object('ok', false); end if;
  -- trava contra abuso: no máximo 200 passos por visitante
  if (select count(*) from crm_pagina_eventos where empresa_id = f.empresa_id and visitante = v_vis) >= 200 then return jsonb_build_object('ok', true); end if;
  insert into crm_pagina_eventos (empresa_id, formulario, visitante, evento, dados, contato_id)
  values (f.empresa_id, f.slug, v_vis, v_ev, jsonb_strip_nulls(jsonb_build_object(
      'src', left(p_dados->>'src', 80), 'modulo', left(p_dados->>'modulo', 120), 'turma', left(p_dados->>'turma', 80),
      'utm', p_dados->'utm', 'pagina', left(p_dados->>'pagina', 300))),
    (select contato_id from crm_pagina_eventos where empresa_id = f.empresa_id and visitante = v_vis and contato_id is not null limit 1));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function crm_registrar_evento_pagina(text, jsonb) from public;
grant execute on function crm_registrar_evento_pagina(text, jsonb) to anon, authenticated;

-- resumo do caminho de um visitante, para a vendedora ("abriu 3 vezes · escolheu SCULPT-2026-12-A")
create function crm_resumo_caminho(p_empresa uuid, p_visitante text) returns text
language sql stable security definer set search_path = public as $$
  select nullif(concat_ws(' · ',
    (select 'abriu a página ' || count(*) || 'x' from crm_pagina_eventos where empresa_id = p_empresa and visitante = p_visitante and evento = 'pagina_aberta' having count(*) > 0),
    (select 'primeira visita ' || to_char(min(criado_em) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') from crm_pagina_eventos where empresa_id = p_empresa and visitante = p_visitante having count(*) > 0),
    (select 'turmas olhadas: ' || string_agg(distinct dados->>'turma', ', ') from crm_pagina_eventos where empresa_id = p_empresa and visitante = p_visitante and dados->>'turma' is not null having count(*) > 0)
  ), '')
$$;
revoke execute on function crm_resumo_caminho(uuid, text) from public, anon;

create or replace function crm_capturar_checkout(p_slug text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f crm_formularios; r jsonb; v_tel text; v_dados jsonb := p_dados; v_src text; v_vend uuid; v_contato uuid; v_novo boolean;
        v_vis text := left(nullif(btrim(p_dados->>'visitante'), ''), 64); v_caminho text;
begin
  v_src := nullif(lower(btrim(coalesce(p_dados->>'src', ''))), '');
  if v_src is not null and coalesce(p_dados->>'utm_source', '') = '' then
    v_dados := v_dados || jsonb_build_object('utm_source', v_src, 'utm_medium', coalesce(nullif(p_dados->>'utm_medium', ''), 'link'));
  end if;
  r := crm_capturar_lead(p_slug, jsonb_build_object('canal', 'checkout') || v_dados);
  select * into f from crm_formularios where slug = lower(p_slug);
  v_tel := crm_tel_br(coalesce(p_dados->>'telefone', p_dados->>'whatsapp', p_dados->>'phone', p_dados->>'celular'));
  select id into v_contato from crm_contatos where empresa_id = f.empresa_id and telefone = v_tel;
  if v_contato is null then return r; end if;

  -- passos da página do mesmo visitante passam a ser deste contato
  if v_vis is not null then
    update crm_pagina_eventos set contato_id = v_contato where empresa_id = f.empresa_id and visitante = v_vis and contato_id is null;
    v_caminho := crm_resumo_caminho(f.empresa_id, v_vis);
  end if;

  -- código de vendedora: tabela de rastreios; se for zap-<nome> sem cadastro, pelo primeiro nome
  if v_src is not null then
    select m.usuario_id into v_vend from rastreios x join vendedoras vd on vd.id = x.vendedora_id
      join crm_membros m on m.usuario_id = vd.perfil_id and m.empresa_id = f.empresa_id and m.ativo
     where lower(x.valor) = v_src and not x.nao_e_vendedora and vd.ativa limit 1;
    if v_vend is null and v_src like 'zap-_%' then
      select m.usuario_id into v_vend from vendedoras vd
        join crm_membros m on m.usuario_id = vd.perfil_id and m.empresa_id = f.empresa_id and m.ativo
       where vd.ativa and lower(unaccent(split_part(btrim(vd.nome), ' ', 1))) = lower(unaccent(substr(v_src, 5))) limit 1;
    end if;
  end if;
  select coalesce((dados->>'novo')::boolean, false) into v_novo from crm_eventos
   where contato_id = v_contato and tipo = 'captura' order by criado_em desc limit 1;
  if v_vend is not null then
    update crm_contatos set responsavel_id = v_vend where id = v_contato and (v_novo or responsavel_id is null);
  end if;

  update crm_tarefas t set
    vence_em = now() + make_interval(mins => greatest(f.primeiro_contato_apos_min, 0)),
    titulo = 'Foi ao pagamento e ainda não comprou: ' || coalesce(f.interesse, f.nome),
    responsavel_id = coalesce(v_vend, t.responsavel_id),
    nota = nullif(concat_ws(' · ', t.nota, 'origem: ' || v_src, v_caminho), '')
  where t.contato_id = v_contato and t.origem = 'captura' and t.feita_em is null and t.cancelada_em is null
    and t.criado_em > now() - interval '1 minute';
  return r;
end $$;

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
