// Automação de comentário → direct (19/10/2026). Quem comenta a palavra-chave recebe uma resposta privada do
// Instagram (só texto, o link vai dentro; até 7 dias depois do comentário; uma por comentário) e, se a equipe quiser,
// uma resposta pública no próprio comentário. Duas entradas, a mesma regra:
// - leitura (cron a cada 2 minutos): lê os comentários novos dos posts escolhidos. Não depende da aprovação da Meta.
// - aviso (webhook): o Instagram avisa na hora. Só chega com o app publicado e aprovado (Advanced Access).
// Cada comentário entra uma vez em marca_automacao_envios (comentario_id único): nunca manda duas vezes.
// O que a pessoa recebe vai por um link rastreado (?ir=código, um por mensagem): link, PDF ou conversa no WhatsApp
// (reveza entre as vendedoras ou um número fixo). O clique conta e, no WhatsApp, a conversa fica com uma vendedora.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { Credenciais } from './publicar.ts'

const GRAPH = 'https://graph.instagram.com/v25.0'
const SETE_DIAS = 7 * 86400000
const POSTS_RECENTES = 12

export type Automacao = {
  id: string; empresa_id: string; nome: string; alvo: 'todos' | 'post' | 'peca'; media_id: string | null; peca_id: string | null
  palavras: string[]; qualquer_comentario: boolean; respostas_publicas: string[]; mensagem: string; link: string | null; desde: string
  destino: 'nenhum' | 'link' | 'arquivo' | 'whatsapp'; arquivo_caminho: string | null; whatsapp_modo: 'reveza' | 'numero'
  whatsapp_numero: string | null; whatsapp_texto: string | null; vendedoras: string[]
}
export type Comentario = { id: string; texto: string; quando: string; usuario: string | null; usuarioId: string | null; media: string }
type Conta = { token: string; conta: string; usuario: string | null }

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// a palavra-chave precisa aparecer inteira no comentário ("bio" não casa com "biologia"), sem ligar para acento e maiúscula
export function casa(a: Pick<Automacao, 'palavras' | 'qualquer_comentario'>, texto: string) {
  if (a.qualquer_comentario) return true
  const t = normalizar(texto)
  return a.palavras.map(normalizar).filter(Boolean).some((p) => new RegExp(`(^|[^a-z0-9])${escapar(p)}([^a-z0-9]|$)`).test(t))
}

// a mensagem leva o link rastreado quando há destino (link preenchido, arquivo ou WhatsApp)
export const temDestino = (a: Pick<Automacao, 'destino' | 'link' | 'arquivo_caminho'>) =>
  a.destino === 'whatsapp' || (a.destino === 'arquivo' && !!a.arquivo_caminho) || (a.destino === 'link' && !!a.link?.trim())
export const textoDaMensagem = (a: Pick<Automacao, 'mensagem' | 'link' | 'destino' | 'arquivo_caminho'>, usuario: string | null, rastreado: string) =>
  [a.mensagem.replace(/\{nome\}/g, usuario ? `@${usuario}` : '').trim(), temDestino(a) ? rastreado : ''].filter(Boolean).join('\n\n')
const LINK_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1/instagram?ir=`
const novoCodigo = () => crypto.randomUUID().replaceAll('-', '').slice(0, 8)

// erros do Instagram em português, com o motivo mais comum de cada um
function motivo(msg: string) {
  if (/outside of allowed window|7 days/i.test(msg)) return 'O comentário tem mais de 7 dias: o Instagram não deixa mais responder no privado.'
  if (/already|only one/i.test(msg)) return 'Este comentário já recebeu uma resposta privada.'
  if (/permission|not allowed|\(#10\)|\(#200\)|\(#3\)/i.test(msg)) return `O Instagram recusou por permissão. Enquanto o app não for aprovado pela Meta, só quem tem papel no app recebe. (${msg.slice(0, 120)})`
  return msg.slice(0, 300)
}

async function postar(caminho: string, token: string, corpo?: unknown, params: Record<string, string> = {}) {
  const r = await fetch(`${GRAPH}/${caminho}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d?.error) throw new Error(String(d?.error?.error_user_msg ?? d?.error?.message ?? `erro ${r.status}`))
  return d
}
const enviarPrivada = (c: Conta, comentario: string, texto: string) => postar(`${c.conta}/messages`, c.token, { recipient: { comment_id: comentario }, message: { text: texto } })
const responderPublico = (c: Conta, comentario: string, texto: string) => postar(`${comentario}/replies`, c.token, undefined, { message: texto })

