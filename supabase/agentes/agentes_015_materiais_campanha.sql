-- Materiais de uma campanha (20/10/2026): página de vendas, roteiros dos vídeos, copy, apresentação das vendedoras.
-- Moram na mesma biblioteca da marca (marca_fontes/marca_trechos), marcados com a campanha. O agente lê o texto
-- INTEIRO deles sempre que cria ou ajusta algo daquela campanha; fora dela, eles não entram na busca geral
-- (campanha que acabou não contamina o resto).
alter table public.marca_fontes
  add column if not exists campanha_id text,
  add column if not exists papel text;   -- pagina · roteiro · copy · apresentacao · outro
create index if not exists marca_fontes_campanha on public.marca_fontes (empresa_id, campanha_id) where campanha_id is not null;

create or replace function public.marca_buscar(p_empresa uuid, p_consulta text, p_limite integer default 6)
 returns table(trecho_id uuid, fonte_id uuid, fonte_titulo text, fonte_tipo text, conteudo text, relevancia real)
 language plpgsql stable set search_path to 'public', 'extensions' as $function$
declare q tsquery;
begin
  q := nullif(replace(plainto_tsquery('portuguese', extensions.unaccent(coalesce(p_consulta, '')))::text, '&', '|'), '')::tsquery;
  if q is null then return; end if;
  return query
    select t.id, f.id, f.titulo, f.tipo, t.conteudo, ts_rank_cd(t.busca, q)
    from marca_trechos t join marca_fontes f on f.id = t.fonte_id
    where t.empresa_id = p_empresa and f.ativo and f.aprovada and f.status = 'pronta' and f.campanha_id is null and t.busca @@ q
    order by ts_rank_cd(t.busca, q) desc
    limit greatest(1, least(p_limite, 30));
end $function$;
