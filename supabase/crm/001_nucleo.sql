-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO (parte separada)
--
-- Regra: nada aqui pode depender de vendedora, Hotmart, comissão ou de
-- qualquer tabela que não comece com crm_. Este arquivo é o que vai ser
-- levado para o Unique Clinical (cada clínica = uma empresa).
--
-- Separação por empresa (LGPD): toda tabela tem empresa_id e só quem é
-- membro daquela empresa enxerga os dados dela. Quem é dono da
-- plataforma não tem acesso automático a nenhuma empresa.
-- ════════════════════════════════════════════════════════════════════

create table crm_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table crm_membros (
  empresa_id uuid not null references crm_empresas on delete cascade,
  usuario_id uuid not null references auth.users on delete cascade,
  papel text not null check (papel in ('admin', 'atendente')),
  ativo boolean not null default true,
  nome text,
  primary key (empresa_id, usuario_id)
);
create index crm_membros_usuario on crm_membros (usuario_id);

create table crm_contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text,
  telefone text check (telefone ~ '^[1-9][0-9]{7,14}$'),   -- só dígitos, com país (5511999998888)
  emails text[] not null default '{}',                      -- sempre minúsculo
  tags text[] not null default '{}',
  origem text,                                              -- de onde veio primeiro (importação, formulário, ...)
  entrou_em timestamptz,
  cidade text,
  uf text,
  instagram text,
  responsavel_id uuid references auth.users on delete set null,
  nao_contatar boolean not null default false,              -- pediu para não receber mensagem (respeitar sempre)
  nao_contatar_em timestamptz,
  nao_contatar_motivo text,
  telefone_invalido boolean not null default false,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index crm_contatos_telefone on crm_contatos (empresa_id, telefone) where telefone is not null;
create index crm_contatos_empresa on crm_contatos (empresa_id);
create index crm_contatos_emails on crm_contatos using gin (emails);
create index crm_contatos_tags on crm_contatos using gin (tags);
create index crm_contatos_responsavel on crm_contatos (responsavel_id) where responsavel_id is not null;

-- Linha do tempo do contato: nota, mensagem, ligação, mudança de etapa...
create table crm_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  contato_id uuid not null references crm_contatos on delete cascade,
  tipo text not null,
  texto text,
  dados jsonb,
  autor_id uuid references auth.users on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index crm_eventos_contato on crm_eventos (contato_id, criado_em desc);

-- ── quem pode o quê ───────────────────────────────────────────────────
create function crm_sou_membro(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_membros where empresa_id = p_empresa and usuario_id = auth.uid() and ativo)
$$;

create function crm_sou_admin(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_membros where empresa_id = p_empresa and usuario_id = auth.uid() and ativo and papel = 'admin')
$$;

-- admin da empresa vê todos; atendente vê os contatos que são dela
create function crm_pode_ver_contato(p_contato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_contatos c
    where c.id = p_contato
      and (crm_sou_admin(c.empresa_id) or (c.responsavel_id = auth.uid() and crm_sou_membro(c.empresa_id)))
  )
$$;

alter table crm_empresas enable row level security;
alter table crm_membros enable row level security;
alter table crm_contatos enable row level security;
alter table crm_eventos enable row level security;

create policy crm_empresas_ver on crm_empresas for select to authenticated using (crm_sou_membro(id));

create policy crm_membros_ver on crm_membros for select to authenticated
  using (usuario_id = (select auth.uid()) or crm_sou_admin(empresa_id));
create policy crm_membros_admin on crm_membros for all to authenticated
  using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));

create policy crm_contatos_ver on crm_contatos for select to authenticated
  using (crm_sou_admin(empresa_id) or (responsavel_id = (select auth.uid()) and crm_sou_membro(empresa_id)));
create policy crm_contatos_inserir on crm_contatos for insert to authenticated
  with check (crm_sou_admin(empresa_id));
create policy crm_contatos_alterar on crm_contatos for update to authenticated
  using (crm_sou_admin(empresa_id) or (responsavel_id = (select auth.uid()) and crm_sou_membro(empresa_id)))
  with check (crm_sou_membro(empresa_id));
-- sem apagar: contato que sai vira "não contatar" (apagar de verdade por pedido LGPD vira função própria)

create policy crm_eventos_ver on crm_eventos for select to authenticated using (crm_pode_ver_contato(contato_id));
create policy crm_eventos_inserir on crm_eventos for insert to authenticated
  with check (crm_pode_ver_contato(contato_id) and autor_id = (select auth.uid()));

