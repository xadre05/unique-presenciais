-- Seguidores, parte 3 (19/10/2026): quantos deixaram de seguir em cada dia (métrica follows_and_unfollows do
-- Instagram, quebra NON_FOLLOWER). Junto com "novos" (follower_count), dá o saldo real do dia: entraram − saíram.
alter table public.marca_seguidores add column if not exists saidas integer;
