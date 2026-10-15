-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO: tentativas sem resposta → arquivo; lead sem primeiro contato → próxima da fila;
-- apagar dados a pedido da pessoa (LGPD).
-- config da empresa: {"tentativas_max": 3, "dias_entre_tentativas": 2, "devolver_fila_min": 15}
-- ════════════════════════════════════════════════════════════════════

alter table crm_contatos add column arquivado_em timestamptz;
alter table crm_contatos add column arquivado_motivo text;
create index crm_contatos_ativos on crm_contatos (empresa_id) where arquivado_em is null;

-- tentativas sem resposta desde a última vez que a pessoa escreveu:
-- dias com mensagem nossa, com WhatsApp aberto pela lista ou com tarefa de contato feita
create function crm_tentativas_sem_resposta(p_contato uuid) returns int
language sql stable security definer set search_path = public as $$
  -- resposta = mensagem recebida, ou evento 'respondeu' (resposta fora da caixa, ex.: celular da vendedora) ou 'reativado' (054)
  with ultima_resposta as (
    select greatest(
      (select max(m.criado_em) from crm_mensagens m join crm_conversas v on v.id = m.conversa_id where v.contato_id = p_contato and m.direcao = 'entrada'),
      (select max(e.criado_em) from crm_eventos e where e.contato_id = p_contato and e.tipo in ('respondeu', 'reativado')),
      '-infinity'::timestamptz) em
  ), dias as (
    select (m.criado_em at time zone 'America/Sao_Paulo')::date d from crm_mensagens m join crm_conversas v on v.id = m.conversa_id, ultima_resposta u
    where v.contato_id = p_contato and m.direcao = 'saida' and m.autor in ('atendente', 'disparo', 'ia') and m.criado_em > u.em
    union
    select (e.criado_em at time zone 'America/Sao_Paulo')::date from crm_eventos e, ultima_resposta u
    where e.contato_id = p_contato and e.tipo = 'whatsapp' and e.criado_em > u.em
    union
    select (t.feita_em at time zone 'America/Sao_Paulo')::date from crm_tarefas t, ultima_resposta u
    where t.contato_id = p_contato and t.feita_em > u.em and t.tipo in ('contato', 'follow_up', 'recuperacao', 'retorno')
  )
  select count(*)::int from dias
$$;
revoke execute on function crm_tentativas_sem_resposta(uuid) from public, anon, authenticated;

