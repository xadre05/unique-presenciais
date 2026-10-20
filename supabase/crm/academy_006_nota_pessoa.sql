-- Nota da pessoa (20/10/2026): cada contato (lead, aluno do online, aluno do presencial) ganha uma nota de 0 a 100 e duas
-- marcas que dá para filtrar separado:
--   temperatura: quente (sinal de interesse nos últimos 30 dias) · morna (90 dias, ou comprou nos últimos 12 meses) · fria
--   pagador: bom · atrasou_pagou · devendo · negativado · reembolsou · sem_historico
-- Recalculada de hora em hora (cron) a partir do que o sistema já tem: Hotmart, matrículas, cobranças e conversas.
alter table public.contato_resumo
  add column if not exists temperatura text,
  add column if not exists pagador text,
  add column if not exists divida numeric not null default 0,
  add column if not exists nota integer,
  add column if not exists nota_motivos text[] not null default '{}',
  add column if not exists nota_em timestamptz;
create index if not exists contato_resumo_nota on public.contato_resumo (nota);
create index if not exists contato_resumo_pagador on public.contato_resumo (pagador);
create index if not exists contato_resumo_temperatura on public.contato_resumo (temperatura);

create or replace function public.atualizar_notas_contatos() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Só o administrador.'; end if;
  with e as (
    select c.id, lower(unnest(c.emails)) email from crm_contatos c where c.empresa_id = empresa_unique()
  ), cob_email as (
    select e.id, k.id cid, k.etapa, k.fase_legal, k.valor_restante from e join cobrancas k on lower(k.email) = e.email
  ), cob_pres as (
    select c.id, k.id cid, k.etapa, k.fase_legal, k.valor_restante
    from cobrancas k join matriculas m on m.id = k.matricula_id join alunos a on a.id = m.aluno_id
    join crm_contatos c on c.empresa_id = empresa_unique() and (lower(a.email) = any (c.emails) or crm_tel_br(a.whatsapp) = c.telefone)
  ), cob as (
    select id,
      bool_or(etapa = 'negativado' or fase_legal in ('negativacao_pedida', 'negativada', 'advogado')) negativado,
      bool_or(etapa not in ('paga', 'sem_acordo', 'encerrada')) devendo,
      bool_or(etapa = 'paga') pagou_atraso,
      coalesce(sum(valor_restante) filter (where etapa not in ('paga', 'sem_acordo', 'encerrada')), 0) divida
    from (select * from cob_email union select * from cob_pres) x group by id  -- union (sem all): a mesma cobrança achada pelo e-mail e pela matrícula conta uma vez só
  ), msg as (
    select v.contato_id id, max(m.criado_em) ultima_entrada
    from crm_conversas v join crm_mensagens m on m.conversa_id = v.id and m.direcao = 'entrada'
    where v.empresa_id = empresa_unique() group by v.contato_id
  ), ped as (
    -- qualquer pedido na Hotmart (comprou, tentou e o cartão recusou, boleto que não pagou) conta como sinal de interesse
    select e.id, max(h.data_pedido) ultimo_pedido from e join hotmart_pagamentos h on lower(h.comprador_email) = e.email group by e.id
  ), base as (
    select c.id, r.segmento, r.reembolsou, r.ultima_compra, r.total_liquido, greatest(c.ultima_captura_em, c.entrou_em) ultima_captura_em, ped.ultimo_pedido, msg.ultima_entrada,
      coalesce(cob.negativado, false) negativado, coalesce(cob.devendo, false) devendo, coalesce(cob.pagou_atraso, false) pagou_atraso, coalesce(cob.divida, 0) divida
    from crm_contatos c join contato_resumo r on r.contato_id = c.id
    left join cob on cob.id = c.id left join msg on msg.id = c.id left join ped on ped.id = c.id
    where c.empresa_id = empresa_unique()
  ), marcas as (
    select b.*,
      case when b.negativado then 'negativado' when b.devendo then 'devendo' when b.reembolsou then 'reembolsou'
           when b.pagou_atraso then 'atrasou_pagou' when b.segmento = 'comprador' then 'bom' else 'sem_historico' end pagador,
      case when greatest(b.ultima_entrada, b.ultima_captura_em, b.ultimo_pedido) > now() - interval '30 days' then 'quente'
           when greatest(b.ultima_entrada, b.ultima_captura_em, b.ultimo_pedido) > now() - interval '90 days' or b.ultima_compra > now() - interval '12 months' then 'morna'
           else 'fria' end temperatura
    from base b
  ), notas as (
    select m.*,
      greatest(0, least(100, 50
        + case m.pagador when 'bom' then 25 when 'atrasou_pagou' then 5 when 'reembolsou' then -20 when 'devendo' then -35 when 'negativado' then -50 else 0 end
        + case m.temperatura when 'quente' then 20 when 'morna' then 10 else 0 end
        + least(15, floor(coalesce(m.total_liquido, 0) / 1000) * 3)::int)) nota,
      array_remove(array[
        case m.pagador when 'bom' then 'pagou tudo em dia' when 'atrasou_pagou' then 'atrasou e regularizou' when 'reembolsou' then 'pediu reembolso ou chargeback'
             when 'devendo' then 'está devendo R$ ' || replace(to_char(m.divida, 'FM999,999,990'), ',', '.') when 'negativado' then 'negativado ou em negativação' end,
        case m.temperatura when 'quente' then 'interesse nos últimos 30 dias' when 'morna' then 'interesse nos últimos 90 dias ou comprou no último ano' end,
        case when coalesce(m.total_liquido, 0) >= 1000 then 'já comprou R$ ' || replace(to_char(m.total_liquido, 'FM999,999,990'), ',', '.') end], null) motivos
    from marcas m
  )
  update contato_resumo r set temperatura = x.temperatura, pagador = x.pagador, divida = x.divida, nota = x.nota, nota_motivos = x.motivos, nota_em = now()
  from notas x
  where r.contato_id = x.id and (r.temperatura, r.pagador, r.divida, r.nota) is distinct from (x.temperatura, x.pagador, x.divida, x.nota);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.atualizar_notas_contatos() from public, anon;
