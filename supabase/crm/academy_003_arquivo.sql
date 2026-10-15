-- ════════════════════════════════════════════════════════════════════
-- UNIQUE: regras de tentativa/arquivo ligadas + Contatos esconde arquivados
-- arquivados: '' (padrão: some, a não ser numa busca por nome/telefone/e-mail), 'true' (todos), 'so' (só arquivados)
-- ════════════════════════════════════════════════════════════════════
update crm_empresas set config = config || '{"tentativas_max": 3, "dias_entre_tentativas": 2, "devolver_fila_min": 15}'::jsonb
where id = empresa_unique();

do $f$
declare d text;
begin
  d := pg_get_functiondef('contatos_filtrados(jsonb)'::regprocedure);
  d := replace(d, $r$  where c.empresa_id = empresa_unique()
$r$, $r$  where c.empresa_id = empresa_unique()
    and (case coalesce(p->>'arquivados', '') when 'so' then c.arquivado_em is not null when 'true' then true
         else c.arquivado_em is null or coalesce(p->>'busca', '') <> '' end)
$r$);
  if d not like '%arquivados%' then raise exception 'trecho não encontrado (filtro)'; end if;
  execute d;
  d := pg_get_functiondef('buscar_contatos(jsonb,integer,integer)'::regprocedure);
  d := replace(d, $r$c.nao_contatar, c.telefone_invalido,$r$, $r$c.nao_contatar, c.telefone_invalido, c.arquivado_em, c.arquivado_motivo,$r$);
  if d not like '%arquivado_motivo%' then raise exception 'trecho não encontrado (busca)'; end if;
  execute d;
  d := pg_get_functiondef('detalhe_contato(uuid)'::regprocedure);
  d := replace(d, $r$'resumo', to_jsonb(r),$r$, $r$'resumo', to_jsonb(r),
    'tentativas', crm_tentativas_sem_resposta(c.id),$r$);
  if d not like '%tentativas%' then raise exception 'trecho não encontrado (detalhe)'; end if;
  execute d;
end $f$;

-- quantos estão arquivados (para o atalho na tela de Contatos)
create function contar_arquivados() returns int
language sql stable security definer set search_path = public as $$
  select case when is_admin() then (select count(*)::int from crm_contatos where empresa_id = empresa_unique() and arquivado_em is not null) end
$$;
revoke execute on function contar_arquivados() from public, anon;


-- (054) lista: quando a vendedora marca "Respondeu", "Interessado" ou "Comprou", vale como resposta (zera as tentativas e tira do arquivo)
do $f$
declare d text;
begin
  d := pg_get_functiondef('marcar_contato_lista(uuid,jsonb)'::regprocedure);
  d := replace(d, $r$  if v_status = 'nao_quer' then$r$, $r$  if v_status in ('conversando', 'interessado', 'comprou') then
    insert into crm_eventos (empresa_id, contato_id, tipo, texto, autor_id) values (empresa_unique(), v.contato_id, 'respondeu', 'Respondeu (lista)', auth.uid());
    perform crm_desarquivar(v.contato_id, 'Respondeu (lista)');
  end if;
  if v_status = 'nao_quer' then$r$);
  if d not like '%Respondeu (lista)%' then raise exception 'trecho não encontrado (lista)'; end if;
  execute d;
end $f$;

-- (055) contato foi para o arquivo → nas listas manuais ativas, quem ainda estava "a contatar" ou "mensagem enviada" vira "Não respondeu"
create function academy_lista_ao_arquivar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.empresa_id = empresa_unique() and new.arquivado_em is not null and old.arquivado_em is null then
    update campanha_contatos cc set status = 'sem_resposta', atualizado_em = now(),
      nota = coalesce(cc.nota || ' · ', '') || coalesce(new.arquivado_motivo, 'arquivado')
    from campanhas k
    where k.id = cc.campanha_id and k.status = 'ativa' and cc.contato_id = new.id and cc.status in ('a_contatar', 'enviada');
  end if;
  return new;
end $$;
revoke execute on function academy_lista_ao_arquivar() from public, anon, authenticated;
create trigger academy_lista_ao_arquivar after update of arquivado_em on crm_contatos
  for each row execute function academy_lista_ao_arquivar();
