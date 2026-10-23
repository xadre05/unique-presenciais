// CRM — NÚCLEO: contas pequenas da caixa de conversas (tempo de espera, janela de 24 h da API oficial, sugestão da IA).
import { supabase } from '../../lib/supabase'
import type { Canal, Conversa, Mensagem } from '../tipos'

export const minutosDesde = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)) : 0)

export function tempoLegivel(min: number) {
  if (min < 60) return `${min} min`
  if (min < 1440) { const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${m} min` : `${h} h` }
  const d = Math.floor(min / 1440)
  return d === 1 ? '1 dia' : `${d} dias`
}

/** A pessoa escreveu por último e ninguém respondeu ainda. */
export const aguardandoResposta = (c: Conversa) => c.status === 'aberta' && c.ultima_direcao === 'entrada'

/** API oficial da Meta: passadas 24 h da última mensagem da pessoa, texto livre não sai (só modelo aprovado). */
export function foraDaJanela(canal: Canal | undefined, msgs: Mensagem[]) {
  if (canal?.tipo !== 'whatsapp_oficial') return false
  const ultima = [...msgs].reverse().find((m) => m.direcao === 'entrada')
  return !ultima || minutosDesde(ultima.criado_em) >= 24 * 60
}

/** Chama uma função do servidor e devolve o erro em português, se houver. */
async function invocar(funcao: string, corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(funcao, { body: corpo })
  if (error) {
    let msg = error.message
    try { const r = await (error as { context?: Response }).context?.json(); if (r?.erro) msg = r.erro } catch { /* sem corpo */ }
    throw new Error(msg)
  }
  if (data?.erro) throw new Error(data.erro)
  return data as Record<string, unknown>
}

/** Rascunho da próxima resposta escrito pela IA (não envia nada). */
export const sugerirResposta = async (conversaId: string) => String((await invocar('crm-sugerir', { conversa_id: conversaId })).texto ?? '')

/** Lista guardada no navegador (favoritas, recentes): some sem problema se o navegador não deixar guardar. */
export function lerLista(chave: string): string[] {
  try { return JSON.parse(localStorage.getItem(chave) ?? '[]') as string[] } catch { return [] }
}
export function guardarLista(chave: string, lista: string[]) {
  try { localStorage.setItem(chave, JSON.stringify(lista)) } catch { /* navegador não deixou guardar */ }
}

export type TipoMidia = 'imagem' | 'audio' | 'video' | 'documento'
export const tipoDoArquivo = (mime: string): TipoMidia => (mime.startsWith('image/') ? 'imagem' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'documento')
// limites do WhatsApp por tipo de arquivo (MB)
const LIMITE_MB: Record<TipoMidia, number> = { imagem: 5, audio: 16, video: 16, documento: 100 }

/** Sobe o arquivo para o sistema (bucket crm-midia) e devolve o que o servidor do WhatsApp precisa para enviar. */
export async function subirArquivo(empresaId: string, f: File) {
  const tipo = tipoDoArquivo(f.type || 'application/octet-stream')
  if (f.size > LIMITE_MB[tipo] * 1024 * 1024) throw new Error(`O WhatsApp aceita ${tipo === 'documento' ? 'documento' : tipo} de até ${LIMITE_MB[tipo]} MB.`)
  const ext = (f.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin'
  const caminho = `${empresaId}/saida/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('crm-midia').upload(caminho, f, { contentType: f.type || undefined })
  if (error) throw new Error(`Não consegui subir o arquivo: ${error.message}`)
  return { caminho, tipo, nome: f.name, mime: f.type || null }
}

const links = new Map<string, { url: string; ate: number }>()
/** Link temporário para ver/tocar um arquivo da conversa (guardado por 50 min). */
export async function linkDoArquivo(caminho: string) {
  const c = links.get(caminho)
  if (c && c.ate > Date.now()) return c.url
  const { data } = await supabase.storage.from('crm-midia').createSignedUrl(caminho, 3600)
  if (data?.signedUrl) links.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60000 })
  return data?.signedUrl ?? null
}

/** Conversa adiada que ainda não voltou (volta na hora marcada ou quando a pessoa escrever de novo). */
export const estaAdiada = (c: Conversa) => !!c.adiada_ate && Date.parse(c.adiada_ate) > Date.now()
  && !(c.ultima_direcao === 'entrada' && c.ultima_em && c.adiada_em && Date.parse(c.ultima_em) > Date.parse(c.adiada_em))

/** Resumo da conversa pela IA (fica guardado na conversa). */
export const resumirConversa = async (conversaId: string) => String((await invocar('crm-sugerir', { conversa_id: conversaId, acao: 'resumo' })).texto ?? '')

/** {{1}}, {{2}}… usados no texto de um modelo da Meta, e o texto com elas preenchidas. */
export const variaveisDe = (corpo: string) => [...new Set([...corpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b)
export const preencherModelo = (corpo: string, params: string[]) => corpo.replace(/\{\{(\d+)\}\}/g, (m, n) => params[Number(n) - 1] || m)
