// Edição do vídeo guardada na peça (conteudo.edicao): o nome do arquivo bruto (para conferir que é o mesmo), a
// transcrição e as receitas do agente. Só texto: o vídeo fica no computador de quem edita.
import { supabase } from '../../../../lib/supabase'
import { useConsulta } from '../../../../lib/dados'
import { alterarPeca } from '../peca/useEdicao'
import { EMPRESA } from '../useMarketing'
import type { Palavra, Plano } from './linhaTempo'
import type { MidiaApoio } from './midias'

export type ArquivoBruto = { nome: string; tamanho: number; duracao: number }
export type Receita = { plano: Plano; pedido?: string; em: string }
export type MusicaFundo = { nome: string; tamanho: number; volume: number }
export type Edicao = { arquivo?: ArquivoBruto; palavras?: Palavra[]; receitas?: Receita[]; midias?: MidiaApoio[]; musica?: MusicaFundo; atualizado_em?: string }
// o que vai para o agente de cada mídia de apoio: o número na lista, o que é e uma miniatura para ele ver
export type MidiaParaAgente = { n: number; tipo: 'imagem' | 'video'; descricao?: string; duracao?: number; miniatura?: string }

export const edicaoDa = (conteudo: Record<string, unknown>) => (conteudo.edicao ?? {}) as Edicao
export const mesmoArquivo = (a: ArquivoBruto | undefined, f: File) => !!a && a.nome === f.name && a.tamanho === f.size

async function chamar<T>(corpo: FormData | Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('editor-video', { body: corpo })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as T
}

export function transcrever(peca: string, wav: Blob) {
  const f = new FormData()
  f.append('empresa', EMPRESA); f.append('peca', peca); f.append('audio', wav, 'audio.wav')
  return chamar<{ palavras: Palavra[]; duracao: number }>(f)
}

// modeloRef = id da referência de estilo escolhida (Base da marca → Referências), para editar naquele estilo
// quadros = fotos do vídeo bruto (para o agente ver onde está o rosto e não cortar a cabeça na tela dividida)
export type OpcoesEdicao = { pedido?: string; lembrar?: string; anterior?: Plano; modeloRef?: string; quadros?: { t: number; miniatura: string }[] }
export function pedirEdicao(peca: string, palavras: Palavra[], duracao: number, midias: MidiaParaAgente[], o: OpcoesEdicao = {}) {
  return chamar<{ plano: Plano }>({ acao: 'editar', empresa: EMPRESA, peca, palavras, duracao, midias, pedido: o.pedido || undefined, lembrar: o.lembrar || undefined, anterior: o.anterior, modelo_ref: o.modeloRef || undefined, quadros: o.quadros?.length ? o.quadros : undefined })
}

// referências de estilo de vídeo já analisadas (reels e vídeo longo)
export function useReferenciasVideo() {
  return useConsulta<{ id: string; nome: string | null; autor: string | null; formato: string }[]>(() => supabase.from('marca_referencias').select('id,nome,autor,formato')
    .eq('empresa_id', EMPRESA).eq('ativo', true).eq('status', 'pronta').in('formato', ['reels', 'video']).order('atualizado_em', { ascending: false }).limit(30))
}

export async function guardarEdicao(peca: string, mudar: (e: Edicao) => Edicao) {
  const erro = await alterarPeca(peca, (p) => ({ conteudo: { ...p.conteudo, edicao: { ...mudar(edicaoDa(p.conteudo)), atualizado_em: new Date().toISOString() } } }))
  if (erro) throw new Error(erro)
}

// a empresa tem o Agente Editor de Vídeo? (contratado e ligado em Configurações → Agentes)
export function useTemEditor() {
  return useConsulta<boolean>(async () => {
    const { data, error } = await supabase.from('agentes_empresa').select('ativo').eq('empresa_id', EMPRESA).eq('agente_id', 'editor').maybeSingle()
    return { data: !!data?.ativo, error }
  })
}
