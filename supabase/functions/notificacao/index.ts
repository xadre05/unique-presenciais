// Notificação extrajudicial das cobranças: boleto com Pix no Banco Inter (ou no Asaas, se o Inter não estiver configurado),
// prazo de N dias, carta por e-mail (Gmail da empresa), negativação no Serasa pelo Asaas e o aviso de pagamento.
// Cada passo fica no histórico da cobrança (prova).
// Ações (administrador): testar · inter_aviso · enviar {ids} · negativar {ids}.
// Avisos de pagamento: Asaas (cabeçalho asaas-access-token) e Inter (?aviso=inter; o sistema confere no Inter antes de dar baixa).
// Travas (orientação do advogado): só depois de ele liberar a carta, só compras até a data de corte, só parcelas vencidas
// (+ multa e juros), uma carta e um boleto por CPF, só em horário comercial, Hotmart lida há menos de 2 horas.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { campos, contaItem, horarioComercial, preencher, type Dados, type Item } from './modelo.ts'
import { emailPronto, enviarEmail } from './email.ts'
import { cadastrarAviso, conferirAcesso, consultarBoleto, emitirBoleto, enderecoBoleto, interPronto, usarInter, type CredInter } from './inter.ts'

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

const registrar = (db: SupabaseClient, id: unknown, canal: string, resultado: string, observacao: string | null, quem: string) =>
  db.from('cobranca_contatos').insert({ cobranca_id: id, canal, resultado, observacao, quem_nome: quem })

const FECHADAS = ['paga', 'sem_acordo', 'encerrada']
type Linha = { c: Dados; item: Item; cpf: string; end: End | null }

// junta tudo o que a carta e o boleto precisam de cada cobrança, e diz por que ela não pode ser notificada (se for o caso)
async function preparar(db: SupabaseClient, cs: Dados[], cfg: Dados, exigeEndereco = false) {
  const ids = cs.map((c) => String(c.id))
  const chaves = cs.map((c) => String(c.chave))
  const emails = [...new Set(cs.map((c) => String(c.email ?? '').toLowerCase()).filter(Boolean))]
  const [{ data: conf }, { data: on }, { data: hc }, { data: pg }] = await Promise.all([
    db.from('v_cobranca_conferencia').select('*').in('cobranca_id', ids),
    db.from('v_cobranca_online').select('chave,np,pagas,valor_parcela,vencidas,parou_em').in('chave', chaves),
    db.from('hotmart_compradores').select('email,documento,endereco').in('email', emails),
    db.from('hotmart_pagamentos').select('comprador_email,produto_id,data_aprovacao').in('comprador_email', emails).not('recorrencia', 'is', null).order('data_aprovacao').limit(5000),
  ])
  const cMap = new Map((conf ?? []).map((x) => [String(x.cobranca_id), x]))
  const oMap = new Map((on ?? []).map((x) => [String(x.chave), x]))
  const hMap = new Map((hc ?? []).map((x) => [String(x.email), x]))
  const ok: Linha[] = [], fora: { c: Dados; motivo: string }[] = []
  for (const c of cs) {
    const k = cMap.get(String(c.id)), o = oMap.get(String(c.chave)), h = hMap.get(String(c.email ?? '').toLowerCase())
    const doc = digitos(k?.cpf ?? h?.documento)
    const motivo = FECHADAS.includes(String(c.etapa)) ? 'já está resolvida'
      : c.origem !== 'online' ? 'presencial: aguardando o contrato assinado ir para o advogado'
      : c.fase_legal ? 'já foi notificada'
      : !o ? 'não está mais em aberto na Hotmart (pode ter pago): conferir'
      : !k?.compra_em || String(k.compra_em) > String(cfg.compra_ate) ? `compra depois de ${String(cfg.compra_ate).split('-').reverse().join('/')}: aguardando a posição da Hotmart`
      : (k?.duvidas ?? []).length && !c.conferido_hotmart_em ? `conferir na Hotmart: ${(k.duvidas as string[]).join('; ')}`
      : doc.length !== 11 && doc.length !== 14 ? 'sem CPF'
      : !c.email ? 'sem e-mail'
      : exigeEndereco && !enderecoBoleto((h?.endereco ?? null) as End | null) ? 'sem endereço completo (o banco exige no boleto)'
      : !(Number(o.vencidas) > 0) ? 'nenhuma parcela vencida'
      : null
    if (motivo || !o) { fora.push({ c, motivo: motivo ?? 'sem dados' }); continue }
    const primeira = (pg ?? []).find((p) => String(p.comprador_email).toLowerCase() === String(c.email).toLowerCase() && p.produto_id === c.produto_id)
    ok.push({ c, cpf: doc, end: (h?.endereco ?? null) as End | null, item: {
      produto: String(c.produto ?? 'curso'), data_compra: primeira?.data_aprovacao ?? k?.compra_em ?? null, parcelas_total: o.np, parcelas_pagas: o.pagas,
      valor_parcela: Number(o.valor_parcela), parou_em: o.parou_em, vencidas: Number(o.vencidas),
    } })
  }
  return { ok, fora }
}

