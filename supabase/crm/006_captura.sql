-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO: captura de leads (formulários próprios + endereço para ManyChat/site)
-- Todo lead entra com origem e campanha (UTM), cai no rodízio e vira tarefa de primeiro contato.
-- (aplicado como 057)
-- ════════════════════════════════════════════════════════════════════

create table crm_formularios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references crm_empresas on delete cascade,
  nome text not null,                                   -- nome interno, vira a "origem" do lead
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  titulo text,                                          -- o que aparece na página
  texto text,
  botao text not null default 'Quero saber mais',
  pedir_email boolean not null default true,
  perguntas jsonb not null default '[]',                -- [{"id":"profissao","rotulo":"Sua profissão","opcoes":["Dentista","Biomédica"]}]
  interesse text,                                       -- produto/assunto de interesse (vai para as etiquetas)
  etiquetas text[] not null default '{}',
  obrigado text not null default 'Recebemos seu contato! Em instantes alguém da equipe fala com você pelo WhatsApp.',
  redirecionar text,                                    -- endereço para mandar a pessoa depois (ex.: grupo, página de obrigado)
  cadencia_id uuid references crm_cadencias on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index crm_formularios_empresa on crm_formularios (empresa_id);
alter table crm_formularios enable row level security;
create policy crm_formularios_ver on crm_formularios for select to authenticated using (crm_sou_membro(empresa_id));
create policy crm_formularios_admin on crm_formularios for all to authenticated using (crm_sou_admin(empresa_id)) with check (crm_sou_admin(empresa_id));

-- primeira origem do contato (nunca muda) e a última captura
alter table crm_contatos add column primeira_origem jsonb;
alter table crm_contatos add column ultima_captura_em timestamptz;

-- o que a página pública precisa (sem login): só formulário ativo, sem dados internos
create function crm_formulario_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', f.nome, 'titulo', f.titulo, 'texto', f.texto, 'botao', f.botao, 'pedir_email', f.pedir_email, 'perguntas', f.perguntas)
  from crm_formularios f where f.slug = lower(p_slug) and f.ativo
$$;
grant execute on function crm_formulario_publico(text) to anon, authenticated;

