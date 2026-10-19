-- Seguidores dia a dia, parte 2 (19/10/2026): além da foto do total (tirada na leitura diária), guarda os "novos
-- seguidores" de cada dia que o Instagram informa (ele só devolve os últimos 30 dias). Assim o histórico já começa
-- com um mês e, daqui para a frente, cada dia tem o total e os novos. Os dias passados só têm "novos" (total vazio).
alter table public.marca_seguidores alter column seguidores drop not null;
alter table public.marca_seguidores add column if not exists novos integer;
