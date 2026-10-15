-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO: ATENDIMENTO (canais, conversas, mensagens, disparos, etapas)
-- Mesma regra do 001: nada aqui conhece vendedora, Hotmart ou comissão.
-- ════════════════════════════════════════════════════════════════════

-- Números de WhatsApp (ou outro canal) da empresa
create table crm_canais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('teste', 'whatsapp_qr', 'whatsapp_oficial')),
  telefone text,
  status text not null default 'desconectado' check (status in ('desconectado', 'conectando', 'conectado', 'erro')),
  status_info text,
  ritmo_por_hora int not null default 20 check (ritmo_por_hora between 1 and 1000),   -- limite de disparo (conversa normal não conta)
  janela_inicio time not null default '08:00',
  janela_fim time not null default '20:00',
  config jsonb not null default '{}',          -- dados não secretos (nome da instância, id do número...)
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index crm_canais_empresa on crm_canais (empresa_id);

-- Chaves dos canais: sem acesso pela tela; só a função do servidor lê
create table crm_canais_segredos (
  canal_id uuid primary key references crm_canais on delete cascade,
  segredos jsonb not null default '{}',
  chave_webhook text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

-- Etapas do funil (colunas do CRM)
create table crm_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text not null,
  ordem int not null default 0,
  cor text,
  final text check (final in ('ganho', 'perdido')),
  criado_em timestamptz not null default now()
);
create index crm_etapas_empresa on crm_etapas (empresa_id, ordem);
alter table crm_contatos add column etapa_id uuid references crm_etapas on delete set null;
alter table crm_contatos add column etapa_em timestamptz;
create index crm_contatos_etapa on crm_contatos (etapa_id) where etapa_id is not null;

-- Conversas: uma por contato em cada canal
create table crm_conversas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  contato_id uuid not null references crm_contatos on delete cascade,
  canal_id uuid not null references crm_canais on delete cascade,
  status text not null default 'aberta' check (status in ('aberta', 'resolvida')),
  atendente_id uuid references auth.users on delete set null,   -- null = na fila, qualquer um pode pegar
  com_ia boolean not null default false,
  nao_lidas int not null default 0,
  ultima_mensagem text,
  ultima_em timestamptz,
  ultima_direcao text,
  aguardando_resposta boolean not null default false,             -- contato falou por último
  criado_em timestamptz not null default now(),
  unique (canal_id, contato_id)
);
create index crm_conversas_lista on crm_conversas (empresa_id, status, ultima_em desc);
create index crm_conversas_atendente on crm_conversas (atendente_id) where atendente_id is not null;

create table crm_mensagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  conversa_id uuid not null references crm_conversas on delete cascade,
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text not null check (autor in ('contato', 'atendente', 'ia', 'sistema', 'disparo')),
  autor_id uuid references auth.users on delete set null,
  tipo text not null default 'texto' check (tipo in ('texto', 'imagem', 'audio', 'video', 'documento', 'outro')),
  texto text,
  midia_url text,
  status text not null default 'pendente' check (status in ('pendente', 'enviada', 'entregue', 'lida', 'erro', 'recebida')),
  erro text,
  id_externo text,
  criado_em timestamptz not null default now()
);
create index crm_mensagens_conversa on crm_mensagens (conversa_id, criado_em);
create unique index crm_mensagens_externo on crm_mensagens (empresa_id, id_externo) where id_externo is not null;

-- Respostas rápidas (modelos de texto)
create table crm_respostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  atalho text not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  unique (empresa_id, atalho)
);

-- Disparos: mesma mensagem (com variações) para muitos contatos, no ritmo do canal
create table crm_disparos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text not null,
  canal_id uuid not null references crm_canais on delete restrict,
  mensagens jsonb not null default '[]',        -- ["texto 1", "texto 2"...] sorteado por contato, com {nome}
  status text not null default 'rascunho' check (status in ('rascunho', 'enviando', 'pausado', 'concluido', 'cancelado')),
  atendente_id uuid references auth.users on delete set null,   -- quem recebe as respostas (null = fila)
  origem text,                                  -- de onde vieram os contatos (texto livre, ex.: "Lista: Black 2026")
  criado_por uuid references auth.users on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);
create index crm_disparos_empresa on crm_disparos (empresa_id, criado_em desc);

