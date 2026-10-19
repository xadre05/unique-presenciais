-- Base da marca → Conhecimento (19/10/2026)
-- 1) Biblioteca: cada material fica "aprovado" (o agente usa como fonte) ou "a validar" (guardado, mas fora das buscas).
--    O que já existe entra aprovado, menos o texto do Unique Codes, que espera a revisão da especialista.
-- 2) Referências de criação ganham um nome curto e o canal de onde vieram.
alter table public.marca_fontes add column if not exists aprovada boolean not null default true;
alter table public.marca_referencias add column if not exists nome text;
alter table public.marca_referencias add column if not exists canal text;

update public.marca_fontes
   set aprovada = false, titulo = 'Unique Codes — os 18 códigos do método'
 where titulo = 'Unique Codes — os 18 códigos do método (a validar pela Dra.)';

create or replace function public.marca_buscar(p_empresa uuid, p_consulta text, p_limite integer default 6)
 returns table(trecho_id uuid, fonte_id uuid, fonte_titulo text, fonte_tipo text, conteudo text, relevancia real)
 language plpgsql
 stable
 set search_path to 'public', 'extensions'
as $function$
declare q tsquery;
begin
  q := nullif(replace(plainto_tsquery('portuguese', extensions.unaccent(coalesce(p_consulta, '')))::text, '&', '|'), '')::tsquery;
  if q is null then return; end if;
  return query
    select t.id, f.id, f.titulo, f.tipo, t.conteudo, ts_rank_cd(t.busca, q)
    from marca_trechos t join marca_fontes f on f.id = t.fonte_id
    where t.empresa_id = p_empresa and f.ativo and f.aprovada and f.status = 'pronta' and t.busca @@ q
    order by ts_rank_cd(t.busca, q) desc
    limit greatest(1, least(p_limite, 30));
end $function$;
