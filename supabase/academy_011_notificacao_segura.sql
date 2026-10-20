-- 011 (20/10/2026): notificação extrajudicial com as travas que o advogado pediu.
--  * só depois de o advogado liberar (data e quem marcou ficam gravados);
--  * só compras até a data de corte (as mais novas podem ter tido antecipação ou negativação pela própria Hotmart);
--  * cobra só as parcelas que já venceram + multa e juros de mora (percentuais ajustáveis);
--  * uma carta e um boleto por CPF, somando os cursos;
--  * só em horário comercial;
--  * quem tem alguma dúvida nos números vai para "Conferir na Hotmart" e só pode ser notificado depois de conferido.
alter table public.cobranca_config
  add column if not exists advogado_liberou_em timestamptz,
  add column if not exists advogado_liberou_por text,
  add column if not exists compra_ate date not null default '2024-12-31',
  add column if not exists multa_pct numeric not null default 2,
  add column if not exists juros_mes_pct numeric not null default 1;

alter table public.cobrancas
  add column if not exists conferido_hotmart_em timestamptz,
  add column if not exists conferido_hotmart_por text,
  add column if not exists conferido_hotmart_obs text,
  add column if not exists notificacao_grupo uuid,
  add column if not exists boleto_principal numeric,
  add column if not exists boleto_encargos numeric;
create index if not exists cobrancas_boleto on public.cobrancas (boleto_id);

-- por cobrança online: CPF, data da compra, tipo de plano e as dúvidas que pedem conferência na Hotmart antes de notificar
create or replace view public.v_cobranca_conferencia with (security_invoker = true) as
  with k as (
    select k.id, k.chave, lower(k.email) email, k.produto_id, v.np, v.pagas, v.vencidas, v.status_hotmart, v.valor_parcela, v.parou_em
    from cobrancas k join v_cobranca_online v on v.chave = k.chave
    where k.origem = 'online'
  ), pg as (
    select lower(comprador_email) email, produto_id, count(distinct coalesce(oferta_codigo, '') || '|' || coalesce(parcelas_cartao, 0)) contratos,
      sum(valor) filter (where status in ('APPROVED', 'COMPLETE')) soma, min(data_aprovacao) primeira
    from hotmart_pagamentos where recorrencia is not null group by 1, 2
  ), ass as (
    select lower(email) email, produto_id, count(*) n, min(adesao) adesao,
      max(nao_pagas) filter (where status = 'DELAYED') nao_pagas,
      (array_agg(tipo order by (status = 'DELAYED') desc, adesao desc nulls last))[1] tipo
    from hotmart_assinaturas where tipo is distinct from 'SUBSCRIPTION' group by 1, 2
  )
  select k.id cobranca_id, hc.documento cpf, coalesce(ass.adesao, pg.primeira)::date compra_em, ass.tipo tipo_plano, ass.nao_pagas nao_pagas_hotmart,
    array_remove(array[
      case when coalesce(ass.n, 0) > 1 or coalesce(pg.contratos, 0) > 1 then 'mais de um contrato do mesmo curso: conferir quais parcelas são de qual' end,
      case when k.valor_parcela > 0 and abs(pg.soma / k.valor_parcela - round(pg.soma / k.valor_parcela)) > 0.05 then 'o total pago não fecha com o valor da parcela' end,
      case when k.status_hotmart like '%DELAYED%' and ass.nao_pagas is distinct from k.vencidas
        then 'a Hotmart lista ' || coalesce(ass.nao_pagas, 0) || ' parcela(s) em aberto e o sistema conta ' || k.vencidas || ' vencida(s)' end,
      case when k.status_hotmart like 'CANCELLED%' then 'plano cancelado: conferir a data do cancelamento' end
    ], null) duvidas,
    k.np, k.pagas, k.vencidas, k.valor_parcela, k.parou_em, k.status_hotmart   -- 011b: a tela calcula o valor da carta com isso
  from k
  left join pg on pg.email = k.email and pg.produto_id = k.produto_id
  left join ass on ass.email = k.email and ass.produto_id = k.produto_id
  left join hotmart_compradores hc on hc.email = k.email;
revoke all on public.v_cobranca_conferencia from anon;
grant select on public.v_cobranca_conferencia to authenticated;

-- carta nova: uma por pessoa, com o detalhamento de cada curso e os encargos separados (o advogado revisa antes do 1º envio)
update public.cobranca_config set
  carta_assunto = 'Notificação extrajudicial — débito em aberto',
  carta_modelo = $c$NOTIFICAÇÃO EXTRAJUDICIAL

{cidade}, {data_envio}

Notificante: {razao_social}, CNPJ {cnpj}, com sede em {endereco}.
Notificado(a): {nome}, CPF {cpf}, e-mail {email}.

Prezado(a) {primeiro_nome},

Consta em aberto, em seu nome, o pagamento do(s) curso(s) abaixo, adquirido(s) pela plataforma Hotmart. O acesso ao conteúdo permaneceu disponível durante todo o período.

{detalhamento}

Parcelas vencidas e não pagas: {valor_principal}
Multa de {multa_pct} e juros de mora de {juros_pct} ao mês: {valor_encargos}
Total para pagamento: {valor_total}

Pela presente, fica Vossa Senhoria NOTIFICADO(A) a quitar o débito até {prazo}, por meio do boleto disponível em: {link_boleto}

Caso o pagamento não seja realizado no prazo, o débito será encaminhado para inscrição nos órgãos de proteção ao crédito, sem prejuízo da cobrança judicial.

Se o pagamento já tiver sido feito, desconsidere esta notificação e nos envie o comprovante para {email_contato} ou pelo WhatsApp {whatsapp_contato}, para que possamos dar baixa.

Atenciosamente,
{razao_social}$c$,
  whatsapp_modelo = $w$Olá, {primeiro_nome}. Aqui é da {remetente_nome}. Enviamos hoje ao seu e-mail ({email}) uma notificação sobre um débito em aberto, com boleto de {valor_total} para pagamento até {prazo}. Se não recebeu, responda esta mensagem que reenviamos. Se já pagou, nos mande o comprovante.$w$
where id and razao_social is null and md5(carta_modelo) = 'c04f75af8593b6f3ade84d7b1164b386';
