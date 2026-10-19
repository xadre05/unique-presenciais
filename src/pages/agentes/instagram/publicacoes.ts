// Agendamentos de publicação no Instagram (marca_publicacoes): criar a partir de uma peça aprovada, cancelar, publicar
// agora ou tentar de novo. As artes que não são JPEG viram JPEG no navegador antes de subir (o Instagram só aceita
// JPEG); o vídeo do Reels vai para o armazenamento "videos".
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { acaoInstagram } from './dados'

export type FormatoPublicacao = 'imagem' | 'carrossel' | 'reels' | 'stories'
export type MidiaPublicacao = { bucket: 'arquivos' | 'videos'; caminho: string; tipo: 'imagem' | 'video' }
export type Publicacao = {
  id: string; peca_id: string | null; formato: FormatoPublicacao; midias: MidiaPublicacao[]; legenda: string | null; quando: string
  status: 'agendada' | 'publicando' | 'publicada' | 'erro' | 'cancelada'; link: string | null; erro: string | null; publicado_em: string | null; criado_em: string
}
// formato da peça → formato da publicação no Instagram (os outros formatos não são publicados daqui)
export const FORMATO_DA_PECA: Record<string, FormatoPublicacao> = { post: 'imagem', carrossel: 'carrossel', reels: 'reels', stories: 'stories' }
export const NOME_FORMATO_PUB: Record<FormatoPublicacao, string> = { imagem: 'Post de imagem', carrossel: 'Carrossel', reels: 'Reels', stories: 'Story' }

export function usePublicacoesDaPeca(empresa: string, pecaId: string) {
  return useConsulta<Publicacao[]>(() => supabase.from('marca_publicacoes').select('id,peca_id,formato,midias,legenda,quando,status,link,erro,publicado_em,criado_em')
    .eq('empresa_id', empresa).eq('peca_id', pecaId).order('criado_em', { ascending: false }).limit(5), [empresa, pecaId])
}

// imagem do armazenamento → JPEG (o Instagram não aceita PNG/WebP); JPEG já pronto é usado como está
export async function comoJpeg(caminho: string, pasta: string) {
  if (/\.jpe?g$/i.test(caminho)) return caminho
  const { data } = await supabase.storage.from('arquivos').download(caminho)
  if (!data) throw new Error('Não consegui abrir uma das artes.')
  const img = await createImageBitmap(data)
  const tela = document.createElement('canvas')
  tela.width = img.width; tela.height = img.height
  const ctx = tela.getContext('2d')!
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tela.width, tela.height)
  ctx.drawImage(img, 0, 0)
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.92))
  if (!blob) throw new Error('Não consegui converter uma das artes para JPEG.')
  const destino = `${pasta}/publicar/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('arquivos').upload(destino, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(msgErro(error))
  return destino
}

export async function enviarVideo(empresa: string, pecaId: string, arquivo: File) {
  const ext = arquivo.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4'
  const caminho = `${empresa}/${pecaId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('videos').upload(caminho, arquivo, { contentType: arquivo.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4') })
  if (error) throw new Error(/exceeded|too large|maximum/i.test(error.message) ? 'O vídeo passou do tamanho permitido. Exporte em 1080p (até 300 MB).' : msgErro(error))
  return caminho
}

export async function agendar(empresa: string, p: { pecaId: string; formato: FormatoPublicacao; midias: MidiaPublicacao[]; legenda: string; quando: Date; agora: boolean }) {
  const { data, error } = await supabase.from('marca_publicacoes').insert({ empresa_id: empresa, rede: 'instagram', peca_id: p.pecaId, formato: p.formato, midias: p.midias, legenda: p.legenda, quando: p.quando.toISOString() }).select('id').single()
  if (error) throw new Error(msgErro(error))
  if (p.agora) await publicarAgora(empresa, data.id)
  return data.id as string
}

export const publicarAgora = (empresa: string, id: string) => acaoInstagram<{ resultado: string }>(empresa, 'publicar', undefined, { id })

export async function cancelar(id: string) {
  const { error } = await supabase.from('marca_publicacoes').update({ status: 'cancelada' }).eq('id', id).eq('status', 'agendada')
  if (error) throw new Error(msgErro(error))
}
