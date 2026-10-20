-- Fila de cobrança (20/10/2026). A fila nasce cheia: de hora em hora (minuto 33, depois da leitura da Hotmart no minuto 23)
-- cobrancas_conferir() põe nela quem deve, atualiza os valores e tira quem pagou.
--   online: quem a Hotmart mostra com parcelas não pagas no Parcelamento Hotmart / Recuperação (hotmart_assinaturas, sem as
--           assinaturas de verdade), que pagou ao menos 1 parcela e não terminou. Uma cobrança por pessoa e produto
--           (chave online|e-mail|produto). Valor = parcela do parcelamento × parcelas não pagas.
--   presencial: parcelas atrasadas, uma cobrança por matrícula.
-- A conversa acontece no Atendimento (menu Cobranças). O dinheiro dos acordos é informado pela cobradora e conferido pelo
-- administrador; a comissão sai do que foi conferido (% em cobranca_config).
-- Sem apagar nada (nem coluna, nem índice): a coluna nova "etapa" manda; "situacao" (antiga) acompanha por gatilho (aberta / paga / encerrada).

alter table public.cobrancas
  add column if not exists etapa text not null default 'a_contatar'
    check (etapa in ('a_contatar', 'aguardando', 'negociando', 'acordo', 'negativar', 'negativado', 'paga', 'sem_acordo', 'encerrada')),
  add column if not exists matricula_id uuid references public.matriculas(id),
  add column if not exists produto_id bigint,
  add column if not exists valor_restante numeric(12,2),
  add column if not exists parou_em date,
  add column if not exists ultimo_pagamento_em date,
  add column if not exists status_hotmart text,
  add column if not exists retornar_em date,
  add column if not exists tentativas integer not null default 0,
  add column if not exists acordo_valor numeric(12,2),
  add column if not exists acordo_forma text,
  add column if not exists acordo_parcelas integer,
  add column if not exists acordo_primeiro_venc date,
  add column if not exists acordo_em timestamptz,
  add column if not exists acordo_obs text,
  add column if not exists negativado_em date;
-- a lei só deixa o nome negativado até 5 anos depois de a dívida vencer
alter table public.cobrancas add column if not exists negativar_ate date generated always as ((parou_em + interval '5 years')::date) stored;
create index if not exists cobrancas_etapa on public.cobrancas (etapa, parou_em);

create or replace function public.cobrancas_situacao_da_etapa() returns trigger language plpgsql as $$
begin
  new.situacao := case when new.etapa = 'paga' then 'paga' when new.etapa in ('sem_acordo', 'encerrada') then 'encerrada' else 'aberta' end;
  return new;
end $$;
create trigger cobrancas_situacao before insert or update of etapa on public.cobrancas for each row execute function public.cobrancas_situacao_da_etapa();

-- o que entrou dos acordos
create table if not exists public.cobranca_config (
  id boolean primary key default true check (id),
  pct_comissao numeric(5,2),
  atualizado_em timestamptz not null default now()
);
insert into public.cobranca_config (id) values (true) on conflict do nothing;
alter table public.cobranca_config enable row level security;
create policy cobcfg_ver on public.cobranca_config for select using (auth.uid() is not null);
create policy cobcfg_upd on public.cobranca_config for update using (is_admin()) with check (is_admin());

create table if not exists public.cobranca_recebimentos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas(id),
  valor numeric(12,2) not null check (valor > 0),
  recebido_em date not null default current_date,
  forma text,
  observacao text,
  informado_por uuid default auth.uid(),
  informado_nome text,
  conferido boolean not null default false,
  conferido_em timestamptz,
  vendedora_id uuid references public.vendedoras(id),
  comissao_pct numeric(5,2),
  comissao_valor numeric(12,2),
  comissao_status text check (comissao_status in ('pendente', 'liberada', 'paga')),
  comissao_paga_em date,
  criado_em timestamptz not null default now()
);
create index if not exists cobranca_receb_cobranca on public.cobranca_recebimentos (cobranca_id);
alter table public.cobranca_recebimentos enable row level security;
create policy cobr_ver on public.cobranca_recebimentos for select using (is_admin() or exists (select 1 from public.cobrancas c where c.id = cobranca_id and c.responsavel_id = minha_vendedora()));
create policy cobr_ins on public.cobranca_recebimentos for insert with check (not conferido and comissao_valor is null and (is_admin() or exists (select 1 from public.cobrancas c where c.id = cobranca_id and c.responsavel_id = minha_vendedora())));
create policy cobr_upd on public.cobranca_recebimentos for update using (is_admin()) with check (is_admin());

