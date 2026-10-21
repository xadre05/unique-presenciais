// Chamadas da parte criativa paga do editor (função editor-criativo): ideias de b-roll e geração na Higgsfield
// (imagem primeiro, clipe só depois de aprovar a imagem) e narração com voz de IA na ElevenLabs.
import { supabase } from '../../../../lib/supabase'
import { EMPRESA } from '../../marketing/useMarketing'
import type { Palavra } from '../../marketing/edicao/linhaTempo'

async function chamar<T>(acao: string, corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('editor-criativo', { body: { acao, empresa: EMPRESA, ...corpo } })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as T
}

export type IdeiaBroll = { de: number; ate: number; descricao: string; prompt: string; movimento?: string }
export const ideiasBroll = (peca: string, palavras: Palavra[], quantos = 4) =>
  chamar<{ ideias: IdeiaBroll[] }>('broll_ideias', { peca, quantos, fala: palavras.map((w, n) => `${n}|${w.p}`).join('\n') })

export type Gerado = { caminho: string; bucket: 'arquivos' | 'videos'; tipo: 'imagem' | 'video' }
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
// manda gerar e acompanha até ficar pronto (imagem: segundos; clipe: 1 a 4 minutos)
export async function gerarNaHiggsfield(peca: string, o: { tipo: 'imagem' | 'video'; prompt: string; imagem?: string; duracao?: number }, aoEsperar?: (s: number) => void): Promise<Gerado> {
  const { pedido } = await chamar<{ pedido: string }>('broll_gerar', { peca, ...o, proporcao: '9:16' })
  const inicio = Date.now()
  for (;;) {
    await esperar(o.tipo === 'video' ? 6000 : 2500)
    aoEsperar?.(Math.round((Date.now() - inicio) / 1000))
    const r = await chamar<{ status: string; erro?: string } & Partial<Gerado>>('broll_status', { peca, pedido, tipo: o.tipo, duracao: o.duracao })
    if (r.erro) throw new Error(r.erro)
    if (r.status === 'completed' && r.caminho) return { caminho: r.caminho, bucket: r.bucket ?? 'arquivos', tipo: r.tipo ?? o.tipo }
    if (Date.now() - inicio > 10 * 60 * 1000) throw new Error('A geração passou de 10 minutos. Tente de novo mais tarde.')
  }
}

export async function linkGerado(g: { caminho: string; bucket?: string }) {
  const { data } = await supabase.storage.from(g.bucket ?? 'arquivos').createSignedUrl(g.caminho, 3600)
  return data?.signedUrl ?? null
}

export type Voz = { id: string; nome: string; tipo?: string; detalhes?: string; amostra?: string }
export const listarVozes = () => chamar<{ vozes: Voz[] }>('vozes', {})
export const narrar = (texto: string, voz: string, peca = '') => chamar<{ caminho: string; palavras: Palavra[]; duracao: number }>('narrar', { texto, voz, peca })
