// Notificação extrajudicial das cobranças: boleto no Asaas (prazo de N dias), carta por e-mail (Resend), negativação no
// Serasa pelo Asaas, e o aviso do Asaas quando o boleto é pago. Cada passo fica no histórico da cobrança (prova).
// Ações (administrador): testar · enviar {ids} · negativar {ids}. Aviso do Asaas: POST com o cabeçalho asaas-access-token.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { campos, preencher, type Dados } from './modelo.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
const somaDias = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

type Cred = Record<string, string>
async function credenciais(db: SupabaseClient, id: string): Promise<Cred> {
  const { data } = await db.rpc('ler_credenciais_integracao', { p_integracao: id })
  return (data ?? {}) as Cred
}

// ── Asaas ─────────────────────────────────────────────────────────────
const baseAsaas = (k: string) => (k.includes('_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')
async function asaas(k: string, caminho: string, metodo = 'GET', corpo?: unknown) {
  const r = await fetch(baseAsaas(k) + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', access_token: k, 'User-Agent': 'unique-comercial' }, body: corpo ? JSON.stringify(corpo) : undefined })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Asaas: ${(d?.errors ?? []).map((e: { description?: string }) => e.description).join('; ') || r.status}`)
  return d
}

type End = { zip_code?: string; address?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string }
async function clienteAsaas(k: string, c: Dados, doc: string, end: End | null) {
  const achado = await asaas(k, `/customers?cpfCnpj=${doc}`)
  if (achado?.data?.[0]?.id) return achado.data[0].id as string
  const novo = await asaas(k, '/customers', 'POST', {
    name: c.aluno_nome, cpfCnpj: doc, email: c.email, mobilePhone: digitos(c.telefone).replace(/^55(?=\d{10,11}$)/, ''), externalReference: c.id,
    postalCode: digitos(end?.zip_code) || undefined, address: end?.address, addressNumber: end?.number, complement: end?.complement, province: end?.neighborhood,
    notificationDisabled: true,
  })
  return novo.id as string
}

// ── e-mail (Resend) ───────────────────────────────────────────────────
async function enviarEmail(cred: Cred, para: string, assunto: string, texto: string, responderPara: string | null) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cred.api_key}` },
    body: JSON.stringify({ from: cred.remetente, to: [para], subject: assunto, text: texto, ...(responderPara ? { reply_to: responderPara } : {}) }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`E-mail: ${d?.message ?? r.status}`)
  return d.id as string
}

const registrar = (db: SupabaseClient, id: unknown, canal: string, resultado: string, observacao: string | null, quem: string) =>
  db.from('cobranca_contatos').insert({ cobranca_id: id, canal, resultado, observacao, quem_nome: quem })

// dados extras de cada cobrança (CPF, endereço, compra) — a mesma conta da função cobrancas_para_notificar
async function extras(db: SupabaseClient, c: Dados) {
  const [{ data: hc }, { data: o }, { data: pg }] = await Promise.all([
    db.from('hotmart_compradores').select('documento,endereco').eq('email', String(c.email ?? '')).maybeSingle(),
    db.from('v_cobranca_online').select('np,pagas,valor_parcela').eq('chave', String(c.chave)).maybeSingle(),
    db.from('hotmart_pagamentos').select('data_aprovacao').ilike('comprador_email', String(c.email ?? '')).eq('produto_id', c.produto_id ?? -1).order('data_aprovacao').limit(1),
  ])
  return { documento: hc?.documento ?? null, endereco: (hc?.endereco ?? null) as End | null, parcelas_total: o?.np ?? null, parcelas_pagas: o?.pagas ?? null, valor_parcela: o?.valor_parcela ?? null, data_compra: pg?.[0]?.data_aprovacao ?? null }
}

// boleto (se ainda não tem) + carta por e-mail; muda a fase para "notificada" com o prazo
async function notificar(db: SupabaseClient, c: Dados, cfg: Dados, kAsaas: string, email: Cred, quem: string) {
  const ex = await extras(db, c)
  const doc = digitos(ex.documento)
  if (doc.length !== 11 && doc.length !== 14) throw new Error('sem CPF')
  if (!c.email) throw new Error('sem e-mail')
  const prazo = somaDias(hoje(), Number(cfg.prazo_dias ?? 5))
  let boleto = { id: c.boleto_id as string | null, url: c.boleto_url as string | null, valor: c.boleto_valor as number | null }
  if (!boleto.id) {
    const cliente = await clienteAsaas(kAsaas, c, doc, ex.endereco)
    const valor = Math.round(Number(c.valor_restante ?? c.valor_vencido ?? 0) * 100) / 100
    if (!(valor > 0)) throw new Error('sem valor')
    const p = await asaas(kAsaas, '/payments', 'POST', { customer: cliente, billingType: 'UNDEFINED', value: valor, dueDate: prazo, description: `Débito em aberto — ${c.produto}`, externalReference: c.id })
    boleto = { id: p.id, url: p.invoiceUrl ?? p.bankSlipUrl, valor }
  }
  const v = campos({ ...c, boleto_url: boleto.url, boleto_valor: boleto.valor, prazo_ate: prazo }, cfg, { ...ex, endereco: null } as Dados)
  const assunto = preencher(String(cfg.carta_assunto ?? 'Notificação extrajudicial'), v)
  const texto = preencher(String(cfg.carta_modelo ?? ''), v)
  const emailId = await enviarEmail(email, String(c.email), assunto, texto, (cfg.email_contato as string) ?? null)
  await db.from('cobrancas').update({
    fase_legal: 'notificada', notificado_em: new Date().toISOString(), prazo_ate: prazo, boleto_id: boleto.id, boleto_url: boleto.url, boleto_valor: boleto.valor,
    email_id: emailId, email_status: 'enviado', atualizado_em: new Date().toISOString(),
  }).eq('id', c.id)
  await registrar(db, c.id, 'email', `Notificação extrajudicial enviada por e-mail para ${c.email} (prazo ${prazo.split('-').reverse().join('/')})`, `Assunto: ${assunto}\n\n${texto}`, quem)
}

async function negativar(db: SupabaseClient, c: Dados, kAsaas: string, quem: string) {
  if (!c.boleto_id) throw new Error('sem boleto')
  const ex = await extras(db, c)
  const e = ex.endereco
  if (!digitos(e?.zip_code) || !e?.address || !e?.neighborhood) throw new Error('sem endereço completo')
  const d = await asaas(kAsaas, '/paymentDunnings', 'POST', {
    payment: c.boleto_id, type: 'CREDIT_BUREAU', description: `Curso ${c.produto}`, customerName: c.aluno_nome, customerCpfCnpj: digitos(ex.documento),
    customerPrimaryPhone: digitos(c.telefone).replace(/^55(?=\d{10,11}$)/, ''), customerPostalCode: digitos(e.zip_code), customerAddress: e.address,
    customerAddressNumber: e.number || 'S/N', customerComplement: e.complement || undefined, customerProvince: e.neighborhood,
  })
  await db.from('cobrancas').update({ fase_legal: 'negativacao_pedida', negativacao_id: d.id, negativacao_status: d.status ?? 'PENDING', negativacao_pedida_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq('id', c.id)
  await registrar(db, c.id, 'sistema', 'Negativação pedida ao Serasa pelo Asaas', `Pedido ${d.id}. O Serasa envia carta ao endereço do devedor antes de incluir o nome.`, quem)
}

// aviso do Asaas: boleto pago → cobrança paga (e o dinheiro entra como recebimento já conferido); negativação concluída
async function aviso(db: SupabaseClient, ev: Dados & { payment?: Dados; paymentDunning?: Dados }) {
  const tipo = String(ev.event ?? '')
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(tipo) && ev.payment?.id) {
    const { data: c } = await db.from('cobrancas').select('id,etapa').eq('boleto_id', String(ev.payment.id)).maybeSingle()
    if (!c || c.etapa === 'paga') return
    const valor = Number(ev.payment.netValue ?? ev.payment.value ?? 0)
    await db.from('cobranca_recebimentos').insert({ cobranca_id: c.id, valor: Number(ev.payment.value ?? valor), recebido_em: String(ev.payment.paymentDate ?? ev.payment.clientPaymentDate ?? hoje()), forma: 'boleto', observacao: `Pago pelo Asaas (líquido ${valor})`, informado_nome: 'Asaas', conferido: true, conferido_em: new Date().toISOString() })
    await db.from('cobrancas').update({ etapa: 'paga', fase_legal: 'paga', atualizado_em: new Date().toISOString() }).eq('id', c.id)
    await registrar(db, c.id, 'sistema', 'Pagou o boleto da notificação (Asaas confirmou)', 'Lembrete: dar baixa na Hotmart, se a compra ainda estiver sendo cobrada lá.', 'Asaas')
  }
  const dun = ev.paymentDunning
  if (tipo.startsWith('PAYMENT_DUNNING') && dun?.id) {
    const { data: c } = await db.from('cobrancas').select('id').eq('negativacao_id', String(dun.id)).maybeSingle()
    if (!c) return
    const feita = tipo === 'PAYMENT_DUNNING_RECEIVED'
    await db.from('cobrancas').update({ negativacao_status: String(dun.status ?? tipo), ...(feita ? { fase_legal: 'negativada', etapa: 'negativado', negativado_em: hoje() } : {}), atualizado_em: new Date().toISOString() }).eq('id', c.id)
    await registrar(db, c.id, 'sistema', feita ? 'Nome negativado no Serasa' : `Negativação: ${dun.status ?? tipo}`, null, 'Asaas')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const tokenAviso = req.headers.get('asaas-access-token')
  if (tokenAviso) {
    const cred = await credenciais(db, 'asaas')
    if (!cred.webhook_token || cred.webhook_token !== tokenAviso) return json({ erro: 'não autorizado' }, 401)
    await aviso(db, await req.json().catch(() => ({})))
    return json({ ok: true })
  }

  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador envia notificações.' }, 403)
  const { data: perfil } = await usuario.auth.getUser()
  const quem = String(perfil?.user?.user_metadata?.nome ?? perfil?.user?.email ?? 'Administrador')
  const corpo = await req.json().catch(() => ({}))
  const acao = String(corpo.acao ?? '')
  const [kAsaas, email] = await Promise.all([credenciais(db, 'asaas').then((c) => c.api_key ?? ''), credenciais(db, 'email')])

  if (acao === 'testar') {
    const r: Record<string, unknown> = {}
    try { const conta = await asaas(kAsaas, '/myAccount'); r.asaas = { ok: true, conta: conta?.name ?? conta?.companyName ?? 'ok', ambiente: kAsaas.includes('_hmlg_') ? 'teste' : 'produção' } } catch (e) { r.asaas = { ok: false, erro: kAsaas ? (e as Error).message : 'sem chave' } }
    r.email = email.api_key && email.remetente ? { ok: true, remetente: email.remetente } : { ok: false, erro: 'falta a chave ou o remetente' }
    return json(r)
  }

  const ids = (corpo.ids ?? []) as string[]
  if (!ids.length || ids.length > 300) return json({ erro: 'Escolha de 1 a 300 cobranças.' }, 400)
  const [{ data: lista }, { data: cfg }] = await Promise.all([
    db.from('cobrancas').select('*').in('id', ids),
    db.from('cobranca_config').select('*').eq('id', true).single(),
  ])
  if (!kAsaas) return json({ erro: 'Cadastre a chave do Asaas em Integrações.' }, 400)
  const feitos: string[] = [], falhas: { id: string; nome: string; motivo: string }[] = []
  for (const c of (lista ?? []) as Dados[]) {
    try {
      if (acao === 'enviar') {
        if (!email.api_key || !email.remetente) throw new Error('cadastre o e-mail em Integrações')
        if (!cfg?.razao_social || !cfg?.cnpj) throw new Error('preencha os dados da empresa')
        await notificar(db, c, cfg as Dados, kAsaas, email, quem)
      } else if (acao === 'negativar') await negativar(db, c, kAsaas, quem)
      else throw new Error('ação desconhecida')
      feitos.push(String(c.id))
    } catch (e) { falhas.push({ id: String(c.id), nome: String(c.aluno_nome ?? ''), motivo: (e as Error).message }) }
  }
  return json({ ok: true, feitos: feitos.length, falhas })
})
