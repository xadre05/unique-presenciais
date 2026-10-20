-- Filtro "Etiqueta" dos contatos: as etiquetas dos formulários ativos (ex.: black-2026) aparecem na lista desde o início,
-- mesmo antes do primeiro lead, e ficam no topo.
create or replace function crm_etiquetas_em_uso(p_empresa uuid) returns table (tag text, contatos bigint)
language sql stable security definer set search_path = public as $$
  with usadas as (
    select t, count(*) n from crm_contatos c, unnest(c.tags) t
    where c.empresa_id = p_empresa and crm_sou_membro(p_empresa) and t not like 'interesse:%' and t <> 'lgpd-apagado'
    group by t
  ), dos_formularios as (
    select distinct t from crm_formularios f, unnest(f.etiquetas) t where f.empresa_id = p_empresa and f.ativo and crm_sou_membro(p_empresa)
  )
  select coalesce(u.t, d.t), coalesce(u.n, 0) from usadas u full join dos_formularios d on d.t = u.t
  order by (d.t is not null) desc, coalesce(u.n, 0) desc, 1 limit 60
$$;
