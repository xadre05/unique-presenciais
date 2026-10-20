-- ════════════════════════════════════════════════════════════════════
-- CRM — lead que vai para o pagamento (página da Black → checkout da Hotmart).
-- A página manda nome, WhatsApp, e-mail, formação, curso/data e a origem (utm) no clique "Ir para o pagamento".
-- O lead entra na hora, mas o primeiro contato da vendedora só vence depois de um tempo (para não ligar
-- enquanto a pessoa ainda está pagando). Se a compra for aprovada antes, essa tarefa é cancelada sozinha.
-- Só acrescenta: coluna nova, função nova, gatilho novo, formulário novo.
-- ════════════════════════════════════════════════════════════════════
alter table crm_formularios add column if not exists primeiro_contato_apos_min int not null default 0;

create function crm_capturar_checkout(p_slug text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f crm_formularios; r jsonb; v_tel text;
begin
  r := crm_capturar_lead(p_slug, jsonb_build_object('canal', 'checkout') || p_dados);
  select * into f from crm_formularios where slug = lower(p_slug);
  v_tel := crm_tel_br(coalesce(p_dados->>'telefone', p_dados->>'whatsapp', p_dados->>'phone', p_dados->>'celular'));
  update crm_tarefas t set
    vence_em = now() + make_interval(mins => greatest(f.primeiro_contato_apos_min, 0)),
    titulo = 'Foi ao pagamento e ainda não comprou: ' || coalesce(f.interesse, f.nome)
  from crm_contatos c
  where c.id = t.contato_id and c.empresa_id = f.empresa_id and c.telefone = v_tel
    and t.origem = 'captura' and t.feita_em is null and t.cancelada_em is null and t.criado_em > now() - interval '1 minute';
  return r;
end $$;
revoke execute on function crm_capturar_checkout(text, jsonb) from public;
grant execute on function crm_capturar_checkout(text, jsonb) to anon, authenticated;

-- comprou → a tarefa "foi ao pagamento e ainda não comprou" perde o sentido
create function crm_fechar_checkout_ao_ganhar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update crm_tarefas set cancelada_em = now()
  where contato_id = new.id and origem = 'captura' and feita_em is null and cancelada_em is null
    and titulo like 'Foi ao pagamento e ainda não comprou:%';
  return new;
end $$;
create trigger crm_contatos_fechar_checkout after update of ganho_em on crm_contatos
  for each row when (new.ganho_em is not null and old.ganho_em is distinct from new.ganho_em)
  execute function crm_fechar_checkout_ao_ganhar();

-- formulário da página da Black (o endereço que a página usa)
insert into crm_formularios (empresa_id, nome, slug, titulo, botao, pedir_email, interesse, etiquetas, obrigado, primeiro_contato_apos_min)
values (empresa_unique(), 'Página da Black (foi ao pagamento)', 'black-2026', 'Black Friday Limited Edition', 'Ir para o pagamento', true,
        'Black Friday Limited Edition', array['black-2026'], 'Seguindo para o pagamento.', 60);
