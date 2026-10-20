// Integração com a Hotmart (só leitura). Chamado pela tela (administrador) ou pela busca automática (cron).
// Ações: testar · ofertas · pagamentos · assinaturas · membros · tudo. As credenciais ficam cifradas no banco (Vault), cadastradas pela tela.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-chave',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const API = 'https://developers.hotmart.com'
type Integ = { id: string; nome: string; conta_id: string | null; traz_ofertas: boolean; traz_pagamentos: boolean; ativa: boolean }
type Cred = { client_id?: string; client_secret?: string; basic?: string }

async function token(c: Cred) {
  if (!c.client_id || !c.client_secret || !c.basic) throw new Error('Credenciais incompletas: preencha Client ID, Client Secret e Basic.')
  const r = await fetch(`https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(c.client_id)}&client_secret=${encodeURIComponent(c.client_secret)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${c.basic.replace(/^Basic\s+/i, '')}` },
  })
  if (!r.ok) throw new Error(`A Hotmart recusou as credenciais (${r.status}). Confira se copiou os três códigos certos.`)
  return (await r.json()).access_token as string
}

async function paginas(url: string, tk: string, extra: Record<string, string> = {}, maxPaginas = 60) {
  const itens: Record<string, any>[] = []
  let pg: string | null = null
  for (let i = 0; i < maxPaginas; i++) {
    const u = new URL(url)
    u.searchParams.set('max_results', '50')
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
    if (pg) u.searchParams.set('page_token', pg)
    const r = await fetch(u, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` } })
    if (!r.ok) throw new Error(`Hotmart respondeu ${r.status} em ${u.pathname}`)
    const d = await r.json()
    itens.push(...(d.items ?? []))
    pg = d.page_info?.next_page_token ?? null
    if (!pg) break
  }
  return itens
}

const FORMAS: Record<string, string> = {
  PAY_IN_FULL: 'Pagamento único (Pix, boleto ou cartão)', UNIQUE_PAYMENT: 'Pagamento único (cartão em até 12x, Pix ou boleto)',
  SMART_INSTALLMENT: 'Parcelamento Hotmart: 1 cobrança por mês (boleto, Pix ou cartão), sem usar o limite do cartão',
  HOTMART_INSTALLMENTS_UNIQUE_LINK: 'Parcelamento Hotmart: 1 cobrança por mês (boleto, Pix ou cartão), sem usar o limite do cartão',
  SUBSCRIPTION: 'Assinatura', INSTALLMENT: 'Parcelado',
}
const quando = (ms: unknown) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null)

// lista de produtos da conta (para ligar cada produto ao curso presencial)
async function lerProdutos(db: SupabaseClient, integ: Integ, tk: string) {
  const agora = new Date().toISOString()
  const produtos = await paginas(`${API}/products/api/v1/products`, tk)
  for (const p of produtos) {
    await db.from('hotmart_produtos').upsert({ id: p.id, ucode: p.ucode, nome: p.name, status: p.status, formato: p.format, sincronizado_em: agora, integracao_id: integ.id }, { onConflict: 'id' })
  }
  return produtos
}

async function ofertas(db: SupabaseClient, integ: Integ, tk: string) {
  const agora = new Date().toISOString()
  const produtos = await lerProdutos(db, integ, tk)
  const { data: escolhidos } = await db.from('hotmart_produtos').select('*').eq('integracao_id', integ.id).or('mostrar.eq.true,curso_id.not.is.null')
  let novos = 0, atualizados = 0, desativados = 0
  for (const p of escolhidos ?? []) {
    if (p.status === 'DELETED') continue
    const ofs = await paginas(`${API}/products/api/v1/products/${p.ucode}/offers`, tk)
    // curso ligado por oferta (Integrações → Ofertas) vale mais que o curso do produto inteiro
    const { data: ligadas } = await db.from('hotmart_ofertas_cursos').select('oferta_codigo,curso_id').in('oferta_codigo', ofs.map((o) => String(o.code)))
    const cursoDaOferta = new Map((ligadas ?? []).map((l) => [l.oferta_codigo as string, l.curso_id as string | null]))
    const codigos: string[] = []
    for (const o of ofs) {
      codigos.push(String(o.code))
      const reg: Record<string, unknown> = {
        titulo: String(o.name || '').trim() || `${p.nome}${o.is_main_offer ? ' — oferta principal' : ''}`,
        curso_id: cursoDaOferta.has(String(o.code)) ? cursoDaOferta.get(String(o.code)) : p.curso_id, tipo: 'hotmart', endereco: String(o.direct_offer_link_for_creator ?? ''),
        valor: o.price?.value ?? null, condicao: FORMAS[String(o.payment_mode)] ?? String(o.payment_mode ?? ''),
        observacao: String(o.description || '').trim() || null, origem: 'hotmart', hotmart_oferta: String(o.code),
        hotmart_produto_id: p.id, forma_hotmart: o.payment_mode, sincronizado_em: agora, ativo: true, ordem: o.is_main_offer ? 1 : 20,
      }
      const { data: existe } = await db.from('links_pagamento').select('id').eq('hotmart_oferta', String(o.code)).maybeSingle()
      if (existe) {
        // mantém o que foi ajustado no sistema: nome, observação, ordem e se está ativo (desativar à mão não volta sozinho)
        delete reg.titulo; delete reg.observacao; delete reg.ordem; delete reg.ativo
        if (!cursoDaOferta.has(String(o.code)) && !p.curso_id) delete reg.curso_id
        await db.from('links_pagamento').update(reg).eq('id', existe.id); atualizados++
      } else { await db.from('links_pagamento').insert(reg); novos++ }
    }
    const { data: sumiram } = await db.from('links_pagamento').select('id,hotmart_oferta').eq('hotmart_produto_id', p.id).eq('origem', 'hotmart').eq('ativo', true)
    for (const s of sumiram ?? []) if (!codigos.includes(s.hotmart_oferta)) { await db.from('links_pagamento').update({ ativo: false, sincronizado_em: agora }).eq('id', s.id); desativados++ }
  }
  return { produtos: produtos.length, novos, atualizados, desativados }
}

// Área de membros (Hotmart Club): quem tem acesso e com que status. Só leitura.
async function membros(db: SupabaseClient, tk: string, subdominio: string) {
  const agora = new Date().toISOString()
  // a API do Club pode devolver a lista em "items" ou direto como lista
  const users: Record<string, any>[] = []
  let pg: string | null = null, formato = ''
  for (let i = 0; i < 200; i++) {
    const u = new URL(`${API}/club/api/v1/users`)
    u.searchParams.set('subdomain', subdominio); u.searchParams.set('max_results', '50')
    if (pg) u.searchParams.set('page_token', pg)
    const r = await fetch(u, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` } })
    if (!r.ok) throw new Error(`Hotmart respondeu ${r.status} na área de membros: ${(await r.text()).slice(0, 200)}`)
    const d = await r.json()
    if (i === 0) formato = JSON.stringify(d, (_k, v) => (typeof v === 'string' && v.includes('@') ? '***' : v)).slice(0, 500)
    const it = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.items?.users) ? d.items.users : []
    users.push(...it)
    pg = Array.isArray(d) ? null : (d?.page_info?.next_page_token ?? null)
    if (!pg || !it.length) break
  }
  const status: Record<string, number> = {}
  const lote = users.map((u) => {
    status[String(u.status)] = (status[String(u.status)] ?? 0) + 1
    return {
      subdominio, user_id: String(u.user_id ?? u.id ?? u.email), email: u.email ? String(u.email).toLowerCase() : null, nome: u.name ?? null,
      status: u.status ?? null, papel: u.role ?? null, primeiro_acesso: quando(u.first_access_date), ultimo_acesso: quando(u.last_access_date),
      progresso: u.progress?.completed_percentage ?? null, engajamento: u.engagement ?? null, bruto: u, sincronizado_em: agora,
    }
  })
  for (let i = 0; i < lote.length; i += 500) {
    const { error } = await db.from('hotmart_membros').upsert(lote.slice(i, i + 500), { onConflict: 'subdominio,user_id' })
    if (error) throw new Error(error.message)
  }
  return { membros: users.length, status, formato, campos: users[0] ? Object.keys(users[0]) : [] }
}

