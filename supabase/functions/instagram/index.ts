// Instagram ligado à Base da marca (19/10/2026). Login pela API do Instagram (Instagram Login), leitura dos posts
// com as métricas (alcance, visualizações, curtidas, comentários, salvos, compartilhamentos) e a análise do que
// funcionou, feita pelo Claude. Segredos (chave do app e token) ficam no Vault. Só lê: não publica nada.
// Ações (POST JSON {acao, empresa}, administrador logado): link, sincronizar, historico, analisar (com filtro de período e formato), desligar.
// GET ?code=&state= é a volta do login do Instagram (sem login do sistema; vale o código de segurança "estado").
// Cron diário: {acao: 'sincronizar_todas'} com o cabeçalho x-cron-chave.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { analisar, type Filtro } from './analise.ts'

const GRAPH = 'https://graph.instagram.com/v25.0'
const ESCOPOS = 'instagram_business_basic,instagram_business_manage_insights'
const RETORNO = `${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram`
// leitura diária: 1 ano (métricas continuam mudando); histórico: uma vez, desde 2024, para comparar os anos
const DIAS_POSTS = 365
const HISTORICO_DESDE = '2024-01-01'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-chave',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const agora = () => new Date().toISOString()

type Conexao = { empresa_id: string; app_id: string | null; status: string; estado: string | null; voltar: string | null; token_expira_em: string | null; token_renovado_em: string | null }
type Media = { id: string; caption?: string; media_type: string; media_product_type?: string; permalink?: string; timestamp: string; thumbnail_url?: string; media_url?: string; like_count?: number; comments_count?: number }

async function segredo(db: SupabaseClient, empresa: string, nome: string) {
  const { data } = await db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: nome })
  return data ? String(data) : ''
}
async function lerJson(r: Response) {
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d?.error) {
    const msg = String(d?.error?.message ?? d?.error_message ?? `erro ${r.status}`)
    if (/expired|session has been invalidated|Error validating access token/i.test(msg)) throw new Error('O acesso ao Instagram venceu ou foi retirado. Clique em Conectar de novo.')
    throw new Error(`O Instagram respondeu: ${msg}`)
  }
  return d
}
const atualizar = (db: SupabaseClient, empresa: string, campos: Record<string, unknown>) =>
  db.from('marca_conexoes').update({ ...campos, atualizado_em: agora() }).eq('empresa_id', empresa).eq('rede', 'instagram')

