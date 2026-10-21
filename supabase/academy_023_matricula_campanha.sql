-- ════════════════════════════════════════════════════════════════════
-- Vendas de campanha pagas fora da Hotmart (Pix direto): a matrícula ganha o campo "campanha";
-- e, para quem compra um único módulo da Mini Residência, o campo "só este módulo" (encontro).
-- O painel de campanhas soma essas matrículas às vendas da Hotmart; as vagas por data contam
-- a matrícula de módulo só naquele módulo.
-- ════════════════════════════════════════════════════════════════════
alter table public.matriculas add column if not exists campanha_id uuid references public.campanhas_vendas on delete set null;
alter table public.matriculas add column if not exists encontro_id uuid references public.encontros on delete set null;
comment on column public.matriculas.campanha_id is 'Campanha de venda em que a matrícula foi fechada (ex.: Black 2026 paga por Pix).';
comment on column public.matriculas.encontro_id is 'Matrícula de um módulo só (ex.: comprou um módulo da Mini Residência na Black). Vazio = a turma inteira.';

create or replace view public.v_black_turmas with (security_invoker = on) as
select b.codigo, b.modulo, b.turma_id, b.encontro_id, b.data_inicio, b.lugares, b.residentes,
  count(distinct hp.transacao) filter (where upper(hp.status) in ('APPROVED', 'COMPLETE', 'COMPLETED')) as compraram,
  count(distinct hp.transacao) filter (where upper(hp.status) in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'CANCELED')) as desistiram,
  (select count(*) from public.matriculas m where m.turma_id = b.turma_id and m.status not in ('cancelada', 'transferida')
     and (m.encontro_id is null or m.encontro_id = b.encontro_id)) as matriculados,
  b.campanha_id
