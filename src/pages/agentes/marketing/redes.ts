// Redes sociais que o agente de Marketing atende e os formatos de cada uma.
// O "tipo" da peça é o formato (post, carrossel, reels = vídeo curto vertical, stories, video = vídeo longo);
// a rede fica em conteudo.rede (sem rede = Instagram, que é como as primeiras peças foram feitas).
import type { Peca } from '../comum'

export type Rede = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin'
export type Formato = 'post' | 'carrossel' | 'reels' | 'stories' | 'video'

export const REDES: Record<Rede, { nome: string; cor: string; formatos: Formato[]; nomes?: Partial<Record<Formato, string>> }> = {
  instagram: { nome: 'Instagram', cor: '#e1306c', formatos: ['post', 'carrossel', 'reels', 'stories'] },
  tiktok: { nome: 'TikTok', cor: '#25f4ee', formatos: ['reels', 'carrossel'], nomes: { reels: 'Vídeo', carrossel: 'Carrossel de fotos' } },
  youtube: { nome: 'YouTube', cor: '#ff3d3d', formatos: ['reels', 'video'], nomes: { reels: 'Shorts', video: 'Vídeo longo' } },
  facebook: { nome: 'Facebook', cor: '#4f8fe6', formatos: ['post', 'reels', 'stories'] },
  linkedin: { nome: 'LinkedIn', cor: '#3b9bd9', formatos: ['post', 'carrossel', 'reels'], nomes: { reels: 'Vídeo curto', carrossel: 'Carrossel (PDF)' } },
}
export const LISTA_REDES = Object.keys(REDES) as Rede[]
const NOME_PADRAO: Record<Formato, string> = { post: 'Post', carrossel: 'Carrossel', reels: 'Reels', stories: 'Stories', video: 'Vídeo longo' }

export const redeDe = (p: Pick<Peca, 'conteudo'>): Rede => ((p.conteudo as { rede?: Rede }).rede && REDES[(p.conteudo as { rede: Rede }).rede] ? (p.conteudo as { rede: Rede }).rede : 'instagram')
export const nomeFormato = (tipo: string, rede: Rede = 'instagram') => REDES[rede].nomes?.[tipo as Formato] ?? NOME_PADRAO[tipo as Formato] ?? tipo
// rótulo curto do cartão: "Reels" no Instagram, "TikTok · Vídeo" nas outras redes
export const rotuloPeca = (p: Pick<Peca, 'tipo' | 'conteudo'>) => { const r = redeDe(p); return r === 'instagram' ? nomeFormato(p.tipo, r) : `${REDES[r].nome} · ${nomeFormato(p.tipo, r)}` }
