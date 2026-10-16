-- ════════════════════════════════════════════════════════════════════
-- CRM — NÚCLEO: meta de vendas do mês por pessoa (aplicado como 059).
-- A vendedora vê só a dela (Minha fila); o administrador vê todas (Painel).
-- ════════════════════════════════════════════════════════════════════
alter table crm_membros add column meta_mes int check (meta_mes is null or meta_mes >= 0);

create function crm_minha_meta(p_empresa uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('meta', m.meta_mes,
    'vendas', (select count(*) from crm_contatos where empresa_id = p_empresa and responsavel_id = auth.uid() and ganho_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))
  from crm_membros m where m.empresa_id = p_empresa and m.usuario_id = auth.uid()
$$;
revoke execute on function crm_minha_meta(uuid) from public, anon;

create function crm_metas(p_empresa uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('usuario_id', m.usuario_id, 'nome', m.nome, 'meta', m.meta_mes,
      'vendas', (select count(*) from crm_contatos c where c.empresa_id = p_empresa and c.responsavel_id = m.usuario_id
                 and c.ganho_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'))
      order by m.nome)
    from crm_membros m where m.empresa_id = p_empresa and m.ativo), '[]');
end $$;
revoke execute on function crm_metas(uuid) from public, anon;

create function crm_definir_meta(p_empresa uuid, p_usuario uuid, p_meta int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not crm_sou_admin(p_empresa) then raise exception 'Só o administrador.'; end if;
  update crm_membros set meta_mes = nullif(p_meta, 0) where empresa_id = p_empresa and usuario_id = p_usuario;
end $$;
revoke execute on function crm_definir_meta(uuid, uuid, int) from public, anon;
