-- ════════════════════════════════════════════════════════════════════
-- CRM — CAMADA DA UNIQUE HOF ACADEMY
--
-- Usa o núcleo (crm_*) e liga com o que é só da Unique: vendedoras,
-- compras da Hotmart, alunos presenciais e listas de campanha.
-- O núcleo nunca depende daqui.
-- ════════════════════════════════════════════════════════════════════

-- telefone brasileiro → só dígitos com 55 (celular com 9). Fixo e número quebrado → null.
create or replace function crm_tel_br(t text) returns text language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(t, ''), '\D', '', 'g'); n text;
begin
  if d = '' then return null; end if;
  if left(d, 2) <> '55' and length(d) in (10, 11) then d := '55' || d; end if;
  if left(d, 2) = '55' and length(d) in (12, 13) and substr(d, 3, 2)::int >= 11 then
    n := substr(d, 5);
    if length(n) = 8 and left(n, 1) in ('6', '7', '8', '9') then n := '9' || n; end if;
    if length(n) = 9 and left(n, 1) = '9' then return '55' || substr(d, 3, 2) || n; end if;
  end if;
  return null;
end $$;

-- a empresa "Unique HOF Academy" dentro do CRM
insert into crm_empresas (id, nome) values ('a0000000-0000-4000-8000-000000000001', 'Unique HOF Academy');
create function empresa_unique() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;

-- membros do CRM da Unique = logins do sistema (admin → admin, vendedora → atendente)
insert into crm_membros (empresa_id, usuario_id, papel, ativo, nome)
select empresa_unique(), id, case when papel = 'admin' then 'admin' else 'atendente' end, papel in ('admin', 'vendedora'), nome from perfis;

create function sync_membro_crm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into crm_membros (empresa_id, usuario_id, papel, ativo, nome)
  values (empresa_unique(), new.id, case when new.papel = 'admin' then 'admin' else 'atendente' end, new.papel in ('admin', 'vendedora'), new.nome)
  on conflict (empresa_id, usuario_id) do update set papel = excluded.papel, ativo = excluded.ativo, nome = excluded.nome;
  return new;
end $$;
create trigger perfis_crm after insert or update of papel, nome on perfis for each row execute function sync_membro_crm();