// uma carta e um boleto por CPF, somando os cursos; muda a fase de todas para "notificada" com o prazo
type Banco = { inter: CredInter | null; kAsaas: string }
type Boleto = { id: string; url: string; banco: string; linha?: string; pix?: string }

// boleto com Pix no Inter: o PDF fica guardado no sistema e o link (válido por 90 dias) vai na carta
async function boletoInter(db: SupabaseClient, cred: CredInter, g: Linha, total: number, prazo: string, grupoId: string, produtos: string): Promise<Boleto> {
  const p = g.c
  const b = await usarInter(cred, (x) => emitirBoleto(x, { seuNumero: grupoId.replace(/-/g, '').slice(0, 15), valor: total, vencimento: prazo,
    pagador: { nome: String(p.aluno_nome ?? ''), cpf: g.cpf, email: String(p.email ?? ''), telefone: String(p.telefone ?? ''), end: g.end },
    linhas: [`Débito em aberto: ${produtos}`, 'Referente à notificação extrajudicial enviada por e-mail.', 'Dúvidas e comprovantes: responda o e-mail da notificação.'] }))
  let url = ''
  if (b.pdf) {
    const caminho = `cobranca/boletos/${grupoId}.pdf`
    const { error } = await db.storage.from('arquivos').upload(caminho, new Blob([b.pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true })
    if (!error) url = (await db.storage.from('arquivos').createSignedUrl(caminho, 90 * 86400)).data?.signedUrl ?? ''
  }
  return { id: b.codigo, url: url || `Linha digitável: ${b.linha}`, banco: 'inter', linha: b.linha, pix: b.pix }
}
async function boletoAsaas(kAsaas: string, g: Linha, total: number, prazo: string, grupoId: string, produtos: string): Promise<Boleto> {
  const cliente = await clienteAsaas(kAsaas, g.c, g.cpf, g.end)
  const pag = await asaas(kAsaas, '/payments', 'POST', { customer: cliente, billingType: 'UNDEFINED', value: total, dueDate: prazo,
    description: `Débito em aberto — ${produtos}`.slice(0, 480), externalReference: grupoId })
  return { id: String(pag.id), url: String(pag.invoiceUrl ?? pag.bankSlipUrl), banco: 'asaas' }
}

async function notificarPessoa(db: SupabaseClient, grupo: Linha[], cfg: Dados, banco: Banco, email: Cred, quem: string) {
  const p = grupo[0].c
  const dia = hoje(), prazo = somaDias(dia, Number(cfg.prazo_dias ?? 5))
  const m = Number(cfg.multa_pct ?? 2), j = Number(cfg.juros_mes_pct ?? 1)
  const contas = grupo.map((g) => contaItem(g.item, dia, m, j))
  const total = Math.round(contas.reduce((s, x) => s + x.total, 0) * 100) / 100
  if (!(total > 0)) throw new Error('sem valor')
  const grupoId = crypto.randomUUID()
  const produtos = grupo.map((g) => g.item.produto).join(', ')
  const bol = banco.inter ? await boletoInter(db, banco.inter, grupo[0], total, prazo, grupoId, produtos) : await boletoAsaas(banco.kAsaas, grupo[0], total, prazo, grupoId, produtos)
  const url = bol.url
  const v = campos({ ...p, documento: grupo[0].cpf, boleto_url: url, boleto_valor: total, prazo_ate: prazo, boleto_linha: bol.linha ?? '', boleto_pix: bol.pix ?? '' }, grupo.map((g) => g.item), cfg, dia)
  const assunto = preencher(String(cfg.carta_assunto ?? 'Notificação extrajudicial'), v)
  const texto = preencher(String(cfg.carta_modelo ?? ''), v)
  const emailId = await enviarEmail(email, String(p.email), assunto, texto, (cfg.email_contato as string) ?? null)
  const agora = new Date().toISOString()
  for (let i = 0; i < grupo.length; i++) {
    const c = grupo[i].c
    await db.from('cobrancas').update({
      fase_legal: 'notificada', notificado_em: agora, prazo_ate: prazo, boleto_id: bol.id, boleto_url: url, boleto_banco: bol.banco, boleto_linha: bol.linha ?? null, boleto_pix: bol.pix ?? null, boleto_valor: contas[i].total,
      boleto_principal: contas[i].principal, boleto_encargos: contas[i].encargos, notificacao_grupo: grupoId, email_id: emailId, email_status: 'enviado', atualizado_em: agora,
    }).eq('id', c.id)
    await registrar(db, c.id, 'email', `Notificação extrajudicial enviada por e-mail para ${p.email} (prazo ${prazo.split('-').reverse().join('/')}; boleto de ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${grupo.length > 1 ? `, somando ${grupo.length} cursos` : ''})`, `Assunto: ${assunto}\n\n${texto}`, quem)
  }
}

// negativação: uma por boleto (o boleto já soma os cursos da pessoa); antes, confere de novo se continua em aberto na Hotmart
async function negativarBoleto(db: SupabaseClient, grupo: Dados[], kAsaas: string, quem: string) {
  const c = grupo[0]
  const limite = somaDias(hoje(), -5)
  if (grupo.some((x) => x.fase_legal !== 'prazo_vencido' || !x.prazo_ate || String(x.prazo_ate) > limite)) throw new Error('o prazo ainda não venceu há 5 dias')
  const { data: on } = await db.from('v_cobranca_online').select('chave,vencidas,valor_parcela').in('chave', grupo.map((x) => String(x.chave)))
  for (const x of grupo) {
    const o = (on ?? []).find((y) => y.chave === x.chave)
    if (!o) throw new Error('não está mais em aberto na Hotmart: conferir antes de negativar')
    if (Math.round(Number(o.vencidas) * Number(o.valor_parcela) * 100) < Math.round(Number(x.boleto_principal ?? 0) * 100)) throw new Error('pagou alguma parcela na Hotmart depois da notificação: conferir antes de negativar')
  }
  const { data: hc } = await db.from('hotmart_compradores').select('documento,endereco').eq('email', String(c.email ?? '').toLowerCase()).maybeSingle()
  const e = (hc?.endereco ?? null) as End | null
  if (!digitos(e?.zip_code) || !e?.address || !e?.neighborhood) throw new Error('sem endereço completo')
  const d = await asaas(kAsaas, '/paymentDunnings', 'POST', {
    payment: c.boleto_id, type: 'CREDIT_BUREAU', description: `Curso(s): ${grupo.map((x) => x.produto).join(', ')}`.slice(0, 480), customerName: c.aluno_nome, customerCpfCnpj: digitos(hc?.documento),
    customerPrimaryPhone: digitos(c.telefone).replace(/^55(?=\d{10,11}$)/, ''), customerPostalCode: digitos(e.zip_code), customerAddress: e.address,
    customerAddressNumber: e.number || 'S/N', customerComplement: e.complement || undefined, customerProvince: e.neighborhood,
  })
  const agora = new Date().toISOString()
  for (const x of grupo) {
    await db.from('cobrancas').update({ fase_legal: 'negativacao_pedida', negativacao_id: d.id, negativacao_status: d.status ?? 'PENDING', negativacao_pedida_em: agora, atualizado_em: agora }).eq('id', x.id)
    await registrar(db, x.id, 'sistema', 'Negativação pedida ao Serasa pelo Asaas', `Pedido ${d.id}. O Serasa envia carta ao endereço do devedor antes de incluir o nome.`, quem)
  }
}

// boleto pago → cobrança paga (o dinheiro entra como recebimento já conferido, dividido entre os cursos do boleto)
async function marcarPago(db: SupabaseClient, boletoId: string, pago: number, quando: string, quem: string, obs: string) {
  const { data: cs } = await db.from('cobrancas').select('id,etapa,boleto_valor').eq('boleto_id', boletoId)
  const pendentes = (cs ?? []).filter((c) => c.etapa !== 'paga')
  if (!pendentes.length) return
  const soma = pendentes.reduce((s, c) => s + Number(c.boleto_valor ?? 0), 0) || pendentes.length
  for (const c of pendentes) {
    const parte = Math.round(pago * (Number(c.boleto_valor ?? 0) || 1) / soma * 100) / 100
    await db.from('cobranca_recebimentos').insert({ cobranca_id: c.id, valor: parte, recebido_em: quando, forma: 'boleto', observacao: obs, informado_nome: quem, conferido: true, conferido_em: new Date().toISOString() })
    await db.from('cobrancas').update({ etapa: 'paga', fase_legal: 'paga', atualizado_em: new Date().toISOString() }).eq('id', c.id)
    await registrar(db, c.id, 'sistema', `Pagou o boleto da notificação (${quem} confirmou)`, 'Lembrete: dar baixa na Hotmart, se a compra ainda estiver sendo cobrada lá.', quem)
  }
}

// aviso do Inter: chega sem assinatura, então o sistema consulta cada boleto no Inter antes de dar baixa
async function avisoInter(db: SupabaseClient, cred: CredInter, lista: Dados[]) {
  const codigos = [...new Set((Array.isArray(lista) ? lista : []).map((x) => String(x.codigoSolicitacao ?? '')).filter(Boolean))].slice(0, 50)
  if (!codigos.length || !interPronto(cred)) return
  await usarInter(cred, async (x) => {
    for (const codigo of codigos) {
      const d = await consultarBoleto(x, codigo).catch(() => null)
      const cob = d?.cobranca
      if (!cob || !['RECEBIDO', 'MARCADO_RECEBIDO'].includes(String(cob.situacao))) continue
      await marcarPago(db, codigo, Number(cob.valorTotalRecebido ?? cob.valorNominal ?? 0), String(cob.dataSituacao ?? hoje()).slice(0, 10), 'Inter', `Pago pelo Inter (${cob.origemRecebimento ?? 'boleto'}, ${cob.valorTotalRecebido ?? cob.valorNominal})`)
    }
  })
}

// aviso do Asaas: boleto pago → cobrança paga; negativação concluída
async function aviso(db: SupabaseClient, ev: Dados & { payment?: Dados; paymentDunning?: Dados }) {
  const tipo = String(ev.event ?? '')
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(tipo) && ev.payment?.id) {
    const pago = Number(ev.payment.value ?? 0), liquido = Number(ev.payment.netValue ?? pago)
    await marcarPago(db, String(ev.payment.id), pago, String(ev.payment.paymentDate ?? ev.payment.clientPaymentDate ?? hoje()), 'Asaas', `Pago pelo Asaas (boleto de ${pago}, líquido ${liquido})`)
  }
  const dun = ev.paymentDunning
  if (tipo.startsWith('PAYMENT_DUNNING') && dun?.id) {
    const { data: cs } = await db.from('cobrancas').select('id').eq('negativacao_id', String(dun.id))
    const feita = tipo === 'PAYMENT_DUNNING_RECEIVED'
    for (const c of cs ?? []) {
      await db.from('cobrancas').update({ negativacao_status: String(dun.status ?? tipo), ...(feita ? { fase_legal: 'negativada', etapa: 'negativado', negativado_em: hoje() } : {}), atualizado_em: new Date().toISOString() }).eq('id', c.id)
      await registrar(db, c.id, 'sistema', feita ? 'Nome negativado no Serasa' : `Negativação: ${dun.status ?? tipo}`, null, 'Asaas')
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  if (new URL(req.url).searchParams.get('aviso') === 'inter') {
    await avisoInter(db, await credenciais(db, 'inter'), await req.json().catch(() => []))
    return json({ ok: true })
  }
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
  const [kAsaas, email, cInter] = await Promise.all([credenciais(db, 'asaas').then((c) => c.api_key ?? ''), credenciais(db, 'email'), credenciais(db, 'inter')])
  const banco: Banco = { inter: interPronto(cInter) ? cInter : null, kAsaas }

  if (acao === 'testar') {
    const r: Record<string, unknown> = {}
    try { const conta = await asaas(kAsaas, '/myAccount'); r.asaas = { ok: true, conta: conta?.name ?? conta?.companyName ?? 'ok', ambiente: kAsaas.includes('_hmlg_') ? 'teste' : 'produção' } } catch (e) { r.asaas = { ok: false, erro: kAsaas ? (e as Error).message : 'sem chave' } }
    if (!banco.inter) r.inter = { ok: false, erro: 'faltam o Client ID, o Client Secret, o certificado ou a chave' }
    else try { await usarInter(banco.inter, conferirAcesso); r.inter = { ok: true } } catch (e) { r.inter = { ok: false, erro: (e as Error).message } }
    // o teste do e-mail manda uma mensagem curta para o próprio remetente (confirma usuário, senha de app e remetente)
    if (!emailPronto(email)) r.email = { ok: false, erro: 'falta o usuário, a senha de app ou o remetente' }
    else try {
      const para = email.remetente.match(/<([^>]+)>/)?.[1] ?? email.remetente
      await enviarEmail(email, para, 'Teste do envio de cobranças', `Este é um teste do envio de notificações do sistema (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}). Se chegou, está funcionando.`, null)
      r.email = { ok: true, remetente: email.remetente, para }
    } catch (e) { r.email = { ok: false, erro: (e as Error).message } }
    return json(r)
  }

  // cadastra no Inter o endereço do aviso de pagamento (uma vez, depois de configurar a integração)
  if (acao === 'inter_aviso') {
    if (!banco.inter) return json({ erro: 'Configure o Banco Inter primeiro.' }, 400)
    try { await usarInter(banco.inter, (x) => cadastrarAviso(x, `${url}/functions/v1/notificacao?aviso=inter`)); return json({ ok: true }) }
    catch (e) { return json({ erro: (e as Error).message }, 400) }
  }

  const ids = (corpo.ids ?? []) as string[]
  if (!ids.length || ids.length > 300) return json({ erro: 'Escolha de 1 a 300 cobranças.' }, 400)
  if (acao === 'enviar' && !banco.inter && !kAsaas) return json({ erro: 'Configure o Banco Inter (boleto) em Integrações.' }, 400)
  if (acao === 'negativar' && !kAsaas) return json({ erro: 'A negativação automática precisa do Asaas. Sem ele, faça o protesto pelo Inter ou o Serasa direto.' }, 400)
  const [{ data: escolhidas }, { data: cfg }, { data: sinc }] = await Promise.all([
    db.from('cobrancas').select('*').in('id', ids),
    db.from('cobranca_config').select('*').eq('id', true).single(),
    db.from('integracoes').select('id,ultima_sinc_em').eq('tipo', 'hotmart').eq('ativa', true),
  ])
  // os números têm que estar frescos: a Hotmart precisa ter sido lida há menos de 2 horas
  const velha = (sinc ?? []).find((x) => !x.ultima_sinc_em || Date.now() - Date.parse(x.ultima_sinc_em) > 2 * 3600e3)
  if (velha) return json({ erro: 'Os dados da Hotmart estão desatualizados. Atualize a Hotmart em Integrações e tente de novo.' }, 400)
  const feitos: string[] = [], falhas: { id: string; nome: string; motivo: string }[] = []
  const falhar = (c: Dados, motivo: string) => falhas.push({ id: String(c.id), nome: String(c.aluno_nome ?? ''), motivo })

  if (acao === 'enviar') {
    if (!horarioComercial()) return json({ erro: 'Notificação só em horário comercial: segunda a sexta, das 9h às 18h.' }, 400)
    if (!cfg?.advogado_liberou_em) return json({ erro: 'O advogado ainda não liberou a carta. Marque a liberação em "dados e modelos" depois que ele revisar.' }, 400)
    if (!cfg?.razao_social || !cfg?.cnpj) return json({ erro: 'Preencha os dados da empresa em "dados e modelos".' }, 400)
    if (!emailPronto(email)) return json({ erro: 'Cadastre o e-mail de cobrança em Integrações.' }, 400)
    // entram também as outras dívidas abertas da mesma pessoa (mesmo CPF), para sair uma carta e um boleto só
    const docs = new Set<string>()
    const { data: confEsc } = await db.from('v_cobranca_conferencia').select('cobranca_id,cpf').in('cobranca_id', ids)
    for (const x of confEsc ?? []) if (x.cpf) docs.add(String(x.cpf))
    const { data: confMesmo } = docs.size ? await db.from('v_cobranca_conferencia').select('cobranca_id').in('cpf', [...docs]) : { data: [] }
    const extrasIds = (confMesmo ?? []).map((x) => String(x.cobranca_id)).filter((id) => !ids.includes(id))
    const { data: extrasCs } = extrasIds.length ? await db.from('cobrancas').select('*').in('id', extrasIds).not('etapa', 'in', '(paga,sem_acordo,encerrada)') : { data: [] }
    const { ok, fora } = await preparar(db, [...(escolhidas ?? []), ...(extrasCs ?? [])] as Dados[], cfg as Dados, !!banco.inter)
    for (const f of fora) if (ids.includes(String(f.c.id))) falhar(f.c, f.motivo)
    const porCpf = new Map<string, Linha[]>()
    for (const g of ok) porCpf.set(g.cpf, [...(porCpf.get(g.cpf) ?? []), g])
    for (const grupo of porCpf.values()) {
      try { await notificarPessoa(db, grupo, cfg as Dados, banco, email, quem); feitos.push(...grupo.map((g) => String(g.c.id))) }
      catch (e) { for (const g of grupo) falhar(g.c, (e as Error).message) }
    }
  } else if (acao === 'negativar') {
    const porBoleto = new Map<string, Dados[]>()
    for (const c of (escolhidas ?? []) as Dados[]) {
      if (!c.boleto_id) { falhar(c, 'sem boleto'); continue }
      porBoleto.set(String(c.boleto_id), [...(porBoleto.get(String(c.boleto_id)) ?? []), c])
    }
    // o boleto vale para todos os cursos da pessoa: negativa todos juntos
    for (const [boleto, grupo] of porBoleto) {
      const { data: todos } = await db.from('cobrancas').select('*').eq('boleto_id', boleto).not('etapa', 'in', '(paga,sem_acordo,encerrada)')
      const g = (todos ?? grupo) as Dados[]
      try { await negativarBoleto(db, g, kAsaas, quem); feitos.push(...g.map((c) => String(c.id))) }
      catch (e) { for (const c of g) falhar(c, (e as Error).message) }
    }
  } else return json({ erro: 'ação desconhecida' }, 400)
  return json({ ok: true, feitos: feitos.length, falhas })
})
