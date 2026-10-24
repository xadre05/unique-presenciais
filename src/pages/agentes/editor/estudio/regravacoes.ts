// Trechos regravados: a pessoa gravou o vídeo inteiro e depois regravou alguns trechos em arquivos separados (juntados
// no fim do bruto). Para cada trecho regravado, acha o pedaço correspondente no vídeo completo (mesmas sequências de 4
// palavras), tira uma foto de cada versão e pede ao agente que escolha a melhor e a coloque NO LUGAR do original.
import type { ArquivoBruto } from '../../marketing/edicao/dados'
import type { Palavra } from '../../marketing/edicao/linhaTempo'
import type { FotoTomada } from './repeticoes'

const limpa = (p: string) => p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '')
const TAM = 4, SALTO_MAX = 12, MIN_PALAVRAS = 6, MAX_PARES = 8

type Faixa = { de: number; ate: number }
export type ParRegravacao = { original: Faixa; nova: Faixa; parte: string }

// faixa de palavras de cada parte no bruto juntado (as partes vêm uma depois da outra)
export function faixasDasPartes(palavras: Palavra[], partes: ArquivoBruto[]) {
  let base = 0
  return partes.map((p) => {
    const ini = base, fim = base + p.duracao; base = fim
    const idx = palavras.map((w, k) => (w.i >= ini && w.i < fim ? k : -1)).filter((k) => k >= 0)
    return { ...p, de: idx[0] ?? -1, ate: idx.at(-1) ?? -1 }
  }).filter((f) => f.de >= 0)
}

export const temRegravacao = (partes?: ArquivoBruto[]) => !!partes?.some((p) => p.papel === 'regravacao')

// a parte de cada palavra (para não confundir o fim de uma parte com o começo da seguinte numa tomada repetida)
export function parteDaPalavra(palavras: Palavra[], partes?: ArquivoBruto[]) {
  if (!partes || partes.length < 2) return undefined
  const faixas = faixasDasPartes(palavras, partes)
  return (k: number) => faixas.findIndex((f) => k >= f.de && k <= f.ate)
}

export function acharRegravacoes(palavras: Palavra[], partes: ArquivoBruto[]): ParRegravacao[] {
  const t = palavras.map((w) => limpa(w.p))
  const chave = (i: number) => t.slice(i, i + TAM).join(' ')
  const faixas = faixasDasPartes(palavras, partes)
  const originais = faixas.filter((f) => f.papel !== 'regravacao')
  const onde = new Map<string, number[]>()
  for (const f of originais) for (let i = f.de; i + TAM - 1 <= f.ate; i++) {
    if (t.slice(i, i + TAM).some((x) => !x)) continue
    onde.set(chave(i), [...(onde.get(chave(i)) ?? []), i])
  }
  const pares: ParRegravacao[] = []
  for (const r of faixas.filter((f) => f.papel === 'regravacao')) {
    // cada palavra da regravação que casa com o vídeo completo, seguindo a continuidade do trecho anterior
    type Aberto = { nova: Faixa; original: Faixa }
    let atual = null as Aberto | null
    const fechar = () => { if (atual && atual.nova.ate - atual.nova.de + 1 >= MIN_PALAVRAS) pares.push({ ...atual, parte: r.nome }); atual = null }
    for (let i = r.de; i + TAM - 1 <= r.ate; i++) {
      const lugares = onde.get(chave(i))
      if (!lugares) continue
      const esperado: number = atual ? atual.original.ate + (i - atual.nova.ate) : -1
      const p: number = atual ? lugares.reduce((a, b) => (Math.abs(b - esperado) < Math.abs(a - esperado) ? b : a)) : lugares[0]
      if (atual && i - atual.nova.ate <= SALTO_MAX && Math.abs(p - esperado) <= SALTO_MAX) {
        atual.nova.ate = i + TAM - 1; atual.original.ate = Math.max(atual.original.ate, p + TAM - 1)
      } else { fechar(); atual = { nova: { de: i, ate: i + TAM - 1 }, original: { de: p, ate: p + TAM - 1 } } }
    }
    fechar()
  }
  return pares.slice(0, MAX_PARES)
}

const fala = (palavras: Palavra[], f: Faixa, max = 10) => `${palavras.slice(f.de, Math.min(f.ate + 1, f.de + max)).map((w) => w.p).join(' ')}${f.ate - f.de >= max ? '…' : ''}`
const meio = (palavras: Palavra[], f: Faixa) => (palavras[f.de].i + palavras[f.ate].f) / 2

function textoPartes(palavras: Palavra[], partes: ArquivoBruto[]) {
  return faixasDasPartes(palavras, partes).map((f) => `- palavras ${f.de} a ${f.ate}: "${f.nome}" (${f.papel === 'regravacao' ? 'trecho regravado' : 'vídeo completo'})`).join('\n')
}

// sem fotos (ajustes depois da primeira edição): o agente continua sabendo das regravações e da ordem livre
export function avisoRegravacoes(palavras: Palavra[], partes: ArquivoBruto[], fotos?: number[][]) {
  const pares = acharRegravacoes(palavras, partes)
  if (!pares.length) return ''
  const linhas = pares.map((p, k) => `${k + 1}. "${fala(palavras, p.original)}" — no vídeo completo: palavras ${p.original.de} a ${p.original.ate}${fotos ? ` (foto em ${meio(palavras, p.original).toFixed(1)} s)` : ''}; regravado: palavras ${p.nova.de} a ${p.nova.ate}${fotos ? ` (foto em ${meio(palavras, p.nova).toFixed(1)} s)` : ''}`)
  return [
    'VÍDEO COMPLETO + TRECHOS REGRAVADOS. O bruto junta o vídeo completo e, no fim, trechos que a pessoa gravou de novo:',
    textoPartes(palavras, partes),
    `Para cada trecho abaixo existem duas versões. ${fotos ? 'Olhe as duas fotos e a fala, e' : 'Pela fala,'} escolha a MELHOR: expressão, olhar para a câmera, luz, postura e fala sem tropeço (a regravação normalmente foi feita porque a primeira não ficou boa: na dúvida, fique com a regravada).`,
    ...linhas,
    'ORDEM DOS TRECHOS: aqui a lista "trechos" é a ORDEM DO VÍDEO FINAL (não precisa ser a ordem do bruto). Siga o vídeo completo do começo ao fim e, onde a versão regravada for a melhor, coloque os trechos dela NO LUGAR dos originais (os originais desse pedaço saem). Os textos, zooms, coberturas e cenas sobre a parte regravada usam os números das palavras da regravação.',
    'Nunca use as duas versões do mesmo trecho, e nunca deixe um trecho regravado solto no fim do vídeo.',
    'No "resumo", diga em uma linha por trecho qual versão ficou e por quê.',
  ].join('\n')
}

export async function regravacoesParaAgente(palavras: Palavra[], partes: ArquivoBruto[], fotografar: (tempos: number[]) => Promise<FotoTomada[]>) {
  const pares = acharRegravacoes(palavras, partes)
  if (!pares.length) return { fotos: [] as FotoTomada[], aviso: '', pares: 0 }
  const fotos = await fotografar(pares.flatMap((p) => [meio(palavras, p.original), meio(palavras, p.nova)])).catch(() => [])
  return { fotos, aviso: avisoRegravacoes(palavras, partes, fotos.length ? [[]] : undefined), pares: pares.length }
}
