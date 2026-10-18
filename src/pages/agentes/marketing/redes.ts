// Canais que o agente de Marketing atende e os formatos de cada um. Ver docs/agentes/REGRAS_AGENTE_MARKETING.md.
// O formato (o que a peça é) fica em formatos.ts; aqui fica onde ela sai e o nome que cada canal dá ao formato
// (ex.: vídeo curto = Reels no Instagram, Shorts no YouTube). O canal fica em conteudo.rede (sem rede = Instagram).
// Quais canais a empresa usa é cadastrado em Base da marca → Redes sociais (perfil.redes); sem cadastro valem os 3 primeiros.
import { createContext, useContext } from 'react'
import type { Peca } from '../comum'
import { FORMATO, FORMATOS, DURACOES, ehVideo, type Formato } from './formatos'

export { FORMATOS, DURACOES, ehVideo, type Formato }
export type Rede = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'linkedin' | 'pinterest' | 'threads' | 'email' | 'whatsapp' | 'site'

type InfoRede = { nome: string; cor: string; formatos: Formato[]; nomes?: Partial<Record<Formato, string>>; exemplo: string }
export const REDES: Record<Rede, InfoRede> = {
  instagram: { nome: 'Instagram', cor: '#e1306c', formatos: ['post', 'carrossel', 'reels', 'stories', 'live'], nomes: { reels: 'Reels' }, exemplo: '@suaempresa' },
  youtube: { nome: 'YouTube', cor: '#ff3d3d', formatos: ['video', 'reels', 'live', 'post', 'texto'], nomes: { reels: 'Shorts', post: 'Imagem na comunidade', texto: 'Texto / enquete na comunidade' }, exemplo: 'youtube.com/@suaempresa' },
  tiktok: { nome: 'TikTok', cor: '#25f4ee', formatos: ['reels', 'carrossel', 'stories', 'live'], nomes: { reels: 'Vídeo', carrossel: 'Carrossel de fotos' }, exemplo: '@suaempresa' },
  facebook: { nome: 'Facebook', cor: '#4f8fe6', formatos: ['post', 'carrossel', 'reels', 'stories', 'texto', 'live'], nomes: { reels: 'Reels' }, exemplo: 'facebook.com/suaempresa' },
  linkedin: { nome: 'LinkedIn', cor: '#3b9bd9', formatos: ['post', 'carrossel', 'reels', 'texto', 'artigo', 'live'], nomes: { reels: 'Vídeo', carrossel: 'Carrossel em PDF', artigo: 'Artigo / newsletter' }, exemplo: 'linkedin.com/company/suaempresa' },
  pinterest: { nome: 'Pinterest', cor: '#e60023', formatos: ['post', 'carrossel', 'reels'], nomes: { post: 'Pin', carrossel: 'Pin carrossel', reels: 'Pin em vídeo' }, exemplo: 'pinterest.com/suaempresa' },
  threads: { nome: 'Threads', cor: '#d9d9d9', formatos: ['texto', 'post', 'carrossel'], exemplo: '@suaempresa' },
  email: { nome: 'E-mail', cor: '#c18cff', formatos: ['email', 'pdf'], exemplo: 'contato@suaempresa.com.br' },
  whatsapp: { nome: 'WhatsApp', cor: '#25d366', formatos: ['mensagem', 'pdf'], exemplo: '(11) 99999-0000' },
  site: { nome: 'Site', cor: '#4fb3e6', formatos: ['artigo', 'pdf'], nomes: { artigo: 'Artigo do blog' }, exemplo: 'suaempresa.com.br' },
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

// nome do formato sem canal (filtros com vários canais) e o nome que um canal dá a ele
export const nomeGenerico = (tipo: string) => FORMATO[tipo as Formato]?.nome ?? tipo
export const redeDe = (p: Pick<Peca, 'conteudo'>): Rede => { const r = p.conteudo.rede as Rede | undefined; return r && REDES[r] ? r : 'instagram' }
export const nomeFormato = (tipo: string, rede: Rede = 'instagram') => REDES[rede].nomes?.[tipo as Formato] ?? nomeGenerico(tipo)
export const rotuloPeca = (p: Pick<Peca, 'tipo' | 'conteudo'>) => { if (p.conteudo.livre) return 'Canal a definir'; const r = redeDe(p); return `${REDES[r].nome} · ${nomeFormato(p.tipo, r)}` }
