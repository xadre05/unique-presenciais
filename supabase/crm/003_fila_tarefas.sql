-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO: dona do contato, rodízio, tarefas, follow-up (cadências),
-- eventos vindos de fora e regras. Nada aqui sabe de Hotmart, vendedora ou agenda:
-- quem usa o motor manda eventos com nomes próprios ("compra_aprovada", "consulta_marcada")
-- e cadastra as regras do que fazer com cada um.
-- ════════════════════════════════════════════════════════════════════

-- configurações por empresa: {"rodizio": true, "prazo_primeiro_contato_min": 5, "devolver_fila_min": null, "canal_padrao": "<id>"}
alter table crm_empresas add column config jsonb not null default '{}';

-- quem está atendendo agora e quem entra no rodízio
alter table crm_membros add column disponivel boolean not null default true;
alter table crm_membros add column recebe_leads boolean not null default true;
alter table crm_membros add column ultimo_lead_em timestamptz;

-- perda com motivo
create table crm_motivos_perda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text not null,
  ordem int not null default 0
);
alter table crm_motivos_perda enable row level security;
create policy crm_motivos_ver on crm_motivos_perda for select to authenticated using (crm_sou_membro(empresa_id));
create policy crm_motivos_admin on crm_motivos_perda for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));
alter table crm_contatos add column motivo_perda text;
alter table crm_contatos add column perdido_em timestamptz;
alter table crm_contatos add column ganho_em timestamptz;

-- tarefas / próxima ação
create table crm_tarefas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  contato_id uuid not null references crm_contatos on delete cascade,
  responsavel_id uuid references auth.users on delete set null,      -- null = da fila
  titulo text not null,
  tipo text not null default 'contato' check (tipo in ('contato', 'retorno', 'recuperacao', 'follow_up', 'outro')),
  vence_em timestamptz not null default now(),
  feita_em timestamptz,
  feita_por uuid references auth.users on delete set null,
  cancelada_em timestamptz,
  origem text not null default 'manual',                               -- manual | cadencia | evento
  inscricao_id uuid,
  nota text,
  criado_por uuid references auth.users on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index crm_tarefas_abertas on crm_tarefas (empresa_id, responsavel_id, vence_em) where feita_em is null and cancelada_em is null;
create index crm_tarefas_contato on crm_tarefas (contato_id);
alter table crm_tarefas enable row level security;
create policy crm_tarefas_ver on crm_tarefas for select to authenticated
  using (crm_sou_admin(empresa_id) or (crm_sou_membro(empresa_id) and (responsavel_id is null or responsavel_id = (select auth.uid()))));
create policy crm_tarefas_inserir on crm_tarefas for insert to authenticated
  with check (crm_sou_membro(empresa_id) and crm_pode_ver_contato(contato_id));
create policy crm_tarefas_alterar on crm_tarefas for update to authenticated
  using (crm_sou_admin(empresa_id) or (crm_sou_membro(empresa_id) and (responsavel_id is null or responsavel_id = (select auth.uid()))))
  with check (crm_sou_membro(empresa_id));

-- follow-up: sequência de passos com prazo. passos = [{"apos_horas": 0, "tipo": "tarefa"|"mensagem", "titulo": "...", "texto": "..."}]
create table crm_cadencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text not null,
  passos jsonb not null default '[]',
  para_se text[] not null default '{respondeu,ganho,perdido}',          -- quando a pessoa responde, compra ou é marcada como perdida
  tipo_tarefa text not null default 'follow_up',
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table crm_cadencias enable row level security;
create policy crm_cadencias_ver on crm_cadencias for select to authenticated using (crm_sou_membro(empresa_id));
create policy crm_cadencias_admin on crm_cadencias for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));

create table crm_cadencia_inscricoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  cadencia_id uuid not null references crm_cadencias on delete cascade,
  contato_id uuid not null references crm_contatos on delete cascade,
  passo int not null default 0,
  proximo_em timestamptz not null default now(),
  status text not null default 'ativa' check (status in ('ativa', 'concluida', 'parada')),
  parada_motivo text,
  dados jsonb,                                                          -- do evento que inscreveu (ex.: link do boleto)
  criado_em timestamptz not null default now()
);
create unique index crm_inscricao_ativa on crm_cadencia_inscricoes (cadencia_id, contato_id) where status = 'ativa';
create index crm_inscricoes_vencidas on crm_cadencia_inscricoes (proximo_em) where status = 'ativa';
alter table crm_cadencia_inscricoes enable row level security;
create policy crm_inscricoes_ver on crm_cadencia_inscricoes for select to authenticated using (crm_sou_admin(empresa_id) or crm_pode_ver_contato(contato_id));

