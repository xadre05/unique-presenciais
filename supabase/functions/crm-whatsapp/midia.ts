// CRM — WhatsApp: arquivos das conversas. O que chega é baixado do provedor e guardado no sistema (bucket crm-midia,
// privado); áudio é transcrito (Whisper, com a chave da OpenAI da empresa). O que sai vai por um link temporário.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { baixarMidiaMeta, type Canal, type Segredos } from './conectores.ts'
import type { MidiaRecebida } from './webhook.ts'

const BUCKET = 'crm-midia'
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'video/mp4': 'mp4', 'application/pdf': 'pdf' }
const extensao = (mime: string, nome?: string | null) => nome?.includes('.') ? nome.split('.').pop()!.toLowerCase().slice(0, 6) : EXT[mime.split(';')[0].trim()] ?? 'bin'

export async function guardarRecebida(db: SupabaseClient, canal: Canal, seg: Segredos, mensagemId: string, midia: MidiaRecebida, tipo: string) {
  try {
    if (canal.tipo !== 'whatsapp_oficial') return
    const { bytes, mime } = await baixarMidiaMeta(seg.segredos.token ?? '', midia.id)
    const caminho = `${canal.empresa_id}/${mensagemId}.${extensao(mime, midia.nome)}`
    const { error } = await db.storage.from(BUCKET).upload(caminho, new Blob([bytes], { type: mime }), { contentType: mime, upsert: true })
    if (error) throw new Error(error.message)
    await db.from('crm_mensagens').update({ midia_url: caminho, midia_mime: mime, midia_nome: midia.nome }).eq('id', mensagemId)
    if (tipo === 'audio') await transcrever(db, canal.empresa_id, mensagemId, bytes, mime)
  } catch (e) {
    await db.from('crm_mensagens').update({ erro: `Arquivo não baixado: ${(e as Error).message}`.slice(0, 300) }).eq('id', mensagemId)
  }
}

export async function transcrever(db: SupabaseClient, empresa: string, mensagemId: string, bytes: Uint8Array<ArrayBuffer>, mime: string) {
  const { data: chave } = await db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: 'openai' })
  if (!chave) return
  const f = new FormData()
  f.append('file', new Blob([bytes], { type: mime }), `audio.${extensao(mime)}`); f.append('model', 'whisper-1'); f.append('language', 'pt')
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: f })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || typeof d.text !== 'string') return
  await db.from('crm_mensagens').update({ transcricao: d.text.trim() }).eq('id', mensagemId)
  // custo: ~US$ 0,006 por minuto; áudio de WhatsApp em opus tem ~1,5 KB por segundo
  const minutos = Math.max(0.1, bytes.length / 1500 / 60)
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'atendimento', tipo: 'transcricao', status: 'pronto', pedido: { mensagem: mensagemId },
    resumo: 'Transcrição de áudio do WhatsApp', modelo: 'whisper-1', custo_usd: Math.round(minutos * 0.006 * 10000) / 10000, terminado_em: new Date().toISOString() })
}

/** Transcreve de novo (botão na tela), lendo o arquivo já guardado. */
export async function transcreverGuardado(db: SupabaseClient, empresa: string, mensagemId: string, caminho: string, mime: string | null) {
  const { data, error } = await db.storage.from(BUCKET).download(caminho)
  if (error || !data) throw new Error('Arquivo do áudio não encontrado.')
  await transcrever(db, empresa, mensagemId, new Uint8Array(await data.arrayBuffer()) as Uint8Array<ArrayBuffer>, mime ?? data.type)
}

/** Link temporário (1 h) para o provedor buscar o arquivo que vai ser enviado. */
export async function linkTemporario(db: SupabaseClient, caminho: string) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(caminho, 3600)
  if (error || !data?.signedUrl) throw new Error('Arquivo não encontrado para enviar.')
  return data.signedUrl
}
