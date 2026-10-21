-- ════════════════════════════════════════════════════════════════════
-- Painel da Black 2026 (Comercial → Black): o placar da campanha num só lugar.
-- Funil da página → CRM → Hotmart, vendas por origem e por vendedora, quem foi ao pagamento e não comprou, vagas.
-- Só leitura; só administrador.
-- ════════════════════════════════════════════════════════════════════
create function public.painel_black() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := empresa_unique(); r jsonb;
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  with ofertas as (select oferta_codigo from hotmart_ofertas_cursos where comissao_online),
  vendas as (
    select hp.transacao, min(hp.data_aprovacao) data, max(hp.comprador_nome) nome, max(lower(hp.comprador_email)) email,
      max(hp.valor) valor, max(hp.valor_liquido) liquido, max(hp.forma) forma, max(hp.oferta_codigo) oferta,
      lower(coalesce(max(hp.bruto #>> '{data,purchase,origin,src}'), max(hp.bruto #>> '{purchase,tracking,source}'), max(hp.rastreio), 'direto')) origem,
      upper(coalesce(max(hp.bruto #>> '{data,purchase,origin,sck}'), max(hp.bruto #>> '{purchase,tracking,source_sck}'), '')) turma,
      bool_or(upper(hp.status) in ('APPROVED','COMPLETE','COMPLETED')) aprovada,
      bool_or(upper(hp.status) in ('REFUNDED','CHARGEBACK','CANCELLED','CANCELED','DISPUTE')) desfeita
    from hotmart_pagamentos hp where hp.oferta_codigo in (select oferta_codigo from ofertas)
    group by hp.transacao),
  validas as (select * from vendas where aprovada and not desfeita),
  capturas as (
    select distinct on (e.contato_id) e.contato_id, e.criado_em, lower(coalesce(e.dados->>'src', e.dados->>'utm_source', 'direto')) origem
    from crm_eventos e where e.empresa_id = v_emp and e.tipo = 'captura' and e.dados->>'formulario' = 'black-2026'
    order by e.contato_id, e.criado_em),
  passos as (select evento, count(distinct visitante) n from crm_pagina_eventos where empresa_id = v_emp and formulario = 'black-2026' group by evento),
  pix as (select count(distinct e.contato_id) n from crm_eventos e
    where e.empresa_id = v_emp and e.tipo = 'evento' and e.texto in ('aguardando_pagamento', 'carrinho_abandonado') and e.dados->>'oferta' in (select oferta_codigo from ofertas))
  select jsonb_build_object(
    'funil', jsonb_build_object(
      'visitantes', coalesce((select n from passos where evento = 'pagina_aberta'), 0),
      'abriram_escolha', coalesce((select n from passos where evento = 'abriu_escolha'), 0),
      'escolheram', coalesce((select n from passos where evento = 'escolheu_turma'), 0),
      'foram_pagamento', (select count(*) from capturas),
      'pix_ou_abandono', (select n from pix),
      'compraram', (select count(*) from validas),
      'desfeitas', (select count(*) from vendas where desfeita)),
    'receita', jsonb_build_object('bruto', coalesce((select sum(valor) from validas), 0), 'liquido', coalesce((select sum(liquido) from validas), 0)),
    'por_origem', coalesce((select jsonb_agg(x order by x.vendas desc, x.leads desc) from (
        select o origem, coalesce(l.n, 0) leads, coalesce(v.n, 0) vendas, coalesce(v.liq, 0) liquido
        from (select origem o from capturas union select origem from validas) os
        left join (select origem, count(*) n from capturas group by 1) l on l.origem = os.o
        left join (select origem, count(*) n, sum(liquido) liq from validas group by 1) v on v.origem = os.o) x), '[]'),
    'por_vendedora', coalesce((select jsonb_agg(x order by x.vendas desc) from (
        select vd.nome, count(*) vendas, sum(co.valor) filter (where co.status <> 'cancelada') comissao
        from comissoes_online co join vendedoras vd on vd.id = co.vendedora_id
        join hotmart_pagamentos hp on hp.id = co.pagamento_id
        where hp.oferta_codigo in (select oferta_codigo from ofertas) and co.status <> 'cancelada' group by vd.nome) x), '[]'),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select (data at time zone 'America/Sao_Paulo')::date dia, count(*) vendas from validas group by 1) x), '[]'),
    'pendentes', coalesce((select jsonb_agg(x order by x.quando desc) from (
        select c.id, c.nome, c.telefone, cap.origem, cap.criado_em quando,
          (select vd.nome from vendedoras vd where vd.perfil_id = c.responsavel_id limit 1) dona,
          exists (select 1 from crm_eventos e where e.contato_id = c.id and e.tipo = 'evento' and e.texto = 'aguardando_pagamento') gerou_pix
        from capturas cap join crm_contatos c on c.id = cap.contato_id
        where not ('black-2026-comprou' = any (c.tags)) limit 200) x), '[]'),
    'vagas', coalesce((select jsonb_agg(x order by x.data_inicio) from (
        select codigo, modulo, data_inicio, lugares, matriculados, compraram, greatest(0, lugares - matriculados - compraram) livres from v_black_turmas) x), '[]'),
    'ultimas', coalesce((select jsonb_agg(x order by x.data desc) from (
        select nome, data, valor, forma, origem, turma from validas order by data desc limit 15) x), '[]')
  ) into r;
  return r;
end $$;
revoke execute on function public.painel_black() from public, anon;
grant execute on function public.painel_black() to authenticated;