create table crm_disparo_itens (
  id uuid primary key default gen_random_uuid(),
  disparo_id uuid not null references crm_disparos on delete cascade,
  empresa_id uuid not null references crm_empresas on delete cascade,
  contato_id uuid not null references crm_contatos on delete cascade,
  atendente_id uuid references auth.users on delete set null,   -- dono da conversa se responder (sobrepõe o do disparo)
  status text not null default 'fila' check (status in ('fila', 'enviado', 'erro', 'pulado')),
  mensagem_id uuid references crm_mensagens on delete set null,
  erro text,
  enviado_em timestamptz,
  unique (disparo_id, contato_id)
);
create index crm_disparo_itens_fila on crm_disparo_itens (disparo_id, status);
create index crm_disparo_itens_enviado on crm_disparo_itens (enviado_em) where enviado_em is not null;

-- ── acesso ───────────────────────────────────────────────────────────
-- conversa visível: admin vê todas; atendente vê as dela e as da fila
create function crm_pode_ver_conversa(p_conversa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_conversas v where v.id = p_conversa
    and (crm_sou_admin(v.empresa_id) or (crm_sou_membro(v.empresa_id) and (v.atendente_id is null or v.atendente_id = auth.uid()))))
$$;
revoke execute on function crm_pode_ver_conversa(uuid) from public, anon;

-- atendente também enxerga o contato das conversas que pode ver
create or replace function crm_pode_ver_contato(p_contato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_contatos c
    where c.id = p_contato
      and (crm_sou_admin(c.empresa_id)
           or (crm_sou_membro(c.empresa_id) and (c.responsavel_id = auth.uid()
               or exists (select 1 from crm_conversas v where v.contato_id = c.id and (v.atendente_id is null or v.atendente_id = auth.uid())))))
  )
$$;
alter policy crm_contatos_ver on crm_contatos using (crm_pode_ver_contato(id));
alter policy crm_contatos_alterar on crm_contatos using (crm_pode_ver_contato(id)) with check (crm_sou_membro(empresa_id));

alter table crm_canais enable row level security;
alter table crm_canais_segredos enable row level security;
alter table crm_etapas enable row level security;
alter table crm_conversas enable row level security;
alter table crm_mensagens enable row level security;
alter table crm_respostas enable row level security;
alter table crm_disparos enable row level security;
alter table crm_disparo_itens enable row level security;

create policy crm_canais_ver on crm_canais for select to authenticated using (crm_sou_membro(empresa_id));
create policy crm_canais_admin on crm_canais for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));
-- crm_canais_segredos: sem regra = ninguém lê pela tela

create policy crm_etapas_ver on crm_etapas for select to authenticated using (crm_sou_membro(empresa_id));
create policy crm_etapas_admin on crm_etapas for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));

create policy crm_conversas_ver on crm_conversas for select to authenticated using (crm_pode_ver_conversa(id));
create policy crm_conversas_alterar on crm_conversas for update to authenticated
  using (crm_pode_ver_conversa(id))
  with check (crm_sou_admin(empresa_id) or atendente_id is null or atendente_id = (select auth.uid()));

create policy crm_mensagens_ver on crm_mensagens for select to authenticated using (crm_pode_ver_conversa(conversa_id));

create policy crm_respostas_ver on crm_respostas for select to authenticated using (crm_sou_membro(empresa_id));
create policy crm_respostas_membro on crm_respostas for all to authenticated using (crm_sou_membro(empresa_id)) with check (crm_sou_membro(empresa_id));

create policy crm_disparos_ver on crm_disparos for select to authenticated using (crm_sou_admin(empresa_id));
create policy crm_disparos_admin on crm_disparos for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));
create policy crm_disparo_itens_ver on crm_disparo_itens for select to authenticated using (crm_sou_admin(empresa_id));