create function crm_arquivar(p_contato uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from crm_contatos where id = p_contato;
  update crm_contatos set arquivado_em = now(), arquivado_motivo = p_motivo where id = p_contato and arquivado_em is null;
  update crm_cadencia_inscricoes set status = 'parada', parada_motivo = 'arquivado' where contato_id = p_contato and status = 'ativa';
  update crm_tarefas set cancelada_em = now() where contato_id = p_contato and feita_em is null and cancelada_em is null;
  update crm_disparo_itens set status = 'pulado', erro = 'arquivado' where contato_id = p_contato and status = 'fila';
  update crm_conversas set status = 'resolvida' where contato_id = p_contato and status = 'aberta' and not aguardando_resposta;
  insert into crm_eventos (empresa_id, contato_id, tipo, texto) values (v_emp, p_contato, 'arquivado', p_motivo);
end $$;
revoke execute on function crm_arquivar(uuid, text) from public, anon, authenticated;

-- volta do arquivo (respondeu, comprou ou alguém reativou). Se tinha ido para Perdido por não responder, volta para o início do funil.
create function crm_desarquivar(p_contato uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from crm_contatos where id = p_contato and arquivado_em is not null and not nao_contatar;
  if v_emp is null then return; end if;
  update crm_contatos k set arquivado_em = null, arquivado_motivo = null,
    perdido_em = case when k.motivo_perda = 'Não respondeu ao follow-up' then null else k.perdido_em end,
    etapa_id = case when k.motivo_perda = 'Não respondeu ao follow-up'
                    then (select id from crm_etapas where empresa_id = v_emp and final is null order by ordem limit 1) else k.etapa_id end,
    etapa_em = case when k.motivo_perda = 'Não respondeu ao follow-up' then now() else k.etapa_em end,
    motivo_perda = case when k.motivo_perda = 'Não respondeu ao follow-up' then null else k.motivo_perda end
  where id = p_contato;
  insert into crm_eventos (empresa_id, contato_id, tipo, texto) values (v_emp, p_contato, 'reativado', p_motivo);
end $$;
revoke execute on function crm_desarquivar(uuid, text) from public, anon, authenticated;

-- pela tela: arquivar à mão ou reativar
create function crm_arquivo(p_contato uuid, p_arquivar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from crm_contatos where id = p_contato;
  if v_emp is null or not crm_pode_ver_contato(p_contato) then raise exception 'Contato não encontrado.'; end if;
  if p_arquivar then perform crm_arquivar(p_contato, coalesce(nullif(trim(p_motivo), ''), 'Arquivado à mão'));
  else
    if (select nao_contatar from crm_contatos where id = p_contato) then raise exception 'Essa pessoa pediu para não ser contatada.'; end if;
    perform crm_desarquivar(p_contato, 'Reativado à mão');
  end if;
end $$;
revoke execute on function crm_arquivo(uuid, boolean, text) from public, anon;

-- roda de hora em hora: quem passou do limite de tentativas sem resposta vai para o arquivo
create function crm_arquivar_sem_resposta() returns int
language plpgsql security definer set search_path = public as $$
declare e record; c record; n int := 0; v_max int; v_dias int;
begin
  for e in select id, config from crm_empresas loop
    v_max := coalesce((e.config->>'tentativas_max')::int, 3);
    v_dias := coalesce((e.config->>'dias_entre_tentativas')::int, 2);
    if v_max <= 0 then continue; end if;
    for c in
      select k.id from crm_contatos k
      where k.empresa_id = e.id and k.arquivado_em is null and k.ganho_em is null and not k.nao_contatar
        -- já houve contato nosso recente o bastante para contar, e o último foi há mais que o intervalo
        and not exists (select 1 from crm_cadencia_inscricoes i where i.contato_id = k.id and i.status = 'ativa')
        and (exists (select 1 from crm_mensagens m join crm_conversas v on v.id = m.conversa_id where v.contato_id = k.id and m.direcao = 'saida' and m.autor in ('atendente', 'disparo', 'ia'))
             or exists (select 1 from crm_eventos ev where ev.contato_id = k.id and ev.tipo = 'whatsapp')
             or exists (select 1 from crm_tarefas t where t.contato_id = k.id and t.feita_em is not null))
    loop
      if crm_tentativas_sem_resposta(c.id) >= v_max
         and not exists (select 1 from crm_mensagens m join crm_conversas v on v.id = m.conversa_id
                         where v.contato_id = c.id and m.direcao = 'saida' and m.autor in ('atendente', 'disparo', 'ia') and m.criado_em > now() - make_interval(days => v_dias))
         and not exists (select 1 from crm_eventos ev where ev.contato_id = c.id and ev.tipo = 'whatsapp' and ev.criado_em > now() - make_interval(days => v_dias))
         and not exists (select 1 from crm_tarefas t where t.contato_id = c.id and t.feita_em > now() - make_interval(days => v_dias))
      then
        update crm_contatos set perdido_em = coalesce(perdido_em, now()), motivo_perda = coalesce(motivo_perda, 'Não respondeu ao follow-up'),
          etapa_id = coalesce((select id from crm_etapas where empresa_id = e.id and final = 'perdido' order by ordem limit 1), etapa_id), etapa_em = now()
        where id = c.id;
        perform crm_arquivar(c.id, format('Não respondeu a %s tentativas', v_max));
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function crm_arquivar_sem_resposta() from public, anon, authenticated;

-- roda a cada 5 min: lead sem primeiro contato além do prazo passa para a próxima disponível (horário comercial)
create function crm_devolver_parados() returns int
language plpgsql security definer set search_path = public as $$
declare e record; v record; n int := 0; v_min int; v_prox uuid;
begin
  if extract(hour from now() at time zone 'America/Sao_Paulo') not between 8 and 19
     or extract(isodow from now() at time zone 'America/Sao_Paulo') > 6 then return 0; end if;
  for e in select id, config from crm_empresas where (config->>'devolver_fila_min') is not null loop
    v_min := (e.config->>'devolver_fila_min')::int;
    for v in
      select c.id, c.atendente_id, c.contato_id from crm_conversas c
      where c.empresa_id = e.id and c.status = 'aberta' and c.aguardando_resposta and c.atendente_id is not null and not c.com_ia
        -- conta a espera a partir das 8h: quem chegou de madrugada não volta para a fila às 8h em ponto
        and greatest(c.ultima_em at time zone 'America/Sao_Paulo', date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '8 hours')
            < (now() at time zone 'America/Sao_Paulo') - make_interval(mins => v_min)
        and not exists (select 1 from crm_mensagens m where m.conversa_id = c.id and m.direcao = 'saida' and m.autor in ('atendente', 'ia'))
        and not exists (select 1 from crm_mensagens m where m.conversa_id = c.id and m.autor = 'sistema' and m.texto like 'voltou para a fila%' and m.criado_em > now() - make_interval(mins => v_min))
    loop
      select usuario_id into v_prox from crm_membros
       where empresa_id = e.id and ativo and disponivel and recebe_leads and usuario_id <> v.atendente_id
       order by ultimo_lead_em nulls first limit 1;
      if v_prox is not null then update crm_membros set ultimo_lead_em = now() where empresa_id = e.id and usuario_id = v_prox; end if;
      update crm_conversas set atendente_id = v_prox where id = v.id;
      update crm_contatos set responsavel_id = v_prox where id = v.contato_id;
      insert into crm_mensagens (empresa_id, conversa_id, direcao, autor, autor_id, texto, status)
      values (e.id, v.id, 'saida', 'sistema', v.atendente_id,
              format('voltou para a fila: sem primeiro contato em %s min%s', v_min, case when v_prox is null then ' (ninguém disponível, ficou na Fila)' else '' end), 'enviada');
      insert into crm_eventos (empresa_id, contato_id, tipo, texto, dados, autor_id)
      values (e.id, v.contato_id, 'sem_primeiro_contato', format('Passou de %s min sem primeiro contato', v_min), jsonb_build_object('de', v.atendente_id, 'para', v_prox), null);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function crm_devolver_parados() from public, anon, authenticated;

-- LGPD: a pessoa pediu para apagar → apaga o conteúdo (mensagens, notas, nome, e-mails); o telefone fica só para não chamar de novo
-- (aplicado como 052; sobrescreve o conteúdo em vez de deletar linhas)
create function crm_apagar_dados(p_contato uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from crm_contatos where id = p_contato;
  if v_emp is null or not crm_sou_admin(v_emp) then raise exception 'Só o administrador.'; end if;
  update crm_mensagens set texto = '[apagado a pedido]', midia_url = null, id_externo = null, erro = null
   where conversa_id in (select id from crm_conversas where contato_id = p_contato);
  update crm_conversas set ultima_mensagem = '[apagado a pedido]', status = 'resolvida', aguardando_resposta = false, nao_lidas = 0 where contato_id = p_contato;
  update crm_tarefas set titulo = '[apagado a pedido]', nota = null, cancelada_em = coalesce(cancelada_em, now()) where contato_id = p_contato;
  update crm_cadencia_inscricoes set dados = '{}', status = case when status = 'ativa' then 'parada' else status end, parada_motivo = coalesce(parada_motivo, 'lgpd') where contato_id = p_contato;
  update crm_disparo_itens set status = case when status = 'fila' then 'pulado' else status end, erro = null where contato_id = p_contato;
  update crm_eventos set texto = null, dados = '{}' where contato_id = p_contato;
  update crm_contatos set nome = 'Dados apagados a pedido', emails = '{}', tags = '{lgpd-apagado}', cidade = null, uf = null,
    instagram = null, observacoes = null, nao_contatar = true, nao_contatar_em = now(), nao_contatar_motivo = 'Pediu exclusão dos dados (LGPD)',
    arquivado_em = now(), arquivado_motivo = 'Exclusão de dados a pedido (LGPD)'
  where id = p_contato;
  insert into crm_eventos (empresa_id, contato_id, tipo, texto, autor_id) values (v_emp, p_contato, 'lgpd_apagado', 'Dados apagados a pedido', auth.uid());
end $$;
revoke execute on function crm_apagar_dados(uuid) from public, anon;

-- para o painel do contato: aviso de "2ª tentativa sem resposta" e se está no arquivo
create function crm_situacao_contato(p_contato uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare k crm_contatos; v_cfg jsonb;
begin
  select * into k from crm_contatos where id = p_contato;
  if k.id is null or not crm_pode_ver_contato(p_contato) then return null; end if;
  select config into v_cfg from crm_empresas where id = k.empresa_id;
  return jsonb_build_object('tentativas', crm_tentativas_sem_resposta(p_contato),
    'max', coalesce((v_cfg->>'tentativas_max')::int, 3), 'dias', coalesce((v_cfg->>'dias_entre_tentativas')::int, 2),
    'arquivado_em', k.arquivado_em, 'arquivado_motivo', k.arquivado_motivo, 'nao_contatar', k.nao_contatar);
end $$;
revoke execute on function crm_situacao_contato(uuid) from public, anon;

-- para o painel do gestor: quantos voltaram para a fila, foram arquivados e voltaram do arquivo no período
create function crm_painel_tentativas(p_empresa uuid, p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  return (select jsonb_build_object(
    'devolvidos', count(*) filter (where tipo = 'sem_primeiro_contato'),
    'arquivados', count(*) filter (where tipo = 'arquivado'),
    'reativados', count(*) filter (where tipo = 'reativado'),
    'no_arquivo', (select count(*) from crm_contatos where empresa_id = p_empresa and arquivado_em is not null))
    from crm_eventos where empresa_id = p_empresa and criado_em > now() - make_interval(days => p_dias)
      and tipo in ('sem_primeiro_contato', 'arquivado', 'reativado'));
end $$;
revoke execute on function crm_painel_tentativas(uuid, int) from public, anon;

-- ajustes em funções anteriores (aplicados trocando trechos da definição atual):
-- • crm_receber_mensagem: quem responde sai do arquivo
-- • crm_evento / crm_marcar_resultado: comprou sai do arquivo
-- • crm_criar_disparo e contatos_filtrados: arquivados ficam de fora (contatos_filtrados aceita {"arquivados": true})
do $f$
declare d text;
begin
  d := pg_get_functiondef('crm_receber_mensagem(uuid,text,text,text,text,text,text)'::regprocedure);
  d := replace(d, $r$  perform crm_parar_cadencias(v_contato, 'respondeu');$r$,
    $r$  perform crm_parar_cadencias(v_contato, 'respondeu');
  perform crm_desarquivar(v_contato, 'Respondeu');$r$);
  if d not like '%crm_desarquivar%' then raise exception 'trecho não encontrado (receber)'; end if;
  execute d;
  d := pg_get_functiondef('crm_evento(uuid,uuid,text,jsonb)'::regprocedure);
  d := replace(d, $r$update crm_contatos set ganho_em = now(), perdido_em = null, motivo_perda = null,$r$,
    $r$update crm_contatos set ganho_em = now(), perdido_em = null, motivo_perda = null, arquivado_em = null, arquivado_motivo = null,$r$);
  if d not like '%arquivado_em = null%' then raise exception 'trecho não encontrado'; end if;
  execute d;
  d := pg_get_functiondef('crm_marcar_resultado(uuid,text,text)'::regprocedure);
  d := replace(d, $r$update crm_contatos set ganho_em = now(), perdido_em = null, motivo_perda = null,$r$,
    $r$update crm_contatos set ganho_em = now(), perdido_em = null, motivo_perda = null, arquivado_em = null, arquivado_motivo = null,$r$);
  if d not like '%arquivado_em = null%' then raise exception 'trecho não encontrado'; end if;
  execute d;
  d := pg_get_functiondef('crm_criar_disparo(uuid,text,uuid,jsonb,uuid[],uuid,text,jsonb)'::regprocedure);
  d := replace(d, $r$and c.telefone is not null and not c.telefone_invalido and not c.nao_contatar$r$,
    $r$and c.telefone is not null and not c.telefone_invalido and not c.nao_contatar and c.arquivado_em is null$r$);
  if d not like '%c.arquivado_em is null%' then raise exception 'trecho não encontrado (disparo)'; end if;
  execute d;
end $f$;

select cron.schedule('crm-arquivar-sem-resposta', '17 * * * *', $$select crm_arquivar_sem_resposta()$$);
select cron.schedule('crm-devolver-parados', '*/5 * * * *', $$select crm_devolver_parados()$$);

-- (aplicado com a 053) quem pediu exclusão de dados (LGPD) não volta a ser preenchido numa reimportação
do $f$
declare d text;
begin
  d := pg_get_functiondef('crm_mesclar_contato(uuid,jsonb,text)'::regprocedure);
  d := replace(d, $r$  if v_id is null then
    insert into crm_contatos$r$, $r$  if v_id is not null and exists (select 1 from crm_contatos where id = v_id and 'lgpd-apagado' = any (tags)) then return 'ignorado'; end if;
  if v_id is null then
    insert into crm_contatos$r$);
  if d not like '%lgpd-apagado%' then raise exception 'trecho não encontrado (mesclar)'; end if;
  execute d;
end $f$;
