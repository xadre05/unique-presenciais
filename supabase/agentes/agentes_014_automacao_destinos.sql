-- Automações, parte 2 (19/10/2026): o que a pessoa recebe. Além da mensagem, um destino:
--   link (página), arquivo (PDF guardado no sistema) ou whatsapp (conversa com a equipe: reveza entre as vendedoras
--   com WhatsApp cadastrado ou vai para um número fixo; número comum, não precisa da API oficial).
-- Todo destino vai por um link rastreado (?ir=código): cada mensagem tem um código, então dá para saber quem clicou,
-- quando e com qual vendedora ficou. O WhatsApp da vendedora fica em vendedoras.whatsapp.
alter table public.marca_automacoes add column if not exists destino text not null default 'link' check (destino in ('nenhum', 'link', 'arquivo', 'whatsapp'));
alter table public.marca_automacoes add column if not exists arquivo_caminho text;
alter table public.marca_automacoes add column if not exists arquivo_nome text;
alter table public.marca_automacoes add column if not exists whatsapp_modo text not null default 'reveza' check (whatsapp_modo in ('reveza', 'numero'));
alter table public.marca_automacoes add column if not exists whatsapp_numero text;
alter table public.marca_automacoes add column if not exists whatsapp_texto text;
alter table public.marca_automacoes add column if not exists vendedoras uuid[] not null default '{}';

alter table public.marca_automacao_envios add column if not exists codigo text unique;
alter table public.marca_automacao_envios add column if not exists cliques integer not null default 0;
alter table public.marca_automacao_envios add column if not exists clicou_em timestamptz;
alter table public.marca_automacao_envios add column if not exists vendedora_id uuid;

alter table public.vendedoras add column if not exists whatsapp text;
