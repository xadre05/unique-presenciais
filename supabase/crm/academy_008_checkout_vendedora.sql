-- ════════════════════════════════════════════════════════════════════
-- Links da Black (/mayara, /naty, /annie, /grupo, /insta…): a página leva o código no "src" (ex.: zap-mayara).
-- 1) a origem do lead passa a guardar esse código (vira utm_source quando não houver utm);
-- 2) se o código é de uma vendedora, a tarefa do lead vai para ela (e o contato também, se ainda não tinha dona);
-- 3) os códigos novos das vendedoras entram na tabela de rastreios (a mesma que reconhece a vendedora na comissão).
-- ════════════════════════════════════════════════════════════════════
create or replace function crm_capturar_checkout(p_slug text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f crm_formularios; r jsonb; v_tel text; v_dados jsonb := p_dados; v_src text; v_vend uuid; v_contato uuid; v_novo boolean;
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

  -- código de vendedora → usuária do CRM
  if v_src is not null then
    select m.usuario_id into v_vend from rastreios x join vendedoras vd on vd.id = x.vendedora_id
      join crm_membros m on m.usuario_id = vd.perfil_id and m.empresa_id = f.empresa_id and m.ativo
     where lower(x.valor) = v_src and not x.nao_e_vendedora and vd.ativa limit 1;
  end if;
  select coalesce((dados->>'novo')::boolean, false) into v_novo from crm_eventos
   where contato_id = v_contato and tipo = 'captura' order by criado_em desc limit 1;
  if v_vend is not null then
    update crm_contatos set responsavel_id = v_vend where id = v_contato and (v_novo or responsavel_id is null);
  end if;

  update crm_tarefas t set
    vence_em = now() + make_interval(mins => greatest(f.primeiro_contato_apos_min, 0)),
    titulo = 'Foi ao pagamento e ainda não comprou: ' || coalesce(f.interesse, f.nome),
    responsavel_id = coalesce(v_vend, t.responsavel_id)
  where t.contato_id = v_contato and t.origem = 'captura' and t.feita_em is null and t.cancelada_em is null
    and t.criado_em > now() - interval '1 minute';
  return r;
end $$;

insert into rastreios (valor, vendedora_id, tipo_lead, nao_e_vendedora, observacao)
select x.valor, vd.id, 'proprio', false, 'Link da Black (/' || x.atalho || ')'
from (values ('zap-mayara', 'Mayara', 'mayara'), ('zap-naty', 'Natália', 'naty'), ('zap-annie', 'Annie Santana', 'annie')) x(valor, nome, atalho)
join vendedoras vd on vd.nome = x.nome
where not exists (select 1 from rastreios r where lower(r.valor) = x.valor);