-- ── resumo de cada contato (o que comprou, segmento) ─────────────────
create table contato_resumo (
  contato_id uuid primary key references crm_contatos on delete cascade,
  segmento text not null,                      -- comprador | quase | marcado | frio
  produtos text[] not null default '{}',
  total_liquido numeric not null default 0,
  primeira_compra timestamptz,
  ultima_compra timestamptz,
  anos_compra int[] not null default '{}',
  reembolsou boolean not null default false,
  aluno_presencial boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create index contato_resumo_segmento on contato_resumo (segmento);
create index contato_resumo_produtos on contato_resumo using gin (produtos);
alter table contato_resumo enable row level security;
create policy contato_resumo_ver on contato_resumo for select to authenticated using ((select is_admin()));

create index if not exists hp_email_lower on hotmart_pagamentos (lower(comprador_email));
create index if not exists hp_data_aprovacao on hotmart_pagamentos (data_aprovacao);

create function atualizar_resumo_contatos() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Só o administrador.'; end if;
  with e as (
    select c.id, unnest(c.emails) email from crm_contatos c where c.empresa_id = empresa_unique()
  ), hp as (
    select e.id, h.produto_nome, h.data_aprovacao, h.valor_liquido, h.status in ('APPROVED', 'COMPLETE') ok, h.status
    from e join hotmart_pagamentos h on lower(h.comprador_email) = e.email
  ), comp as (
    select id,
      coalesce(array_agg(distinct produto_nome) filter (where ok and produto_nome is not null), '{}') produtos,
      coalesce(sum(valor_liquido) filter (where ok), 0) total,
      min(data_aprovacao) filter (where ok) primeira,
      max(data_aprovacao) filter (where ok) ultima,
      coalesce(array_agg(distinct extract(year from data_aprovacao)::int) filter (where ok and data_aprovacao is not null), '{}') anos,
      bool_or(status in ('REFUNDED', 'CHARGEBACK')) reembolsou
    from hp group by id
  ), pres as (
    select distinct c.id from crm_contatos c
    join alunos a on (crm_tel_br(a.whatsapp) = c.telefone or lower(a.email) = any (c.emails))
    join matriculas m on m.aluno_id = a.id and m.status <> 'cancelada'
    where c.empresa_id = empresa_unique()
  )
  insert into contato_resumo as r (contato_id, segmento, produtos, total_liquido, primeira_compra, ultima_compra, anos_compra, reembolsou, aluno_presencial, atualizado_em)
  select c.id,
    case
      when cardinality(coalesce(comp.produtos, '{}')) > 0 or pres.id is not null or 'hotmart-comprador' = any (c.tags) then 'comprador'
      when 'hotmart-quase' = any (c.tags) then 'quase'
      when c.tags && array['compra-realizada', 'aluno', 'abandonou-carrinho', 'abandonou-carrinho-boleto', 'aguardando-pagamento'] then 'marcado'
      else 'frio' end,
    coalesce(comp.produtos, '{}'), coalesce(comp.total, 0), comp.primeira, comp.ultima, coalesce(comp.anos, '{}'),
    coalesce(comp.reembolsou, false), pres.id is not null, now()
  from crm_contatos c
  left join comp on comp.id = c.id
  left join pres on pres.id = c.id
  where c.empresa_id = empresa_unique()
  on conflict (contato_id) do update set
    segmento = excluded.segmento, produtos = excluded.produtos, total_liquido = excluded.total_liquido,
    primeira_compra = excluded.primeira_compra, ultima_compra = excluded.ultima_compra, anos_compra = excluded.anos_compra,
    reembolsou = excluded.reembolsou, aluno_presencial = excluded.aluno_presencial, atualizado_em = now()
  where (r.segmento, r.produtos, r.total_liquido, r.ultima_compra, r.aluno_presencial, r.reembolsou)
     is distinct from (excluded.segmento, excluded.produtos, excluded.total_liquido, excluded.ultima_compra, excluded.aluno_presencial, excluded.reembolsou);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function atualizar_resumo_contatos() from public, anon;

-- ── entradas automáticas na base ─────────────────────────────────────
-- compra nova na Hotmart → contato (só e-mail; a Hotmart não manda telefone por aqui)
create function contato_da_hotmart() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.comprador_email like '%@%' then
      perform crm_mesclar_contato(empresa_unique(), jsonb_build_object(
        'nome', new.comprador_nome, 'emails', jsonb_build_array(lower(new.comprador_email)),
        'tags', jsonb_build_array('hotmart'), 'entrou_em', coalesce(new.data_pedido, new.data_aprovacao, now())), 'hotmart');
    end if;
  exception when others then null;  -- nunca travar a entrada do pagamento
  end;
  return new;
end $$;
create trigger hp_contato after insert on hotmart_pagamentos for each row execute function contato_da_hotmart();

-- aluno presencial → contato
create function contato_do_aluno() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform crm_mesclar_contato(empresa_unique(), jsonb_build_object(
      'nome', new.nome, 'telefone', crm_tel_br(new.whatsapp),
      'emails', case when new.email like '%@%' then jsonb_build_array(lower(new.email)) else '[]'::jsonb end,
      'tags', jsonb_build_array('aluno-presencial'), 'cidade', new.cidade, 'uf', new.uf, 'instagram', new.instagram), 'presencial');
  exception when others then null;
  end;
  return new;
end $$;
create trigger alunos_contato after insert or update of whatsapp, email on alunos for each row execute function contato_do_aluno();

-- ── listas (campanhas) divididas entre vendedoras ────────────────────
create table campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  objetivo text,
  mensagens jsonb not null default '[]',      -- [{titulo, texto}] com {nome} no texto
  filtro jsonb,                               -- como a lista foi montada
  status text not null default 'ativa' check (status in ('ativa', 'encerrada')),
  criada_por uuid references perfis (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  encerrada_em timestamptz
);

create table campanha_contatos (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas on delete cascade,
  contato_id uuid not null references crm_contatos on delete cascade,
  vendedora_id uuid references vendedoras (id),
  status text not null default 'a_contatar' check (status in
    ('a_contatar', 'enviada', 'conversando', 'interessado', 'comprou', 'sem_interesse', 'sem_resposta', 'numero_errado', 'nao_quer')),
  tentativas int not null default 0,
  ultimo_contato_em timestamptz,
  retornar_em date,
  nota text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  unique (campanha_id, contato_id)
);
create index campanha_contatos_vend on campanha_contatos (campanha_id, vendedora_id, status);
create index campanha_contatos_contato on campanha_contatos (contato_id);

alter table campanhas enable row level security;
alter table campanha_contatos enable row level security;
create policy campanhas_ver on campanhas for select to authenticated using (
  (select is_admin()) or exists (select 1 from campanha_contatos cc where cc.campanha_id = campanhas.id and cc.vendedora_id = (select minha_vendedora())));
create policy campanhas_admin on campanhas for all to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy cc_ver on campanha_contatos for select to authenticated using ((select is_admin()) or vendedora_id = (select minha_vendedora()));
create policy cc_admin on campanha_contatos for all to authenticated using ((select is_admin())) with check ((select is_admin()));

-- comprou depois de uma data? (Hotmart pelo e-mail ou matrícula presencial) → "Produto em dd/mm"
create function comprou_desde(p_contato uuid, p_desde timestamptz) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select h.produto_nome || ' em ' || to_char(h.data_aprovacao at time zone 'America/Sao_Paulo', 'DD/MM')
       from crm_contatos c, unnest(c.emails) e
       join hotmart_pagamentos h on lower(h.comprador_email) = e
      where c.id = p_contato and h.status in ('APPROVED', 'COMPLETE') and h.data_aprovacao >= p_desde
        and coalesce(h.recorrencia, 1) <= 1
      order by h.data_aprovacao limit 1),
    (select cu.nome || ' (presencial) em ' || to_char(m.data_venda, 'DD/MM')
       from crm_contatos c
       join alunos a on (crm_tel_br(a.whatsapp) = c.telefone or lower(a.email) = any (c.emails))
       join matriculas m on m.aluno_id = a.id and m.status <> 'cancelada' and m.data_venda >= (p_desde at time zone 'America/Sao_Paulo')::date
       join turmas t on t.id = m.turma_id join cursos cu on cu.id = t.curso_id
      where c.id = p_contato order by m.data_venda limit 1))