// trata um comentário que casou com a automação: reserva (evita mandar duas vezes), manda e guarda o resultado
export async function tratar(db: SupabaseClient, c: Conta, a: Automacao, cm: Comentario, via: 'leitura' | 'aviso') {
  const codigo = novoCodigo()
  const { error } = await db.from('marca_automacao_envios').insert({ empresa_id: a.empresa_id, automacao_id: a.id, comentario_id: cm.id, media_id: cm.media, usuario: cm.usuario, usuario_id: cm.usuarioId, texto: cm.texto.slice(0, 500), via, codigo })
  if (error) return 'já tratado'
  try {
    await enviarPrivada(c, cm.id, textoDaMensagem(a, cm.usuario, LINK_BASE + codigo))
    let publico = false
    if (a.respostas_publicas.length) {
      const frase = a.respostas_publicas[Math.floor(Math.random() * a.respostas_publicas.length)]
      publico = await responderPublico(c, cm.id, frase.replace(/\{nome\}/g, cm.usuario ? `@${cm.usuario}` : '')).then(() => true).catch((e) => { console.error('resposta pública', (e as Error).message); return false })
    }
    await db.from('marca_automacao_envios').update({ status: 'enviado', respondeu_em_publico: publico }).eq('comentario_id', cm.id)
    return 'enviado'
  } catch (e) {
    const erro = motivo((e as Error).message)
    await db.from('marca_automacao_envios').update({ status: 'erro', erro }).eq('comentario_id', cm.id)
    return erro
  }
}

// a automação mais específica que vale para este comentário (post ou peça antes de "qualquer post")
export function escolher(lista: Automacao[], postsDaPeca: Map<string, string>, cm: Comentario, agora = Date.now()) {
  if (agora - new Date(cm.quando).getTime() > SETE_DIAS) return null
  const vale = (a: Automacao) => new Date(cm.quando) >= new Date(a.desde) && casa(a, cm.texto)
    && (a.alvo === 'todos' || (a.alvo === 'post' && a.media_id === cm.media) || (a.alvo === 'peca' && !!a.peca_id && postsDaPeca.get(a.peca_id) === cm.media))
  return lista.filter((a) => a.alvo !== 'todos').find(vale) ?? lista.find((a) => a.alvo === 'todos' && vale(a)) ?? null
}

async function contaDa(db: SupabaseClient, empresa: string, credenciais: Credenciais): Promise<Conta> {
  const [{ token, conta }, { data }] = await Promise.all([credenciais(empresa), db.from('marca_conexoes').select('usuario').eq('empresa_id', empresa).eq('rede', 'instagram').maybeSingle()])
  return { token, conta, usuario: data?.usuario ?? null }
}

async function ativasDa(db: SupabaseClient, empresa: string) {
  const { data } = await db.from('marca_automacoes').select('*').eq('empresa_id', empresa).eq('rede', 'instagram').eq('ativa', true).order('criado_em')
  const lista = (data ?? []) as Automacao[]
  const pecas = lista.filter((a) => a.alvo === 'peca' && a.peca_id).map((a) => a.peca_id!)
  const { data: ligados } = pecas.length ? await db.from('marca_posts').select('peca_id,externo_id').in('peca_id', pecas) : { data: [] }
  return { lista, postsDaPeca: new Map((ligados ?? []).map((x) => [String(x.peca_id), String(x.externo_id)])) }
}

const eDaConta = (c: Conta, cm: Comentario) => cm.usuarioId === c.conta || (!!c.usuario && cm.usuario === c.usuario)

