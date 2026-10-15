// ════════════════════════════════════════════════════════════════════
// CRM — WhatsApp (parte separada). Não conhece vendedora, Hotmart nem comissão.
//
// Ações (POST JSON {acao}):
//   enviar           tela (login)       {conversa_id, texto} ou {contato_id, canal_id, texto}
//   simular_entrada  tela (admin)       {canal_id, telefone, nome, texto}  — só no número de teste
//   processar_fila   cron (x-cron-chave) manda o próximo lote dos disparos, no ritmo de cada número
//   webhook          provedor            ?canal=<id>&chave=<chave_webhook>  (mensagens que chegam)
// ════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-chave',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Canal = { id: string; empresa_id: string; tipo: 'teste' | 'whatsapp_qr' | 'whatsapp_oficial'; nome: string; status: string; config: Record<string, unknown> }
type Segredos = { segredos: Record<string, string>; chave_webhook: string }

// ── conectores: cada tipo de número sabe mandar uma mensagem de texto ──
async function mandarTexto(canal: Canal, seg: Segredos, telefone: string, texto: string): Promise<string | null> {
  if (canal.tipo === 'teste') return `teste-${crypto.randomUUID()}`

  if (canal.tipo === 'whatsapp_qr') {
    // servidor próprio (Evolution API): config.url, config.instancia; segredo: apikey
    const base = String(canal.config.url ?? '').replace(/\/$/, '')
    const r = await fetch(`${base}/message/sendText/${encodeURIComponent(String(canal.config.instancia ?? ''))}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: seg.segredos.apikey ?? '' },
      body: JSON.stringify({ number: telefone, text: texto }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`O servidor do WhatsApp respondeu ${r.status}: ${JSON.stringify(d).slice(0, 200)}`)
    return d?.key?.id ?? null
  }

  if (canal.tipo === 'whatsapp_oficial') {
    // API oficial da Meta: config.phone_number_id; segredo: token
    const r = await fetch(`https://graph.facebook.com/v21.0/${canal.config.phone_number_id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seg.segredos.token ?? ''}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: telefone, type: 'text', text: { body: texto } }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d?.error?.message ?? `A Meta respondeu ${r.status}`)
    return d?.messages?.[0]?.id ?? null
  }
  throw new Error('Tipo de número desconhecido.')
}

// ── conectores: o que chega pelo webhook vira {telefone, nome, texto, id} ──
type Recebida = { telefone: string; nome: string | null; texto: string | null; tipo: string; id: string | null }
function lerWebhook(canal: Canal, corpo: any): Recebida[] {
  const saida: Recebida[] = []
  if (canal.tipo === 'whatsapp_qr') {
    const evento = String(corpo?.event ?? '').toLowerCase()
    if (!evento.includes('messages.upsert') && !evento.includes('messages_upsert')) return saida
    const lista = Array.isArray(corpo.data) ? corpo.data : [corpo.data]
    for (const m of lista) {
      if (!m?.key || m.key.fromMe) continue
      const jid = String(m.key.remoteJid ?? '')
      if (!jid.endsWith('@s.whatsapp.net')) continue          // ignora grupos e status
      const msg = m.message ?? {}
      const texto = msg.conversation ?? msg.extendedTextMessage?.text ?? msg.imageMessage?.caption ?? msg.videoMessage?.caption ?? null
      const tipo = msg.imageMessage ? 'imagem' : msg.audioMessage ? 'audio' : msg.videoMessage ? 'video' : msg.documentMessage ? 'documento' : texto ? 'texto' : 'outro'
      saida.push({ telefone: jid.split('@')[0], nome: m.pushName ?? null, texto, tipo, id: m.key.id ?? null })
    }
  }
  if (canal.tipo === 'whatsapp_oficial') {
    for (const e of corpo?.entry ?? []) for (const c of e.changes ?? []) {
      const v = c.value ?? {}
      const nomes: Record<string, string> = {}
      for (const ct of v.contacts ?? []) nomes[ct.wa_id] = ct.profile?.name
      for (const m of v.messages ?? []) {
        const texto = m.text?.body ?? m.image?.caption ?? m.button?.text ?? m.interactive?.button_reply?.title ?? null
        const tipo = m.type === 'image' ? 'imagem' : m.type === 'audio' ? 'audio' : m.type === 'video' ? 'video' : m.type === 'document' ? 'documento' : texto ? 'texto' : 'outro'
        saida.push({ telefone: m.from, nome: nomes[m.from] ?? null, texto, tipo, id: m.id ?? null })
      }
    }
  }
  return saida
}

const sortear = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const primeiroNome = (n: string | null) => { const p = (n ?? '').trim().split(/\s+/)[0] ?? ''; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '' }
const preencher = (t: string, nome: string | null) => t.replace(/\{primeiro_nome\}|\{nome\}/gi, primeiroNome(nome)).replace(/[ \t]+([,.!?])/g, '$1')

async function canalESegredos(db: SupabaseClient, canalId: string) {
  const { data: canal } = await db.from('crm_canais').select('*').eq('id', canalId).single()
  const { data: seg } = await db.from('crm_canais_segredos').select('*').eq('canal_id', canalId).single()
  if (!canal || !seg) throw new Error('Número não encontrado.')
  return { canal: canal as Canal, seg: seg as Segredos }
}

// manda uma mensagem já registrada e atualiza o status
async function despachar(db: SupabaseClient, msgId: string, canal: Canal, seg: Segredos, telefone: string, texto: string) {
  try {
    const idExt = await mandarTexto(canal, seg, telefone, texto)
    await db.from('crm_mensagens').update({ status: 'enviada', id_externo: idExt }).eq('id', msgId)
    return { ok: true as const }
  } catch (e) {
    const erro = (e as Error).message
    await db.from('crm_mensagens').update({ status: 'erro', erro }).eq('id', msgId)
    return { ok: false as const, erro }
  }
}

async function processarFila(db: SupabaseClient) {
  const { data: itens, error } = await db.rpc('crm_proximos_envios', { p_max: 40 })
  if (error) throw new Error(error.message)
  const cache = new Map<string, { canal: Canal; seg: Segredos }>()
  let enviados = 0, erros = 0
  for (const it of (itens ?? []) as { item_id: string; disparo_id: string; contato_id: string; canal_id: string; empresa_id: string }[]) {
    // trava o item (se outra execução pegou antes, pula)
    const { data: travado } = await db.from('crm_disparo_itens').update({ status: 'enviado', enviado_em: new Date().toISOString() }).eq('id', it.item_id).eq('status', 'fila').select('atendente_id').maybeSingle()
    if (!travado) continue
    if (!cache.has(it.canal_id)) cache.set(it.canal_id, await canalESegredos(db, it.canal_id))
    const { canal, seg } = cache.get(it.canal_id)!
    const { data: d } = await db.from('crm_disparos').select('mensagens, atendente_id').eq('id', it.disparo_id).single()
    const { data: c } = await db.from('crm_contatos').select('nome, telefone, nao_contatar, telefone_invalido').eq('id', it.contato_id).single()
    if (!c?.telefone || c.nao_contatar || c.telefone_invalido) { await db.from('crm_disparo_itens').update({ status: 'pulado', erro: 'sem WhatsApp ou pediu para não receber' }).eq('id', it.item_id); continue }
    await db.from('crm_conversas').upsert({ empresa_id: it.empresa_id, contato_id: it.contato_id, canal_id: it.canal_id, atendente_id: travado.atendente_id ?? d?.atendente_id ?? null },
      { onConflict: 'canal_id,contato_id', ignoreDuplicates: true })
    const { data: conv } = await db.from('crm_conversas').select('id').eq('canal_id', it.canal_id).eq('contato_id', it.contato_id).single()
    const texto = preencher(String(sortear((d?.mensagens ?? ['']) as string[])), c.nome)
    const { data: msgId } = await db.rpc('crm_registrar_saida', { p_conversa: conv!.id, p_texto: texto, p_autor: 'disparo', p_autor_id: null })
    const r = await despachar(db, msgId as string, canal, seg, c.telefone, texto)
    await db.from('crm_disparo_itens').update({ mensagem_id: msgId, ...(r.ok ? {} : { status: 'erro', erro: r.erro }) }).eq('id', it.item_id)
    if (r.ok) enviados++; else erros++
  }
  // disparos sem nada na fila → concluídos
  const { data: abertos } = await db.from('crm_disparos').select('id').eq('status', 'enviando')
  for (const d of abertos ?? []) {
    const { count } = await db.from('crm_disparo_itens').select('id', { count: 'exact', head: true }).eq('disparo_id', d.id).eq('status', 'fila')
    if (!count) await db.from('crm_disparos').update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', d.id)
  }
  return { enviados, erros }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const u = new URL(req.url)

  try {
    // ── webhook do provedor ──
    const canalWebhook = u.searchParams.get('canal')
    if (canalWebhook) {
      const { canal, seg } = await canalESegredos(db, canalWebhook)
      // verificação da Meta (GET com hub.challenge)
      if (req.method === 'GET') {
        return u.searchParams.get('hub.verify_token') === seg.chave_webhook ? new Response(u.searchParams.get('hub.challenge') ?? '') : json({ erro: 'chave' }, 403)
      }
      if (canal.tipo !== 'whatsapp_oficial' && u.searchParams.get('chave') !== seg.chave_webhook) return json({ erro: 'chave' }, 403)
      const corpo = await req.json().catch(() => ({}))
      // status de conexão (servidor próprio)
      if (canal.tipo === 'whatsapp_qr' && String(corpo?.event ?? '').toLowerCase().includes('connection')) {
        const st = String(corpo?.data?.state ?? '')
        await db.from('crm_canais').update({ status: st === 'open' ? 'conectado' : st === 'connecting' ? 'conectando' : 'desconectado' }).eq('id', canal.id)
        return json({ ok: true })
      }
      for (const m of lerWebhook(canal, corpo)) {
        await db.rpc('crm_receber_mensagem', { p_canal: canal.id, p_telefone: m.telefone, p_nome: m.nome, p_texto: m.texto, p_tipo: m.tipo, p_id_externo: m.id })
      }
      return json({ ok: true })
    }

    const corpo = await req.json().catch(() => ({}))
    const acao = String(corpo.acao ?? '')

    // ── fila de disparos (cron) ──
    if (acao === 'processar_fila') {
      const { data: chave } = await db.rpc('crm_chave_cron')
      if (!chave || req.headers.get('x-cron-chave') !== chave) return json({ erro: 'chave' }, 403)
      return json(await processarFila(db))
    }

    // daqui para baixo: pessoa logada, com as regras de acesso dela
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: eu } = await usuario.auth.getUser()
    if (!eu?.user) return json({ erro: 'Entre no sistema de novo.' }, 401)

    if (acao === 'enviar') {
      const texto = String(corpo.texto ?? '').trim()
      if (!texto) return json({ erro: 'Escreva a mensagem.' }, 400)
      let conversaId = corpo.conversa_id ? String(corpo.conversa_id) : null
      if (!conversaId) {
        // começar conversa nova com um contato
        const { data: c } = await usuario.from('crm_contatos').select('id, empresa_id').eq('id', String(corpo.contato_id ?? '')).maybeSingle()
        if (!c) return json({ erro: 'Contato não encontrado.' }, 404)
        const { data: k } = await usuario.from('crm_canais').select('id').eq('id', String(corpo.canal_id ?? '')).eq('empresa_id', c.empresa_id).maybeSingle()
        if (!k) return json({ erro: 'Escolha o número.' }, 400)
        await db.from('crm_conversas').upsert({ empresa_id: c.empresa_id, contato_id: c.id, canal_id: k.id, atendente_id: eu.user.id }, { onConflict: 'canal_id,contato_id', ignoreDuplicates: true })
        const { data: v } = await db.from('crm_conversas').select('id').eq('canal_id', k.id).eq('contato_id', c.id).single()
        conversaId = v!.id
      }
      const { data: conv } = await usuario.from('crm_conversas').select('id, canal_id, atendente_id, contato_id').eq('id', conversaId!).maybeSingle()
      if (!conv) return json({ erro: 'Conversa não encontrada.' }, 404)
      if (!conv.atendente_id) await db.from('crm_conversas').update({ atendente_id: eu.user.id }).eq('id', conv.id)   // quem responde assume
      const { data: contato } = await db.from('crm_contatos').select('telefone').eq('id', conv.contato_id).single()
      const { canal, seg } = await canalESegredos(db, conv.canal_id)
      if (canal.status !== 'conectado') return json({ erro: `O número "${canal.nome}" não está conectado.` }, 400)
      const { data: msgId, error } = await db.rpc('crm_registrar_saida', { p_conversa: conv.id, p_texto: texto, p_autor: 'atendente', p_autor_id: eu.user.id })
      if (error) return json({ erro: error.message }, 400)
      const r = await despachar(db, msgId as string, canal, seg, contato!.telefone, texto)
      return json(r.ok ? { ok: true, mensagem: msgId, conversa: conv.id } : { erro: r.erro, mensagem: msgId }, r.ok ? 200 : 502)
    }

    if (acao === 'simular_entrada') {
      const { canal } = await canalESegredos(db, String(corpo.canal_id ?? ''))
      const { data: admin } = await usuario.rpc('crm_sou_admin', { p_empresa: canal.empresa_id })
      if (admin !== true) return json({ erro: 'Só o administrador.' }, 403)
      if (canal.tipo !== 'teste') return json({ erro: 'Simulação só no número de teste.' }, 400)
      const tel = String(corpo.telefone ?? '').replace(/\D/g, '')
      if (tel.length < 10) return json({ erro: 'Telefone inválido.' }, 400)
      const { data, error } = await db.rpc('crm_receber_mensagem', { p_canal: canal.id, p_telefone: tel, p_nome: corpo.nome ?? null, p_texto: String(corpo.texto ?? ''), p_id_externo: `sim-${crypto.randomUUID()}` })
      if (error) return json({ erro: error.message }, 400)
      return json({ ok: true, ...data })
    }

    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: (e as Error).message }, 500)
  }
})