// Parcelamento Hotmart e assinaturas (a área "Recuperação" da Hotmart): status de cada uma (em dia, em atraso, cancelada),
// quantas cobranças tem o plano e a próxima data. É daqui que a fila de cobrança sabe quem está devendo. Só leitura.
async function assinaturas(db: SupabaseClient, integ: Integ, tk: string) {
  const agora = new Date().toISOString()
  // o resumo traz o Parcelamento Hotmart (billing_type SMART_INSTALLMENT) com as cobranças não pagas; sem data só vem o recente
  const its = await paginas(`${API}/payments/api/v1/subscriptions/summary`, tk, { accession_date: String(Date.UTC(2020, 0, 1)) }, 200)
  // a Hotmart pode repetir a mesma assinatura entre páginas: fica a última
  const unicas = [...new Map(its.map((a) => [String(a.subscription_id ?? a.subscriber_code), a])).values()]
  const lote = unicas.map((a) => {
    const naoPagas = (a.unpaid_recurrencies ?? []) as { number?: number; charge_date?: number }[]
    return {
      id: String(a.subscription_id ?? a.subscriber_code), integracao_id: integ.id, assinante: a.subscriber_code ?? null, status: a.status ?? null,
      produto_id: a.product?.id ?? null, produto_nome: a.product?.name ?? null, oferta_codigo: a.offer?.code ?? null,
      tipo: a.last_recurrency?.billing_type ?? null, ciclos: a.lifetime ?? null, ultima_parcela: a.last_recurrency?.number ?? null,
      ultima_parcela_status: a.last_recurrency?.status ?? null, nao_pagas: naoPagas.length,
      primeira_nao_paga: quando(naoPagas.map((x) => Number(x.charge_date ?? 0)).filter(Boolean).sort((x, y) => x - y)[0]),
      adesao: quando(a.accession_date), proxima_cobranca: quando(a.date_next_charge),
      email: a.subscriber?.email ? String(a.subscriber.email).toLowerCase() : null, nome: a.subscriber?.name ?? null, bruto: a, sincronizado_em: agora,
    }
  })
  for (let i = 0; i < lote.length; i += 500) {
    const { error } = await db.from('hotmart_assinaturas').upsert(lote.slice(i, i + 500), { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
  const status: Record<string, number> = {}
  for (const a of lote) status[String(a.status)] = (status[String(a.status)] ?? 0) + 1
  return { assinaturas: lote.length, status }
}

// CPF e telefone de quem está devendo (para negociar e, se for o caso, negativar). Só leitura; busca só quem ainda não tem.
async function compradores(db: SupabaseClient, integ: Integ, tk: string, limite = 150) {
  const { data: faltam } = await db.rpc('compradores_sem_documento', { p_integracao: integ.id, p_limite: limite })
  let achados = 0
  for (const f of (faltam ?? []) as { email: string; transacao: string }[]) {
    const r = await fetch(`${API}/payments/api/v1/sales/users?transaction=${encodeURIComponent(f.transacao)}`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` } })
    if (!r.ok) continue
    const d = await r.json()
    const users = ((d.items ?? [])[0]?.users ?? []) as Record<string, any>[]
    const u = (users.find((x) => String(x.role).toUpperCase() === 'BUYER') ?? users[0])?.user ?? {}
    const docs = (u.documents ?? []) as { value?: string; type?: string }[]
    const doc = String((docs.find((x) => String(x.type).toUpperCase() === 'CPF') ?? docs[0])?.value ?? '').replace(/\D/g, '') || null
    const fone = String(u.cellphone || u.phone || '').replace(/\D/g, '') || null
    await db.from('hotmart_compradores').upsert({ email: f.email, documento: doc, telefone: fone, nome: u.name ?? null, consultado_em: new Date().toISOString() }, { onConflict: 'email' })
    if (doc) achados++
  }
  return { consultados: (faltam ?? []).length, com_documento: achados }
}

// Status que a busca traz. Sem filtro a Hotmart só devolve aprovados; para ver reembolso e cancelamento é preciso pedir cada um.
const APROVADOS = ['APPROVED', 'COMPLETE']
const DESFEITOS = ['REFUNDED', 'CHARGEBACK', 'CANCELLED', 'PROTESTED', 'PARTIALLY_REFUNDED', 'DISPUTE']

async function pagamentos(db: SupabaseClient, integ: Integ, tk: string, janela: { inicio: number; fim: number }, statuses: string[], jaLeuProdutos: boolean) {
  if (!jaLeuProdutos) await lerProdutos(db, integ, tk)
  const vendas: Record<string, any>[] = []
  for (const st of statuses) {
    try { vendas.push(...await paginas(`${API}/payments/api/v1/sales/history`, tk, { start_date: String(janela.inicio), end_date: String(janela.fim), transaction_status: st })) }
    catch (e) { if (APROVADOS.includes(st)) throw e } // status raro que a Hotmart não aceite não derruba a busca
  }
  const cont: Record<string, number> = { baixado: 0, a_conferir: 0, sem_acao: 0, ignorado: 0 }
  const erros: string[] = []
  for (const v of vendas) {
    const pu = v.purchase ?? {}
    const transacao = String(pu.transaction ?? '')
    if (!transacao) continue
    const rec = Number(pu.recurrency_number ?? pu.recurrence_number ?? 0) || null
    const id = rec ? `${transacao}#${rec}` : transacao
    const bruto = Number(pu.price?.value ?? 0) || null
    // líquido do produtor = base da taxa (preço sem os juros do parcelamento) − taxa da Hotmart
    const baseTaxa = Number(pu.hotmart_fee?.base ?? 0) || bruto
    const taxa = Number(pu.hotmart_fee?.total ?? 0) || 0
    const liquido = baseTaxa ? Math.round((baseTaxa - taxa) * 100) / 100 : null
    const { data: ja } = await db.from('hotmart_pagamentos').select('situacao').eq('id', id).maybeSingle()
    const reg = {
      id, transacao, integracao_id: integ.id, status: pu.status ?? null, evento: 'busca',
      comprador_nome: v.buyer?.name ?? null, comprador_email: v.buyer?.email ?? null,
      produto_id: v.product?.id ?? null, produto_nome: v.product?.name ?? null, oferta_codigo: pu.offer?.code ?? null,
      valor: bruto, valor_liquido: liquido,
      forma: pu.payment?.type ?? pu.payment?.method ?? null, parcelas_cartao: pu.payment?.installments_number ?? null, recorrencia: rec,
      data_pedido: quando(pu.order_date), data_aprovacao: quando(pu.approved_date), bruto: v, atualizado_em: new Date().toISOString(),
    }
    const { error: eg } = ja
      ? await db.from('hotmart_pagamentos').update({ status: reg.status, bruto: v, valor_liquido: liquido, atualizado_em: reg.atualizado_em }).eq('id', id)
      : await db.from('hotmart_pagamentos').insert(reg)
    if (eg) { if (erros.length < 3) erros.push(`${id}: ${eg.message}`); continue }
    const { data: r } = await db.rpc('processar_pagamento_hotmart', { p_id: id })
    cont[String(r)] = (cont[String(r)] ?? 0) + 1
  }
  return { vendas: vendas.length, ...cont, ...(erros.length ? { erros } : {}) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const corpo = await req.json().catch(() => ({}))
  const acao = String(corpo.acao ?? 'tudo')

  // quem pode chamar: administrador logado, ou a busca automática com a chave interna
  const chave = req.headers.get('x-cron-chave')
  let autorizado = false
  if (chave) {
    const { data } = await db.rpc('ler_credenciais_integracao', { p_integracao: 'sistema' })
    autorizado = !!data?.cron && data.cron === chave
  } else {
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data } = await usuario.rpc('is_admin')
    autorizado = data === true
  }
  if (!autorizado) return json({ erro: 'Só o administrador pode usar a integração.' }, 403)

  const { data: lista } = await db.from('integracoes').select('*').eq('tipo', 'hotmart').order('ordem')
  const alvo = ((lista ?? []) as Integ[]).filter((i) => (corpo.integracao ? i.id === corpo.integracao : i.ativa))
  if (corpo.integracao && !alvo.length) return json({ erro: 'Integração não encontrada.' }, 404)

  const resultado: Record<string, unknown> = {}
  for (const integ of alvo) {
    const agora = new Date().toISOString()
    try {
      const { data: cred } = await db.rpc('ler_credenciais_integracao', { p_integracao: integ.id })
      if (!cred?.client_id && acao === 'tudo') { resultado[integ.id] = { pulada: 'sem credenciais' }; continue }
      const tk = await token(cred as Cred)
      const r: Record<string, unknown> = {}
      if (acao === 'preco') {
        const rr = await fetch(`${API}/payments/api/v1/sales/price/details?transaction=${encodeURIComponent(String(corpo.transacao))}`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` } })
        resultado[integ.id] = { ok: true, status: rr.status, corpo: await rr.text() }
        continue
      }
      if (acao === 'membros') {
        try { resultado[integ.id] = { ok: true, ...(await membros(db, tk, String(corpo.subdominio ?? 'uniquehofclub'))) } }
        catch (e) { resultado[integ.id] = { ok: false, erro: (e as Error).message } }
        continue
      }
      if (acao === 'sonda') {
        // só leitura: mostra a forma da resposta de uma consulta (sem nomes, e-mails ou documentos) para ligar uma integração nova
        const caminhos = ['/payments/api/v1/subscriptions', '/payments/api/v1/sales/users', '/payments/api/v1/subscriptions/summary']
        if (!caminhos.includes(String(corpo.caminho))) { resultado[integ.id] = { ok: false, erro: 'Consulta não permitida.' }; continue }
        const u = new URL(`${API}${corpo.caminho}`)
        for (const [k, v] of Object.entries((corpo.params ?? {}) as Record<string, string>)) u.searchParams.set(k, String(v))
        const rr = await fetch(u, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` } })
        const d = await rr.json().catch(() => null)
        const STATUS = /status|type|period|cycle|currency|recurr|trial|max|number|date|lifetime/i
        const mascara = (v: unknown, k = ''): unknown => Array.isArray(v) ? v.slice(0, 2).map((x) => mascara(x, k))
          : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([kk, vv]) => [kk, mascara(vv, kk)]))
          : typeof v === 'string' && (!STATUS.test(k) || /^\d{8,}$/.test(v)) ? `texto(${v.length})` : v
        const its = (d?.items ?? []) as Record<string, any>[]
        const st: Record<string, number> = {}
        for (const it of its) { const s = String(it.status ?? it.subscription?.status ?? ''); st[s] = (st[s] ?? 0) + 1 }
        resultado[integ.id] = { ok: rr.ok, http: rr.status, itens: its.length, proxima: !!d?.page_info?.next_page_token, total: d?.page_info?.total_results ?? null, status: st, exemplo: mascara(its[0] ?? d) }
        continue
      }
      if (acao === 'diagnostico') {
        const extra: Record<string, string> = {}
        if (corpo.inicio) extra.start_date = String(corpo.inicio)
        if (corpo.fim) extra.end_date = String(corpo.fim)
        if (corpo.status) extra.transaction_status = String(corpo.status)
        const it = await paginas(`${API}/payments/api/v1/sales/history`, tk, extra)
        const datas = it.map((v) => Number(v.purchase?.approved_date ?? v.purchase?.order_date ?? 0)).filter(Boolean).sort((a, b) => a - b)
        const st: Record<string, number> = {}
        for (const v of it) st[String(v.purchase?.status)] = (st[String(v.purchase?.status)] ?? 0) + 1
        resultado[integ.id] = { ok: true, extra, total: it.length, primeira: quando(datas[0]), ultima: quando(datas[datas.length - 1]), status: st }
        continue
      }
      if (acao === 'ofertas' || (acao === 'tudo' && integ.traz_ofertas)) r.ofertas = await ofertas(db, integ, tk)
      if (acao === 'assinaturas' || (acao === 'tudo' && integ.traz_pagamentos)) {
        try { r.assinaturas = await assinaturas(db, integ, tk) } catch (e) { r.assinaturas = { erro: (e as Error).message } }
        try { r.compradores = await compradores(db, integ, tk) } catch (e) { r.compradores = { erro: (e as Error).message } }
      }
      if (acao === 'pagamentos' || (acao === 'tudo' && integ.traz_pagamentos)) {
        // janela: datas exatas (histórico, mês a mês) ou os últimos N dias
        const fim = Number(corpo.fim) || Date.now()
        const inicio = Number(corpo.inicio) || fim - Math.min(800, Math.max(1, Number(corpo.dias ?? 3))) * 86400000
        const statuses = corpo.so_desfeitos ? DESFEITOS : [...APROVADOS, ...DESFEITOS]
        r.pagamentos = await pagamentos(db, integ, tk, { inicio, fim }, statuses, !!r.ofertas || !!corpo.sem_produtos)
      }
      await db.from('integracoes').update({ ultimo_teste_em: agora, ultimo_teste_ok: true, ultimo_erro: null, ...(acao === 'testar' ? {} : { ultima_sinc_em: agora }) }).eq('id', integ.id)
      resultado[integ.id] = { ok: true, ...r }
    } catch (e) {
      const m = (e as Error).message
      await db.from('integracoes').update({ ultimo_teste_em: agora, ultimo_teste_ok: false, ultimo_erro: m }).eq('id', integ.id)
      resultado[integ.id] = { ok: false, erro: m }
    }
  }
  const unico = corpo.integracao ? resultado[corpo.integracao] as Record<string, unknown> : null
  if (unico && unico.ok === false) return json({ erro: unico.erro, resultado }, 400)
  return json({ ok: true, resultado })
})
