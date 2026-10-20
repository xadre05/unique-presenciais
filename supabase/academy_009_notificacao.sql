-- Notificação extrajudicial (20/10/2026). Fluxo para quem deve: boleto no Asaas com prazo (5 dias), carta por e-mail
-- (Resend), aviso por WhatsApp, e negativação no Serasa pelo Asaas para quem não pagar. Cada passo fica registrado no
-- histórico da cobrança (data, hora, conteúdo enviado), que serve de prova e vira o dossiê para o advogado.
-- Sem apagar nada: a etapa da conversa (etapa) continua; o andamento legal fica numa coluna própria (fase_legal).

-- 1. integrações novas (credenciais no cofre, como as da Hotmart)
insert into public.integracoes (id, nome, tipo, descricao, traz_ofertas, traz_pagamentos, ativa, ordem) values
  ('asaas', 'Asaas — boleto e negativação', 'outro', 'Gera os boletos das notificações e pede a negativação no Serasa de quem não pagar.', false, false, true, 50),
  ('email', 'E-mail (Resend)', 'outro', 'Envia as notificações por e-mail com o domínio da empresa e guarda a confirmação de entrega.', false, false, true, 51)
on conflict (id) do nothing;

create or replace function public.salvar_credencial_integracao(p_integracao text, p_campo text, p_valor text)
returns void language plpgsql security definer set search_path to 'public', 'vault' as $function$
declare v_nome text; v_id uuid;
begin
  if not is_admin() then raise exception 'Só o administrador pode cadastrar credenciais.'; end if;
  if p_campo not in ('client_id', 'client_secret', 'basic', 'hottok', 'api_key', 'webhook_token', 'remetente') then raise exception 'Campo inválido.'; end if;
  if not exists (select 1 from integracoes where id = p_integracao) then raise exception 'Integração não encontrada.'; end if;
  if coalesce(trim(p_valor), '') = '' then raise exception 'Valor vazio.'; end if;
  v_nome := 'integ:' || p_integracao || ':' || p_campo;
  select id into v_id from vault.secrets where name = v_nome;
  if v_id is null then perform vault.create_secret(trim(p_valor), v_nome);
  else perform vault.update_secret(v_id, trim(p_valor)); end if;
  update integracoes set credenciais_em = now(), ultimo_teste_ok = null where id = p_integracao;
end $function$;

-- 2. andamento legal de cada cobrança
alter table public.cobrancas
  add column if not exists fase_legal text check (fase_legal in ('preparada', 'notificada', 'prazo_vencido', 'negativacao_pedida', 'negativada', 'advogado', 'paga')),
  add column if not exists notificado_em timestamptz,
  add column if not exists prazo_ate date,
  add column if not exists boleto_id text,
  add column if not exists boleto_url text,
  add column if not exists boleto_valor numeric(12,2),
  add column if not exists email_id text,
  add column if not exists email_status text,
  add column if not exists whatsapp_avisado_em timestamptz,
  add column if not exists negativacao_id text,
  add column if not exists negativacao_status text,
  add column if not exists negativacao_pedida_em timestamptz;
create index if not exists cobrancas_fase_legal on public.cobrancas (fase_legal, prazo_ate);

-- 3. dados da empresa e modelos (carta e WhatsApp) — editáveis na tela
alter table public.cobranca_config
  add column if not exists razao_social text,
  add column if not exists cnpj text,
  add column if not exists endereco text,
  add column if not exists cidade text,
  add column if not exists email_contato text,
  add column if not exists whatsapp_contato text,
  add column if not exists remetente_nome text,
  add column if not exists prazo_dias integer not null default 5,
  add column if not exists carta_assunto text,
  add column if not exists carta_modelo text,
  add column if not exists whatsapp_modelo text;
