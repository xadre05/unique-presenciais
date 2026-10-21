-- ════════════════════════════════════════════════════════════════════
-- Black 2026: ligação entre o código de turma da página (vai no "sck" do checkout, ex.: SCULPT-BSB-2026-11-05)
-- e a turma/módulo do sistema. Os módulos da Black são os encontros das turmas da Mini Residência
-- (Módulo 1 = Start, 2 = Collagen, 3 = Sculpt, 4 = Thread); o Unique Codes é a própria turma.
-- A view conta quantos compraram cada data (compra aprovada; reembolso não conta).
-- ════════════════════════════════════════════════════════════════════
create table public.black_turmas (
  codigo text primary key,
  modulo text not null,
  turma_id uuid not null references public.turmas on delete cascade,
  encontro_id uuid references public.encontros on delete set null,
  data_inicio date not null,
  lugares int not null default 12,
  residentes int not null default 0
);
alter table public.black_turmas enable row level security;
create policy black_turmas_ler on public.black_turmas for select to authenticated using (true);
create policy black_turmas_admin on public.black_turmas for all using (is_admin()) with check (is_admin());

-- Mini Residência: o código casa com o encontro da mesma data
insert into public.black_turmas (codigo, modulo, turma_id, encontro_id, data_inicio, residentes)
select x.codigo, x.modulo, e.turma_id, e.id, x.inicio, x.residentes
from (values
  ('SCULPT-BSB-2026-11-05', 'SCULPT', date '2026-11-05', 4), ('THREAD-BSB-2026-12-04', 'THREAD', date '2026-12-04', 4),
  ('START-BSB-2026-11-19', 'START', date '2026-11-19', 4), ('COLLAGEN-BSB-2027-01-21', 'COLLAGEN', date '2027-01-21', 4),
  ('SCULPT-BSB-2027-02-25', 'SCULPT', date '2027-02-25', 4), ('THREAD-BSB-2027-03-18', 'THREAD', date '2027-03-18', 4),
  ('START-BSB-2027-03-11', 'START', date '2027-03-11', 0), ('COLLAGEN-BSB-2027-04-08', 'COLLAGEN', date '2027-04-08', 0),
  ('SCULPT-BSB-2027-05-13', 'SCULPT', date '2027-05-13', 0), ('THREAD-BSB-2027-06-17', 'THREAD', date '2027-06-17', 0)
) x(codigo, modulo, inicio, residentes)
join public.encontros e on e.data_inicio = x.inicio and not e.cancelado
join public.turmas t on t.id = e.turma_id and t.curso_id = '304cb038-ee98-4bdc-81e2-1f26f9291b9d';

-- Unique Codes: a turma inteira
insert into public.black_turmas (codigo, modulo, turma_id, data_inicio)
select 'UCODES-BSB-2026-11-13', 'UCODES', t.id, date '2026-11-13' from public.turmas t where t.id = '1cd22685-c40a-4d1f-974c-efaae3d9dae0';

create view public.v_black_turmas with (security_invoker = on) as
select b.codigo, b.modulo, b.turma_id, b.encontro_id, b.data_inicio, b.lugares, b.residentes,
  count(distinct hp.transacao) filter (where upper(hp.status) in ('APPROVED', 'COMPLETE', 'COMPLETED')) as compraram,
  count(distinct hp.transacao) filter (where upper(hp.status) in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'CANCELED')) as desistiram,
  (select count(*) from public.matriculas m where m.turma_id = b.turma_id and m.status <> 'cancelada') as matriculados
from public.black_turmas b
left join public.hotmart_pagamentos hp
  on upper(coalesce(hp.bruto #>> '{data,purchase,origin,sck}', hp.bruto #>> '{purchase,tracking,source_sck}', '')) = b.codigo
group by b.codigo;