-- entrada de lead (página pública, ManyChat, site). p_dados: nome, telefone/whatsapp, email, respostas{}, utm_*, fbclid, gclid, pagina
create function crm_capturar_lead(p_slug text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f crm_formularios; v_tel text; v_email text; v_nome text; v_contato uuid; v_novo boolean; v_dona uuid; v_origem jsonb; v_tags text[]; v_resp jsonb;
begin
  select * into f from crm_formularios where slug = lower(p_slug) and ativo;
  if f.id is null then raise exception 'Formulário não encontrado.'; end if;
  -- armadilha para robôs: campo escondido preenchido = finge que deu certo
  if coalesce(p_dados->>'site', '') <> '' then return jsonb_build_object('ok', true, 'obrigado', f.obrigado, 'redirecionar', f.redirecionar); end if;
  v_tel := crm_tel_br(coalesce(p_dados->>'telefone', p_dados->>'whatsapp', p_dados->>'phone', p_dados->>'celular'));
  v_email := nullif(lower(trim(coalesce(p_dados->>'email', ''))), '');
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
  v_nome := nullif(trim(coalesce(p_dados->>'nome', p_dados->>'name', p_dados->>'first_name', '')), '');
  if v_tel is null then raise exception 'Confira o WhatsApp (com DDD).'; end if;
  if v_nome is null or length(v_nome) < 2 then raise exception 'Escreva seu nome.'; end if;
  -- a mesma pessoa no mesmo formulário em 10 minutos conta uma vez só
  if exists (select 1 from crm_eventos e join crm_contatos c on c.id = e.contato_id
             where c.empresa_id = f.empresa_id and c.telefone = v_tel and e.tipo = 'captura'
               and e.dados->>'formulario' = f.slug and e.criado_em > now() - interval '10 minutes') then
    return jsonb_build_object('ok', true, 'obrigado', f.obrigado, 'redirecionar', f.redirecionar);
  end if;

  v_origem := jsonb_strip_nulls(jsonb_build_object(
    'formulario', f.slug, 'formulario_nome', f.nome, 'quando', now(),
    'utm_source', nullif(p_dados->>'utm_source', ''), 'utm_medium', nullif(p_dados->>'utm_medium', ''),
    'utm_campaign', nullif(p_dados->>'utm_campaign', ''), 'utm_content', nullif(p_dados->>'utm_content', ''),
    'utm_term', nullif(p_dados->>'utm_term', ''), 'fbclid', nullif(p_dados->>'fbclid', ''), 'gclid', nullif(p_dados->>'gclid', ''),
    'pagina', nullif(left(p_dados->>'pagina', 500), ''), 'canal', nullif(p_dados->>'canal', '')));
  v_resp := coalesce(p_dados->'respostas', '{}'::jsonb);
  v_tags := f.etiquetas || case when f.interesse is not null then array['interesse:' || lower(f.interesse)] else '{}' end;

  select id into v_contato from crm_contatos where empresa_id = f.empresa_id and telefone = v_tel;
  v_novo := v_contato is null;
  perform crm_mesclar_contato(f.empresa_id, jsonb_build_object('nome', v_nome, 'telefone', v_tel,
    'emails', case when v_email is null then '[]'::jsonb else jsonb_build_array(v_email) end, 'tags', to_jsonb(v_tags)), f.nome);
  select id into v_contato from crm_contatos where empresa_id = f.empresa_id and telefone = v_tel;
  if v_contato is null then raise exception 'Não deu para salvar. Tente de novo.'; end if;

  update crm_contatos set primeira_origem = coalesce(primeira_origem, v_origem), ultima_captura_em = now(),
    origem = coalesce(origem, f.nome),
    etapa_id = coalesce(etapa_id, (select id from crm_etapas where empresa_id = f.empresa_id and final is null order by ordem limit 1)),
    etapa_em = case when etapa_id is null then now() else etapa_em end
  where id = v_contato;
  -- quem pede de novo depois de arquivado volta (a não ser que tenha pedido para não receber)
  perform crm_desarquivar(v_contato, 'Preencheu o formulário ' || f.nome);

  insert into crm_eventos (empresa_id, contato_id, tipo, texto, dados)
  values (f.empresa_id, v_contato, 'captura', 'Preencheu: ' || f.nome, v_origem || jsonb_build_object('respostas', v_resp, 'novo', v_novo));

  -- dona: quem já cuida dele, senão o rodízio
  select responsavel_id into v_dona from crm_contatos where id = v_contato;
  if v_dona is null then
    v_dona := crm_escolher_atendente(f.empresa_id, v_contato);
    if v_dona is not null then update crm_contatos set responsavel_id = v_dona where id = v_contato; end if;
  end if;
  if not (select nao_contatar from crm_contatos where id = v_contato) then
    insert into crm_tarefas (empresa_id, contato_id, responsavel_id, titulo, tipo, vence_em, origem, nota, criado_por)
    values (f.empresa_id, v_contato, v_dona, 'Primeiro contato: ' || f.nome || coalesce(' (' || f.interesse || ')', ''), 'contato', now(), 'captura',
            nullif(concat_ws(' · ', (select string_agg(k || ': ' || v, ' · ') from jsonb_each_text(v_resp) as r(k, v)), v_origem->>'utm_campaign'), ''), null);
    if f.cadencia_id is not null then perform crm_iniciar_cadencia(f.cadencia_id, v_contato, '{}'::jsonb); end if;
  end if;
  return jsonb_build_object('ok', true, 'obrigado', f.obrigado, 'redirecionar', f.redirecionar);
end $$;
grant execute on function crm_capturar_lead(text, jsonb) to anon, authenticated;

-- números da captura para a tela (admin): por formulário e por campanha
create function crm_resumo_captura(p_empresa uuid, p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  return jsonb_build_object(
    'por_formulario', coalesce((select jsonb_agg(x order by x.leads desc) from (
        select e.dados->>'formulario' formulario, count(*) leads, count(*) filter (where (e.dados->>'novo')::boolean) novos,
               count(distinct e.contato_id) filter (where c.ganho_em > e.criado_em) vendas
        from crm_eventos e join crm_contatos c on c.id = e.contato_id
        where e.empresa_id = p_empresa and e.tipo = 'captura' and e.criado_em > now() - make_interval(days => p_dias)
        group by 1) x), '[]'),
    'por_campanha', coalesce((select jsonb_agg(x order by x.leads desc) from (
        select coalesce(e.dados->>'utm_campaign', '(sem campanha)') campanha, coalesce(e.dados->>'utm_source', '—') fonte, count(*) leads,
               count(distinct e.contato_id) filter (where c.ganho_em > e.criado_em) vendas
        from crm_eventos e join crm_contatos c on c.id = e.contato_id
        where e.empresa_id = p_empresa and e.tipo = 'captura' and e.criado_em > now() - make_interval(days => p_dias)
        group by 1, 2 limit 50) x), '[]'));
end $$;
revoke execute on function crm_resumo_captura(uuid, int) from public, anon;

-- lead novo vira aviso na tela da vendedora
alter publication supabase_realtime add table crm_tarefas;