update public.cobranca_config set
  carta_assunto = coalesce(carta_assunto, 'Notificação extrajudicial — débito em aberto referente a {produto}'),
  carta_modelo = coalesce(carta_modelo, $c$NOTIFICAÇÃO EXTRAJUDICIAL

{cidade}, {data_envio}

Notificante: {razao_social}, CNPJ {cnpj}, com sede em {endereco}.
Notificado(a): {nome}, CPF {cpf}, e-mail {email}.

Prezado(a) {primeiro_nome},

Em {data_compra}, você adquiriu o curso {produto} pela plataforma Hotmart, em {parcelas_total} parcelas de {valor_parcela}. Foram pagas {parcelas_pagas} parcelas. Desde {primeira_em_aberto} não há pagamento, restando em aberto {parcelas_em_aberto} parcelas, no total de {valor_total}. O acesso ao curso permaneceu disponível durante todo esse período.

Pela presente, fica Vossa Senhoria NOTIFICADO(A) a quitar o débito até {prazo}, por meio do boleto disponível em: {link_boleto}

Caso o pagamento não seja realizado no prazo, o débito será encaminhado para inscrição nos órgãos de proteção ao crédito, sem prejuízo da cobrança judicial, acrescida dos encargos legais e contratuais cabíveis.

Se o pagamento já tiver sido feito, desconsidere esta notificação e nos envie o comprovante para {email_contato} ou pelo WhatsApp {whatsapp_contato}, para que possamos dar baixa.

Atenciosamente,
{razao_social}$c$),
  whatsapp_modelo = coalesce(whatsapp_modelo, $w$Olá, {primeiro_nome}. Aqui é da {remetente_nome}. Enviamos hoje ao seu e-mail ({email}) uma notificação sobre o curso {produto}, com boleto de {valor_total} para pagamento até {prazo}. Se não recebeu, responda esta mensagem que reenviamos. Se já pagou, nos mande o comprovante.$w$),
  remetente_nome = coalesce(remetente_nome, 'Unique HOF Academy')
where id;

-- 4. endereço do comprador (a Hotmart informa; o Serasa manda a carta para ele)
alter table public.hotmart_compradores add column if not exists endereco jsonb;
create or replace function public.compradores_sem_documento(p_integracao text, p_limite integer default 150)
returns table (email text, transacao text) language sql stable security definer set search_path = public as $$
  with devendo as (
    select distinct a.email from public.hotmart_assinaturas a
    where a.integracao_id = p_integracao and a.email is not null and upper(a.status) not in ('ACTIVE', 'STARTED')
    union
    select distinct oc.em from public.v_online_compras oc where oc.integracao_id = p_integracao and oc.situacao in ('atrasado', 'desistiu')
  )
  select d.email, (select h.transacao from public.hotmart_pagamentos h where lower(h.comprador_email) = d.email and h.integracao_id = p_integracao order by h.data_aprovacao desc nulls last limit 1)
  from devendo d
  where not exists (select 1 from public.hotmart_compradores c where c.email = d.email and c.endereco is not null)
    and exists (select 1 from public.hotmart_pagamentos h where lower(h.comprador_email) = d.email and h.integracao_id = p_integracao)
  limit p_limite
$$;
revoke all on function public.compradores_sem_documento(text, integer) from public, anon, authenticated;
grant execute on function public.compradores_sem_documento(text, integer) to service_role;

-- 5. o que a tela de notificação precisa de cada cobrança (só o administrador: tem CPF e endereço)
create or replace function public.cobrancas_para_notificar() returns table (
  cobranca_id uuid, documento text, endereco jsonb, data_compra date, parcelas_total integer, parcelas_pagas integer, valor_parcela numeric
) language sql stable security definer set search_path = public as $$
  select c.id, coalesce(hc.documento, al.cpf), hc.endereco,
    (select min(h.data_aprovacao)::date from public.hotmart_pagamentos h where lower(h.comprador_email) = c.email and h.produto_id = c.produto_id),
    o.np, o.pagas::int, o.valor_parcela
  from public.cobrancas c
  left join public.hotmart_compradores hc on hc.email = c.email
  left join public.v_cobranca_online o on o.chave = c.chave
  left join public.matriculas m on m.id = c.matricula_id
  left join public.alunos al on al.id = m.aluno_id
  where is_admin() and c.etapa not in ('paga', 'sem_acordo', 'encerrada')
$$;
revoke all on function public.cobrancas_para_notificar() from public, anon;
grant execute on function public.cobrancas_para_notificar() to authenticated;

-- 6. prazo vencido sem pagamento: passa sozinho para "prazo vencido" (de hora em hora, junto com a conferência)
create or replace function public.cobrancas_prazo_vencido() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with f as (
    update public.cobrancas set fase_legal = 'prazo_vencido', atualizado_em = now()
    where fase_legal = 'notificada' and prazo_ate < current_date and etapa not in ('paga', 'sem_acordo', 'encerrada')
    returning id
  )
  insert into public.cobranca_contatos (cobranca_id, canal, resultado, quem, quem_nome)
  select id, 'sistema', 'Prazo da notificação venceu sem pagamento', null, 'Sistema' from f;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cobrancas_prazo_vencido() from public, anon, authenticated;
select cron.schedule('cobrancas-prazo', '35 * * * *', $cron$ select public.cobrancas_prazo_vencido() $cron$);
