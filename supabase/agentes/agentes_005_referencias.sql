-- 075 · Referências para modelar (19/10/2026, migração agentes_referencias).
-- Posts, reels, carrosséis e textos de TERCEIROS (concorrentes, outros nichos, quem a equipe admira, materiais comprados)
-- que servem de modelo de FORMATO: gancho, estrutura, edição, texto na tela, jeito de falar. Separadas da Biblioteca da
-- marca (que é o conhecimento da própria empresa). Cada empresa só vê as suas (RLS por administrador, filtro por empresa).
-- Os arquivos (prints e quadros tirados do vídeo no navegador) ficam no armazenamento "arquivos", pasta
-- agentes/referencias/<empresa>/<id>. A ficha é escrita pelo agente (função agentes, ação referencia).
-- Regra: copiar a forma, nunca o conteúdo, as frases ou a marca de terceiros.
create table if not exists public.marca_referencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  categoria text not null default 'outro' check (categoria in ('concorrente', 'outro_nicho', 'admiro', 'material', 'outro')),
  autor text,
  link text,
  formato text not null default 'outro' check (formato in ('carrossel', 'reels', 'post', 'stories', 'video', 'texto', 'outro')),
  por_que text,
  texto text,
  arquivos jsonb not null default '[]'::jsonb,
  ficha jsonb,
  status text not null default 'nova' check (status in ('nova', 'analisando', 'pronta', 'erro')),
  erro text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists marca_referencias_empresa on public.marca_referencias (empresa_id, ativo, formato);
alter table public.marca_referencias enable row level security;
create policy mref_ver on public.marca_referencias for select using (is_admin());
create policy mref_criar on public.marca_referencias for insert with check (is_admin());
create policy mref_mudar on public.marca_referencias for update using (is_admin()) with check (is_admin());
