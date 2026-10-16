-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO: melhorias da caixa de conversas (o que os usuários mais reclamam nos concorrentes)
-- • notas internas na conversa (só a equipe vê; nunca vão para o WhatsApp)
-- • número de uma pessoa (canal com dona): o que chega nele vai para ela
-- • mensagens mandadas pelo celular (QR code "fromMe" / coexistência "smb_message_echoes") aparecem na conversa
-- • status de entrega/leitura/falha que o WhatsApp avisa depois
-- (aplicado como 056)
-- ════════════════════════════════════════════════════════════════════

create table crm_notas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  conversa_id uuid not null references crm_conversas on delete cascade,
  autor_id uuid references auth.users,
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now()
);
create index crm_notas_conversa on crm_notas (conversa_id, criado_em);
alter table crm_notas enable row level security;
create policy crm_notas_ver on crm_notas for select to authenticated using (crm_pode_ver_conversa(conversa_id));
alter publication supabase_realtime add table crm_notas;

create function crm_nota_interna(p_conversa uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_id uuid;
begin
  select empresa_id into v_emp from crm_conversas where id = p_conversa;
  if v_emp is null or not crm_pode_ver_conversa(p_conversa) then raise exception 'Conversa não encontrada.'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Escreva a nota.'; end if;
  insert into crm_notas (empresa_id, conversa_id, autor_id, texto) values (v_emp, p_conversa, auth.uid(), trim(p_texto)) returning id into v_id;
  return v_id;
end $$;
revoke execute on function crm_nota_interna(uuid, text) from public, anon;

-- número de uma pessoa: o que chega nele vai para ela (e o que ela manda pelo celular sai com o nome dela)
alter table crm_canais add column atendente_id uuid references auth.users;

-- mensagem que a equipe mandou direto pelo celular (o sistema só fica sabendo depois)
create function crm_registrar_eco(p_canal uuid, p_telefone text, p_texto text, p_tipo text default 'texto', p_id_externo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k crm_canais; v_contato uuid; v_conv crm_conversas; v_msg uuid;
begin
  select * into k from crm_canais where id = p_canal;
  if k.id is null then raise exception 'canal não existe'; end if;
  if p_id_externo is not null and exists (select 1 from crm_mensagens where empresa_id = k.empresa_id and id_externo = p_id_externo) then
    return jsonb_build_object('repetida', true);
  end if;
  select id into v_contato from crm_contatos where empresa_id = k.empresa_id and telefone = p_telefone;
  if v_contato is null then
    insert into crm_contatos (empresa_id, telefone, origem, entrou_em, tags, responsavel_id)
    values (k.empresa_id, p_telefone, 'whatsapp', now(), array['whatsapp'], k.atendente_id) returning id into v_contato;
  end if;
  -- a mensagem que o próprio sistema mandou pode voltar como "eco" antes de o id dela ser gravado
  if exists (select 1 from crm_mensagens m join crm_conversas v on v.id = m.conversa_id
             where v.canal_id = p_canal and v.contato_id = v_contato and m.direcao = 'saida' and m.texto is not distinct from p_texto
               and m.criado_em > now() - interval '3 minutes' and (m.id_externo is null or m.id_externo = p_id_externo)) then
    return jsonb_build_object('repetida', true);
  end if;
  insert into crm_conversas (empresa_id, contato_id, canal_id, atendente_id) values (k.empresa_id, v_contato, p_canal, k.atendente_id)
  on conflict (canal_id, contato_id) do nothing;
  select * into v_conv from crm_conversas where canal_id = p_canal and contato_id = v_contato;
  if v_conv.atendente_id is null and k.atendente_id is not null then update crm_conversas set atendente_id = k.atendente_id where id = v_conv.id; end if;
  insert into crm_mensagens (empresa_id, conversa_id, direcao, autor, autor_id, tipo, texto, status, id_externo)
  values (k.empresa_id, v_conv.id, 'saida', 'atendente', k.atendente_id, coalesce(p_tipo, 'texto'), p_texto, 'enviada', p_id_externo)
  returning id into v_msg;
  update crm_conversas set ultima_mensagem = left(coalesce(p_texto, '[' || coalesce(p_tipo, 'texto') || ']'), 200), ultima_em = now(),
    ultima_direcao = 'saida', aguardando_resposta = false, nao_lidas = 0, status = 'aberta'
  where id = v_conv.id;
  update crm_contatos set responsavel_id = coalesce(responsavel_id, k.atendente_id) where id = v_contato;
  return jsonb_build_object('mensagem', v_msg, 'conversa', v_conv.id);
end $$;
revoke execute on function crm_registrar_eco(uuid, text, text, text, text) from public, anon, authenticated;

-- status que o WhatsApp avisa depois (entregue, lida, falhou). Só anda para frente.
create function crm_status_mensagem(p_canal uuid, p_id_externo text, p_status text, p_erro text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_emp uuid;
begin
  select empresa_id into v_emp from crm_canais where id = p_canal;
  update crm_mensagens m set status = p_status, erro = case when p_status = 'erro' then coalesce(p_erro, 'O WhatsApp não entregou') else m.erro end
  where m.empresa_id = v_emp and m.id_externo = p_id_externo and m.direcao = 'saida'
    and (p_status = 'erro'
         or array_position(array['pendente', 'enviada', 'entregue', 'lida'], p_status) > coalesce(array_position(array['pendente', 'enviada', 'entregue', 'lida'], m.status), 0));
end $$;
revoke execute on function crm_status_mensagem(uuid, text, text, text) from public, anon, authenticated;

-- o que chega no número de uma pessoa vai para ela
do $f$
declare d text;
begin
  d := pg_get_functiondef('crm_receber_mensagem(uuid,text,text,text,text,text,text)'::regprocedure);
  d := replace(d, $r$v_dona := crm_escolher_atendente(k.empresa_id, v_contato);$r$, $r$v_dona := coalesce(k.atendente_id, crm_escolher_atendente(k.empresa_id, v_contato));$r$);
  if d not like '%coalesce(k.atendente_id, crm_escolher_atendente%' then raise exception 'trecho não encontrado (receber)'; end if;
  execute d;
end $f$;

-- (058) busca por palavra dentro das conversas (mensagens e notas) + nome/telefone; só o que a pessoa pode ver
create function crm_buscar_conversas(p_empresa uuid, p_termo text) returns table (conversa_id uuid, trecho text)
language sql stable security definer set search_path = public as $$
  with t as (select '%' || trim(p_termo) || '%' q)
  select distinct on (x.conversa_id) x.conversa_id, x.trecho from (
    select m.conversa_id, left(m.texto, 160) trecho, m.criado_em from crm_mensagens m, t
     where m.empresa_id = p_empresa and m.texto ilike t.q
    union all
    select n.conversa_id, left('Nota: ' || n.texto, 160), n.criado_em from crm_notas n, t
     where n.empresa_id = p_empresa and n.texto ilike t.q
    union all
    select v.id, null, v.ultima_em from crm_conversas v join crm_contatos c on c.id = v.contato_id, t
     where v.empresa_id = p_empresa and (c.nome ilike t.q or (length(regexp_replace(p_termo, '\D', '', 'g')) >= 4 and c.telefone like '%' || regexp_replace(p_termo, '\D', '', 'g') || '%'))
  ) x
  where length(trim(p_termo)) >= 2 and crm_pode_ver_conversa(x.conversa_id)
  order by x.conversa_id, x.criado_em desc nulls last
  limit 200
$$;
revoke execute on function crm_buscar_conversas(uuid, text) from public, anon;
