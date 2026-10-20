// Controle → monitor: confere sozinho se sites, domínios, IAs e banco estão de pé. Roda pelo cron a cada 30 min
// (cabeçalho x-cron-chave) ou pelo botão "Verificar agora" (administrador logado). Grava o resultado em controle_monitores.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-chave', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const EMPRESA_AGENTES = 'a0000000-0000-4000-8000-000000000001'
const LIMITE_BANCO = 500 * 1024 * 1024        // plano gratuito do Supabase
const LIMITE_ARQUIVOS = 1024 * 1024 * 1024

type Monitor = { id: string; nome: string; tipo: string; alvo: string | null; nivel: string | null; desde: string | null }
type Resultado = { nivel: 'ok' | 'alerta' | 'erro'; detalhe: string; valor?: Record<string, unknown> }

async function comPrazo(url: string, init: RequestInit = {}, ms = 15000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctl.signal, redirect: 'follow' }) } finally { clearTimeout(t) }
}

async function verSite(url: string): Promise<Resultado> {
  const ini = Date.now()
  try {
    const r = await comPrazo(url, { headers: { 'User-Agent': 'UniqueMonitor/1.0' } })
    const ms = Date.now() - ini
    await r.body?.cancel()
    if (r.status >= 500) return { nivel: 'erro', detalhe: `Fora do ar (o servidor respondeu ${r.status})`, valor: { status: r.status, ms } }
    if (r.status >= 400) return { nivel: 'erro', detalhe: `Página não encontrada ou bloqueada (${r.status})`, valor: { status: r.status, ms } }
    if (ms > 6000) return { nivel: 'alerta', detalhe: `No ar, mas lenta: ${(ms / 1000).toFixed(1)} s para abrir`, valor: { status: r.status, ms } }
    return { nivel: 'ok', detalhe: `No ar · abriu em ${(ms / 1000).toFixed(1)} s`, valor: { status: r.status, ms } }
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'não respondeu em 15 s' : (e as Error).message
    return { nivel: 'erro', detalhe: `Fora do ar: ${msg}` }
  }
}

async function verDominio(dominio: string): Promise<Resultado> {
  const r = await comPrazo(`https://rdap.registro.br/domain/${encodeURIComponent(dominio)}`, { headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'Mozilla/5.0 (compatible; UniqueMonitor/1.0)' } })
  if (r.status === 404) return { nivel: 'erro', detalhe: 'Domínio não encontrado no Registro.br' }
  if (!r.ok) return { nivel: 'alerta', detalhe: `Não consegui consultar o Registro.br agora (${r.status})` }
  const d = await r.json()
  const exp = (d.events ?? []).find((e: { eventAction: string }) => e.eventAction === 'expiration')?.eventDate as string | undefined
  if (!exp) return { nivel: 'alerta', detalhe: 'Registro.br não informou o vencimento' }
  const dias = Math.floor((Date.parse(exp) - Date.now()) / 86400000)
  const data = new Date(exp).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const dns = ((d.nameservers ?? []) as { ldhName: string }[]).map((n) => n.ldhName.toLowerCase())
  const ondeDns = dns.some((n) => /dns-parking\.com|hostinger/.test(n)) ? 'Hostinger' : dns[0] ?? '—'
  const valor = { vence_em: exp.slice(0, 10), dias, situacao: d.status ?? [], dns }
  if (dias < 0) return { nivel: 'erro', detalhe: `Venceu em ${data}`, valor }
  if (dias <= 30) return { nivel: 'alerta', detalhe: `Vence em ${dias} dia(s) (${data}) — renove no Registro.br · DNS: ${ondeDns}`, valor }
  if (ondeDns === 'Hostinger') return { nivel: 'alerta', detalhe: `Registrado até ${data} · o DNS ainda está na Hostinger: se a Hostinger for cancelada, o site e o e-mail deste domínio podem cair`, valor }
  return { nivel: 'ok', detalhe: `Registrado até ${data} · DNS: ${ondeDns}`, valor }
}

async function verAnthropic(db: SupabaseClient): Promise<Resultado> {
  const { data: chave } = await db.rpc('agentes_ler_chave', { p_empresa: EMPRESA_AGENTES })
  if (!chave) return { nivel: 'erro', detalhe: 'Sem chave cadastrada (Agentes → Configurações)' }
  // pergunta mínima (1 palavra) só para saber se a chave vale e se há crédito
  const r = await comPrazo('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
  }, 30000)
  if (r.ok) { await r.body?.cancel(); return { nivel: 'ok', detalhe: 'Chave funcionando e com crédito' } }
  const txt = await r.text()
  if (r.status === 401 || r.status === 403) return { nivel: 'erro', detalhe: 'A Anthropic recusou a chave (trocada ou apagada?)' }
  if (/credit balance|billing/i.test(txt)) return { nivel: 'erro', detalhe: 'Sem crédito na Anthropic — os agentes param' }
  if (r.status === 429 || r.status === 529) return { nivel: 'alerta', detalhe: 'A Anthropic está sobrecarregada agora; os agentes podem demorar' }
  return { nivel: 'alerta', detalhe: `Resposta inesperada da Anthropic (${r.status})` }
}