// ===== login =====
// só volta para as telas do próprio sistema (nunca para um endereço qualquer)
const voltarSeguro = (v: unknown) => (typeof v === 'string' && /^(https:\/\/unique-presenciais[a-z0-9-]*\.vercel\.app|http:\/\/localhost:\d+)\//.test(v) ? v : 'https://unique-presenciais.vercel.app/agentes/marca')

async function linkLogin(db: SupabaseClient, empresa: string, voltar: unknown) {
  const { data: c } = await db.from('marca_conexoes').select('app_id').eq('empresa_id', empresa).eq('rede', 'instagram').maybeSingle()
  if (!c?.app_id || !(await segredo(db, empresa, 'instagram_app'))) throw new Error('Cadastre primeiro o ID e a chave secreta do app do Instagram.')
  const estado = `${empresa}.${crypto.randomUUID()}`
  await atualizar(db, empresa, { estado, voltar: voltarSeguro(voltar), erro: null })
  const q = new URLSearchParams({ client_id: c.app_id, redirect_uri: RETORNO, response_type: 'code', scope: ESCOPOS, state: estado })
  return { url: `https://www.instagram.com/oauth/authorize?${q}` }
}

async function perfilDa(token: string) {
  return await lerJson(await fetch(`${GRAPH}/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${token}`)) as
    { user_id?: string; id?: string; username?: string; name?: string; profile_picture_url?: string; followers_count?: number; media_count?: number }
}
const dadosDoPerfil = (p: Awaited<ReturnType<typeof perfilDa>>) => ({ conta_id: String(p.user_id ?? p.id ?? ''), usuario: p.username ?? null, nome: p.name ?? null, foto: p.profile_picture_url ?? null, seguidores: p.followers_count ?? null, publicacoes: p.media_count ?? null })

async function voltaDoLogin(db: SupabaseClient, url: URL) {
  const estado = url.searchParams.get('state') ?? ''
  const { data: c } = estado ? await db.from('marca_conexoes').select('*').eq('estado', estado).maybeSingle() : { data: null }
  const destino = voltarSeguro(c?.voltar)
  const ir = (situacao: string) => new Response(null, { status: 302, headers: { Location: `${destino}${destino.includes('?') ? '&' : '?'}instagram=${situacao}` } })
  if (!c) return ir('erro')
  const conexao = c as Conexao
  if (url.searchParams.get('error')) { await atualizar(db, conexao.empresa_id, { estado: null, erro: 'O login foi cancelado no Instagram.' }); return ir('cancelado') }
  try {
    const appSegredo = await segredo(db, conexao.empresa_id, 'instagram_app')
    const corpo = new URLSearchParams({ client_id: String(conexao.app_id), client_secret: appSegredo, grant_type: 'authorization_code', redirect_uri: RETORNO, code: (url.searchParams.get('code') ?? '').replace(/#_$/, '') })
    const curto = await lerJson(await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: corpo }))
    const tokenCurto = String(curto?.data?.[0]?.access_token ?? curto?.access_token ?? '')
    if (!tokenCurto) throw new Error('O Instagram não devolveu o acesso.')
    const longo = await lerJson(await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSegredo}&access_token=${tokenCurto}`))
    const { error } = await db.rpc('marca_guardar_token', { p_empresa: conexao.empresa_id, p_rede: 'instagram', p_token: longo.access_token })
    if (error) throw new Error(error.message)
    const perfil = await perfilDa(longo.access_token)
    await atualizar(db, conexao.empresa_id, { ...dadosDoPerfil(perfil), status: 'conectado', estado: null, erro: null, conectado_em: agora(), token_renovado_em: agora(), token_expira_em: new Date(Date.now() + Number(longo.expires_in ?? 5184000) * 1000).toISOString() })
    // os posts entram em segundo plano; a tela já mostra a conta ligada
    // @ts-ignore EdgeRuntime existe no Supabase
    EdgeRuntime.waitUntil(sincronizar(db, conexao.empresa_id).catch((e) => atualizar(db, conexao.empresa_id, { erro: (e as Error).message })))
    return ir('ok')
  } catch (e) {
    await atualizar(db, conexao.empresa_id, { status: 'erro', estado: null, erro: (e as Error).message })
    return ir('erro')
  }
}

// ===== posts e métricas =====
const NOMES: Record<string, string> = { reach: 'alcance', views: 'visualizacoes', likes: 'curtidas', comments: 'comentarios', saved: 'salvos', shares: 'compartilhamentos', total_interactions: 'interacoes', profile_visits: 'visitas_perfil', follows: 'seguidores_ganhos', ig_reels_avg_watch_time: 'tempo_medio_ms' }
const tipoDe = (m: Media) => (m.media_product_type === 'REELS' ? 'reels' : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : m.media_type === 'VIDEO' ? 'video' : 'imagem')

async function metricasDo(m: Media, token: string) {
  const base: Record<string, number> = { curtidas: Number(m.like_count ?? 0), comentarios: Number(m.comments_count ?? 0) }
  const listas = tipoDe(m) === 'reels'
    ? ['reach,views,likes,comments,saved,shares,total_interactions,ig_reels_avg_watch_time', 'reach,likes,comments,saved,shares']
    : ['reach,views,likes,comments,saved,shares,total_interactions,profile_visits,follows', 'reach,likes,comments,saved,shares']
  // nem toda métrica existe para todo post (posts antigos, carrossel): tenta a lista menor se a maior falhar
  for (const lista of listas) {
    const r = await fetch(`${GRAPH}/${m.id}/insights?metric=${lista}&access_token=${token}`)
    if (!r.ok) continue
    const d = await r.json().catch(() => ({})) as { data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }
    for (const x of d.data ?? []) { const v = x.total_value?.value ?? x.values?.[0]?.value; if (NOMES[x.name] && typeof v === 'number') base[NOMES[x.name]] = v }
    return base
  }
  return base
}

async function renovarSePreciso(db: SupabaseClient, empresa: string, c: Conexao, token: string) {
  const faltam = c.token_expira_em ? (new Date(c.token_expira_em).getTime() - Date.now()) / 86400000 : 0
  const renovadoHa = c.token_renovado_em ? (Date.now() - new Date(c.token_renovado_em).getTime()) / 3600000 : 99
  if (faltam > 20 || renovadoHa < 24) return token
  const novo = await lerJson(await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`))
  await db.rpc('marca_guardar_token', { p_empresa: empresa, p_rede: 'instagram', p_token: novo.access_token })
  await atualizar(db, empresa, { token_renovado_em: agora(), token_expira_em: new Date(Date.now() + Number(novo.expires_in ?? 5184000) * 1000).toISOString() })
  return String(novo.access_token)
}

// novos seguidores de cada dia, como o Instagram informa (só os últimos 30 dias; não desconta quem deixou de seguir).
// Grava só a coluna "novos": a foto do total, quando existe, fica como está.
async function novosPorDia(db: SupabaseClient, empresa: string, token: string) {
  const ate = Math.floor(Date.now() / 1000), desde = ate - 29 * 86400
  const r = await fetch(`${GRAPH}/me/insights?metric=follower_count&period=day&since=${desde}&until=${ate}&access_token=${token}`)
  if (!r.ok) throw new Error(`Instagram ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const d = await r.json() as { data?: { name: string; values?: { value: number; end_time: string }[] }[] }
  const valores = d.data?.find((x) => x.name === 'follower_count')?.values ?? []
  // end_time é o fim do dia (meia-noite do Pacífico): o valor é do dia anterior
  const linhas = valores.filter((v) => typeof v.value === 'number' && v.end_time).map((v) => ({
    empresa_id: empresa, rede: 'instagram', novos: v.value,
    dia: new Date(new Date(v.end_time.slice(0, 10) + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10),
  }))
  if (linhas.length) { const { error } = await db.from('marca_seguidores').upsert(linhas, { onConflict: 'empresa_id,rede,dia' }); if (error) throw new Error(error.message) }
}

async function sincronizar(db: SupabaseClient, empresa: string, desde = Date.now() - DIAS_POSTS * 86400000, maximo = 400) {
  const { data: c } = await db.from('marca_conexoes').select('*').eq('empresa_id', empresa).eq('rede', 'instagram').maybeSingle()
  if (!c || c.status !== 'conectado') throw new Error('O Instagram não está conectado.')
  const token = await renovarSePreciso(db, empresa, c as Conexao, await segredo(db, empresa, 'instagram_token'))
  const perfil = dadosDoPerfil(await perfilDa(token))
  await atualizar(db, empresa, perfil)
  // foto do dia dos seguidores (o Instagram não guarda o histórico; com o tempo, dá para comparar o crescimento)
  if (perfil.seguidores != null) {
    const { error } = await db.from('marca_seguidores').upsert({ empresa_id: empresa, rede: 'instagram', dia: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), seguidores: perfil.seguidores }, { onConflict: 'empresa_id,rede,dia' })
    if (error) console.error('seguidores', error.message)
  }
  await novosPorDia(db, empresa, token).catch((e) => console.error('novos seguidores', (e as Error).message))
  const limite = desde
  const medias: Media[] = []
  let pagina: string | null = `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count&limit=50&access_token=${token}`
  while (pagina && medias.length < maximo) {
    const d = await lerJson(await fetch(pagina)) as { data?: Media[]; paging?: { next?: string } }
    const lote = d.data ?? []
    medias.push(...lote.filter((m) => new Date(m.timestamp).getTime() >= limite))
    pagina = lote.length && new Date(lote.at(-1)!.timestamp).getTime() >= limite ? d.paging?.next ?? null : null
  }
  // métricas de 8 em 8 (o Instagram limita pedidos por hora)
  const linhas = []
  for (let i = 0; i < medias.length; i += 8) {
    const lote = medias.slice(i, i + 8)
    const metricas = await Promise.all(lote.map((m) => metricasDo(m, token)))
    linhas.push(...lote.map((m, j) => ({
      empresa_id: empresa, rede: 'instagram', externo_id: m.id, tipo: tipoDe(m), legenda: m.caption ?? null, link: m.permalink ?? null,
      miniatura: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : m.media_url ?? null), publicado_em: m.timestamp, metricas: metricas[j], atualizado_em: agora(),
    })))
  }
  if (linhas.length) { const { error } = await db.from('marca_posts').upsert(linhas, { onConflict: 'empresa_id,rede,externo_id' }); if (error) throw new Error(error.message) }
  await atualizar(db, empresa, { sincronizado_em: agora(), erro: null })
  return { posts: linhas.length }
}

async function sincronizarTodas(db: SupabaseClient) {
  const { data } = await db.from('marca_conexoes').select('empresa_id').eq('rede', 'instagram').eq('status', 'conectado')
  const feitas: Record<string, unknown> = {}
  for (const c of data ?? []) { try { feitas[c.empresa_id] = await sincronizar(db, c.empresa_id) } catch (e) { feitas[c.empresa_id] = (e as Error).message; await atualizar(db, c.empresa_id, { erro: (e as Error).message }) } }
  return feitas
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  if (req.method === 'GET') return await voltaDoLogin(db, new URL(req.url))

  const corpo = await req.json().catch(() => ({})) as { acao?: string; empresa?: string; voltar?: string; filtro?: Filtro }
  if (corpo.acao === 'sincronizar_todas') {
    const { data: chave } = await db.rpc('crm_chave_cron')
    if (!chave || req.headers.get('x-cron-chave') !== chave) return json({ erro: 'Acesso negado.' }, 403)
    return json(await sincronizarTodas(db))
  }
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode mexer na conexão com o Instagram.' }, 403)
  const empresa = String(corpo.empresa ?? '')
  try {
    if (corpo.acao === 'link') return json(await linkLogin(db, empresa, corpo.voltar))
    if (corpo.acao === 'sincronizar') return json(await sincronizar(db, empresa))
    if (corpo.acao === 'historico') {
      // pode levar alguns minutos: roda em segundo plano e a tela recarrega depois
      // @ts-ignore EdgeRuntime existe no Supabase
      EdgeRuntime.waitUntil(sincronizar(db, empresa, new Date(HISTORICO_DESDE + 'T00:00:00Z').getTime(), 1200).catch((e) => atualizar(db, empresa, { erro: (e as Error).message })))
      return json({ ok: true })
    }
    if (corpo.acao === 'analisar') {
      const analise = await analisar(db, empresa, corpo.filtro ?? {})
      await atualizar(db, empresa, { analise })
      return json({ analise })
    }
    if (corpo.acao === 'desligar') {
      await db.rpc('marca_guardar_token', { p_empresa: empresa, p_rede: 'instagram', p_token: '' })
      await atualizar(db, empresa, { status: 'desligado', estado: null, token_expira_em: null })
      return json({ ok: true })
    }
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    await atualizar(db, empresa, { erro: (e as Error).message })
    return json({ erro: (e as Error).message })
  }
})
