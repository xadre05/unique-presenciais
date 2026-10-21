-- 21/10/2026: o administrador cria peça direto pela tela (ex.: "Novo vídeo para editar" no Agente Editor de Vídeo).
-- Já aplicada no banco.
create policy agpeca_ins on public.agentes_pecas for insert with check (is_admin());
