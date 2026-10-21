-- ════════════════════════════════════════════════════════════════════
-- Campanhas de venda: o painel deixa de ser só da Black e vira "Campanhas" no Comercial.
-- Cada campanha diz qual formulário da página (CRM), quais ofertas da Hotmart, a etiqueta e as metas;
-- o painel_campanha(id) monta o placar de qualquer uma. A Black 2026 é a primeira.
-- ════════════════════════════════════════════════════════════════════
create table public.campanhas_vendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  inicio date,
  fim date,
  formulario_slug text,                 -- formulário do CRM que recebe os leads da página
  etiqueta text,                        -- etiqueta dos contatos da campanha
  ofertas text[] not null default '{}', -- códigos de oferta da Hotmart (off=…) que contam como venda da campanha
  meta_vendas int,
  meta_receita numeric(14,2),
  campanha_marca_id text,               -- a mesma campanha no agente de marketing (Agentes → Marca → Campanhas)
  observacao text,
  criado_em timestamptz not null default now()
);
alter table public.campanhas_vendas enable row level security;
create policy campanhas_vendas_ler on public.campanhas_vendas for select to authenticated using (true);
create policy campanhas_vendas_admin on public.campanhas_vendas for all using (is_admin()) with check (is_admin());

insert into public.campanhas_vendas (nome, inicio, fim, formulario_slug, etiqueta, ofertas, meta_vendas, meta_receita, campanha_marca_id)
values ('Black Friday Limited Edition', '2026-10-20', '2026-11-30', 'black-2026', 'black-2026', array['9r0jcoeg', '54utqf4b'], 200, 1000000, '522e1855-3de2-425f-bec6-6df974e18950');

-- as datas/vagas passam a pertencer a uma campanha
alter table public.black_turmas add column if not exists campanha_id uuid references public.campanhas_vendas on delete cascade;
update public.black_turmas set campanha_id = (select id from public.campanhas_vendas where formulario_slug = 'black-2026');
create or replace view public.v_black_turmas with (security_invoker = on) as
select b.codigo, b.modulo, b.turma_id, b.encontro_id, b.data_inicio, b.lugares, b.residentes,
  count(distinct hp.transacao) filter (where upper(hp.status) in ('APPROVED', 'COMPLETE', 'COMPLETED')) as compraram,
  count(distinct hp.transacao) filter (where upper(hp.status) in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'CANCELED')) as desistiram,
  (select count(*) from public.matriculas m where m.turma_id = b.turma_id and m.status <> 'cancelada') as matriculados,
  b.campanha_id
from public.black_turmas b
left join public.hotmart_pagamentos hp
  on upper(coalesce(hp.bruto #>> '{data,purchase,origin,sck}', hp.bruto #>> '{purchase,tracking,source_sck}', '')) = b.codigo
group by b.codigo;
