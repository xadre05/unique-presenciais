// Criativos NOSSOS que venderam: o ranking vem das vendas da Hotmart (o código de rastreio guarda o anúncio do Facebook).
// Para ensinar o agente, a equipe sobe o vídeo (ou a imagem) do anúncio campeão e, se quiser, o texto; o navegador
// transcreve a fala e tira quadros, e o Agente decompõe o roteiro. A referência fica na categoria "nosso" com o
// resultado, e o Agente de Marketing parte dela nos roteiros de venda (pode reaproveitar as frases, são nossas).
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import type { Ficha } from './dados'
import { estudarArquivo } from './estudoVideo'

export type Campeao = { anuncio: string; tipo: 'video' | 'imagem'; vendas: number; pedidos: number; receita: number; de: string; ate: string; campanhas: string; produtos: string; posicionamentos: string }

export function useCampeoes() {
  return useConsulta<Campeao[]>(() => supabase.rpc('criativos_campeoes'), [])
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('editor-video', { body: corpo })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as T
}

async function subir(caminho: string, arquivo: Blob) {
  const { error } = await supabase.storage.from('arquivos').upload(caminho, arquivo, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new Error('Não consegui enviar a imagem: ' + error.message)
  return caminho
}

// imagem do anúncio em JPEG de até 1024 px (o agente lê JPEG)
async function imagemEmJpeg(f: File) {
  const img = await createImageBitmap(f)
  const escala = Math.min(1, 1024 / Math.max(img.width, img.height))
  const tela = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * escala), height: Math.round(img.height * escala) })
  tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height)
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Não consegui ler a imagem.')
  return blob
}

// o que vai junto: quadros do vídeo (com a fala transcrita) ou a imagem do anúncio
async function material(pasta: string, arquivo: File | null, etapa: (t: string) => void) {
  if (!arquivo) return { arquivos: [], fala: '' }
  if (arquivo.type.startsWith('image/')) return { arquivos: [{ caminho: await subir(`${pasta}/imagem_0.0s.jpg`, await imagemEmJpeg(arquivo)), nome: arquivo.name, quadro: true }], fala: '' }
  const estudo = await estudarArquivo(arquivo, etapa)
  etapa('enviando os quadros')
  const arquivos = []
  for (const q of estudo.quadros) arquivos.push({ caminho: await subir(`${pasta}/q_${q.segundo.toFixed(1)}s.jpg`, q.arquivo), nome: 'quadro.jpg', quadro: true })
  return { arquivos, fala: estudo.fala ?? '' }
}

export type NovoCampeao = { arquivo: File | null; texto: string; por_que: string }

export async function guardarCampeao(empresa: string, c: Campeao, novo: NovoCampeao, etapa: (t: string) => void) {
  if (!novo.arquivo && !novo.texto.trim()) throw new Error('Suba o vídeo ou a imagem do anúncio, ou cole o texto dele.')
  const id = crypto.randomUUID()
  const { arquivos, fala } = await material(`agentes/referencias/${empresa}/${id}`, novo.arquivo, etapa)
  if (novo.arquivo && !fala && c.tipo === 'video' && !novo.texto.trim()) etapa('não consegui transcrever a fala; o agente vai pelas imagens')
  const texto = [novo.texto.trim() && `TEXTO DO ANÚNCIO:\n${novo.texto.trim()}`, fala && `FALA DO VÍDEO:\n${fala}`].filter(Boolean).join('\n\n')
  const { error } = await supabase.from('marca_referencias').insert({
    id, empresa_id: empresa, categoria: 'nosso', canal: 'instagram', formato: c.tipo === 'imagem' ? 'post' : 'reels', nome: c.anuncio,
    texto: texto || null, por_que: novo.por_que.trim() || null, arquivos, status: 'analisando',
    resultado: { vendas: c.vendas, receita: c.receita, campanha: c.campanhas, de: c.de, ate: c.ate, produtos: c.produtos },
  })
  if (error) throw new Error(msgErro(error))
  etapa('o agente está estudando o roteiro')
  return estudarCriativo(empresa, id)
}

export const estudarCriativo = (empresa: string, id: string) => chamar<{ ficha: Ficha }>({ acao: 'criativo', empresa, id })
