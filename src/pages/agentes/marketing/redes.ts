// Canais (redes) que o agente de Marketing atende e os formatos de cada um. Ver docs/agentes/REGRAS_AGENTE_MARKETING.md.
// O "tipo" da peça é o formato (post, carrossel, reels = vídeo curto vertical, stories, video = vídeo longo);
// o canal fica em conteudo.rede (sem rede = Instagram, que é como as primeiras peças foram feitas).
// Quais canais a empresa usa é cadastrado em Base da marca → Redes sociais (perfil.redes); sem cadastro valem os 3 primeiros.
import { createContext, useContext } from 'react'
import type { Peca } from '../comum'

export type Rede = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'linkedin' | 'pinterest' | 'threads'
export type Formato = 'post' | 'carrossel' | 'reels' | 'stories' | 'video'

type InfoRede = { nome: string; cor: string; formatos: Formato[]; nomes?: Partial<Record<Formato, string>>; exemplo: string }
export const REDES: Record<Rede, InfoRede> = {
  instagram: { nome: 'Instagram', cor: '#e1306c', formatos: ['post', 'carrossel', 'reels', 'stories'], nomes: { post: 'Post', reels: 'Reels' }, exemplo: '@suaempresa' },
  youtube: { nome: 'YouTube', cor: '#ff3d3d', formatos: ['video', 'reels', 'post'], nomes: { video: 'Vídeo longo', reels: 'Shorts', post: 'Post da comunidade' }, exemplo: 'youtube.com/@suaempresa' },
  tiktok: { nome: 'TikTok', cor: '#25f4ee', formatos: ['reels', 'carrossel', 'stories'], nomes: { reels: 'Vídeo', carrossel: 'Carrossel de fotos', stories: 'Stories' }, exemplo: '@suaempresa' },
  facebook: { nome: 'Facebook', cor: '#4f8fe6', formatos: ['post', 'carrossel', 'reels', 'stories'], nomes: { post: 'Post', reels: 'Reels' }, exemplo: 'facebook.com/suaempresa' },
  linkedin: { nome: 'LinkedIn', cor: '#3b9bd9', formatos: ['post', 'carrossel', 'reels'], nomes: { post: 'Post', reels: 'Vídeo', carrossel: 'Carrossel (PDF)' }, exemplo: 'linkedin.com/company/suaempresa' },
  pinterest: { nome: 'Pinterest', cor: '#e60023', formatos: ['post', 'carrossel', 'reels'], nomes: { post: 'Pin', carrossel: 'Pin carrossel', reels: 'Pin em vídeo' }, exemplo: 'pinterest.com/suaempresa' },
  threads: { nome: 'Threads', cor: '#d9d9d9', formatos: ['post', 'carrossel'], nomes: { post: 'Post de texto', carrossel: 'Post com fotos' }, exemplo: '@suaempresa' },
}
export const TODAS_REDES = Object.keys(REDES) as Rede[]
export const REDES_PADRAO: Rede[] = ['instagram', 'youtube', 'tiktok']

// cadastro da empresa: { instagram: { ativa: true, perfil: '@unique' }, ... }
export type CadastroRedes = Partial<Record<Rede, { ativa: boolean; perfil?: string }>>
export function redesAtivas(perfil: Record<string, unknown> | undefined): Rede[] {
  const cad = (perfil?.redes ?? null) as CadastroRedes | null
  if (!cad) return REDES_PADRAO
  const lista = TODAS_REDES.filter((r) => cad[r]?.ativa)
  return lista.length ? lista : REDES_PADRAO
}
// os canais ligados chegam às telas por aqui (a tela do agente fornece a lista)
export const RedesAtivas = createContext<Rede[]>(REDES_PADRAO)
export const useRedes = () => useContext(RedesAtivas)

// nome do formato sem canal (filtros com vários canais): o jeito do formato, não o nome que cada rede dá a ele
const NOME_PADRAO: Record<Formato, string> = { post: 'Imagem (post)', carrossel: 'Carrossel', reels: 'Vídeo curto vertical', stories: 'Stories', video: 'Vídeo longo horizontal' }
export const FORMATOS: Formato[] = ['post', 'carrossel', 'reels', 'stories', 'video']
export const nomeGenerico = (tipo: string) => NOME_PADRAO[tipo as Formato] ?? tipo

// duração desejada para vídeos (regra 3)
export const DURACOES: Partial<Record<Formato, string[]>> = {
  reels: ['15 segundos', '30 segundos', '60 segundos', '90 segundos'],
  video: ['3 a 5 minutos', '6 a 10 minutos', '10 a 15 minutos', '15 a 25 minutos'],
}
export const ehVideo = (f: string) => f === 'reels' || f === 'video'

export const redeDe = (p: Pick<Peca, 'conteudo'>): Rede => { const r = p.conteudo.rede as Rede | undefined; return r && REDES[r] ? r : 'instagram' }
export const nomeFormato = (tipo: string, rede: Rede = 'instagram') => REDES[rede].nomes?.[tipo as Formato] ?? NOME_PADRAO[tipo as Formato] ?? tipo
export const rotuloPeca = (p: Pick<Peca, 'tipo' | 'conteudo'>) => { if (p.conteudo.livre) return 'Canal a definir'; const r = redeDe(p); return `${REDES[r].nome} · ${nomeFormato(p.tipo, r)}` }
