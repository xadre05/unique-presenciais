// Referências para modelar: posts, reels, carrosséis e textos de terceiros guardados como modelo de FORMATO.
// Separadas da Biblioteca da marca (conhecimento da própria empresa). Cada empresa só vê as suas.
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { enviarArquivo } from '../../../components/ui'
import { tirarQuadros } from './quadros'

export type Categoria = 'nosso' | 'concorrente' | 'outro_nicho' | 'admiro' | 'material' | 'outro'
export type Formato = 'carrossel' | 'reels' | 'post' | 'stories' | 'video' | 'texto' | 'outro'
export type Ficha = {
  resumo: string; gancho?: string; estrutura?: string[]; visual?: string; texto_na_tela?: string; ritmo?: string
  linguagem?: string; por_que_funciona?: string; como_usar?: string; nao_copiar?: string
  variacoes?: string; edicao?: string // só na ficha de canal
  argumento?: string; prova?: string; oferta?: string // só nos criativos nossos que venderam
}
// cada vídeo estudado de um canal: medidas tiradas no navegador, caminhos dos quadros e a análise do agente
export type VideoCanal = { nome: string; duracao: number; quadros: string[]; cortes_por_min?: number; palavras_por_min?: number; fala?: string; ficha?: Ficha; erro?: string }
export type Arquivo = { caminho: string; nome: string; quadro?: boolean }
export type Referencia = {
  id: string; nome: string | null; canal: string | null; categoria: Categoria; autor: string | null; link: string | null; formato: Formato; por_que: string | null; texto: string | null
  arquivos: Arquivo[]; ficha: Ficha | null; status: 'nova' | 'analisando' | 'pronta' | 'erro'; erro: string | null; criado_em: string
  tipo: 'peca' | 'canal'; videos: VideoCanal[]
  resultado: { vendas?: number; receita?: number; campanha?: string; de?: string; ate?: string } | null
}
export type NovaRef = { nome: string; canal: string; categoria: Categoria; formato: Formato; autor: string; link: string; por_que: string; texto: string }

export const CATEGORIAS: { id: Categoria; nome: string; dica: string }[] = [
  { id: 'nosso', nome: 'Nossos que deram resultado', dica: 'Posts e anúncios da própria empresa que funcionaram' },
  { id: 'concorrente', nome: 'Concorrentes', dica: 'Quem disputa o mesmo cliente' },
  { id: 'outro_nicho', nome: 'Outros nichos', dica: 'Formato bom de qualquer área, para trazer para a nossa' },
  { id: 'admiro', nome: 'Quem admiramos', dica: 'Profissionais e marcas que são inspiração' },
  { id: 'material', nome: 'Materiais comprados', dica: 'Cursos e pacotes de modelos (ex.: banco de ganchos)' },
  { id: 'outro', nome: 'Outras', dica: '' },
]
export const FORMATOS: { id: Formato; nome: string }[] = [
  { id: 'reels', nome: 'Reels' }, { id: 'carrossel', nome: 'Carrossel' }, { id: 'post', nome: 'Post de imagem' }, { id: 'stories', nome: 'Stories' },
  { id: 'video', nome: 'Vídeo longo' }, { id: 'texto', nome: 'Texto (legenda, e-mail, mensagem)' }, { id: 'outro', nome: 'Outro' },
]
// título do cartão: o nome dado pela equipe ou, sem ele, o formato e de quem é
export const tituloReferencia = (r: Pick<Referencia, 'nome' | 'formato' | 'autor'>) => r.nome?.trim() || `${nomeFormato(r.formato)}${r.autor ? ` · ${r.autor}` : ''}`
export const nomeFormato = (f: string) => FORMATOS.find((x) => x.id === f)?.nome ?? f
export const nomeCategoria = (c: string) => CATEGORIAS.find((x) => x.id === c)?.nome ?? c

export function useReferencias(empresa: string) {
  return useConsulta<Referencia[]>(() => supabase.from('marca_referencias').select('id,nome,canal,categoria,autor,link,formato,por_que,texto,arquivos,ficha,status,erro,criado_em,tipo,videos,resultado')
    .eq('empresa_id', empresa).eq('ativo', true).order('criado_em', { ascending: false }), [empresa])
}

// sobe os prints e os quadros do vídeo, depois grava a referência (o id vem antes para a pasta dos arquivos)
export async function guardarReferencia(empresa: string, nova: NovaRef, imagens: File[], video: File | null, etapa: (t: string) => void) {
  const id = crypto.randomUUID()
  const pasta = `agentes/referencias/${empresa}/${id}`
  const arquivos: Arquivo[] = []
  if (video) {
    etapa('Tirando os quadros do vídeo…')
    for (const q of await tirarQuadros(video)) arquivos.push({ caminho: await enviarArquivo(pasta, q), nome: q.name, quadro: true })
  }
  for (const [i, img] of imagens.entries()) {
    etapa(`Enviando print ${i + 1} de ${imagens.length}…`)
    arquivos.push({ caminho: await enviarArquivo(pasta, img), nome: img.name })
  }
  const { error } = await supabase.from('marca_referencias').insert({
    id, empresa_id: empresa, nome: nova.nome.trim() || null, canal: nova.canal || null, categoria: nova.categoria, formato: nova.formato, autor: nova.autor.trim() || null, link: nova.link.trim() || null,
    por_que: nova.por_que.trim() || null, texto: nova.texto.trim() || null, arquivos,
  })
  if (error) throw new Error(msgErro(error))
  return id
}

// o agente olha os arquivos e escreve a ficha (leva até 1 minuto)
export async function pedirFicha(empresa: string, id: string) {
  const { data, error } = await supabase.functions.invoke('agentes', { body: { empresa, referencia: id } })
  const d = data as { ficha?: Ficha; erro?: string } | null
  if (error || !d || d.erro) throw new Error(d?.erro ?? 'O agente não respondeu. Tente de novo.')
  return d.ficha
}

export async function mudarReferencia(id: string, campos: Partial<Pick<Referencia, 'categoria' | 'por_que'>> & { ativo?: boolean }) {
  const { error } = await supabase.from('marca_referencias').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(msgErro(error))
}