// ===== leitura (a cada 2 minutos) =====
async function comentariosDo(c: Conta, media: string): Promise<Comentario[]> {
  const r = await fetch(`${GRAPH}/${media}/comments?fields=id,text,timestamp,username,from&limit=50&access_token=${c.token}`)
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d?.error) throw new Error(String(d?.error?.message ?? `erro ${r.status}`))
  return ((d.data ?? []) as { id: string; text?: string; timestamp: string; username?: string; from?: { id?: string; username?: string } }[])
    .map((x) => ({ id: x.id, texto: x.text ?? '', quando: x.timestamp, usuario: x.from?.username ?? x.username ?? null, usuarioId: x.from?.id ?? null, media }))
}

export async function lerComentarios(db: SupabaseClient, empresa: string, credenciais: Credenciais) {
  const { lista, postsDaPeca } = await ativasDa(db, empresa)
  if (!lista.length) return { posts: 0, enviados: 0 }
  const c = await contaDa(db, empresa, credenciais)
  const medias = new Set<string>()
  for (const a of lista) { if (a.alvo === 'post' && a.media_id) medias.add(a.media_id); if (a.alvo === 'peca' && a.peca_id && postsDaPeca.get(a.peca_id)) medias.add(postsDaPeca.get(a.peca_id)!) }
  if (lista.some((a) => a.alvo === 'todos')) {
    const { data } = await db.from('marca_posts').select('externo_id').eq('empresa_id', empresa).eq('rede', 'instagram').gte('publicado_em', new Date(Date.now() - SETE_DIAS).toISOString()).order('publicado_em', { ascending: false }).limit(POSTS_RECENTES)
    for (const p of data ?? []) medias.add(String(p.externo_id))
  }
  const { data: feitos } = await db.from('marca_automacao_envios').select('comentario_id').eq('empresa_id', empresa).gte('criado_em', new Date(Date.now() - SETE_DIAS - 86400000).toISOString())
  const jaFeitos = new Set((feitos ?? []).map((x) => String(x.comentario_id)))
  let enviados = 0
  for (const media of medias) {
    const comentarios = await comentariosDo(c, media).catch((e) => { console.error('comentários', media, (e as Error).message); return [] })
    for (const cm of comentarios) {
      if (jaFeitos.has(cm.id) || eDaConta(c, cm)) continue
      const a = escolher(lista, postsDaPeca, cm)
      if (a && (await tratar(db, c, a, cm, 'leitura')) === 'enviado') enviados++
    }
  }
  return { posts: medias.size, enviados }
}

export async function automacoesTodas(db: SupabaseClient, credenciais: Credenciais) {
  const { data } = await db.from('marca_automacoes').select('empresa_id').eq('rede', 'instagram').eq('ativa', true)
  const feitas: Record<string, unknown> = {}
  for (const empresa of new Set((data ?? []).map((x) => String(x.empresa_id)))) {
    try { feitas[empresa] = await lerComentarios(db, empresa, credenciais) } catch (e) { feitas[empresa] = (e as Error).message; console.error('automações', empresa, (e as Error).message) }
  }
  return feitas
}

