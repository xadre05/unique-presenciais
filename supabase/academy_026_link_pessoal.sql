-- 24/10/2026 — link pessoal da página de vendas de cada vendedora (aplicado via migração link_pessoal_vendedora)
create or replace function public.link_pessoal_vendedora(p_vendedora uuid default null)
returns text language sql stable security definer set search_path = public as $$
  select 'https://uniquehofacademy.com.br/' || replace(r.valor, 'zap-', '')
  from rastreios r join vendedoras v on v.id = r.vendedora_id
  where r.valor like 'zap-%'
    and (case when p_vendedora is not null and is_admin() then v.id = p_vendedora else v.perfil_id = auth.uid() end)
  order by r.criado_em desc limit 1
$$;
revoke all on function public.link_pessoal_vendedora(uuid) from public, anon;
grant execute on function public.link_pessoal_vendedora(uuid) to authenticated;