-- regras: o que fazer quando chega um evento. acao: mover_etapa {etapa_id} | iniciar_cadencia {cadencia_id} | parar_cadencias | marcar_ganho | criar_tarefa {titulo, tipo, horas} | etiqueta {tag}
create table crm_regras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  evento text not null,
  acao text not null check (acao in ('mover_etapa', 'iniciar_cadencia', 'parar_cadencias', 'marcar_ganho', 'criar_tarefa', 'etiqueta')),
  parametros jsonb not null default '{}',
  ordem int not null default 0,
  ativa boolean not null default true
);
create index crm_regras_evento on crm_regras (empresa_id, evento) where ativa;
alter table crm_regras enable row level security;
create policy crm_regras_ver on crm_regras for select to authenticated using (crm_sou_admin(empresa_id));
create policy crm_regras_admin on crm_regras for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));

-- ── rodízio ───────────────────────────────────────────────────────────
-- dona do contato: a que já tem (se ativa) ou a próxima disponível do rodízio
create function crm_escolher_atendente(p_empresa uuid, p_contato uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select c.responsavel_id into v from crm_contatos c
   join crm_membros m on m.empresa_id = c.empresa_id and m.usuario_id = c.responsavel_id and m.ativo
   where c.id = p_contato;
  if v is not null then return v; end if;
  if not coalesce((select (config->>'rodizio')::boolean from crm_empresas where id = p_empresa), false) then return null; end if;
  select usuario_id into v from crm_membros
   where empresa_id = p_empresa and ativo and disponivel and recebe_leads
   order by ultimo_lead_em nulls first, usuario_id limit 1 for update skip locked;
  if v is null then return null; end if;
  update crm_membros set ultimo_lead_em = now() where empresa_id = p_empresa and usuario_id = v;
  update crm_contatos set responsavel_id = v where id = p_contato and responsavel_id is null;
  return v;
end $$;
revoke execute on function crm_escolher_atendente(uuid, uuid) from public, anon, authenticated;

-- ── evento vindo de fora ─────────────────────────────────────────────
create function crm_parar_cadencias(p_contato uuid, p_motivo text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update crm_cadencia_inscricoes i set status = 'parada', parada_motivo = p_motivo
  from crm_cadencias k where k.id = i.cadencia_id and i.contato_id = p_contato and i.status = 'ativa' and p_motivo = any (k.para_se);
  get diagnostics n = row_count;
  -- tarefas automáticas ainda abertas dessas cadências deixam de valer
  update crm_tarefas t set cancelada_em = now() from crm_cadencia_inscricoes i
  where t.inscricao_id = i.id and i.contato_id = p_contato and i.status = 'parada' and t.feita_em is null and t.cancelada_em is null;
  return n;
end $$;
revoke execute on function crm_parar_cadencias(uuid, text) from public, anon, authenticated;

create function crm_iniciar_cadencia(p_cadencia uuid, p_contato uuid, p_dados jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare k crm_cadencias; v uuid; h numeric;
begin
  select * into k from crm_cadencias where id = p_cadencia and ativa;
  if k.id is null or jsonb_array_length(k.passos) = 0 then return null; end if;
  h := coalesce((k.passos->0->>'apos_horas')::numeric, 0);
  insert into crm_cadencia_inscricoes (empresa_id, cadencia_id, contato_id, proximo_em, dados)
  values (k.empresa_id, k.id, p_contato, now() + make_interval(secs => h * 3600), p_dados)
  on conflict do nothing returning id into v;
  return v;
end $$;
revoke execute on function crm_iniciar_cadencia(uuid, uuid, jsonb) from public, anon, authenticated;

-- registra o evento na linha do tempo do contato e aplica as regras da empresa
create function crm_evento(p_empresa uuid, p_contato uuid, p_evento text, p_dados jsonb default '{}') returns int
language plpgsql security definer set search_path = public as $$
declare r crm_regras; n int := 0; v_dona uuid;
begin
  insert into crm_eventos (empresa_id, contato_id, tipo, texto, dados, autor_id)
  values (p_empresa, p_contato, 'evento', p_evento, p_dados, null);
  for r in select * from crm_regras where empresa_id = p_empresa and evento = p_evento and ativa order by ordem loop
    n := n + 1;
    if r.acao = 'mover_etapa' then
      update crm_contatos set etapa_id = (r.parametros->>'etapa_id')::uuid, etapa_em = now() where id = p_contato;
    elsif r.acao = 'marcar_ganho' then
      update crm_contatos set ganho_em = now(), perdido_em = null, motivo_perda = null,
        etapa_id = coalesce((select id from crm_etapas where empresa_id = p_empresa and final = 'ganho' order by ordem limit 1), etapa_id), etapa_em = now()
      where id = p_contato;
      perform crm_parar_cadencias(p_contato, 'ganho');
    elsif r.acao = 'parar_cadencias' then
      perform crm_parar_cadencias(p_contato, coalesce(r.parametros->>'motivo', 'ganho'));
    elsif r.acao = 'iniciar_cadencia' then
      perform crm_escolher_atendente(p_empresa, p_contato);
      perform crm_iniciar_cadencia((r.parametros->>'cadencia_id')::uuid, p_contato, p_dados);
    elsif r.acao = 'criar_tarefa' then
      v_dona := crm_escolher_atendente(p_empresa, p_contato);
      insert into crm_tarefas (empresa_id, contato_id, responsavel_id, titulo, tipo, vence_em, origem, criado_por)
      values (p_empresa, p_contato, v_dona, coalesce(r.parametros->>'titulo', p_evento), coalesce(r.parametros->>'tipo', 'contato'),
              now() + make_interval(secs => coalesce((r.parametros->>'horas')::numeric, 0) * 3600), 'evento', null);
    elsif r.acao = 'etiqueta' then
      update crm_contatos set tags = (select array_agg(distinct x) from unnest(tags || array[r.parametros->>'tag']) x) where id = p_contato;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function crm_evento(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function crm_evento(uuid, uuid, text, jsonb) to service_role;

-- passos de cadência vencidos (a função do servidor manda as mensagens; tarefas são criadas aqui)
create function crm_cadencias_vencidas(p_max int default 50) returns table (inscricao_id uuid, empresa_id uuid, contato_id uuid, tipo text, texto text, dados jsonb)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare i record; k crm_cadencias; p jsonb; v_dona uuid; prox jsonb;
begin
  -- só em horário comercial (8h às 20h de Brasília): fora disso nada vence
  if extract(hour from now() at time zone 'America/Sao_Paulo') not between 8 and 19 then return; end if;
  for i in select * from crm_cadencia_inscricoes where status = 'ativa' and proximo_em <= now() order by proximo_em limit p_max for update skip locked loop
    select * into k from crm_cadencias where id = i.cadencia_id;
    p := k.passos->i.passo;
    if p is null or not k.ativa then
      update crm_cadencia_inscricoes set status = 'concluida' where id = i.id; continue;
    end if;
    if coalesce(p->>'tipo', 'tarefa') = 'tarefa' then
      v_dona := crm_escolher_atendente(i.empresa_id, i.contato_id);
      insert into crm_tarefas (empresa_id, contato_id, responsavel_id, titulo, tipo, vence_em, origem, inscricao_id, nota, criado_por)
      values (i.empresa_id, i.contato_id, v_dona, coalesce(p->>'titulo', k.nome), k.tipo_tarefa, now(), 'cadencia', i.id, p->>'texto', null);
    else
      inscricao_id := i.id; empresa_id := i.empresa_id; contato_id := i.contato_id; tipo := 'mensagem'; texto := p->>'texto'; dados := i.dados;
      return next;
    end if;
    prox := k.passos->(i.passo + 1);
    if prox is null then
      update crm_cadencia_inscricoes set passo = i.passo + 1, status = 'concluida' where id = i.id;
    else
      update crm_cadencia_inscricoes set passo = i.passo + 1,
        proximo_em = i.criado_em + make_interval(secs => coalesce((prox->>'apos_horas')::numeric, 24) * 3600)
      where id = i.id;
    end if;
  end loop;
end $$;
revoke execute on function crm_cadencias_vencidas(int) from public, anon, authenticated;
grant execute on function crm_cadencias_vencidas(int) to service_role;

-- ── telas ────────────────────────────────────────────────────────────
-- marcar perda (motivo obrigatório) ou ganho manual
create function crm_marcar_resultado(p_contato uuid, p_resultado text, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c crm_contatos;
begin
  select * into c from crm_contatos where id = p_contato;
  if c.id is null or not crm_pode_ver_contato(p_contato) then raise exception 'Contato não encontrado.'; end if;
  if p_resultado = 'perdido' then
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Escolha o motivo da perda.'; end if;
    update crm_contatos set perdido_em = now(), motivo_perda = p_motivo, ganho_em = null,
      etapa_id = coalesce((select id from crm_etapas where empresa_id = c.empresa_id and final = 'perdido' order by ordem limit 1), etapa_id), etapa_em = now()
    where id = p_contato;
    perform crm_parar_cadencias(p_contato, 'perdido');
  elsif p_resultado = 'ganho' then
    update crm_contatos set ganho_em = now(), perdido_em = null, motivo_perda = null,
      etapa_id = coalesce((select id from crm_etapas where empresa_id = c.empresa_id and final = 'ganho' order by ordem limit 1), etapa_id), etapa_em = now()
    where id = p_contato;
    perform crm_parar_cadencias(p_contato, 'ganho');
  else raise exception 'Resultado inválido.'; end if;
  update crm_tarefas set cancelada_em = now() where contato_id = p_contato and feita_em is null and cancelada_em is null;
  insert into crm_eventos (empresa_id, contato_id, tipo, texto, dados) values (c.empresa_id, p_contato, p_resultado, p_motivo, null);
end $$;
revoke execute on function crm_marcar_resultado(uuid, text, text) from public, anon;

-- inscrever um contato num follow-up pela tela
create function crm_seguir(p_cadencia uuid, p_contato uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k crm_cadencias;
begin
  select * into k from crm_cadencias where id = p_cadencia;
  if k.id is null or not crm_sou_membro(k.empresa_id) or not crm_pode_ver_contato(p_contato) then raise exception 'Não encontrado.'; end if;
  update crm_contatos set responsavel_id = coalesce(responsavel_id, auth.uid()) where id = p_contato;
  return crm_iniciar_cadencia(p_cadencia, p_contato, null);
end $$;
revoke execute on function crm_seguir(uuid, uuid) from public, anon;

-- minha fila agora (admin pode ver a de outra pessoa)
create function crm_minha_fila(p_empresa uuid, p_usuario uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := coalesce(p_usuario, auth.uid()); hoje_fim timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '1 day';
begin
  if not crm_sou_membro(p_empresa) or (u <> auth.uid() and not crm_sou_admin(p_empresa)) then raise exception 'Sem acesso.'; end if;
  return jsonb_build_object(
    'esperando', coalesce((select jsonb_agg(x order by x.ultima_em) from (
        select v.id conversa_id, v.contato_id, c.nome, c.telefone, v.ultima_mensagem, v.ultima_em,
          not exists (select 1 from crm_mensagens m where m.conversa_id = v.id and m.direcao = 'saida' and m.autor in ('atendente', 'ia')) novo
        from crm_conversas v join crm_contatos c on c.id = v.contato_id
        where v.empresa_id = p_empresa and v.status = 'aberta' and v.aguardando_resposta and v.atendente_id = u) x), '[]'),
    'fila', (select count(*) from crm_conversas where empresa_id = p_empresa and status = 'aberta' and atendente_id is null),
    'tarefas', coalesce((select jsonb_agg(x order by x.vence_em) from (
        select t.id, t.contato_id, c.nome, c.telefone, t.titulo, t.tipo, t.vence_em, t.nota, t.origem, t.vence_em < now() - interval '1 hour' atrasada,
          (select v.id from crm_conversas v where v.contato_id = t.contato_id order by v.ultima_em desc nulls last limit 1) conversa_id
        from crm_tarefas t join crm_contatos c on c.id = t.contato_id
        where t.empresa_id = p_empresa and t.responsavel_id = u and t.feita_em is null and t.cancelada_em is null and t.vence_em < hoje_fim
        limit 300) x), '[]'),
    'sem_proxima_acao', (select count(*) from crm_conversas v join crm_contatos c on c.id = v.contato_id
        where v.empresa_id = p_empresa and v.atendente_id = u and v.status = 'aberta' and c.ganho_em is null and c.perdido_em is null
          and not exists (select 1 from crm_tarefas t where t.contato_id = v.contato_id and t.feita_em is null and t.cancelada_em is null)),
    'numeros', jsonb_build_object(
      'conversas_hoje', (select count(distinct m.conversa_id) from crm_mensagens m join crm_conversas v on v.id = m.conversa_id
          where v.empresa_id = p_empresa and m.autor = 'atendente' and m.autor_id = u and m.criado_em >= hoje_fim - interval '1 day'),
      'tarefas_feitas_hoje', (select count(*) from crm_tarefas where empresa_id = p_empresa and feita_por = u and feita_em >= hoje_fim - interval '1 day'),
      'ganhos_mes', (select count(*) from crm_contatos where empresa_id = p_empresa and responsavel_id = u and ganho_em >= date_trunc('month', now()))
    ));
end $$;
revoke execute on function crm_minha_fila(uuid, uuid) from public, anon;

-- painel do gestor
create function crm_painel(p_empresa uuid, p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare desde timestamptz := now() - make_interval(days => p_dias);
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  return jsonb_build_object(
    'agora', jsonb_build_object(
      'esperando', (select count(*) from crm_conversas where empresa_id = p_empresa and status = 'aberta' and aguardando_resposta),
      'maior_espera', (select min(ultima_em) from crm_conversas where empresa_id = p_empresa and status = 'aberta' and aguardando_resposta),
      'sem_dona', (select count(*) from crm_conversas where empresa_id = p_empresa and status = 'aberta' and atendente_id is null),
      'tarefas_atrasadas', (select count(*) from crm_tarefas where empresa_id = p_empresa and feita_em is null and cancelada_em is null and vence_em < now() - interval '1 hour'),
      'equipe', (select coalesce(jsonb_agg(jsonb_build_object('usuario_id', usuario_id, 'nome', nome, 'disponivel', disponivel, 'recebe_leads', recebe_leads) order by nome), '[]')
                 from crm_membros where empresa_id = p_empresa and ativo)),
    'por_pessoa', (select coalesce(jsonb_agg(x order by x.nome), '[]') from (
      select m.usuario_id, m.nome,
        (select count(distinct v.id) from crm_conversas v where v.empresa_id = p_empresa and v.atendente_id = m.usuario_id and v.ultima_em >= desde) conversas,
        (select count(*) from crm_conversas v where v.empresa_id = p_empresa and v.atendente_id = m.usuario_id and v.status = 'aberta' and v.aguardando_resposta) esperando,
        (select percentile_cont(0.5) within group (order by extract(epoch from r.resp - r.ent) / 60) from (
           select (select min(m1.criado_em) from crm_mensagens m1 where m1.conversa_id = v.id and m1.direcao = 'entrada' and m1.criado_em >= desde) ent,
                  (select min(m2.criado_em) from crm_mensagens m2 where m2.conversa_id = v.id and m2.direcao = 'saida' and m2.autor = 'atendente' and m2.autor_id = m.usuario_id
                     and m2.criado_em >= (select min(m1.criado_em) from crm_mensagens m1 where m1.conversa_id = v.id and m1.direcao = 'entrada' and m1.criado_em >= desde)) resp
           from crm_conversas v where v.empresa_id = p_empresa and v.atendente_id = m.usuario_id) r where r.resp is not null) mediana_resposta_min,
        (select count(*) from crm_tarefas t where t.empresa_id = p_empresa and t.responsavel_id = m.usuario_id and t.feita_em is null and t.cancelada_em is null and t.vence_em < now() - interval '1 hour') tarefas_atrasadas,
        (select count(*) from crm_tarefas t where t.empresa_id = p_empresa and t.feita_por = m.usuario_id and t.feita_em >= desde) tarefas_feitas,
        (select count(*) from crm_contatos c where c.empresa_id = p_empresa and c.responsavel_id = m.usuario_id and c.ganho_em >= desde) ganhos,
        (select count(*) from crm_contatos c where c.empresa_id = p_empresa and c.responsavel_id = m.usuario_id and c.perdido_em >= desde) perdas
      from crm_membros m where m.empresa_id = p_empresa and m.ativo) x),
    'funil', (select coalesce(jsonb_agg(jsonb_build_object('etapa', e.nome, 'cor', e.cor, 'final', e.final,
        'contatos', (select count(*) from crm_contatos c where c.etapa_id = e.id),
        'dias_medio', (select round(avg(extract(epoch from now() - c.etapa_em) / 86400)::numeric, 1) from crm_contatos c where c.etapa_id = e.id and e.final is null)) order by e.ordem), '[]')
      from crm_etapas e where e.empresa_id = p_empresa),
    'motivos_perda', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo_perda, 'n', n) order by n desc), '[]') from (
        select motivo_perda, count(*) n from crm_contatos where empresa_id = p_empresa and perdido_em >= desde group by 1) x),
    'origens', (select coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'novos', novos, 'ganhos', ganhos) order by novos desc), '[]') from (
        select coalesce(origem, 'sem origem') origem, count(*) filter (where entrou_em >= desde) novos, count(*) filter (where ganho_em >= desde) ganhos
        from crm_contatos where empresa_id = p_empresa group by 1 having count(*) filter (where entrou_em >= desde or ganho_em >= desde) > 0) x)
  );
end $$;
revoke execute on function crm_painel(uuid, int) from public, anon;

-- disponibilidade: a pessoa liga/desliga a própria; admin muda de qualquer uma
create function crm_minha_disponibilidade(p_empresa uuid, p_disponivel boolean, p_usuario uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := coalesce(p_usuario, auth.uid());
begin
  if u <> auth.uid() and not crm_sou_admin(p_empresa) then raise exception 'Sem acesso.'; end if;
  update crm_membros set disponivel = p_disponivel where empresa_id = p_empresa and usuario_id = u;
end $$;
revoke execute on function crm_minha_disponibilidade(uuid, boolean, uuid) from public, anon;

-- (048) mensagem recebida: conversa sem dona vai para a dona do contato ou para o rodízio; respondeu = follow-ups param.
-- A versão completa de crm_receber_mensagem fica em 002 com estes dois trechos acrescentados:
--   if v_conversa.atendente_id is null and not v_conversa.com_ia then v_dona := crm_escolher_atendente(...); ... end if;
--   perform crm_parar_cadencias(v_contato, 'respondeu');

-- fila do cron também roda quando há follow-up vencido
select cron.alter_job((select jobid from cron.job where jobname = 'crm-fila-disparos'), command := $$
  select net.http_post(
    url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/crm-whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-chave', public.crm_chave_cron()),
    body := '{"acao":"processar_fila"}'::jsonb,
    timeout_milliseconds := 55000)
  where exists (select 1 from public.crm_disparos where status = 'enviando')
     or exists (select 1 from public.crm_cadencia_inscricoes where status = 'ativa' and proximo_em <= now())
$$);

-- (050) equipe com disponibilidade; admin liga/desliga quem entra no rodízio e muda a configuração da empresa
create function crm_membros_empresa(p_empresa uuid) returns table (usuario_id uuid, nome text, papel text, ativo boolean, disponivel boolean, recebe_leads boolean)
language sql stable security definer set search_path = public as $$
  select m.usuario_id, m.nome, m.papel, m.ativo, m.disponivel, m.recebe_leads from crm_membros m
  where m.empresa_id = p_empresa and crm_sou_membro(p_empresa) order by m.nome
$$;
revoke execute on function crm_membros_empresa(uuid) from public, anon;
create function crm_recebe_leads(p_empresa uuid, p_usuario uuid, p_valor boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  update crm_membros set recebe_leads = p_valor where empresa_id = p_empresa and usuario_id = p_usuario;
end $$;
revoke execute on function crm_recebe_leads(uuid, uuid, boolean) from public, anon;
create function crm_salvar_config(p_empresa uuid, p_config jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  update crm_empresas set config = config || p_config where id = p_empresa;
end $$;
revoke execute on function crm_salvar_config(uuid, jsonb) from public, anon;