create function crm_tocar() returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger crm_contatos_tocar before update on crm_contatos for each row execute function crm_tocar();

-- ── juntar um contato na base (sem checar permissão: uso interno) ─────
-- linha = {nome, telefone, emails[], tags[], entrou_em, cidade, uf, instagram}
-- Procura primeiro pelo telefone, depois por qualquer e-mail. Se acha,
-- completa o que falta (nunca apaga o que já tem). Se não acha, cria.
create function crm_mesclar_contato(p_empresa uuid, p_linha jsonb, p_origem text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_tel text := nullif(p_linha->>'telefone', '');
  v_emails text[] := coalesce((select array_agg(distinct lower(trim(e))) from jsonb_array_elements_text(coalesce(p_linha->'emails', '[]')) e where trim(e) like '%@%'), '{}');
  v_tags text[] := coalesce((select array_agg(distinct t) from jsonb_array_elements_text(coalesce(p_linha->'tags', '[]')) t where t <> ''), '{}');
  v_entrou timestamptz := nullif(p_linha->>'entrou_em', '')::timestamptz;
  v_id uuid;
  v_tel_atual text;
begin
  if v_tel is not null and v_tel !~ '^[1-9][0-9]{7,14}$' then v_tel := null; end if;
  if v_tel is null and cardinality(v_emails) = 0 then return 'ignorado'; end if;

  if v_tel is not null then
    select id, telefone into v_id, v_tel_atual from crm_contatos where empresa_id = p_empresa and telefone = v_tel;
  end if;
  if v_id is null and cardinality(v_emails) > 0 then
    -- por e-mail: prefere um contato sem telefone (para não juntar duas pessoas com telefones diferentes)
    select id, telefone into v_id, v_tel_atual from crm_contatos
     where empresa_id = p_empresa and emails && v_emails and (v_tel is null or telefone is null)
     order by (telefone is null) desc limit 1;
  end if;

  if v_id is null then
    insert into crm_contatos (empresa_id, nome, telefone, emails, tags, origem, entrou_em, cidade, uf, instagram)
    values (p_empresa, nullif(trim(p_linha->>'nome'), ''), v_tel, v_emails, v_tags, p_origem, coalesce(v_entrou, now()),
            nullif(trim(p_linha->>'cidade'), ''), nullif(upper(trim(p_linha->>'uf')), ''), nullif(trim(p_linha->>'instagram'), ''));
    return 'novo';
  end if;

  update crm_contatos c set
    nome = coalesce(nullif(c.nome, ''), nullif(trim(p_linha->>'nome'), '')),
    telefone = coalesce(c.telefone, v_tel),
    emails = (select coalesce(array_agg(distinct x), '{}') from unnest(c.emails || v_emails) x),
    tags = (select coalesce(array_agg(distinct x), '{}') from unnest(c.tags || v_tags) x),
    entrou_em = least(c.entrou_em, v_entrou),
    cidade = coalesce(c.cidade, nullif(trim(p_linha->>'cidade'), '')),
    uf = coalesce(c.uf, nullif(upper(trim(p_linha->>'uf')), '')),
    instagram = coalesce(c.instagram, nullif(trim(p_linha->>'instagram'), ''))
  where c.id = v_id;
  return 'atualizado';
end $$;
revoke execute on function crm_mesclar_contato(uuid, jsonb, text) from public, anon, authenticated;

-- Importação em lote (até 2.000 linhas por chamada). Só admin da empresa.
create function crm_importar_contatos(p_empresa uuid, p_linhas jsonb, p_origem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v text; n_novo int := 0; n_atual int := 0; n_ign int := 0;
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador pode importar contatos.'; end if;
  if jsonb_array_length(p_linhas) > 2000 then raise exception 'Mande no máximo 2.000 linhas por vez.'; end if;
  for r in select * from jsonb_array_elements(p_linhas) loop
    v := crm_mesclar_contato(p_empresa, r, p_origem);
    if v = 'novo' then n_novo := n_novo + 1; elsif v = 'atualizado' then n_atual := n_atual + 1; else n_ign := n_ign + 1; end if;
  end loop;
  return jsonb_build_object('novos', n_novo, 'atualizados', n_atual, 'ignorados', n_ign);
end $$;
revoke execute on function crm_importar_contatos(uuid, jsonb, text) from public, anon;
