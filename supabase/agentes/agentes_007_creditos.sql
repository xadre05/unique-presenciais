-- Agentes em créditos (19/10/2026): quem usa o sistema vê e limita o consumo em créditos, não em dólar.
-- 1 crédito = US$ 0,01 de custo de IA. O custo real em dólar continua em agentes_trabalhos.custo_usd (área de controle).
alter table public.agentes_config add column if not exists limite_mes_creditos integer;
update public.agentes_config set limite_mes_creditos = round(limite_mes_usd * 100)
 where limite_mes_usd is not null and limite_mes_creditos is null;
update public.agentes_empresa
   set perfil = (perfil - 'limite_mes_usd') || jsonb_build_object('limite_mes_creditos', round((perfil->>'limite_mes_usd')::numeric * 100))
 where perfil ? 'limite_mes_usd' and nullif(perfil->>'limite_mes_usd', '') is not null;