-- conferir um recebimento: comissão de quem está com a cobrança; se o acordo foi pago inteiro, a cobrança fecha
create or replace function public.conferir_recebimento_cobranca(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare r public.cobranca_recebimentos; c public.cobrancas; pct numeric; total numeric; alvo numeric;
begin
  if not is_admin() then raise exception 'Só o administrador confere recebimentos.'; end if;
  select * into r from public.cobranca_recebimentos where id = p_id for update;
  if r.id is null or r.conferido then return; end if;
  select * into c from public.cobrancas where id = r.cobranca_id;
  select pct_comissao into pct from public.cobranca_config;
  update public.cobranca_recebimentos set conferido = true, conferido_em = now(), vendedora_id = c.responsavel_id,
    comissao_pct = case when c.responsavel_id is not null then pct end,
    comissao_valor = case when c.responsavel_id is not null and pct is not null then round(r.valor * pct / 100, 2) end,
    comissao_status = case when c.responsavel_id is not null and pct is not null then 'pendente' end
  where id = p_id;
  insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
  values (c.id, 'sistema', 'Pagamento de R$ ' || to_char(r.valor, 'FM999G999G990D00') || ' conferido', auth.uid(), 'Administrador');
  select sum(valor) into total from public.cobranca_recebimentos where cobranca_id = c.id and conferido;
  alvo := coalesce(c.acordo_valor, c.valor_restante, c.valor_vencido, 0);
  if c.etapa not in ('paga', 'sem_acordo', 'encerrada') and alvo > 0 and total >= alvo then
    update public.cobrancas set etapa = 'paga', atualizado_em = now() where id = c.id;
    insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome) values (c.id, 'sistema', 'Acordo pago', null, 'Sistema');
  end if;
end $$;
revoke all on function public.conferir_recebimento_cobranca(uuid) from public, anon;
grant execute on function public.conferir_recebimento_cobranca(uuid) to authenticated;

-- passar várias cobranças de uma vez (ou tirar de quem estava)
create or replace function public.distribuir_cobrancas(p_ids uuid[], p_vendedora uuid) returns integer language plpgsql security definer set search_path = public as $$
declare n integer; quem text;
begin
  if not is_admin() then raise exception 'Só o administrador distribui cobranças.'; end if;
  select nome into quem from public.vendedoras where id = p_vendedora;
  with m as (
    update public.cobrancas set responsavel_id = p_vendedora, atualizado_em = now()
    where id = any(p_ids) and responsavel_id is distinct from p_vendedora returning id
  )
  insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
  select id, 'sistema', coalesce('Passada para ' || quem, 'Sem responsável'), auth.uid(), 'Administrador' from m;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.distribuir_cobrancas(uuid[], uuid) from public, anon;
grant execute on function public.distribuir_cobrancas(uuid[], uuid) to authenticated;

-- quem deve no online (uma linha por pessoa e produto)
create or replace view public.v_cobranca_online with (security_invoker = true) as
with ass as (
  select a.integracao_id, a.email, a.produto_id, max(a.produto_nome) as produto_nome, max(a.nome) as nome, max(a.oferta_codigo) as oferta_codigo,
    max(a.nao_pagas)::bigint as nao_pagas, min(a.primeira_nao_paga)::date as primeira_nao_paga,
    string_agg(distinct a.status, ', ') as status, false as so_ativa
  from public.hotmart_assinaturas a
  -- só o que a própria Hotmart chama de "Atraso" ou "Cancelado"; plano "Ativo" (inclusive quem renegociou pela Recuperação)
  -- não é dívida, mesmo que a lista de parcelas não pagas ainda mostre parcelas antigas
  where a.tipo is distinct from 'SUBSCRIPTION' and a.email is not null and a.nao_pagas > 0 and (a.status = 'DELAYED' or a.status like 'CANCELLED%')
  group by 1, 2, 3
), parc as (
  -- cada cobrança do parcelamento (recorrência): quantas foram pagas, o valor da parcela e o total de parcelas
  select lower(h.comprador_email) as email, h.produto_id, max(h.parcelas_cartao) as np,
    count(*) filter (where upper(h.status) in ('APPROVED', 'COMPLETE', 'COMPLETED')) as pagas,
    count(*) filter (where upper(h.status) in ('REFUNDED', 'CHARGEBACK', 'PARTIALLY_REFUNDED')) as estornos,
    (array_agg(h.valor order by (upper(h.status) in ('APPROVED', 'COMPLETE', 'COMPLETED')) desc, h.data_aprovacao desc nulls last))[1] as parcela,
    max(h.data_aprovacao) filter (where upper(h.status) in ('APPROVED', 'COMPLETE', 'COMPLETED')) as ultima_data
  from public.hotmart_pagamentos h where h.recorrencia is not null
  group by 1, 2
), base as (
  select a.integracao_id, a.email, a.produto_id, a.produto_nome as produto,
    coalesce(a.nome, (select max(h.comprador_nome) from public.hotmart_pagamentos h where lower(h.comprador_email) = a.email)) as nome,
    a.status as status_hotmart, p.parcela as valor_parcela, p.pagas, p.np, p.ultima_data,
    least(a.nao_pagas, coalesce(p.np - p.pagas, a.nao_pagas)) as vencidas, a.primeira_nao_paga as parou_em, false as valor_estimado
  from ass a
  join parc p on p.email = a.email and p.produto_id = a.produto_id
  where p.estornos = 0 and p.pagas >= 1 and p.pagas < coalesce(p.np, p.pagas + 1)       -- pagou ao menos 1 parcela e não terminou
)
select 'online|' || b.email || '|' || coalesce(b.produto_id::text, '') as chave,
  b.integracao_id, b.email, b.produto_id, b.produto, b.nome, b.status_hotmart, b.valor_parcela, b.pagas, b.np, b.ultima_data, b.vencidas, b.parou_em,
  round(b.valor_parcela * b.vencidas, 2) as valor_vencido,
  round(b.valor_parcela * greatest(coalesce(b.np - b.pagas, 0), b.vencidas), 2) as valor_restante,
  b.valor_estimado
