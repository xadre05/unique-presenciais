// Integração com a Hotmart (só leitura). Chamado pela tela (administrador) ou pela busca automática (cron).
// Ações: testar · ofertas · pagamentos · tudo. As credenciais ficam cifradas no banco (Vault), cadastradas pela tela.
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

async function paginas(url: string, tk: string, extra: Record<string, string> = {}) {
  const itens: Record<string, any>[] = []
  let pg: string | null = null
  for (let i = 0; i < 60; i++) {
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

const FORMAS: Record<string, string> = { PAY_IN_FULL: 'Pagamento único (Pix, boleto ou cartão)', SUBSCRIPTION: 'Assinatura', SMART_INSTALLMENT: 'Parcelado Hotmart', INSTALLMENT: 'Parcelado' }
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
    const codigos: string[] = []
    for (const o of ofs) {
      codigos.push(String(o.code))
      const reg: Record<string, unknown> = {
        titulo: String(o.name || '').trim() || `${p.nome}${o.is_main_offer ? ' — oferta principal' : ''}`,
        curso_id: p.curso_id, tipo: 'hotmart', endereco: String(o.direct_offer_link_for_creator ?? ''),
        valor: o.price?.value ?? null, condicao: FORMAS[String(o.payment_mode)] ?? String(o.payment_mode ?? ''),
        observacao: String(o.description || '').trim() || null, origem: 'hotmart', hotmart_oferta: String(o.code),
        hotmart_produto_id: p.id, forma_hotmart: o.payment_mode, sincronizado_em: agora, ativo: true, ordem: o.is_main_offer ? 1 : 20,
      }
      const { data: existe } = await db.from('links_pagamento').select('id').eq('hotmart_oferta', String(o.code)).maybeSingle()
      if (existe) {
        delete reg.titulo; delete reg.observacao
        if (!p.curso_id) delete reg.curso_id
        await db.from('links_pagamento').update(reg).eq('id', existe.id); atualizados++
      } else { await db.from('links_pagamento').insert(reg); novos++ }
    }
    const { data: sumiram } = await db.from('links_pagamento').select('id,hotmart_oferta').eq('hotmart_produto_id', p.id).eq('origem', 'hotmart').eq('ativo', true)
    for (const s of sumiram ?? []) if (!codigos.includes(s.hotmart_oferta)) { await db.from('links_pagamento').update({ ativo: false, sincronizado_em: agora }).eq('id', s.id); desativados++ }
  }
  return { produtos: produtos.length, novos, atualizados, desativados }
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
