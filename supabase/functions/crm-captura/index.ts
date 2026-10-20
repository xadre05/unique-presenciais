// CRM — entrada de leads de outros sistemas (ManyChat, Typebot, site, Elementor).
// POST ?f=<endereço do formulário>  corpo JSON ou formulário: nome, whatsapp/telefone/phone, email, utm_*, respostas{}
// &etapa=checkout: a pessoa clicou em "ir para o pagamento" — o primeiro contato da vendedora espera o tempo do formulário.
// Sem login: usa a mesma regra da página pública (crm_capturar_lead).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405)
  const u = new URL(req.url)
  const slug = u.searchParams.get('f') ?? ''
  if (!slug) return json({ erro: 'Falta ?f=<formulário>.' }, 400)
  let dados: Record<string, unknown> = {}
  const tipo = req.headers.get('content-type') ?? ''
  try {
    if (tipo.includes('application/json')) dados = await req.json()
    else { const f = await req.formData(); f.forEach((v, k) => { dados[k] = String(v) }) }
  } catch { return json({ erro: 'Corpo inválido.' }, 400) }
  // respostas podem vir como texto JSON (envio por formulário / sendBeacon)
  if (typeof dados.respostas === 'string') { try { dados.respostas = JSON.parse(dados.respostas as string) } catch { dados.respostas = {} } }
  // utm na própria URL também vale
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) { const v = u.searchParams.get(k); if (v && !dados[k]) dados[k] = v }
  const checkout = u.searchParams.get('etapa') === 'checkout'
  if (!dados.canal) dados.canal = checkout ? 'checkout' : 'integracao'
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await db.rpc(checkout ? 'crm_capturar_checkout' : 'crm_capturar_lead', { p_slug: slug, p_dados: dados })
  if (error) return json({ ok: false, erro: error.message }, 400)
  return json(data)
})