from base b;

-- quem deve no presencial (uma linha por matrícula com parcela atrasada)
create or replace view public.v_cobranca_presencial with (security_invoker = true) as
select 'presencial|' || p.matricula_id as chave, p.matricula_id, max(p.aluno_nome) as aluno_nome, max(p.aluno_whatsapp) as telefone,
    max(p.turma_nome) as produto, sum(p.valor) as valor_vencido, count(*)::int as vencidas, min(p.vencimento) as parou_em,
    (select sum(q.valor) from public.v_parcelas q where q.matricula_id = p.matricula_id and q.situacao in ('atrasada', 'a_vencer', 'sem_vencimento')) as valor_restante,
    (select max(q.data_recebimento) from public.v_parcelas q where q.matricula_id = p.matricula_id and q.considerada_paga) as ultimo_pagamento_em
from public.v_parcelas p where p.situacao = 'atrasada' group by p.matricula_id;

-- a rotina de hora em hora (mesmo nome e mesmo agendamento da versão anterior, que só fechava as pagas)
create or replace function public.cobrancas_conferir() returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; k integer;
begin
  insert into public.cobrancas (origem, chave, integracao_id, aluno_nome, email, telefone, produto, produto_id, valor_vencido, cobrancas_vencidas, venceu_em, parou_em, ultimo_pagamento_em, valor_restante, status_hotmart, etapa, criado_por)
  select 'online', o.chave, o.integracao_id, o.nome, o.email,
    coalesce((select ct.telefone from public.crm_contatos ct where ct.emails @> array[o.email] and ct.telefone is not null limit 1), (select hc.telefone from public.hotmart_compradores hc where hc.email = o.email)),
    o.produto, o.produto_id, o.valor_vencido, o.vencidas, o.parou_em, o.parou_em, o.ultima_data::date, o.valor_restante, o.status_hotmart, 'a_contatar', null
  from public.v_cobranca_online o
  where not exists (select 1 from public.cobrancas x where x.chave = o.chave and (x.etapa not in ('paga', 'sem_acordo', 'encerrada') or x.etapa in ('sem_acordo', 'encerrada') or x.atualizado_em >= coalesce(o.ultima_data, '-infinity')));
  get diagnostics k = row_count; n := n + k;

  update public.cobrancas c set valor_vencido = o.valor_vencido, cobrancas_vencidas = o.vencidas, valor_restante = o.valor_restante, parou_em = o.parou_em,
    venceu_em = o.parou_em, ultimo_pagamento_em = o.ultima_data::date, status_hotmart = o.status_hotmart,
    telefone = coalesce(c.telefone, (select ct.telefone from public.crm_contatos ct where ct.emails @> array[o.email] and ct.telefone is not null limit 1), (select hc.telefone from public.hotmart_compradores hc where hc.email = o.email)),
    atualizado_em = now()
  from public.v_cobranca_online o
  where c.chave = o.chave and c.etapa not in ('paga', 'sem_acordo', 'encerrada')
    and (c.valor_vencido is distinct from o.valor_vencido or c.valor_restante is distinct from o.valor_restante or c.parou_em is distinct from o.parou_em or c.status_hotmart is distinct from o.status_hotmart or c.telefone is null);

  -- saiu da lista de quem deve: pagou na Hotmart (ou foi reembolsado)
  with f as (
    update public.cobrancas c set etapa = case when exists (select 1 from public.v_online_compras oc where oc.em = c.email and oc.produto_id = c.produto_id and oc.situacao = 'estornado') then 'encerrada' else 'paga' end, atualizado_em = now()
    where c.origem = 'online' and c.etapa not in ('paga', 'sem_acordo', 'encerrada') and not exists (select 1 from public.v_cobranca_online o where o.chave = c.chave)
    returning c.id, c.etapa
  )
  insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
  select id, 'sistema', case when etapa = 'paga' then 'Voltou a pagar (a Hotmart confirmou)' else 'Compra reembolsada na Hotmart' end, null, 'Sistema' from f;
  get diagnostics k = row_count; n := n + k;

  -- presencial

  insert into public.cobrancas (origem, chave, matricula_id, aluno_nome, telefone, produto, valor_vencido, cobrancas_vencidas, venceu_em, parou_em, ultimo_pagamento_em, valor_restante, etapa, criado_por)
  select 'presencial', p.chave, p.matricula_id, p.aluno_nome, p.telefone, p.produto, p.valor_vencido, p.vencidas, p.parou_em, p.parou_em, p.ultimo_pagamento_em, p.valor_restante, 'a_contatar', null
  from public.v_cobranca_presencial p where not exists (select 1 from public.cobrancas x where x.chave = p.chave and x.etapa not in ('paga', 'sem_acordo', 'encerrada'));
  get diagnostics k = row_count; n := n + k;

  update public.cobrancas c set valor_vencido = p.valor_vencido, cobrancas_vencidas = p.vencidas, valor_restante = p.valor_restante,
    parou_em = p.parou_em, venceu_em = p.parou_em, ultimo_pagamento_em = p.ultimo_pagamento_em, telefone = coalesce(c.telefone, p.telefone), atualizado_em = now()
  from public.v_cobranca_presencial p
  where c.chave = p.chave and c.etapa not in ('paga', 'sem_acordo', 'encerrada')
    and (c.valor_vencido is distinct from p.valor_vencido or c.valor_restante is distinct from p.valor_restante or c.parou_em is distinct from p.parou_em);

  with f as (
    update public.cobrancas c set etapa = 'paga', atualizado_em = now()
    where c.origem = 'presencial' and c.etapa not in ('paga', 'sem_acordo', 'encerrada') and not exists (select 1 from public.v_cobranca_presencial p where p.chave = c.chave)
    returning c.id
  )
  insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
  select id, 'sistema', 'Nenhuma parcela atrasada (pagamento lançado na matrícula)', null, 'Sistema' from f;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke all on function public.cobrancas_conferir() from public, anon, authenticated;

