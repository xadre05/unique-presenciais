-- 019 · Criativos nossos que venderam (21/10/2026). O código de rastreio das vendas da Hotmart guarda qual anúncio do
-- Facebook vendeu (FB|conjunto|id|campanha|id|ANÚNCIO|id|posicionamento). A função monta o ranking por anúncio
-- (compradores únicos e receita líquida; cópias do mesmo anúncio somam juntas). A equipe guarda o roteiro do campeão
-- como referência da categoria "nosso", com o resultado, e o Agente de Marketing parte deles nos roteiros de venda.
-- Só acréscimos (banco compartilhado): a regra de categoria ganha "nosso"; coluna nova "resultado".
alter table public.marca_referencias add column if not exists resultado jsonb;
alter table public.marca_referencias drop constraint if exists marca_referencias_categoria_check;
alter table public.marca_referencias add constraint marca_referencias_categoria_check
  check (categoria in ('nosso', 'concorrente', 'outro_nicho', 'admiro', 'material', 'outro'));

create or replace function public.criativos_campeoes()
returns table (anuncio text, tipo text, vendas bigint, pedidos bigint, receita numeric, de date, ate date, campanhas text, produtos text, posicionamentos text)
language sql stable security definer set search_path = public as $$
  with v as (
    select trim(regexp_replace(split_part(rastreio, '|', 6), '\s*—\s*Cópia.*$', '')) as anuncio,
      split_part(rastreio, '|', 4) as campanha, split_part(rastreio, '|', 8) as posicionamento,
      comprador_email, valor_liquido, data_pedido, produto_nome
    from hotmart_pagamentos
    where rastreio like 'FB|%' and split_part(rastreio, '|', 7) ~ '^\d+$' and status in ('APPROVED', 'COMPLETE', 'COMPLETED')
  )
  select anuncio,
    case when anuncio ilike 'ADI%' or anuncio ilike '%est_tico%' then 'imagem' else 'video' end,
    count(distinct lower(comprador_email)), count(*), round(sum(valor_liquido)::numeric, 2),
    min(data_pedido)::date, max(data_pedido)::date,
    string_agg(distinct campanha, ' / '), string_agg(distinct produto_nome, ' / '), string_agg(distinct posicionamento, ', ')
  from v where is_admin() and anuncio <> ''
  group by anuncio order by 3 desc, 5 desc limit 60
$$;
revoke all on function public.criativos_campeoes() from public, anon;
grant execute on function public.criativos_campeoes() to authenticated;