-- ── funções usadas pela tela ─────────────────────────────────────────
-- pegar uma conversa da fila (ou o admin passar para alguém)
create function crm_assumir_conversa(p_conversa uuid, p_atendente uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v crm_conversas; v_para uuid := coalesce(p_atendente, auth.uid());
begin
  select * into v from crm_conversas where id = p_conversa;
  if v.id is null or not crm_pode_ver_conversa(p_conversa) then raise exception 'Conversa não encontrada.'; end if;
  if v_para <> auth.uid() and not crm_sou_admin(v.empresa_id) then raise exception 'Só o administrador passa conversa para outra pessoa.'; end if;
  if not exists (select 1 from crm_membros where empresa_id = v.empresa_id and usuario_id = v_para and ativo) then raise exception 'Essa pessoa não é da equipe.'; end if;
  update crm_conversas set atendente_id = v_para, status = 'aberta' where id = p_conversa;
  insert into crm_mensagens (empresa_id, conversa_id, direcao, autor, autor_id, texto, status)
  values (v.empresa_id, p_conversa, 'saida', 'sistema', auth.uid(),
          case when v_para = auth.uid() then 'assumiu a conversa' else 'passou a conversa' end, 'enviada');
end $$;
revoke execute on function crm_assumir_conversa(uuid, uuid) from public, anon;

create function crm_marcar_lida(p_conversa uuid) returns void
language sql security definer set search_path = public as $$
  update crm_conversas set nao_lidas = 0 where id = p_conversa and crm_pode_ver_conversa(p_conversa)
$$;
revoke execute on function crm_marcar_lida(uuid) from public, anon;

-- criar disparo com uma lista de contatos (quem chama decide os contatos)
create function crm_criar_disparo(p_empresa uuid, p_nome text, p_canal uuid, p_mensagens jsonb, p_contatos uuid[], p_atendente uuid default null, p_origem text default null, p_donos jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; n int;
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador cria disparos.'; end if;
  if not exists (select 1 from crm_canais where id = p_canal and empresa_id = p_empresa) then raise exception 'Escolha o número que vai enviar.'; end if;
  if jsonb_array_length(coalesce(p_mensagens, '[]')) = 0 then raise exception 'Escreva pelo menos uma mensagem.'; end if;
  insert into crm_disparos (empresa_id, nome, canal_id, mensagens, atendente_id, origem)
  values (p_empresa, coalesce(nullif(trim(p_nome), ''), 'Disparo'), p_canal, p_mensagens, p_atendente, p_origem) returning id into v_id;
  insert into crm_disparo_itens (disparo_id, empresa_id, contato_id, atendente_id)
  select v_id, p_empresa, c.id, nullif(p_donos->>c.id::text, '')::uuid
  from crm_contatos c
  where c.id = any (p_contatos) and c.empresa_id = p_empresa
    and c.telefone is not null and not c.telefone_invalido and not c.nao_contatar
  on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('id', v_id, 'contatos', n);
end $$;
revoke execute on function crm_criar_disparo(uuid, text, uuid, jsonb, uuid[], uuid, text, jsonb) from public, anon;

-- andamento dos disparos
create function crm_resumo_disparos(p_empresa uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.criado_em desc), '[]') from (
    select d.id, d.nome, d.status, d.criado_em, d.iniciado_em, d.concluido_em, d.origem, d.mensagens, d.canal_id, k.nome canal_nome, k.ritmo_por_hora,
      count(i.*) total,
      count(i.*) filter (where i.status = 'fila') na_fila,
      count(i.*) filter (where i.status = 'enviado') enviados,
      count(i.*) filter (where i.status = 'erro') erros,
      count(i.*) filter (where i.status = 'enviado' and exists (
        select 1 from crm_conversas v join crm_mensagens m on m.conversa_id = v.id
        where v.contato_id = i.contato_id and v.canal_id = d.canal_id and m.direcao = 'entrada' and m.criado_em > i.enviado_em)) responderam
    from crm_disparos d join crm_canais k on k.id = d.canal_id
    left join crm_disparo_itens i on i.disparo_id = d.id
    where d.empresa_id = p_empresa and crm_sou_admin(p_empresa)
    group by d.id, k.nome, k.ritmo_por_hora
  ) x
$$;
revoke execute on function crm_resumo_disparos(uuid) from public, anon;

-- ── uso interno (só a função do servidor) ────────────────────────────
-- registra uma mensagem recebida: acha/cria contato e conversa, guarda a mensagem
create function crm_receber_mensagem(p_canal uuid, p_telefone text, p_nome text, p_texto text, p_tipo text default 'texto', p_midia text default null, p_id_externo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k crm_canais; v_contato uuid; v_conversa crm_conversas; v_msg uuid;
begin
  select * into k from crm_canais where id = p_canal;
  if k.id is null then raise exception 'canal não existe'; end if;
  if p_id_externo is not null and exists (select 1 from crm_mensagens where empresa_id = k.empresa_id and id_externo = p_id_externo) then
    return jsonb_build_object('repetida', true);
  end if;
  select id into v_contato from crm_contatos where empresa_id = k.empresa_id and telefone = p_telefone;
  if v_contato is null then
    insert into crm_contatos (empresa_id, nome, telefone, origem, entrou_em, tags)
    values (k.empresa_id, nullif(trim(p_nome), ''), p_telefone, 'whatsapp', now(), array['whatsapp'])
    returning id into v_contato;
  end if;
  insert into crm_conversas (empresa_id, contato_id, canal_id, atendente_id)
  values (k.empresa_id, v_contato, p_canal,
          (select coalesce(i.atendente_id, d.atendente_id) from crm_disparo_itens i join crm_disparos d on d.id = i.disparo_id
            where i.contato_id = v_contato and d.canal_id = p_canal and i.status = 'enviado'
            order by i.enviado_em desc limit 1))
  on conflict (canal_id, contato_id) do nothing;
  select * into v_conversa from crm_conversas where canal_id = p_canal and contato_id = v_contato;
  insert into crm_mensagens (empresa_id, conversa_id, direcao, autor, tipo, texto, midia_url, status, id_externo)
  values (k.empresa_id, v_conversa.id, 'entrada', 'contato', coalesce(p_tipo, 'texto'), p_texto, p_midia, 'recebida', p_id_externo)
  returning id into v_msg;
  update crm_conversas set status = 'aberta', nao_lidas = nao_lidas + 1, ultima_mensagem = left(coalesce(p_texto, '[' || p_tipo || ']'), 200),
    ultima_em = now(), ultima_direcao = 'entrada', aguardando_resposta = true
  where id = v_conversa.id;
  -- quem responde entra no funil (primeira etapa), se ainda não estiver
  update crm_contatos set etapa_id = (select id from crm_etapas where empresa_id = k.empresa_id and final is null order by ordem limit 1), etapa_em = now()
  where id = v_contato and etapa_id is null;
  return jsonb_build_object('mensagem', v_msg, 'conversa', v_conversa.id, 'contato', v_contato, 'com_ia', v_conversa.com_ia);
end $$;
revoke execute on function crm_receber_mensagem(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- guarda uma mensagem que vai sair (a função do servidor manda e depois atualiza o status)
create function crm_registrar_saida(p_conversa uuid, p_texto text, p_autor text, p_autor_id uuid, p_tipo text default 'texto', p_midia text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v crm_conversas; v_id uuid;
begin
  select * into v from crm_conversas where id = p_conversa;
  insert into crm_mensagens (empresa_id, conversa_id, direcao, autor, autor_id, tipo, texto, midia_url, status)
  values (v.empresa_id, p_conversa, 'saida', p_autor, p_autor_id, p_tipo, p_texto, p_midia, 'pendente') returning id into v_id;
  update crm_conversas set ultima_mensagem = left(coalesce(p_texto, '[' || p_tipo || ']'), 200), ultima_em = now(), ultima_direcao = 'saida',
    aguardando_resposta = false, nao_lidas = 0 where id = p_conversa;
  return v_id;
end $$;
revoke execute on function crm_registrar_saida(uuid, text, text, uuid, text, text) from public, anon, authenticated;

-- próximos itens de disparo a enviar agora, respeitando o ritmo e o horário de cada canal
create function crm_proximos_envios(p_max int default 30) returns table (item_id uuid, disparo_id uuid, contato_id uuid, canal_id uuid, empresa_id uuid)
language sql security definer set search_path = public as $$
  -- ritmo até 60/h: no máximo 1 envio a cada (60/ritmo) minutos, espalhado na hora.
  -- ritmo acima de 60/h: até ritmo/60 por minuto. Nunca passa do ritmo na última hora.
  with envios as (
    select d.canal_id, max(i.enviado_em) ultimo,
      count(*) filter (where i.enviado_em > now() - interval '1 minute') no_minuto,
      count(*) filter (where i.enviado_em > now() - interval '1 hour') na_hora
    from crm_disparo_itens i join crm_disparos d on d.id = i.disparo_id
    where i.enviado_em > now() - interval '1 hour'
    group by d.canal_id
  ), canais as (
    select k.id,
      least(
        k.ritmo_por_hora - coalesce(e.na_hora, 0),
        case when k.ritmo_por_hora <= 60
          then case when e.ultimo is null or e.ultimo < now() - make_interval(secs => 3600.0 / k.ritmo_por_hora - 20) then 1 else 0 end
          else ceil(k.ritmo_por_hora / 60.0)::int - coalesce(e.no_minuto, 0) end
      ) cota
    from crm_canais k left join envios e on e.canal_id = k.id
    where k.ativo and k.status = 'conectado'
      and (now() at time zone 'America/Sao_Paulo')::time between k.janela_inicio and k.janela_fim
  ), candidatos as (
    select i.id item_id, i.disparo_id, i.contato_id, d.canal_id, i.empresa_id,
      row_number() over (partition by d.canal_id order by d.iniciado_em, random()) rn
    from crm_disparo_itens i join crm_disparos d on d.id = i.disparo_id
    where d.status = 'enviando' and i.status = 'fila'
  )
  select c.item_id, c.disparo_id, c.contato_id, c.canal_id, c.empresa_id
  from candidatos c join canais k on k.id = c.canal_id
  where c.rn <= k.cota
  limit p_max
$$;
revoke execute on function crm_proximos_envios(int) from public, anon, authenticated;

-- tempo real para a caixa de conversas
alter publication supabase_realtime add table crm_conversas, crm_mensagens;

-- todo canal novo ganha sua linha de segredos (com a chave do webhook)
create function crm_canal_criado() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into crm_canais_segredos (canal_id) values (new.id) on conflict do nothing; return new; end $$;
revoke execute on function crm_canal_criado() from public, anon, authenticated;
create trigger crm_canais_segredos_auto after insert on crm_canais for each row execute function crm_canal_criado();

-- (042) chave interna da fila + funções liberadas só para a função do servidor
select vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'crm:cron', 'Chave interna da fila de disparos do CRM');
create function crm_chave_cron() returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'crm:cron' limit 1
$$;
revoke execute on function crm_chave_cron() from public, anon, authenticated;
grant execute on function crm_chave_cron() to service_role;
grant execute on function crm_receber_mensagem(uuid, text, text, text, text, text, text), crm_registrar_saida(uuid, text, text, uuid, text, text), crm_proximos_envios(int) to service_role;

-- fila de disparos: roda a cada minuto, só quando há disparo em andamento
select cron.schedule('crm-fila-disparos', '* * * * *', $$
  select net.http_post(
    url := 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/crm-whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-chave', public.crm_chave_cron()),
    body := '{"acao":"processar_fila"}'::jsonb,
    timeout_milliseconds := 55000)
  where exists (select 1 from public.crm_disparos where status = 'enviando')
$$);

-- (043) nomes da equipe para quem é membro
create function crm_equipe(p_empresa uuid) returns table (usuario_id uuid, nome text, papel text, ativo boolean)
language sql stable security definer set search_path = public as $$
  select m.usuario_id, m.nome, m.papel, m.ativo from crm_membros m where m.empresa_id = p_empresa and crm_sou_membro(p_empresa) order by m.nome
$$;
revoke execute on function crm_equipe(uuid) from public, anon;

-- (044) admin grava chaves do número (sem poder ler de volta) e vê o endereço de recebimento
create function crm_salvar_segredo_canal(p_canal uuid, p_campo text, p_valor text) returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from crm_canais where id = p_canal;
  if v_emp is null or not crm_sou_admin(v_emp) then raise exception 'Só o administrador.'; end if;
  if p_campo not in ('apikey', 'token') then raise exception 'Campo inválido.'; end if;
  insert into crm_canais_segredos (canal_id) values (p_canal) on conflict do nothing;
  update crm_canais_segredos set segredos = segredos || jsonb_build_object(p_campo, p_valor) where canal_id = p_canal;
end $$;
revoke execute on function crm_salvar_segredo_canal(uuid, text, text) from public, anon;

create function crm_info_canal(p_canal uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid; s crm_canais_segredos;
begin
  select empresa_id into v_emp from crm_canais where id = p_canal;
  if v_emp is null or not crm_sou_admin(v_emp) then raise exception 'Só o administrador.'; end if;
  select * into s from crm_canais_segredos where canal_id = p_canal;
  return jsonb_build_object('chave_webhook', s.chave_webhook, 'salvos', (select coalesce(jsonb_agg(k), '[]') from jsonb_object_keys(coalesce(s.segredos, '{}')) k));
end $$;
revoke execute on function crm_info_canal(uuid) from public, anon;
