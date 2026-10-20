-- ════════════════════════════════════════════════════════════════════
-- Controle → domínios: o Registro.br recusa as consultas vindas das funções do Supabase (403),
-- mas aceita as que saem do próprio banco. Então a consulta é feita em dois passos pelo banco:
-- pedir (a cada 6 h) e, 3 minutos depois, ler a resposta e gravar vencimento e DNS no monitor.
-- ════════════════════════════════════════════════════════════════════
alter table public.controle_monitores add column if not exists pedido_id bigint;

create function public.controle_dominios_pedir() returns int
language plpgsql security definer set search_path = public as $$
declare m record; n int := 0;
begin
  for m in select id, alvo from controle_monitores where tipo = 'dominio' and ativo and alvo is not null loop
    update controle_monitores set pedido_id = net.http_get(
      'https://rdap.registro.br/domain/' || m.alvo,
      headers := '{"User-Agent":"Mozilla/5.0 (compatible; UniqueMonitor/1.0)","Accept":"application/rdap+json, application/json"}'::jsonb)
    where id = m.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create function public.controle_dominios_ler() returns int
language plpgsql security definer set search_path = public as $$
declare m record; r record; d jsonb; v_exp timestamptz; v_dias int; v_dns text[]; v_onde text; v_nivel text; v_det text; n int := 0;
begin
  for m in select id, pedido_id, nivel, desde from controle_monitores where tipo = 'dominio' and pedido_id is not null loop
    select status_code, content into r from net._http_response where id = m.pedido_id;
    if not found then continue; end if;
    if r.status_code = 404 then v_nivel := 'erro'; v_det := 'Domínio não encontrado no Registro.br'; d := null;
    elsif r.status_code <> 200 then v_nivel := 'alerta'; v_det := 'Não consegui consultar o Registro.br agora (' || r.status_code || ')'; d := null;
    else
      d := r.content::jsonb;
      select (e->>'eventDate')::timestamptz into v_exp from jsonb_array_elements(d->'events') e where e->>'eventAction' = 'expiration' limit 1;
      select array_agg(lower(ns->>'ldhName')) into v_dns from jsonb_array_elements(coalesce(d->'nameservers', '[]')) ns;
      v_onde := case when exists (select 1 from unnest(v_dns) x where x ~ 'dns-parking\.com|hostinger') then 'Hostinger' else coalesce(v_dns[1], '—') end;
      v_dias := floor(extract(epoch from v_exp - now()) / 86400);
      if v_exp is null then v_nivel := 'alerta'; v_det := 'Registro.br não informou o vencimento';
      elsif v_dias < 0 then v_nivel := 'erro'; v_det := 'Venceu em ' || to_char(v_exp at time zone 'America/Sao_Paulo', 'DD/MM/YYYY');
      elsif v_dias <= 30 then v_nivel := 'alerta'; v_det := 'Vence em ' || v_dias || ' dia(s) (' || to_char(v_exp at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ') — renove no Registro.br · DNS: ' || v_onde;
      elsif v_onde = 'Hostinger' then v_nivel := 'alerta'; v_det := 'Registrado até ' || to_char(v_exp at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ' · o DNS ainda está na Hostinger: se a Hostinger for cancelada, o site e o e-mail deste domínio podem cair';
      else v_nivel := 'ok'; v_det := 'Registrado até ' || to_char(v_exp at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ' · DNS: ' || v_onde;
      end if;
    end if;
    update controle_monitores set nivel = v_nivel, detalhe = v_det, verificado_em = now(), pedido_id = null,
      valor = case when d is null then valor else jsonb_strip_nulls(jsonb_build_object('vence_em', v_exp::date, 'dias', v_dias, 'dns', to_jsonb(v_dns))) end,
      desde = case when m.nivel = v_nivel and m.desde is not null then m.desde else now() end
    where id = m.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.controle_dominios_pedir() from public, anon, authenticated;
revoke execute on function public.controle_dominios_ler() from public, anon, authenticated;

select cron.schedule('controle-dominios-pedir', '7 */6 * * *', $cron$ select public.controle_dominios_pedir() $cron$);
select cron.schedule('controle-dominios-ler', '10 */6 * * *', $cron$ select public.controle_dominios_ler() $cron$);
