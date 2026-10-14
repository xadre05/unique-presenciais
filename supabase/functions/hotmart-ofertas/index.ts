// Busca na Hotmart os produtos e as ofertas (links de pagamento) e grava em links_pagamento.
// Só administrador pode chamar. Credenciais ficam nos segredos do Supabase:
// HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_BASIC (Ferramentas > Credenciais Hotmart).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const API = 'https://developers.hotmart.com'

async function tokenHotmart() {
  const id = Deno.env.get('HOTMART_CLIENT_ID'), segredo = Deno.env.get('HOTMART_CLIENT_SECRET'), basic = Deno.env.get('HOTMART_BASIC')
  if (!id || !segredo || !basic) throw new Error('CREDENCIAIS_AUSENTES')
  const r = await fetch(`https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(segredo)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${basic.replace(/^Basic\s+/i, '')}` },
  })
  if (!r.ok) throw new Error(`Hotmart recusou as credenciais (${r.status}).`)
  return (await r.json()).access_token as string
}

async function todasPaginas(url: string, token: string) {
  const itens: Record<string, unknown>[] = []
  let pagina: string | null = null
  for (let i = 0; i < 40; i++) {
    const u = new URL(url); u.searchParams.set('max_results', '50'); if (pagina) u.searchParams.set('page_token', pagina)
    const r = await fetch(u, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`Hotmart respondeu ${r.status} em ${u.pathname}`)
    const d = await r.json()
    itens.push(...(d.items ?? []))
    pagina = d.page_info?.next_page_token ?? null
    if (!pagina) break
  }
  return itens
}

const FORMAS: Record<string, string> = { PAY_IN_FULL: 'Pagamento único (Pix, boleto ou cartão)', SUBSCRIPTION: 'Assinatura', SMART_INSTALLMENT: 'Parcelado Hotmart', INSTALLMENT: 'Parcelado' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode sincronizar com a Hotmart.' }, 403)
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const token = await tokenHotmart()
    const agora = new Date().toISOString()
    const produtos = await todasPaginas(`${API}/products/api/v1/products`, token)
    // produtos: guarda todos (sem perder a ligação com curso que o admin fez)
    for (const p of produtos) {
      await db.from('hotmart_produtos').upsert({ id: p.id, ucode: p.ucode, nome: p.name, status: p.status, formato: p.format, sincronizado_em: agora }, { onConflict: 'id', ignoreDuplicates: false })
    }
    const { data: escolhidos } = await db.from('hotmart_produtos').select('*').or('mostrar.eq.true,curso_id.not.is.null')
    let novos = 0, atualizados = 0, desativados = 0
    for (const p of escolhidos ?? []) {
      if (p.status === 'DELETED') continue
      const ofertas = await todasPaginas(`${API}/products/api/v1/products/${p.ucode}/offers`, token)
      const codigos: string[] = []
      for (const o of ofertas) {
        codigos.push(String(o.code))
        const preco = (o.price as { value?: number })?.value ?? null
        const nome = String(o.name || '').trim()
        const reg = {
          titulo: nome || `${p.nome}${o.is_main_offer ? ' — oferta principal' : ''}`,
          curso_id: p.curso_id, tipo: 'hotmart', endereco: String(o.direct_offer_link_for_creator ?? ''),
          valor: preco, condicao: FORMAS[String(o.payment_mode)] ?? String(o.payment_mode ?? ''),
          observacao: String(o.description || '').trim() || null, origem: 'hotmart', hotmart_oferta: String(o.code),
          hotmart_produto_id: p.id, forma_hotmart: o.payment_mode, sincronizado_em: agora, ativo: true,
          ordem: o.is_main_offer ? 1 : 20,
        }
        const { data: existe } = await db.from('links_pagamento').select('id').eq('hotmart_oferta', String(o.code)).maybeSingle()
        if (existe) {
          // mantém o que o admin ajustou à mão (turma, finalidade, aluno, validade, observação)
          const { titulo: _t, observacao: _o, ...resto } = reg as Record<string, unknown>
          if (!p.curso_id) delete resto.curso_id
          await db.from('links_pagamento').update(resto).eq('id', existe.id); atualizados++
        } else { await db.from('links_pagamento').insert(reg); novos++ }
      }
      const { data: sumiram } = await db.from('links_pagamento').select('id,hotmart_oferta').eq('hotmart_produto_id', p.id).eq('origem', 'hotmart').eq('ativo', true)
      for (const s of sumiram ?? []) if (!codigos.includes(s.hotmart_oferta)) { await db.from('links_pagamento').update({ ativo: false, sincronizado_em: agora }).eq('id', s.id); desativados++ }
    }
    return json({ ok: true, produtos: produtos.length, produtos_escolhidos: (escolhidos ?? []).length, novos, atualizados, desativados, em: agora })
  } catch (e) {
    const m = (e as Error).message
    if (m === 'CREDENCIAIS_AUSENTES') return json({ erro: 'As credenciais da Hotmart ainda não foram cadastradas no Supabase.', codigo: 'sem_credenciais' }, 400)
    return json({ erro: m }, 500)
  }
})
