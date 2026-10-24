// Vídeo gravado em partes: lê a fala de cada parte, pede ao agente a ordem certa (pelo que foi falado e pelo roteiro)
// e, depois de juntar, monta a transcrição do vídeo inteiro com o tempo de cada palavra deslocado pela parte.
import { supabase } from '../../../../lib/supabase'
import { EMPRESA } from '../../marketing/useMarketing'
import { guardarEdicao, type ArquivoBruto, type Edicao } from '../../marketing/edicao/dados'
import type { Progresso } from '../cortes/audioLongo'
import { transcreverVideo } from '../cortes/audioLongo'
import type { Palavra } from '../../marketing/edicao/linhaTempo'

export type Papel = 'gancho' | 'corpo' | 'chamada' | 'completo' | 'regravacao'
export type Parte = { arquivo: File; duracao?: number; palavras?: Palavra[]; papel?: Papel; fora?: string }
export type Ordem = { ordem: number[]; descartar: { parte: number; motivo: string }[]; papeis: { parte: number; papel: Papel }[]; explicacao: string }

// cada parte é ouvida (transcrita, o que custa) UMA vez: a fala fica guardada na peça e volta pelo nome e tamanho
// do arquivo, mesmo depois de recarregar a página ou escolher as partes de novo
export async function lerParte(peca: string, parte: Parte, aoProgresso?: Progresso, guardadas: Edicao['falas_partes'] = []): Promise<Parte & { reaproveitada?: boolean }> {
  const ja = guardadas.find((g) => g.nome === parte.arquivo.name && g.tamanho === parte.arquivo.size)
  if (ja?.palavras.length) return { ...parte, duracao: ja.duracao, palavras: ja.palavras, reaproveitada: true }
  const { palavras, duracao } = await transcreverVideo(peca, parte.arquivo, aoProgresso)
  const nova = { nome: parte.arquivo.name, tamanho: parte.arquivo.size, duracao, palavras }
  await guardarEdicao(peca, (e) => ({ ...e, falas_partes: [...(e.falas_partes ?? []).filter((g) => !(g.nome === nova.nome && g.tamanho === nova.tamanho)), nova].slice(-8) })).catch(() => { /* sem guardar: na próxima vez ouve de novo */ })
  return { ...parte, duracao, palavras }
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

export const infoDa = (p: Parte): ArquivoBruto => ({ nome: p.arquivo.name, tamanho: p.arquivo.size, duracao: p.duracao ?? 0, papel: p.papel })
const mesma = (a: ArquivoBruto, f: File) => a.nome === f.name && a.tamanho === f.size

// as partes escolhidas são as mesmas já juntadas antes? devolve a ordem guardada (posições na lista escolhida)
export function ordemGuardada(salvas: ArquivoBruto[] | undefined, arquivos: File[]): number[] | null {
  if (!salvas?.length || salvas.length !== arquivos.length) return null
  const ordem = salvas.map((s) => arquivos.findIndex((f) => mesma(s, f)))
  return ordem.every((k) => k >= 0) ? ordem : null
}

export const nomeDoJuntado = (titulo: string) => `${titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - partes juntas.mp4`

// Regravações: a pessoa gravou o vídeo inteiro e depois regravou alguns trechos em arquivos separados. Uma parte cuja
// fala já está quase toda dentro de outra parte maior (mesmas sequências de 4 palavras) é regravação: entra no vídeo
// DEPOIS das outras, para o agente comparar e escolher a melhor versão de cada trecho na edição. Nunca fica fora.
const limpa = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '')
function sequencias(p: Parte) {
  const t = (p.palavras ?? []).map((w) => limpa(w.p)).filter(Boolean)
  return t.slice(0, Math.max(0, t.length - 3)).map((_, i) => t.slice(i, i + 4).join(' '))
}
const PARTE_REPETIDA = 0.25
export function marcarRegravacoes(partes: Parte[], ordem: number[]): { partes: Parte[]; ordem: number[]; achadas: number[] } {
  const seq = partes.map((p) => sequencias(p))
  const todas = partes.map((_, k) => k)
  const achadas = todas.filter((k) => {
    if (seq[k].length < 4) return false
    return todas.some((m) => {
      if (m === k || seq[m].length <= seq[k].length) return false
      const da = new Set(seq[m])
      return seq[k].filter((s) => da.has(s)).length / seq[k].length >= PARTE_REPETIDA
    })
  })
  if (!achadas.length) return { partes, ordem, achadas }
  const base = ordem.filter((k) => !achadas.includes(k))
  const resto = todas.filter((k) => !achadas.includes(k) && !base.includes(k))
  return {
    partes: partes.map((p, k) => (achadas.includes(k) ? { ...p, papel: 'regravacao' as Papel, fora: undefined } : p)),
    ordem: [...(base.length ? base : resto.slice(0, 1)), ...achadas],
    achadas,
  }
}