async function verOpenAI(db: SupabaseClient): Promise<Resultado> {
  const { data: chave } = await db.rpc('agentes_ler_chave_ia', { p_empresa: EMPRESA_AGENTES, p_provedor: 'openai' })
  if (!chave) return { nivel: 'alerta', detalhe: 'Sem chave cadastrada (usada só para imagens)' }
  const r = await comPrazo('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${chave}` } })
  await r.body?.cancel()
  if (r.ok) return { nivel: 'ok', detalhe: 'Chave funcionando (o crédito só aparece quando gera imagem)' }
  if (r.status === 401) return { nivel: 'erro', detalhe: 'A OpenAI recusou a chave' }
  if (r.status === 429) return { nivel: 'erro', detalhe: 'A OpenAI está bloqueando: sem crédito ou limite atingido' }
  return { nivel: 'alerta', detalhe: `Resposta inesperada da OpenAI (${r.status})` }
}

async function verSupabase(db: SupabaseClient): Promise<Resultado> {
  const { data, error } = await db.rpc('controle_uso_banco')
  if (error) return { nivel: 'alerta', detalhe: `Não consegui medir: ${error.message}` }
  const banco = Number(data.banco_bytes), arq = Number(data.arquivos_bytes)
  const pb = banco / LIMITE_BANCO, pa = arq / LIMITE_ARQUIVOS
  const mb = (b: number) => `${Math.round(b / 1048576)} MB`
  const detalhe = `No ar · banco ${mb(banco)} de 500 MB (${Math.round(pb * 100)}%) · arquivos ${mb(arq)} de 1 GB (${Math.round(pa * 100)}%) · plano gratuito, sem cópia diária`
  const valor = { banco_bytes: banco, arquivos_bytes: arq }
  if (Math.max(pb, pa) >= 0.9) return { nivel: 'erro', detalhe: 'Quase no limite do plano gratuito — ' + detalhe, valor }
  if (Math.max(pb, pa) >= 0.7) return { nivel: 'alerta', detalhe: 'Passou de 70% do plano gratuito — ' + detalhe, valor }
  return { nivel: 'ok', detalhe, valor }
}

async function verificar(db: SupabaseClient, m: Monitor): Promise<Resultado> {
  try {
    if (m.tipo === 'site') return await verSite(m.alvo ?? '')
    if (m.tipo === 'dominio') return await verDominio(m.alvo ?? '')
    if (m.tipo === 'anthropic') return await verAnthropic(db)
    if (m.tipo === 'openai') return await verOpenAI(db)
    if (m.tipo === 'supabase') return await verSupabase(db)
    return { nivel: 'alerta', detalhe: 'Tipo de verificação desconhecido' }
  } catch (e) {
    return { nivel: 'alerta', detalhe: `Não consegui verificar agora: ${(e as Error).message}` }
  }
}

async function autorizado(req: Request, db: SupabaseClient, url: string) {
  const chave = req.headers.get('x-cron-chave')
  if (chave) {
    const { data } = await db.rpc('ler_credenciais_integracao', { p_integracao: 'sistema' })
    return !!data?.cron && data.cron === chave
  }
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data } = await usuario.rpc('is_admin')
  return data === true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  if (!(await autorizado(req, db, url))) return json({ erro: 'Só o administrador.' }, 403)

  const { data: lista } = await db.from('controle_monitores').select('id,nome,tipo,alvo,nivel,desde').eq('ativo', true).neq('tipo', 'dominio')  // domínios: o banco consulta o Registro.br (academy_016)
  const monitores = (lista ?? []) as Monitor[]
  const agora = new Date().toISOString()
  const resultados = await Promise.all(monitores.map(async (m) => {
    const r = await verificar(db, m)
    await db.from('controle_monitores').update({
      nivel: r.nivel, detalhe: r.detalhe, valor: r.valor ?? null, verificado_em: agora,
      desde: m.nivel === r.nivel && m.desde ? m.desde : agora,
    }).eq('id', m.id)
    return { id: m.id, ...r }
  }))
  return json({ ok: true, resultados })
})