$$;
revoke execute on function comprou_desde(uuid, timestamptz) from public, anon, authenticated;

-- filtro único usado na busca e na montagem das listas
create function contatos_filtrados(p jsonb) returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select c.id from crm_contatos c left join contato_resumo r on r.contato_id = c.id
  where c.empresa_id = empresa_unique()
    and (coalesce(p->>'segmento', '') = '' or r.segmento = p->>'segmento'
         or (p->>'segmento' = 'comprador_ou_quase' and r.segmento in ('comprador', 'quase')))
    and (coalesce(p->>'produto', '') = '' or p->>'produto' = any (r.produtos))
    and (coalesce(p->>'sem_produto', '') = '' or not (p->>'sem_produto' = any (coalesce(r.produtos, '{}'))))
    and (coalesce(p->>'ano_compra', '') = '' or (p->>'ano_compra')::int = any (r.anos_compra))
    and (coalesce(p->>'ano_entrada', '') = '' or extract(year from c.entrou_em) = (p->>'ano_entrada')::int)
    and (coalesce(p->>'tag', '') = '' or p->>'tag' = any (c.tags))
    and (not coalesce((p->>'so_whats')::boolean, false) or (c.telefone is not null and not c.telefone_invalido and not c.nao_contatar))
    and (not coalesce((p->>'fora_de_lista')::boolean, false) or not exists (
          select 1 from campanha_contatos cc join campanhas k on k.id = cc.campanha_id where cc.contato_id = c.id and k.status = 'ativa'))
    and (coalesce(p->>'busca', '') = ''
         or c.nome ilike '%' || (p->>'busca') || '%'
         or (regexp_replace(p->>'busca', '\D', '', 'g') <> '' and length(regexp_replace(p->>'busca', '\D', '', 'g')) >= 4
             and c.telefone like '%' || regexp_replace(p->>'busca', '\D', '', 'g') || '%')
         or exists (select 1 from unnest(c.emails) e where e ilike '%' || (p->>'busca') || '%'))
$$;
revoke execute on function contatos_filtrados(jsonb) from public, anon, authenticated;