grant execute on function public.atualizar_notas_contatos() to authenticated;
select cron.schedule('notas-contatos', '41 * * * *', $cron$ select public.atualizar_notas_contatos() $cron$);

-- filtros novos na tela Contatos (e nas listas/disparos que usam o mesmo filtro): nota mínima/máxima, temperatura, pagador
create or replace function public.contatos_filtrados(p jsonb)
 returns table(id uuid) language sql stable security definer set search_path to 'public' set enable_nestloop to 'off' as $function$
  select c.id from crm_contatos c left join contato_resumo r on r.contato_id = c.id
  where c.empresa_id = empresa_unique()
    and (case coalesce(p->>'arquivados', '') when 'so' then c.arquivado_em is not null when 'true' then true
         else c.arquivado_em is null or coalesce(p->>'busca', '') <> '' end)
    and (coalesce(p->>'segmento', '') = '' or r.segmento = p->>'segmento'
         or (p->>'segmento' = 'comprador_ou_quase' and r.segmento in ('comprador', 'quase')))
    and (coalesce(p->>'compra', '') = ''
         or (p->>'compra' = 'sim' and r.segmento = 'comprador')
         or (p->>'compra' = 'nao' and coalesce(r.segmento, 'frio') <> 'comprador')
         or (p->>'compra' = 'online' and coalesce(r.aluno_online, false))
         or (p->>'compra' = 'presencial' and coalesce(r.aluno_presencial, false))
         or (p->>'compra' = 'so_online' and coalesce(r.aluno_online, false) and not coalesce(r.aluno_presencial, false))
         or (p->>'compra' = 'so_presencial' and coalesce(r.aluno_presencial, false) and not coalesce(r.aluno_online, false))
         or (p->>'compra' = 'ambos' and coalesce(r.aluno_online, false) and coalesce(r.aluno_presencial, false)))
    and (coalesce(p->>'produto', '') = '' or p->>'produto' = any (r.produtos))
    and (coalesce(p->>'sem_produto', '') = '' or not (p->>'sem_produto' = any (coalesce(r.produtos, '{}'))))
    and (coalesce(p->>'ano_compra', '') = '' or (p->>'ano_compra')::int = any (r.anos_compra))
    and (coalesce(p->>'ano_entrada', '') = '' or extract(year from c.entrou_em) = (p->>'ano_entrada')::int)
    and (coalesce(p->>'tag', '') = '' or p->>'tag' = any (c.tags))
    and (coalesce(p->>'acesso', '') = '' or r.acesso = p->>'acesso'
         or (p->>'acesso' = 'tem' and r.acesso in ('vitalicio', 'em_dia', 'vence_60'))
         or (p->>'acesso' = 'vencido' and r.acesso in ('vencido_recente', 'vencido_antigo')))
    and (coalesce(p->>'temperatura', '') = '' or r.temperatura = p->>'temperatura')
    and (coalesce(p->>'pagador', '') = '' or r.pagador = p->>'pagador'
         or (p->>'pagador' = 'sem_divida' and coalesce(r.pagador, '') not in ('devendo', 'negativado'))
         or (p->>'pagador' = 'com_divida' and r.pagador in ('devendo', 'negativado')))
    and (coalesce(p->>'nota_min', '') = '' or coalesce(r.nota, 50) >= (p->>'nota_min')::int)
    and (coalesce(p->>'nota_max', '') = '' or coalesce(r.nota, 50) <= (p->>'nota_max')::int)
    and (not coalesce((p->>'so_whats')::boolean, false) or (c.telefone is not null and not c.telefone_invalido and not c.nao_contatar))
    and (not coalesce((p->>'fora_de_lista')::boolean, false) or not exists (
          select 1 from campanha_contatos cc join campanhas k on k.id = cc.campanha_id where cc.contato_id = c.id and k.status = 'ativa'))
    and (coalesce(p->>'busca', '') = ''
         or c.nome ilike '%' || (p->>'busca') || '%'
         or (regexp_replace(p->>'busca', '\D', '', 'g') <> '' and length(regexp_replace(p->>'busca', '\D', '', 'g')) >= 4
             and c.telefone like '%' || regexp_replace(p->>'busca', '\D', '', 'g') || '%')
         or exists (select 1 from unnest(c.emails) e where e ilike '%' || (p->>'busca') || '%'))
