// Edição do vídeo guardada na peça (conteudo.edicao): o nome do arquivo bruto (para conferir que é o mesmo), a
// transcrição e as receitas do agente. Só texto: o vídeo fica no computador de quem edita.
import { supabase } from '../../../../lib/supabase'
import { useConsulta } from '../../../../lib/dados'
import { alterarPeca } from '../peca/useEdicao'
import { EMPRESA } from '../useMarketing'
import type { Palavra, Plano } from './linhaTempo'
import type { MidiaApoio } from './midias'
import { destinoDa, type Destino } from '../peca/editor'
import type { Peca } from '../../comum'

export type ArquivoBruto = { nome: string; tamanho: number; duracao: number }
export type Receita = { plano: Plano; pedido?: string; em: string }
export type MusicaFundo = { nome: string; tamanho: number; volume: number }
// final = o vídeo editado, guardado no armazenamento quando a edição é concluída (é ele que o Marketing ou o Tráfego
// recebem); concluida = quando e para onde foi entregue; referencia = o estilo pedido só para este vídeo
export type VideoFinal = { caminho: string; nome: string; tamanho: number; em: string }
export type ReferenciaVideo = { nome: string; texto: string; quadros: { t: number; miniatura: string }[] }
export type Edicao = { arquivo?: ArquivoBruto; palavras?: Palavra[]; receitas?: Receita[]; midias?: MidiaApoio[]; musica?: MusicaFundo; atualizado_em?: string
  final?: VideoFinal; concluida?: { em: string; destino: Destino }; referencia?: ReferenciaVideo; estilo_ref?: string; capa?: string; config_estilo?: ConfigEstilo }
// ajustes finos do estilo só para este vídeo (etapa Estilo do Estúdio)
export type ConfigEstilo = { ritmo?: 'rapido' | 'moderado' | 'calmo'; legenda?: 'palavras' | 'chave'; imagens?: 'muitas' | 'algumas' | 'poucas'; efeitos?: 'muitos' | 'poucos' | 'nenhum' }
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
export type OpcoesEdicao = { pedido?: string; lembrar?: string; anterior?: Plano; modeloRef?: string; quadros?: { t: number; miniatura: string }[]; referencia?: ReferenciaVideo }
export function pedirEdicao(peca: string, palavras: Palavra[], duracao: number, midias: MidiaParaAgente[], o: OpcoesEdicao = {}) {
  return chamar<{ plano: Plano }>({ acao: 'editar', empresa: EMPRESA, peca, palavras, duracao, midias, pedido: o.pedido || undefined, lembrar: o.lembrar || undefined, anterior: o.anterior, modelo_ref: o.modeloRef || undefined, quadros: o.quadros?.length ? o.quadros : undefined, referencia: o.referencia })
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

// Concluir a edição: o vídeo editado sobe para o armazenamento (até 300 MB) e a peça é entregue conforme a origem
// (ver destinoDa). O vídeo de um post planejado ou avulso marca a etapa "Vídeo editado" da peça.
export async function concluirEdicao(peca: Peca, video: File, aoEnviar?: (texto: string) => void) {
  const ext = video.type.includes('webm') ? 'webm' : video.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4'
  const caminho = `${EMPRESA}/${peca.id}/editado-${crypto.randomUUID()}.${ext}`
  aoEnviar?.(`Enviando o vídeo editado (${(video.size / 1048576).toFixed(0)} MB)…`)
  const { error } = await supabase.storage.from('videos').upload(caminho, video, { contentType: video.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4') })
  if (error) throw new Error(/exceeded|too large|maximum/i.test(error.message) ? 'O vídeo passou de 300 MB. Gere o vídeo final de novo ou exporte em 1080p.' : error.message)
  const em = new Date().toISOString(), destino = destinoDa(peca)
  const { data: u } = await supabase.auth.getUser()
  const erro = await alterarPeca(peca.id, (p) => ({ conteudo: {
    ...p.conteudo,
    producao_ok: { em, por: u.user?.email ?? 'Agente Editor' },
    edicao: { ...edicaoDa(p.conteudo), final: { caminho, nome: video.name, tamanho: video.size, em }, concluida: { em, destino }, atualizado_em: em },
  } }))
  if (erro) throw new Error(erro)
  return destino
}

// link temporário (1 hora) para assistir ou baixar o vídeo editado
export async function linkDoFinal(final: VideoFinal) {
  const { data, error } = await supabase.storage.from('videos').createSignedUrl(final.caminho, 3600, { download: false })
  if (error) throw new Error(error.message)
  return data.signedUrl
}
