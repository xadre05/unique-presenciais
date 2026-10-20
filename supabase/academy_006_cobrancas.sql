-- Cobrança pelo sistema (20/10/2026). Começa pelo online (Hotmart): o administrador vê quem está atrasado (por conta da
-- Hotmart), passa a cobrança para uma vendedora e cada contato fica registrado (WhatsApp, ligação, promessa de
-- pagamento). A vendedora só vê as cobranças passadas para ela. Os dados do aluno (nome, telefone, produto, valor)
-- ficam copiados na cobrança, para ela não precisar de acesso à área do online.
-- chave do online = e-mail|produto|oferta|parcelas (a mesma da v_online_compras), para saber quando a pessoa voltou a pagar.
-- De hora em hora (depois da leitura da Hotmart) cobrancas_conferir() fecha as que foram pagas e atualiza o valor.
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  origem text not null default 'online' check (origem in ('online', 'presencial')),
  chave text not null,
  integracao_id text,
  aluno_nome text,
  email text,
  telefone text,
  produto text,
  valor_vencido numeric(12,2),
  cobrancas_vencidas integer,
  venceu_em date,
  responsavel_id uuid references public.vendedoras(id),
  situacao text not null default 'aberta' check (situacao in ('aberta', 'prometeu', 'negociando', 'sem_resposta', 'nao_vai_pagar', 'paga', 'encerrada')),
  promessa_em date,
  ultimo_contato_em timestamptz,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists cobrancas_chave_aberta on public.cobrancas (chave) where situacao not in ('paga', 'encerrada');
create index if not exists cobrancas_responsavel on public.cobrancas (responsavel_id, situacao);
alter table public.cobrancas enable row level security;
create policy cob_ver on public.cobrancas for select using (is_admin() or responsavel_id = minha_vendedora());
create policy cob_ins on public.cobrancas for insert with check (is_admin());
create policy cob_upd on public.cobrancas for update using (is_admin() or responsavel_id = minha_vendedora()) with check (is_admin() or responsavel_id = minha_vendedora());

create table if not exists public.cobranca_contatos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas(id) on delete cascade,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'ligacao', 'email', 'outro', 'sistema')),
  resultado text,
  observacao text,
  quem uuid default auth.uid(),
  quem_nome text,
  criado_em timestamptz not null default now()
);
create index if not exists cobranca_contatos_cobranca on public.cobranca_contatos (cobranca_id, criado_em desc);
alter table public.cobranca_contatos enable row level security;
create policy cobc_ver on public.cobranca_contatos for select using (exists (select 1 from public.cobrancas c where c.id = cobranca_id and (is_admin() or c.responsavel_id = minha_vendedora())));
create policy cobc_ins on public.cobranca_contatos for insert with check (exists (select 1 from public.cobrancas c where c.id = cobranca_id and (is_admin() or c.responsavel_id = minha_vendedora())));

-- fecha as cobranças do online que voltaram a pagar (ou foram estornadas) e atualiza o valor das que seguem abertas
create or replace function public.cobrancas_conferir() returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; k integer;
begin
  with situ as (
    select c.id, oc.situacao, a.valor_vencido, a.cobrancas_vencidas
    from public.cobrancas c
    left join public.v_online_compras oc on oc.em || '|' || coalesce(oc.produto_id::text, '') || '|' || coalesce(oc.oferta_codigo, '') || '|' || oc.np = c.chave
    left join public.v_online_atrasos a on a.em || '|' || coalesce(a.produto_id::text, '') || '|' || coalesce(a.oferta_codigo, '') || '|' || a.np = c.chave
    where c.origem = 'online' and c.situacao not in ('paga', 'encerrada')
  ), fechar as (
    update public.cobrancas c set situacao = case when s.situacao = 'estornado' then 'encerrada' else 'paga' end, atualizado_em = now()
    from situ s where s.id = c.id and s.situacao in ('em_dia', 'quitado', 'estornado') returning c.id, c.situacao
  )
  insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
  select id, 'sistema', case when situacao = 'paga' then 'Voltou a pagar (a Hotmart confirmou)' else 'Compra estornada na Hotmart' end, null, 'Sistema' from fechar;
  get diagnostics k = row_count; n := n + k;
  update public.cobrancas c set valor_vencido = a.valor_vencido, cobrancas_vencidas = a.cobrancas_vencidas, atualizado_em = now()
  from public.v_online_atrasos a
  where c.origem = 'online' and c.situacao not in ('paga', 'encerrada')
    and a.em || '|' || coalesce(a.produto_id::text, '') || '|' || coalesce(a.oferta_codigo, '') || '|' || a.np = c.chave
    and (c.valor_vencido is distinct from a.valor_vencido or c.cobrancas_vencidas is distinct from a.cobrancas_vencidas);
  return n;
end $$;
revoke all on function public.cobrancas_conferir() from public, anon, authenticated;

select cron.schedule('cobrancas-conferir', '33 * * * *', $cron$ select public.cobrancas_conferir() $cron$);