-- lista para negativação (só o administrador): CPF vem da Hotmart (hotmart_compradores) ou do cadastro do aluno presencial
create or replace function public.cobrancas_para_negativar() returns table (cobranca_id uuid, nome text, documento text, email text, telefone text, produto text, valor numeric, vencimento date, negativar_ate date, origem text)
language sql stable security definer set search_path = public as $$
  select c.id, c.aluno_nome, coalesce(hc.documento, al.cpf), c.email, c.telefone, c.produto, coalesce(c.valor_vencido, 0), c.parou_em, c.negativar_ate, c.origem
  from public.cobrancas c
  left join public.hotmart_compradores hc on hc.email = c.email
  left join public.matriculas m on m.id = c.matricula_id
  left join public.alunos al on al.id = m.aluno_id
  where is_admin() and c.etapa = 'negativar'
  order by c.parou_em
$$;
revoke all on function public.cobrancas_para_negativar() from public, anon;
grant execute on function public.cobrancas_para_negativar() to authenticated;

-- (008e, 20/10) "vencida" passa a ser pela data: parcela que falta e cuja data já passou (a 1ª em aberto e as seguintes,
-- mês a mês). Quando o plano é cancelado, a Hotmart para de listar as parcelas seguintes, mas a data delas passa do mesmo
-- jeito; contar só a lista da Hotmart escondia R$ 146 mil já vencidos. valor_restante = tudo o que falta do contrato.
-- (a versão em produção da v_cobranca_online é a de academy_008e_cobranca_vencido_por_data; esta acima foi a primeira)

-- (008f, 20/10) plano cancelado pelo vendedor ou pela Hotmart (ex.: mentoria encerrada): deve só o que não pagou até o
-- cancelamento (a lista de parcelas não pagas da Hotmart), não o contrato inteiro. Plano em atraso continua devendo tudo.
-- Versão em produção da v_cobranca_online: academy_008f_cobranca_cancelado_ate_cancelamento.
