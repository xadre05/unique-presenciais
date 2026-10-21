-- 018 · Estudar um canal (21/10/2026). Uma referência pode ser um CANAL inteiro (YouTube ou Instagram): a equipe
-- baixa de 3 a 10 vídeos, o navegador tira quadros, mede os cortes e transcreve o áudio de cada um, o agente estuda
-- vídeo por vídeo e depois escreve a ficha do padrão do canal. Só colunas novas (banco compartilhado).
alter table public.marca_referencias add column if not exists tipo text not null default 'peca';
alter table public.marca_referencias add column if not exists videos jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.marca_referencias add constraint marca_referencias_tipo check (tipo in ('peca', 'canal'));
exception when duplicate_object then null; end $$;
