// Vídeo gravado em partes: lê a fala de cada parte, pede ao agente a ordem certa (pelo que foi falado e pelo roteiro)
// e, depois de juntar, monta a transcrição do vídeo inteiro com o tempo de cada palavra deslocado pela parte.
import { supabase } from '../../../../lib/supabase'
import { EMPRESA } from '../../marketing/useMarketing'
import { audioDoVideo } from '../../marketing/edicao/audio'
import { transcrever, type ArquivoBruto } from '../../marketing/edicao/dados'
import type { Palavra } from '../../marketing/edicao/linhaTempo'

export type Papel = 'gancho' | 'corpo' | 'chamada' | 'completo'
export type Parte = { arquivo: File; duracao?: number; palavras?: Palavra[]; papel?: Papel; fora?: string }
export type Ordem = { ordem: number[]; descartar: { parte: number; motivo: string }[]; papeis: { parte: number; papel: Papel }[]; explicacao: string }

export async function lerParte(peca: string, parte: Parte): Promise<Parte> {
  const audio = await audioDoVideo(parte.arquivo)
  const { palavras } = await transcrever(peca, audio.wav)
  return { ...parte, duracao: audio.duracao, palavras }
}

export const falaDa = (p: Parte) => (p.palavras ?? []).map((x) => x.p).join(' ')

// as partes vão numeradas a partir de 1 (a posição na lista escolhida)
export async function pedirOrdem(peca: string, partes: Parte[], roteiro?: string): Promise<Ordem> {
  const corpo = { acao: 'ordenar', empresa: EMPRESA, peca, roteiro: roteiro || undefined,
    partes: partes.map((p, k) => ({ n: k + 1, nome: p.arquivo.name, duracao: p.duracao ?? 0, fala: falaDa(p) })) }
  const { data, error } = await supabase.functions.invoke('editor-criativo', { body: corpo })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as Ordem
}

// a fala do vídeo juntado: as palavras de cada parte, deslocadas pelo tempo das partes que vieram antes
export function juntarPalavras(partes: Parte[], duracoes: number[]): Palavra[] {
  let base = 0
  return partes.flatMap((p, k) => {
    const deslocadas = (p.palavras ?? []).map((w) => ({ ...w, i: w.i + base, f: w.f + base }))
    base += duracoes[k] ?? p.duracao ?? 0
    return deslocadas
  })
}

export const infoDa = (p: Parte): ArquivoBruto => ({ nome: p.arquivo.name, tamanho: p.arquivo.size, duracao: p.duracao ?? 0 })
const mesma = (a: ArquivoBruto, f: File) => a.nome === f.name && a.tamanho === f.size

// as partes escolhidas são as mesmas já juntadas antes? devolve a ordem guardada (posições na lista escolhida)
export function ordemGuardada(salvas: ArquivoBruto[] | undefined, arquivos: File[]): number[] | null {
  if (!salvas?.length) return null
  const ordem = salvas.map((s) => arquivos.findIndex((f) => mesma(s, f)))
  return ordem.every((k) => k >= 0) ? ordem : null
}

export const nomeDoJuntado = (titulo: string) => `${titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - partes juntas.mp4`
