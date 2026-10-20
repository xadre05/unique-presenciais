-- ════════════════════════════════════════════════════════════════════
-- Área "Controle": os serviços pagos da empresa num lugar só (IA, hospedagem, banco, vendas, atendimento…).
-- Para cada um: para que serve, quanto custa, quando renova, saldo de crédito, onde administrar.
-- Senhas e chaves NÃO ficam aqui — só o e-mail da conta e o endereço do painel.
-- ════════════════════════════════════════════════════════════════════
create table public.controle_servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'Outro',
  para_que text,
  valor numeric(12,2),
  moeda text not null default 'BRL' check (moeda in ('BRL','USD')),
  ciclo text not null default 'mensal' check (ciclo in ('mensal','anual','credito','por_uso')),
  proximo_vencimento date,
  alerta_dias int not null default 7 check (alerta_dias between 0 and 90),
  saldo numeric(12,2),
  saldo_minimo numeric(12,2),
  saldo_em timestamptz,
  forma_pagamento text,
  conta_email text,
  painel_url text,
  responsavel text,
  situacao text not null default 'ativo' check (situacao in ('ativo','cancelar','cancelado')),
  observacao text,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.controle_servicos enable row level security;
create policy controle_servicos_admin on public.controle_servicos for all using (is_admin()) with check (is_admin());

-- os serviços que a empresa já usa (valores e datas ficam para preencher na tela)
insert into public.controle_servicos (nome, categoria, para_que, moeda, ciclo, painel_url, situacao, observacao, ordem) values
  ('Anthropic (Claude)', 'Inteligência artificial', 'IA dos agentes e do atendimento', 'USD', 'credito', 'https://console.anthropic.com/settings/billing', 'ativo', null, 10),
  ('OpenAI', 'Inteligência artificial', 'IA e imagens', 'USD', 'credito', 'https://platform.openai.com/settings/organization/billing', 'ativo', null, 20),
  ('RunPod', 'Inteligência artificial', 'Servidor de IA (GPU)', 'USD', 'credito', 'https://www.runpod.io/console/user/billing', 'ativo', null, 30),
  ('Supabase', 'Sistema e banco de dados', 'Banco de dados do sistema da Unique e do Unique Clinical', 'USD', 'mensal', 'https://supabase.com/dashboard/org/_/billing', 'ativo', null, 40),
  ('Vercel', 'Sistema e banco de dados', 'Onde o sistema fica no ar', 'USD', 'mensal', 'https://vercel.com/dashboard', 'ativo', null, 50),
  ('StayCloud', 'Hospedagem e domínios', 'Hospedagem das páginas e domínios', 'BRL', 'anual', null, 'ativo', null, 60),
  ('Hostinger', 'Hospedagem e domínios', 'Hospedagem antiga', 'BRL', 'anual', 'https://hpanel.hostinger.com', 'cancelar', 'Decisão: não renovar; levar tudo para o StayCloud antes de vencer.', 70),
  ('Hotmart', 'Vendas', 'Checkout e área de membros (cobra por venda)', 'BRL', 'por_uso', 'https://app.hotmart.com', 'ativo', null, 80);