-- busca de contatos (admin)
create function buscar_contatos(p jsonb, p_limite int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  with f as materialized (select id from contatos_filtrados(p))
  select jsonb_build_object(
    'total', (select count(*) from f),
    'linhas', coalesce((select jsonb_agg(x) from (
      select c.id, c.nome, c.telefone, c.emails, c.tags, c.cidade, c.uf, c.entrou_em, c.origem, c.nao_contatar, c.telefone_invalido,
             r.segmento, r.produtos, r.total_liquido, r.ultima_compra, r.aluno_presencial, r.reembolsou,
             (select k.nome from campanha_contatos cc join campanhas k on k.id = cc.campanha_id
               where cc.contato_id = c.id and k.status = 'ativa' order by k.criado_em desc limit 1) lista_ativa
      from f join crm_contatos c on c.id = f.id left join contato_resumo r on r.contato_id = c.id
      order by r.ultima_compra desc nulls last, c.entrou_em desc nulls last, c.id
      limit least(p_limite, 200) offset p_offset) x), '[]'::jsonb)) into v;
  return v;
end $$;

-- contagem por segmento com o filtro atual (ignorando o próprio segmento)
create function contar_contatos(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  select coalesce(jsonb_object_agg(seg, jsonb_build_object('total', total, 'com_whats', com_whats, 'livres', livres)), '{}') into v from (
    select coalesce(r.segmento, 'frio') seg, count(*) total,
      count(*) filter (where c.telefone is not null and not c.telefone_invalido and not c.nao_contatar) com_whats,
      count(*) filter (where c.telefone is not null and not c.telefone_invalido and not c.nao_contatar and not exists (
        select 1 from campanha_contatos cc join campanhas k on k.id = cc.campanha_id where cc.contato_id = c.id and k.status = 'ativa')) livres
    from contatos_filtrados(p - 'segmento') f join crm_contatos c on c.id = f.id left join contato_resumo r on r.contato_id = c.id
    group by 1) s;
  return v;
end $$;

-- criar lista com o filtro e dividir entre as vendedoras (mistura igual de cada tipo para cada uma)
create function criar_campanha(p_nome text, p_objetivo text, p_mensagens jsonb, p_filtro jsonb, p_vendedoras uuid[], p_limite int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; n int; nv int := coalesce(cardinality(p_vendedoras), 0);
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  if nv = 0 then raise exception 'Escolha pelo menos uma vendedora.'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Dê um nome para a lista.'; end if;
  insert into campanhas (nome, objetivo, mensagens, filtro) values (trim(p_nome), p_objetivo, coalesce(p_mensagens, '[]'), p_filtro)
  returning id into v_id;
  insert into campanha_contatos (campanha_id, contato_id, vendedora_id)
  select v_id, s.id, p_vendedoras[1 + ((row_number() over (order by s.ordem)) - 1) % nv]
  from (
    select f.id, row_number() over (order by case r.segmento when 'comprador' then 1 when 'quase' then 2 when 'marcado' then 3 else 4 end, random()) ordem
    from contatos_filtrados(coalesce(p_filtro, '{}') || '{"so_whats": true}') f left join contato_resumo r on r.contato_id = f.id
  ) s
  where p_limite is null or s.ordem <= p_limite;
  get diagnostics n = row_count;
  return jsonb_build_object('id', v_id, 'contatos', n);
end $$;

-- passar os contatos ainda não contatados de uma vendedora para outra(s)
create function redistribuir_lista(p_campanha uuid, p_de uuid, p_para uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int; nv int := coalesce(cardinality(p_para), 0);
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  if nv = 0 then raise exception 'Escolha para quem passar.'; end if;
  with s as (
    select id, row_number() over (order by random()) rn from campanha_contatos
    where campanha_id = p_campanha and vendedora_id is not distinct from p_de and status = 'a_contatar')
  update campanha_contatos cc set vendedora_id = p_para[1 + (s.rn - 1) % nv], atualizado_em = now(), atualizado_por = auth.uid()
  from s where cc.id = s.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- resumo das listas: admin vê todas; vendedora vê só a parte dela
create function resumo_campanhas() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(k order by k.status, k.criado_em desc), '[]') from (
    select k.id, k.nome, k.objetivo, k.status, k.criado_em, k.mensagens, k.filtro,
      (select coalesce(jsonb_agg(v order by v.vendedora_nome), '[]') from (
        select cc.vendedora_id, coalesce(vd.nome, 'Sem vendedora') vendedora_nome, count(*) total,
          count(*) filter (where cc.status = 'a_contatar') a_contatar,
          count(*) filter (where cc.status = 'enviada') enviada,
          count(*) filter (where cc.status in ('conversando', 'interessado')) conversando,
          count(*) filter (where cc.status = 'comprou') comprou,
          count(*) filter (where cc.status in ('sem_interesse', 'sem_resposta', 'numero_errado', 'nao_quer')) encerrados,
          count(*) filter (where cc.retornar_em <= current_date and cc.status in ('enviada', 'conversando', 'interessado')) retornar_hoje,
          count(*) filter (where comprou_desde(cc.contato_id, k.criado_em) is not null) compraram
        from campanha_contatos cc left join vendedoras vd on vd.id = cc.vendedora_id
        where cc.campanha_id = k.id and (is_admin() or cc.vendedora_id = minha_vendedora())
        group by cc.vendedora_id, vd.nome) v) por_vendedora
    from campanhas k
    where is_admin() or exists (select 1 from campanha_contatos cc where cc.campanha_id = k.id and cc.vendedora_id = minha_vendedora())
  ) k
$$;

-- contatos de uma lista (vendedora: só os dela; admin: todos)
create function contatos_da_lista(p_campanha uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]') from (
    select cc.id, cc.status, cc.nota, cc.retornar_em, cc.ultimo_contato_em, cc.tentativas, cc.vendedora_id, vd.nome vendedora_nome,
      c.id contato_id, c.nome, c.telefone, c.emails[1] email, c.cidade, c.uf, c.nao_contatar,
      r.segmento, r.produtos, r.ultima_compra, r.aluno_presencial,
      case when is_admin() then r.total_liquido end total_liquido,
      comprou_desde(c.id, k.criado_em) comprou_depois
    from campanha_contatos cc
    join campanhas k on k.id = cc.campanha_id
    join crm_contatos c on c.id = cc.contato_id
    left join contato_resumo r on r.contato_id = c.id
    left join vendedoras vd on vd.id = cc.vendedora_id
    where cc.campanha_id = p_campanha and (is_admin() or cc.vendedora_id = minha_vendedora())
    order by case r.segmento when 'comprador' then 1 when 'quase' then 2 when 'marcado' then 3 else 4 end, r.ultima_compra desc nulls last, c.nome
  ) x
$$;

-- vendedora (ou admin) registra o que aconteceu com um contato da lista
-- p = {status?, nota?, retornar_em? (null limpa), enviou?: true quando abriu o WhatsApp}
create function marcar_contato_lista(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v campanha_contatos; v_status text := nullif(p->>'status', ''); v_enviou boolean := coalesce((p->>'enviou')::boolean, false);
begin
  select * into v from campanha_contatos where id = p_id;
  if v.id is null or not (is_admin() or v.vendedora_id = minha_vendedora()) then raise exception 'Esse contato não está na sua lista.'; end if;
  update campanha_contatos set
    status = coalesce(v_status, case when v_enviou and status = 'a_contatar' then 'enviada' else status end),
    nota = case when p ? 'nota' then nullif(trim(p->>'nota'), '') else nota end,
    retornar_em = case when p ? 'retornar_em' then nullif(p->>'retornar_em', '')::date else retornar_em end,
    tentativas = tentativas + case when v_enviou then 1 else 0 end,
    ultimo_contato_em = case when v_enviou then now() else ultimo_contato_em end,
    atualizado_em = now(), atualizado_por = auth.uid()
  where id = p_id;
  insert into crm_eventos (empresa_id, contato_id, tipo, texto, dados, autor_id)
  values (empresa_unique(), v.contato_id, case when v_enviou then 'whatsapp' else 'lista' end,
          case when p ? 'nota' then nullif(trim(p->>'nota'), '') end,
          jsonb_build_object('campanha', v.campanha_id, 'status', v_status, 'retornar_em', p->>'retornar_em'), auth.uid());
  if v_status = 'nao_quer' then
    update crm_contatos set nao_contatar = true, nao_contatar_em = now(), nao_contatar_motivo = 'Pediu para não receber (lista)' where id = v.contato_id;
  elsif v_status = 'numero_errado' then
    update crm_contatos set telefone_invalido = true where id = v.contato_id;
  end if;
end $$;

-- ficha completa do contato (admin)
create function detalhe_contato(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  select jsonb_build_object(
    'contato', to_jsonb(c),
    'resumo', to_jsonb(r),
    'compras', coalesce((select jsonb_agg(h order by h.data_aprovacao desc) from (
        select h.data_aprovacao, h.produto_nome, h.valor_liquido, h.status, h.forma, h.recorrencia, h.parcelas_cartao
        from unnest(c.emails) e join hotmart_pagamentos h on lower(h.comprador_email) = e) h), '[]'),
    'listas', coalesce((select jsonb_agg(jsonb_build_object('campanha', k.nome, 'status', cc.status, 'vendedora', vd.nome, 'nota', cc.nota, 'atualizado_em', cc.atualizado_em) order by k.criado_em desc)
        from campanha_contatos cc join campanhas k on k.id = cc.campanha_id left join vendedoras vd on vd.id = cc.vendedora_id
        where cc.contato_id = c.id), '[]'),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('tipo', ev.tipo, 'texto', ev.texto, 'dados', ev.dados, 'criado_em', ev.criado_em, 'autor', pf.nome) order by ev.criado_em desc)
        from crm_eventos ev left join perfis pf on pf.id = ev.autor_id where ev.contato_id = c.id), '[]'))
  into v
  from crm_contatos c left join contato_resumo r on r.contato_id = c.id
  where c.id = p_id and c.empresa_id = empresa_unique();
  return v;
end $$;

revoke execute on function buscar_contatos(jsonb, int, int), contar_contatos(jsonb), criar_campanha(text, text, jsonb, jsonb, uuid[], int),
  redistribuir_lista(uuid, uuid, uuid[]), resumo_campanhas(), contatos_da_lista(uuid), marcar_contato_lista(uuid, jsonb), detalhe_contato(uuid)
  from public, anon;

-- base inicial: alunos presenciais e compradores que já estão no banco
select crm_mesclar_contato(empresa_unique(), jsonb_build_object(
  'nome', a.nome, 'telefone', crm_tel_br(a.whatsapp),
  'emails', case when a.email like '%@%' then jsonb_build_array(lower(a.email)) else '[]'::jsonb end,
  'tags', jsonb_build_array('aluno-presencial'), 'cidade', a.cidade, 'uf', a.uf, 'instagram', a.instagram, 'entrou_em', a.criado_em), 'presencial')
from alunos a;

select crm_mesclar_contato(empresa_unique(), jsonb_build_object(
  'nome', x.nome, 'emails', jsonb_build_array(x.email), 'tags', jsonb_build_array('hotmart'), 'entrou_em', x.primeira), 'hotmart')
from (select lower(comprador_email) email, (array_agg(comprador_nome order by data_aprovacao))[1] nome, min(coalesce(data_pedido, data_aprovacao)) primeira
      from hotmart_pagamentos where comprador_email like '%@%' group by 1) x;

select atualizar_resumo_contatos();

-- tabela de câmbio: só leitura para quem está logado (estava sem regra de acesso)
alter table interno.cambio_export enable row level security;
create policy cambio_ler on interno.cambio_export for select to authenticated using (true);
revoke all on interno.cambio_export from anon;

-- resumo atualizado de hora em hora (depois da busca da Hotmart, que roda aos :23)
select cron.schedule('crm-resumo', '35 * * * *', 'select public.atualizar_resumo_contatos()');

-- (038) funções internas não ficam abertas para quem não está logado
revoke execute on function crm_sou_membro(uuid), crm_sou_admin(uuid), crm_pode_ver_contato(uuid), contato_da_hotmart(), contato_do_aluno(), sync_membro_crm() from public, anon;
revoke execute on function contato_da_hotmart(), contato_do_aluno(), sync_membro_crm() from authenticated;
alter function empresa_unique() set search_path = public;

-- (039–041) etapas do funil da Unique e um número de teste (simulador)
insert into crm_etapas (empresa_id, nome, ordem, cor, final) values
 (empresa_unique(), 'Novo contato', 1, '#7fa9d9', null), (empresa_unique(), 'Em conversa', 2, '#c9a45c', null),
 (empresa_unique(), 'Interessado', 3, '#e0b04f', null), (empresa_unique(), 'Negociando', 4, '#dcb96f', null),
 (empresa_unique(), 'Comprou', 5, '#6fbf8a', 'ganho'), (empresa_unique(), 'Perdido', 6, '#a3a3a9', 'perdido');
insert into crm_canais (empresa_id, nome, tipo, status, ritmo_por_hora, status_info)
values (empresa_unique(), 'Número de teste (simulador)', 'teste', 'conectado', 60, 'Não envia nada de verdade: serve para testar conversas e disparos.');
