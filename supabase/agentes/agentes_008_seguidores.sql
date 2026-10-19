-- Seguidores dia a dia (19/10/2026): o Instagram só entrega o número de seguidores de hoje (e o histórico de 30 dias),
-- então a leitura diária guarda uma foto por dia. Com o tempo, dá para comparar o crescimento entre períodos.
create table if not exists public.marca_seguidores (
  empresa_id uuid not null,
  rede text not null,
  dia date not null,
  seguidores integer not null,
  primary key (empresa_id, rede, dia)
);
alter table public.marca_seguidores enable row level security;
create policy mseg_ver on public.marca_seguidores for select using (is_admin());
