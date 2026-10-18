// Canais (redes) que o agente de Marketing atende e os formatos de cada um. Ver docs/agentes/REGRAS_AGENTE_MARKETING.md.
// O "tipo" da peça é o formato (post, carrossel, reels = vídeo curto vertical, stories, video = vídeo longo);
// o canal fica em conteudo.rede (sem rede = Instagram, que é como as primeiras peças foram feitas).
import type { Peca } from '../comum'

export type Rede = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'linkedin'
export type Formato = 'post' | 'carrossel' | 'reels' | 'stories' | 'video'

type InfoRede = { nome: string; cor: string; ativa: boolean; formatos: Formato[]; nomes?: Partial<Record<Formato, string>> }
export const REDES: Record<Rede, InfoRede> = {
  instagram: { nome: 'Instagram', cor: '#e1306c', ativa: true, formatos: ['post', 'carrossel', 'reels', 'stories'] },
  youtube: { nome: 'YouTube', cor: '#ff3d3d', ativa: true, formatos: ['video', 'reels'], nomes: { video: 'Vídeo', reels: 'Shorts' } },
  tiktok: { nome: 'TikTok', cor: '#25f4ee', ativa: true, formatos: ['reels', 'carrossel'], nomes: { reels: 'Vídeo curto', carrossel: 'Carrossel de fotos' } },
  // prontos na estrutura, ligados depois (regra: Instagram, YouTube e TikTok primeiro)
  facebook: { nome: 'Facebook', cor: '#4f8fe6', ativa: false, formatos: ['post', 'reels', 'stories'] },
  linkedin: { nome: 'LinkedIn', cor: '#3b9bd9', ativa: false, formatos: ['post', 'carrossel', 'reels'], nomes: { reels: 'Vídeo curto', carrossel: 'Carrossel (PDF)' } },
}
export const LISTA_REDES = (Object.keys(REDES) as Rede[]).filter((r) => REDES[r].ativa)
const NOME_PADRAO: Record<Formato, string> = { post: 'Post', carrossel: 'Carrossel', reels: 'Reels', stories: 'Stories', video: 'Vídeo longo' }

// duração desejada para vídeos (regra 3)
export const DURACOES: Partial<Record<Formato, string[]>> = {
  reels: ['15 segundos', '30 segundos', '60 segundos', '90 segundos'],
  video: ['3 a 5 minutos', '6 a 10 minutos', '10 a 15 minutos', '15 a 25 minutos'],
}
export const ehVideo = (f: string) => f === 'reels' || f === 'video'

export const redeDe = (p: Pick<Peca, 'conteudo'>): Rede => { const r = p.conteudo.rede as Rede | undefined; return r && REDES[r] ? r : 'instagram' }
export const nomeFormato = (tipo: string, rede: Rede = 'instagram') => REDES[rede].nomes?.[tipo as Formato] ?? NOME_PADRAO[tipo as Formato] ?? tipo
export const rotuloPeca = (p: Pick<Peca, 'tipo' | 'conteudo'>) => { if (p.conteudo.livre) return 'Canal a definir'; const r = redeDe(p); return `${REDES[r].nome} · ${nomeFormato(p.tipo, r)}` }