// ===== aviso instantâneo (webhook) =====
async function assinaturaConfere(bruto: string, assinatura: string, segredoApp: string) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredoApp), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const feita = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(bruto)))
  const hex = [...feita].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hex}` === assinatura
}

type Aviso = { entry?: { id: string; changes?: { field: string; value: { id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string } } }[] }[] }

export async function receberAviso(db: SupabaseClient, bruto: string, assinatura: string, credenciais: Credenciais, segredoDoApp: (empresa: string) => Promise<string>) {
  const aviso = JSON.parse(bruto) as Aviso
  let tratados = 0
  for (const entrada of aviso.entry ?? []) {
    const { data: conexao } = await db.from('marca_conexoes').select('empresa_id').eq('rede', 'instagram').eq('conta_id', String(entrada.id)).maybeSingle()
    if (!conexao) continue
    const empresa = String(conexao.empresa_id)
    if (!(await assinaturaConfere(bruto, assinatura, await segredoDoApp(empresa)))) { console.error('aviso com assinatura errada', empresa); continue }
    await db.from('marca_conexoes').update({ webhook_em: new Date().toISOString() }).eq('empresa_id', empresa).eq('rede', 'instagram')
    const comentarios = (entrada.changes ?? []).filter((x) => x.field === 'comments' && x.value?.id && x.value?.media?.id)
    if (!comentarios.length) continue
    const { lista, postsDaPeca } = await ativasDa(db, empresa)
    if (!lista.length) continue
    const c = await contaDa(db, empresa, credenciais)
    for (const { value: v } of comentarios) {
      const cm: Comentario = { id: v.id!, texto: v.text ?? '', quando: new Date().toISOString(), usuario: v.from?.username ?? null, usuarioId: v.from?.id ?? null, media: v.media!.id! }
      if (eDaConta(c, cm)) continue
      const a = escolher(lista, postsDaPeca, cm)
      if (a) { await tratar(db, c, a, cm, 'aviso'); tratados++ }
    }
  }
  return tratados
}

// ===== link rastreado (?ir=código): conta o clique e leva ao destino =====
const soDigitos = (t: string) => { const d = t.replace(/\D/g, ''); return d.length === 10 || d.length === 11 ? `55${d}` : d }

// a próxima vendedora do revezamento: entre as ativas com WhatsApp (e escolhidas na automação), a que recebeu menos nos últimos 30 dias
async function proximaVendedora(db: SupabaseClient, a: Automacao) {
  let q = db.from('vendedoras').select('id,whatsapp').eq('ativa', true).not('whatsapp', 'is', null)
  if (a.vendedoras.length) q = q.in('id', a.vendedoras)
  const { data: candidatas } = await q
  const lista = (candidatas ?? []).filter((v) => soDigitos(String(v.whatsapp ?? '')).length >= 12)
  if (!lista.length) return null
  const { data: recentes } = await db.from('marca_automacao_envios').select('vendedora_id').in('vendedora_id', lista.map((v) => v.id)).gte('clicou_em', new Date(Date.now() - 30 * 86400000).toISOString())
  const conta = new Map<string, number>()
  for (const r of recentes ?? []) conta.set(String(r.vendedora_id), (conta.get(String(r.vendedora_id)) ?? 0) + 1)
  return [...lista].sort((x, y) => (conta.get(x.id) ?? 0) - (conta.get(y.id) ?? 0))[0]
}

const pagina = (texto: string, status = 404) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font-family:sans-serif;padding:24px">${texto}</p>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

export async function irPara(db: SupabaseClient, codigo: string) {
  const { data: envio } = await db.from('marca_automacao_envios').select('id,automacao_id,codigo,cliques,vendedora_id').eq('codigo', codigo).maybeSingle()
  if (!envio?.automacao_id) return pagina('Este link não está mais disponível.')
  const { data: auto } = await db.from('marca_automacoes').select('*').eq('id', envio.automacao_id).maybeSingle()
  if (!auto) return pagina('Este link não está mais disponível.')
  const a = auto as Automacao
  let destino: string | null = null
  const campos: Record<string, unknown> = { cliques: Number(envio.cliques ?? 0) + 1, clicou_em: new Date().toISOString() }
  if (a.destino === 'link') destino = a.link?.trim() || null
  if (a.destino === 'arquivo' && a.arquivo_caminho) {
    const { data } = await db.storage.from('arquivos').createSignedUrl(a.arquivo_caminho, 3600)
    destino = data?.signedUrl ?? null
  }
  if (a.destino === 'whatsapp') {
    let numero = a.whatsapp_modo === 'numero' ? soDigitos(a.whatsapp_numero ?? '') : ''
    if (a.whatsapp_modo === 'reveza') {
      const ja = envio.vendedora_id ? (await db.from('vendedoras').select('id,whatsapp').eq('id', envio.vendedora_id).maybeSingle()).data : null
      const v = ja?.whatsapp ? ja : await proximaVendedora(db, a)
      if (v) { numero = soDigitos(String(v.whatsapp)); campos.vendedora_id = v.id }
    }
    const texto = `${(a.whatsapp_texto || 'Oi! Vim pelo Instagram e quero saber mais.').trim()} (código ${codigo})`
    destino = numero.length >= 12 ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null
  }
  await db.from('marca_automacao_envios').update(campos).eq('id', envio.id)
  return destino ? new Response(null, { status: 302, headers: { Location: destino } }) : pagina('O destino deste link ainda não foi configurado. Tente de novo mais tarde.')
}
