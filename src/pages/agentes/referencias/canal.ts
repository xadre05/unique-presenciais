// Estudar um canal: a equipe baixa de 3 a 10 vídeos de um canal de que gosta (YouTube ou Instagram). Para cada vídeo,
// o navegador tira quadros, mede os cortes e transcreve a fala (estudoVideo.ts); os quadros sobem para a pasta do
// canal e o agente estuda vídeo por vídeo. No fim ele escreve a ficha do padrão do canal, que o Agente Editor e o
// Agente de Marketing usam como modelo. O vídeo em si nunca sai do computador.
import { supabase } from '../../../lib/supabase'
import { msgErro } from '../../../lib/dados'
import type { Ficha, Formato, Referencia, VideoCanal } from './dados'
import { estudarArquivo, type EstudoVideo } from './estudoVideo'

export type NovoCanal = { nome: string; rede: string; formato: Extract<Formato, 'reels' | 'video'>; autor: string; link: string; por_que: string }
export type Andamento = (n: number, texto: string) => void
export const MAX_VIDEOS = 10

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('editor-video', { body: corpo })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as T
}

async function gravarVideos(id: string, videos: VideoCanal[], extra: Record<string, unknown> = {}) {
  const { error } = await supabase.from('marca_referencias').update({ videos, ...extra, atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(msgErro(error))
}

async function subirQuadros(pasta: string, n: number, estudo: EstudoVideo) {
  const caminhos: string[] = []
  for (const q of estudo.quadros) {
    const caminho = `${pasta}/v${n + 1}_${q.segundo.toFixed(1)}s.jpg`
    const { error } = await supabase.storage.from('arquivos').upload(caminho, q.arquivo, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw new Error('Não consegui enviar os quadros: ' + error.message)
    caminhos.push(caminho)
  }
  return caminhos
}

const estudarNoAgente = (empresa: string, canal: string, n: number) => chamar<{ ficha: Ficha }>({ acao: 'canal_video', empresa, canal, n })
const fichaDoCanal = (empresa: string, canal: string) => chamar<{ ficha: Ficha }>({ acao: 'canal', empresa, canal })

export async function estudarCanal(empresa: string, c: NovoCanal, arquivos: File[], andamento: Andamento) {
  const id = crypto.randomUUID()
  const pasta = `agentes/referencias/${empresa}/${id}`
  const { error } = await supabase.from('marca_referencias').insert({
    id, empresa_id: empresa, tipo: 'canal', status: 'analisando', categoria: 'admiro', canal: c.rede, formato: c.formato,
    nome: c.nome.trim() || null, autor: c.autor.trim() || null, link: c.link.trim() || null, por_que: c.por_que.trim() || null,
  })
  if (error) throw new Error(msgErro(error))
  const videos: VideoCanal[] = []
  for (const [n, arquivo] of arquivos.entries()) {
    try {
      const estudo = await estudarArquivo(arquivo, (t) => andamento(n, t))
      andamento(n, 'enviando os quadros')
      const { duracao, cortes_por_min, palavras_por_min, fala } = estudo
      videos.push({ nome: arquivo.name, duracao, cortes_por_min, palavras_por_min, fala, quadros: await subirQuadros(pasta, n, estudo) })
      const capa = n === 0 && videos[0].quadros[0] ? { arquivos: [{ caminho: videos[0].quadros[0], nome: 'capa.jpg', quadro: true }] } : {}
      await gravarVideos(id, videos, capa)
      andamento(n, 'o agente está estudando')
      // a análise fica também na lista local: o próximo vídeo grava a lista inteira de novo
      const { ficha } = await estudarNoAgente(empresa, id, videos.length - 1)
      videos[videos.length - 1] = { ...videos[videos.length - 1], ficha }
      andamento(n, 'pronto')
    } catch (e) {
      andamento(n, `não deu certo: ${(e as Error).message}`)
    }
  }
  if (!videos.length) {
    await supabase.from('marca_referencias').update({ status: 'erro', erro: 'Nenhum vídeo pôde ser estudado.' }).eq('id', id)
    throw new Error('Nenhum vídeo pôde ser estudado. Tente com arquivos MP4.')
  }
  andamento(-1, 'escrevendo o padrão do canal')
  await fichaDoCanal(empresa, id)
  return id
}

// canal que parou no meio: estuda os vídeos que ficaram sem análise e escreve a ficha de novo
export async function retomarCanal(empresa: string, r: Referencia) {
  for (const [n, v] of r.videos.entries()) if (!v.ficha) await estudarNoAgente(empresa, r.id, n).catch(() => undefined)
  return fichaDoCanal(empresa, r.id)
}
