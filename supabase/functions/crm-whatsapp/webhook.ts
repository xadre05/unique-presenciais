// CRM — WhatsApp: lê o que o provedor avisa (mensagem que chegou, eco do celular, status de entrega).
// deno-lint-ignore-file no-explicit-any
import type { Canal } from './conectores.ts'

export type MidiaRecebida = { id: string; mime: string | null; nome: string | null }
export type Recebida = { telefone: string; nome: string | null; texto: string | null; tipo: string; id: string | null; midia?: MidiaRecebida; anuncio?: Record<string, string> }
export type Status = { id: string; status: 'enviada' | 'entregue' | 'lida' | 'erro'; erro?: string }
export type Lido = { recebidas: Recebida[]; ecos: Recebida[]; status: Status[] }

const ROTULO: Record<string, string> = { imagem: '[foto]', audio: '[áudio]', video: '[vídeo]', documento: '[documento]', figurinha: '[figurinha]' }
export const rotuloMidia = (tipo: string) => ROTULO[tipo] ?? null

function tipoEvolution(msg: any) {
  const texto = msg.conversation ?? msg.extendedTextMessage?.text ?? msg.imageMessage?.caption ?? msg.videoMessage?.caption ?? msg.documentMessage?.caption ?? null
  const tipo = msg.imageMessage ? 'imagem' : msg.audioMessage ? 'audio' : msg.videoMessage ? 'video' : msg.documentMessage ? 'documento' : texto ? 'texto' : 'outro'
  return { texto, tipo }
}
function tipoMeta(m: any) {
  const texto = m.text?.body ?? m.image?.caption ?? m.video?.caption ?? m.document?.caption ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null
  const tipo = m.type === 'image' ? 'imagem' : m.type === 'audio' ? 'audio' : m.type === 'video' ? 'video' : m.type === 'document' ? 'documento' : m.type === 'sticker' ? 'figurinha' : texto ? 'texto' : 'outro'
  const bruto = m.image ?? m.audio ?? m.video ?? m.document ?? m.sticker
  const midia = bruto?.id ? { id: String(bruto.id), mime: bruto.mime_type ?? null, nome: bruto.filename ?? null } : undefined
  // veio de anúncio "clique para WhatsApp": guarda de qual anúncio
  const anuncio = m.referral ? { origem: 'anuncio', anuncio_id: String(m.referral.source_id ?? ''), titulo: String(m.referral.headline ?? ''), ctwa_clid: String(m.referral.ctwa_clid ?? '') } : undefined
  return { texto, tipo, midia, anuncio }
}
const STATUS_EVOLUTION: Record<string, Status['status']> = { SERVER_ACK: 'enviada', DELIVERY_ACK: 'entregue', READ: 'lida', PLAYED: 'lida', ERROR: 'erro', '2': 'enviada', '3': 'entregue', '4': 'lida', '5': 'lida', '0': 'erro' }
const STATUS_META: Record<string, Status['status']> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'erro' }

function evolution(corpo: any, r: Lido) {
  const evento = String(corpo?.event ?? '').toLowerCase().replace('_', '.')
  const lista = Array.isArray(corpo?.data) ? corpo.data : [corpo?.data]
  if (evento.includes('messages.upsert')) {
    for (const m of lista) {
      if (!m?.key) continue
      const jid = String(m.key.remoteJid ?? '')
      if (!jid.endsWith('@s.whatsapp.net')) continue          // ignora grupos, status e contatos sem número
      const { texto, tipo } = tipoEvolution(m.message ?? {})
      const item = { telefone: jid.split('@')[0], nome: m.key.fromMe ? null : (m.pushName ?? null), texto, tipo, id: m.key.id ?? null }
      if (m.key.fromMe) r.ecos.push(item); else r.recebidas.push(item)
    }
  }
  if (evento.includes('messages.update')) {
    for (const u of lista) {
      const id = u?.keyId ?? u?.key?.id
      const st = STATUS_EVOLUTION[String(u?.status ?? u?.update?.status ?? '')]
      if (id && st) r.status.push({ id, status: st })
    }
  }
}

function meta(corpo: any, r: Lido) {
  for (const e of corpo?.entry ?? []) for (const c of e.changes ?? []) {
    const v = c.value ?? {}
    const nomes: Record<string, string> = {}
    for (const ct of v.contacts ?? []) nomes[ct.wa_id] = ct.profile?.name
    for (const m of v.messages ?? []) {
      const { texto, tipo, midia, anuncio } = tipoMeta(m)
      r.recebidas.push({ telefone: m.from, nome: nomes[m.from] ?? null, texto, tipo, id: m.id ?? null, midia, anuncio })
    }
    // coexistência: o que a vendedora mandou pelo app WhatsApp Business do celular
    for (const m of v.message_echoes ?? []) {
      const { texto, tipo, midia } = tipoMeta(m)
      if (m.to) r.ecos.push({ telefone: String(m.to), nome: null, texto, tipo, id: m.id ?? null, midia })
    }
    for (const s of v.statuses ?? []) {
      const st = STATUS_META[String(s.status ?? '')]
      if (s.id && st) r.status.push({ id: s.id, status: st, erro: s.errors?.[0]?.error_data?.details ?? s.errors?.[0]?.message ?? s.errors?.[0]?.title })
    }
  }
}

export function lerWebhook(canal: Canal, corpo: any): Lido {
  const r: Lido = { recebidas: [], ecos: [], status: [] }
  if (canal.tipo === 'whatsapp_qr') evolution(corpo, r)
  if (canal.tipo === 'whatsapp_oficial') meta(corpo, r)
  return r
}
