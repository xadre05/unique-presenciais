-- Captura da Black: o código do link (src) passa a ficar gravado na captura e na primeira origem do contato novo.
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

  -- o código do link (zap-naty, insta, grupo…) fica gravado na captura e, se o contato é novo, na primeira origem
  if v_src is not null then
    update crm_eventos set dados = dados || jsonb_build_object('src', v_src)
     where id = (select id from crm_eventos where contato_id = v_contato and tipo = 'captura' order by criado_em desc limit 1);
    update crm_contatos set primeira_origem = primeira_origem || jsonb_build_object('src', v_src)
     where id = v_contato and primeira_origem->>'formulario' = f.slug and not (primeira_origem ? 'src');
  end if;

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
