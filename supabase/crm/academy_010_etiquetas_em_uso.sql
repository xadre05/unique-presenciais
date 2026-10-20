-- Contatos: lista das etiquetas em uso (para o filtro "Etiqueta" da tela de contatos), da mais usada para a menos usada.
create function crm_etiquetas_em_uso(p_empresa uuid) returns table (tag text, contatos bigint)
language sql stable security definer set search_path = public as $$
  select t, count(*) from crm_contatos c, unnest(c.tags) t
  where c.empresa_id = p_empresa and crm_sou_membro(p_empresa) and t not like 'interesse:%' and t <> 'lgpd-apagado'
  group by t order by count(*) desc, t limit 60
$$;
revoke execute on function crm_etiquetas_em_uso(uuid) from public, anon;
grant execute on function crm_etiquetas_em_uso(uuid) to authenticated;