from public.black_turmas b
left join public.hotmart_pagamentos hp
  on upper(coalesce(hp.bruto #>> '{data,purchase,origin,sck}', hp.bruto #>> '{purchase,tracking,source_sck}', '')) = b.codigo
group by b.codigo;

-- a venda da Uguimara (Unique Codes, Pix de 16/10) é da Black
update public.matriculas set campanha_id = (select id from public.campanhas_vendas where formulario_slug = 'black-2026')
where id = (select m.id from public.matriculas m join public.alunos a on a.id = m.aluno_id
            where a.nome ilike 'Uguimara%' and m.turma_id = '1cd22685-c40a-4d1f-974c-efaae3d9dae0' limit 1);

create or replace function public.painel_campanha(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := empresa_unique(); r jsonb; c campanhas_vendas;
begin
  if not is_admin() then raise exception 'Só o administrador.'; end if;
  select * into c from campanhas_vendas where id = p_id;
  if c.id is null then raise exception 'Campanha não encontrada.'; end if;
  with ofertas as (select unnest(c.ofertas) oferta_codigo),
  vendas as (
    select hp.transacao, min(hp.data_aprovacao) data, max(hp.comprador_nome) nome, max(lower(hp.comprador_email)) email,
      max(hp.valor) valor, max(hp.valor_liquido) liquido, max(hp.forma) forma, max(hp.oferta_codigo) oferta,
      lower(coalesce(max(hp.bruto #>> '{data,purchase,origin,src}'), max(hp.bruto #>> '{purchase,tracking,source}'), max(hp.rastreio), 'direto')) origem,
      upper(coalesce(max(hp.bruto #>> '{data,purchase,origin,sck}'), max(hp.bruto #>> '{purchase,tracking,source_sck}'), '')) turma,
      bool_or(upper(hp.status) in ('APPROVED','COMPLETE','COMPLETED')) aprovada,
      bool_or(upper(hp.status) in ('REFUNDED','CHARGEBACK','CANCELLED','CANCELED','DISPUTE')) desfeita
    from hotmart_pagamentos hp where hp.oferta_codigo in (select oferta_codigo from ofertas)
      and (c.inicio is null or coalesce(hp.data_aprovacao, hp.data_pedido) >= c.inicio)
      and (c.fim is null or coalesce(hp.data_aprovacao, hp.data_pedido) < c.fim + 1)
    group by hp.transacao),
  validas as (select * from vendas where aprovada and not desfeita),
  -- vendas lançadas como matrícula (Pix direto, fora da Hotmart) marcadas com esta campanha
  manuais as (
    select m.id, m.data_venda, m.valor_fechado valor, a.nome, vd.nome vendedora, t.nome turma,
      (select coalesce(sum(co.valor), 0) from comissoes co where co.matricula_id = m.id and co.status <> 'cancelada') comissao
    from matriculas m join alunos a on a.id = m.aluno_id join turmas t on t.id = m.turma_id left join vendedoras vd on vd.id = m.vendedora_id
    where m.campanha_id = c.id and m.status not in ('cancelada', 'transferida')),
  capturas as (
    select distinct on (e.contato_id) e.contato_id, e.criado_em, lower(coalesce(e.dados->>'src', e.dados->>'utm_source', 'direto')) origem
    from crm_eventos e where e.empresa_id = v_emp and e.tipo = 'captura' and e.dados->>'formulario' = c.formulario_slug
    order by e.contato_id, e.criado_em),
  passos as (select evento, count(distinct visitante) n from crm_pagina_eventos where empresa_id = v_emp and formulario = c.formulario_slug group by evento),
  pix as (select count(distinct e.contato_id) n from crm_eventos e
    where e.empresa_id = v_emp and e.tipo = 'evento' and e.texto in ('aguardando_pagamento', 'carrinho_abandonado') and e.dados->>'oferta' in (select oferta_codigo from ofertas))
  select jsonb_build_object(
    'campanha', jsonb_build_object('id', c.id, 'nome', c.nome, 'inicio', c.inicio, 'fim', c.fim, 'meta_vendas', c.meta_vendas, 'meta_receita', c.meta_receita),
    'funil', jsonb_build_object(
      'visitantes', coalesce((select n from passos where evento = 'pagina_aberta'), 0),
      'abriram_escolha', coalesce((select n from passos where evento = 'abriu_escolha'), 0),
      'escolheram', coalesce((select n from passos where evento = 'escolheu_turma'), 0),
      'foram_pagamento', (select count(*) from capturas),
      'pix_ou_abandono', (select n from pix),
      'compraram', (select count(*) from validas) + (select count(*) from manuais),
      'fora_hotmart', (select count(*) from manuais),
      'desfeitas', (select count(*) from vendas where desfeita)),
    'receita', jsonb_build_object('bruto', coalesce((select sum(valor) from validas), 0) + coalesce((select sum(valor) from manuais), 0),
                                  'liquido', coalesce((select sum(liquido) from validas), 0) + coalesce((select sum(valor) from manuais), 0),
                                  'fora_hotmart', coalesce((select sum(valor) from manuais), 0)),
    'por_origem', coalesce((select jsonb_agg(x order by x.vendas desc, x.leads desc) from (
        select o origem, coalesce(l.n, 0) leads, coalesce(v.n, 0) vendas, coalesce(v.liq, 0) liquido
        from (select origem o from capturas union select origem from validas union select 'pix-direto' from manuais) os
        left join (select origem, count(*) n from capturas group by 1) l on l.origem = os.o
        left join (select origem, count(*) n, sum(liquido) liq from validas group by 1
                   union all select 'pix-direto', count(*), sum(valor) from manuais having count(*) > 0) v on v.origem = os.o) x), '[]'),
    'por_vendedora', coalesce((select jsonb_agg(x order by x.vendas desc) from (
        select nome, sum(vendas)::int vendas, sum(comissao) comissao from (
          select vd.nome, count(*) vendas, sum(co.valor) comissao
          from comissoes_online co join vendedoras vd on vd.id = co.vendedora_id
          join hotmart_pagamentos hp on hp.id = co.pagamento_id
          where hp.oferta_codigo in (select oferta_codigo from ofertas) and co.status <> 'cancelada'
            and (c.inicio is null or hp.data_aprovacao >= c.inicio) and (c.fim is null or hp.data_aprovacao < c.fim + 1)
          group by vd.nome
          union all
          select coalesce(vendedora, 'Sem vendedora'), count(*), sum(comissao) from manuais group by 1) u
        group by nome) x), '[]'),
    'por_dia', coalesce((select jsonb_agg(x order by x.dia) from (
        select dia, count(*) vendas from (select (data at time zone 'America/Sao_Paulo')::date dia from validas union all select data_venda from manuais) d group by 1) x), '[]'),
    'pendentes', coalesce((select jsonb_agg(x order by x.quando desc) from (
        select ct.id, ct.nome, ct.telefone, cap.origem, cap.criado_em quando,
          (select vd.nome from vendedoras vd where vd.perfil_id = ct.responsavel_id limit 1) dona,
          exists (select 1 from crm_eventos e where e.contato_id = ct.id and e.tipo = 'evento' and e.texto = 'aguardando_pagamento') gerou_pix
        from capturas cap join crm_contatos ct on ct.id = cap.contato_id
        where not exists (select 1 from crm_eventos e2 where e2.contato_id = ct.id and e2.tipo = 'evento' and e2.texto = 'compra_aprovada'
                            and e2.dados->>'oferta' in (select oferta_codigo from ofertas) and e2.criado_em >= cap.criado_em - interval '30 days')
        limit 200) x), '[]'),
    'vagas', coalesce((select jsonb_agg(x order by x.data_inicio) from (
        select codigo, modulo, data_inicio, lugares, matriculados, compraram, greatest(0, lugares - matriculados - compraram) livres from v_black_turmas where campanha_id = c.id) x), '[]'),
    'ultimas', coalesce((select jsonb_agg(x order by x.data desc) from (
        select nome, data, valor, forma, origem, turma from validas
        union all select nome, data_venda::timestamptz, valor, 'Pix direto', 'pix-direto', turma from manuais
        order by data desc limit 15) x), '[]')
  ) into r;
  return r;
end $$;

