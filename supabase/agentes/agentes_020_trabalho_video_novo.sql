-- 020 · "Novo vídeo para editar" (21/10/2026): o navegador cria um trabalho já pronto (sem IA, sem custo) só para ser
-- o dono da peça de vídeo. A regra de inserção geral só aceita trabalho "na_fila"; esta libera só este caso.
create policy agtrab_ins_video on public.agentes_trabalhos for insert
  with check (is_admin() and tipo = 'video_novo' and status = 'pronto' and coalesce(custo_usd, 0) = 0);
