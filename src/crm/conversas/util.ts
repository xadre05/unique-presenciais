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

/** Rascunho da próxima resposta escrito pela IA (não envia nada). */
export async function sugerirResposta(conversaId: string) {
  const { data, error } = await supabase.functions.invoke('crm-sugerir', { body: { conversa_id: conversaId } })
  if (error) {
    let msg = error.message
    try { const r = await (error as { context?: Response }).context?.json(); if (r?.erro) msg = r.erro } catch { /* sem corpo */ }
    throw new Error(msg)
  }
  if (data?.erro) throw new Error(data.erro)
  return String(data?.texto ?? '')
}

/** Lista guardada no navegador (favoritas, recentes): some sem problema se o navegador não deixar guardar. */
export function lerLista(chave: string): string[] {
  try { return JSON.parse(localStorage.getItem(chave) ?? '[]') as string[] } catch { return [] }
}
export function guardarLista(chave: string, lista: string[]) {
  try { localStorage.setItem(chave, JSON.stringify(lista)) } catch { /* navegador não deixou guardar */ }
}
