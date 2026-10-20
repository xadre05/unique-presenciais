// CRM — entrada de leads de outros sistemas (ManyChat, Typebot, site, Elementor, página da Black).
// POST ?f=<endereço do formulário>  corpo JSON (também como texto, do jeito que o navegador manda em "no-cors") ou formulário:
//   nome/name, whatsapp/telefone/phone, email, utm_* (ou utm{...}), src, respostas{} — campos soltos como formacao, modulo,
//   turma, data, oferta, cidade e visitante viram respostas.
// &etapa=checkout (ou "etapa": "iniciou_checkout" no corpo): a pessoa clicou em "ir para o pagamento" — o primeiro contato da
//   vendedora espera o tempo do formulário e vai para a vendedora do link (zap-nome).
// &tipo=evento: passo da página antes do formulário (visitante + evento) — guardado e ligado ao contato quando o lead chegar.
// Sem login: usa as mesmas regras da página pública (crm_capturar_lead).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const SOLTOS = ['formacao', 'modulo', 'turma', 'data', 'oferta', 'cidade', 'visitante', 'posicao']
const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

async function lerCorpo(req: Request): Promise<Record<string, unknown> | null> {
  const tipo = req.headers.get('content-type') ?? ''
  if (tipo.includes('multipart/form-data') || tipo.includes('application/x-www-form-urlencoded')) {
    const dados: Record<string, unknown> = {}
    const f = await req.formData(); f.forEach((v, k) => { dados[k] = String(v) })
    return dados
  }
  const texto = await req.text()
  try { const d = JSON.parse(texto); return d && typeof d === 'object' ? d : null } catch { /* não é JSON */ }
  try { return Object.fromEntries(new URLSearchParams(texto)) } catch { return null }
}

function arrumar(dados: Record<string, unknown>, u: URL) {
  if (typeof dados.respostas === 'string') { try { dados.respostas = JSON.parse(dados.respostas as string) } catch { dados.respostas = {} } }
  // utm dentro de "utm": {...}
  const utm = (dados.utm && typeof dados.utm === 'object' ? dados.utm : {}) as Record<string, unknown>
  for (const k of UTMS) if (!dados[k] && utm[k]) dados[k] = utm[k]
  if (!dados.src && utm.src) dados.src = utm.src
  // utm na própria URL também vale
  for (const k of UTMS) { const v = u.searchParams.get(k); if (v && !dados[k]) dados[k] = v }
  // campos soltos viram respostas
  const resp = (dados.respostas && typeof dados.respostas === 'object' ? dados.respostas : {}) as Record<string, unknown>
  for (const k of SOLTOS) if (dados[k] != null && dados[k] !== '' && resp[k] == null) resp[k] = String(dados[k]).slice(0, 200)
  dados.respostas = resp
  return dados
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405)
  const u = new URL(req.url)
  const slug = u.searchParams.get('f') ?? ''
  if (!slug) return json({ erro: 'Falta ?f=<formulário>.' }, 400)
  const bruto = await lerCorpo(req).catch(() => null)
  if (!bruto) return json({ erro: 'Corpo inválido.' }, 400)
  const dados = arrumar(bruto, u)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

  if (u.searchParams.get('tipo') === 'evento') {
    const { data, error } = await db.rpc('crm_registrar_evento_pagina', { p_slug: slug, p_dados: dados })
    return error ? json({ ok: false, erro: error.message }, 400) : json(data)
  }
  const checkout = u.searchParams.get('etapa') === 'checkout' || dados.etapa === 'iniciou_checkout'
  if (!dados.canal) dados.canal = checkout ? 'checkout' : 'integracao'
  const { data, error } = await db.rpc(checkout ? 'crm_capturar_checkout' : 'crm_capturar_lead', { p_slug: slug, p_dados: dados })
  if (error) return json({ ok: false, erro: error.message }, 400)
  return json(data)
})