$function$;

-- a lista de contatos devolve a nota e as marcas
create or replace function public.buscar_contatos(p jsonb, p_limite integer default 50, p_offset integer default 0)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v jsonb;
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  with f as materialized (select id from contatos_filtrados(p))
  select jsonb_build_object(
    'total', (select count(*) from f),
    'linhas', coalesce((select jsonb_agg(x) from (
      select c.id, c.nome, c.telefone, c.emails, c.tags, c.cidade, c.uf, c.entrou_em, c.origem, c.nao_contatar, c.telefone_invalido, c.arquivado_em, c.arquivado_motivo, c.responsavel_id,
             r.segmento, r.produtos, r.total_liquido, r.ultima_compra, r.aluno_presencial, r.reembolsou, r.aluno_online, r.vendido_por, r.cursos_presenciais, r.acesso, r.acesso_ate,
             r.nota, r.temperatura, r.pagador, r.divida, r.nota_motivos,
             (select k.nome from campanha_contatos cc join campanhas k on k.id = cc.campanha_id
               where cc.contato_id = c.id and k.status = 'ativa' order by k.criado_em desc limit 1) lista_ativa
      from f join crm_contatos c on c.id = f.id left join contato_resumo r on r.contato_id = c.id
      order by r.ultima_compra desc nulls last, c.entrou_em desc nulls last, c.id
      limit least(p_limite, 200) offset p_offset) x), '[]'::jsonb)) into v;
  return v;
end $function$;

-- 006b: a mesma cobrança achada pelo e-mail e pela matrícula conta uma vez só (union sem all, já aplicado acima) e
-- quem entrou como lead nos últimos 30 dias conta como quente (ultima_captura_em nunca foi preenchido; usa entrou_em)

-- 006c: o painel da conversa (Atendimento) mostra a nota; para quem não é administrador, os motivos vão sem valores em R$
create or replace function public.resumo_do_contato(p_contato uuid)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when crm_pode_ver_contato(p_contato) then jsonb_build_object(
    'segmento', r.segmento, 'produtos', r.produtos, 'ultima_compra', r.ultima_compra, 'primeira_compra', r.primeira_compra,
    'aluno_presencial', r.aluno_presencial, 'reembolsou', r.reembolsou,
    'total_liquido', case when is_admin() then r.total_liquido end,
    'nota', r.nota, 'temperatura', r.temperatura, 'pagador', r.pagador,
    'nota_motivos', case when is_admin() then r.nota_motivos else array(select regexp_replace(m, ' R\$ [0-9.]+', '') from unnest(r.nota_motivos) m) end,
    'listas', (select coalesce(jsonb_agg(jsonb_build_object('campanha', k.nome, 'status', cc.status, 'vendedora', vd.nome, 'nota', cc.nota) order by k.criado_em desc), '[]')
               from campanha_contatos cc join campanhas k on k.id = cc.campanha_id left join vendedoras vd on vd.id = cc.vendedora_id where cc.contato_id = p_contato))
  end
  from (select 1) x left join contato_resumo r on r.contato_id = p_contato
$function$;

-- 006c: nota de várias pessoas de uma vez (alunos do Comercial, fila de cobrança), achadas pelo e-mail ou pelo WhatsApp.
-- Entrada: [{"k": "chave", "email": "...", "tel": "..."}]. Saída: {"chave": {nota, temperatura, pagador, motivos}}.
-- Se a pessoa aparece em dois contatos (cadastro duplicado), vale a nota mais baixa.
create or replace function public.notas_de_pessoas(p jsonb)
 returns jsonb language sql stable security definer set search_path to 'public' as $function$
  with i as materialized (
    select i.k, nullif(lower(trim(i.email)), '') email, crm_tel_br(i.tel) tel
    from jsonb_to_recordset(case when auth.uid() is null then '[]'::jsonb else p end) i(k text, email text, tel text)
  ), ce as (
    select c.id, lower(e) email from crm_contatos c, unnest(c.emails) e where c.empresa_id = empresa_unique()
  ), achou as (
    select i.k, ce.id from i join ce on ce.email = i.email
    union select i.k, c.id from i join crm_contatos c on c.empresa_id = empresa_unique() and c.telefone = i.tel
  )
  select coalesce(jsonb_object_agg(k, nota), '{}'::jsonb) from (
    select distinct on (a.k) a.k, jsonb_build_object('nota', r.nota, 'temperatura', r.temperatura, 'pagador', r.pagador,
      'motivos', case when is_admin() then r.nota_motivos else array(select regexp_replace(m, ' R\$ [0-9.]+', '') from unnest(r.nota_motivos) m) end) nota
    from achou a join contato_resumo r on r.contato_id = a.id and r.nota is not null
    order by a.k, r.nota) x
$function$;
revoke all on function public.notas_de_pessoas(jsonb) from public, anon;
grant execute on function public.notas_de_pessoas(jsonb) to authenticated;
