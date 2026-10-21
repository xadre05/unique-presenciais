// Cortes de vídeo longo: a transcrição vira linhas com o segundo (para o agente escolher os trechos), os cortes que o
// agente propõe e a criação de um vídeo para editar por corte. A transcrição fica guardada no navegador (por nome e
// tamanho do arquivo) para não pagar de novo se a pessoa voltar ao mesmo vídeo.
import { supabase } from '../../../../lib/supabase'
import { EMPRESA } from '../../marketing/useMarketing'
import type { Palavra } from '../../marketing/edicao/linhaTempo'
import { criarVideo } from '../dados'
import { deixarArquivo, type Atalho } from '../arquivoPendente'

export type Corte = { titulo: string; de: number; ate: number; gancho: string; por_que: string; tipo?: string; nota: number }
export type Transcricao = { palavras: Palavra[]; duracao: number; cortes?: Corte[] }

// uma linha a cada pausa longa ou a cada ~18 palavras: "segundo | fala"
export function linhasDaTranscricao(palavras: Palavra[]) {
  const linhas: string[] = []
  let atual: Palavra[] = []
  const fechar = () => { if (atual.length) linhas.push(`${Math.round(atual[0].i)}-${Math.round(atual.at(-1)!.f)} | ${atual.map((w) => w.p).join(' ')}`); atual = [] }
  palavras.forEach((w, k) => {
    if (atual.length && (w.i - palavras[k - 1].f > 0.9 || atual.length >= 18)) fechar()
    atual.push(w)
  })
  fechar()
  return linhas.join('\n')
}

export async function pedirCortes(titulo: string, t: Transcricao, quantos: number) {
  const { data, error } = await supabase.functions.invoke('editor-criativo', { body: { acao: 'cortes', empresa: EMPRESA, titulo, linhas: linhasDaTranscricao(t.palavras), duracao: t.duracao, quantos } })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return ((data?.cortes ?? []) as Corte[]).filter((c) => c.ate > c.de).sort((a, b) => a.de - b.de)
}

export async function criarCortes(arquivo: File, atalho: Atalho | null, cortes: Corte[], t: Transcricao, campanha?: string) {
  const ids: string[] = []
  for (const c of cortes) {
    const palavras = t.palavras.filter((w) => w.i >= c.de - 0.3 && w.f <= c.ate + 0.5)
    const r = await criarVideo({ titulo: c.titulo, finalidade: 'organico', campanha, roteiro: '' }, {
      corte: { de: c.de, ate: c.ate, fonte: arquivo.name, gancho: c.gancho, por_que: c.por_que },
      edicao: { arquivo: { nome: arquivo.name, tamanho: arquivo.size, duracao: t.duracao }, palavras, atualizado_em: new Date().toISOString() },
    })
    if (r.erro || !r.id) throw new Error(r.erro ?? 'Não consegui criar um dos cortes.')
    deixarArquivo(r.id, arquivo, atalho)
    ids.push(r.id)
  }
  return ids
}

// ===== transcrição guardada no navegador =====
const BANCO = 'editor-cortes'
function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => { const r = indexedDB.open(BANCO, 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error) })
}
const chave = (f: File) => `${f.name}|${f.size}`
export async function transcricaoGuardada(f: File): Promise<Transcricao | null> {
  try { const db = await abrir(); return await new Promise((ok) => { const r = db.transaction('t').objectStore('t').get(chave(f)); r.onsuccess = () => ok((r.result as Transcricao) ?? null); r.onerror = () => ok(null) }) } catch { return null }
}
export async function guardarTranscricao(f: File, t: Transcricao) {
  try { const db = await abrir(); db.transaction('t', 'readwrite').objectStore('t').put(t, chave(f)) } catch { /* sem IndexedDB: só não fica guardada */ }
}
