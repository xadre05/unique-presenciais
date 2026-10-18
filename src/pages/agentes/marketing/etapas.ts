// Etapas de uma peça no quadro do Planejamento. Guardadas sem mudar o banco:
// status (rascunho / aprovada / postada / descartada) + conteudo.etapa para "ideia" e "em produção".
import { supabase } from '../../../lib/supabase'
import type { Peca } from '../comum'

export type Etapa = 'ideia' | 'producao' | 'revisao' | 'pronto' | 'publicado'

export const ETAPAS: { id: Etapa; nome: string; icone: string; cor: string }[] = [
  { id: 'ideia', nome: 'Ideias', icone: 'ideia', cor: '#9a9aa3' },
  { id: 'producao', nome: 'Em produção', icone: 'atualizar', cor: '#a46ee6' },
  { id: 'revisao', nome: 'Em revisão', icone: 'olho', cor: '#e0a93b' },
  { id: 'pronto', nome: 'Pronto', icone: 'check', cor: '#4cbf73' },
  { id: 'publicado', nome: 'Publicado', icone: 'enviar', cor: '#4f8fe6' },
]
export const ETAPA: Record<Etapa, (typeof ETAPAS)[number]> = Object.fromEntries(ETAPAS.map((e) => [e.id, e])) as Record<Etapa, (typeof ETAPAS)[number]>

export const COR_TIPO: Record<string, string> = { post: '#d9a24b', carrossel: '#a46ee6', reels: '#e5534b', stories: '#2fb3a0', video: '#e07b39' }

export function etapaDe(p: Peca): Etapa | 'descartada' {
  if (p.status === 'descartada') return 'descartada'
  if (p.status === 'postada') return 'publicado'
  if (p.status === 'aprovada') return 'pronto'
  if (p.conteudo.etapa === 'ideia') return 'ideia'
  if (p.conteudo.etapa === 'producao') return 'producao'
  return 'revisao'
}

// peça que ainda é só ideia: o agente precisa escrever antes de virar rascunho de verdade
export const ehIdeia = (p: Peca) => p.conteudo.etapa === 'ideia'

export async function moverPara(p: Peca, etapa: Etapa) {
  const { etapa: _e, ...resto } = p.conteudo
  const conteudo = etapa === 'ideia' || etapa === 'producao' ? { ...resto, etapa } : resto
  const status = etapa === 'pronto' ? 'aprovada' : etapa === 'publicado' ? 'postada' : 'rascunho'
  const { data } = await supabase.auth.getUser()
  return supabase.from('agentes_pecas').update({ status, conteudo, decidido_por: data.user?.id ?? null, atualizado_em: new Date().toISOString() }).eq('id', p.id)
}

export function mudarPeca(id: string, campos: Record<string, unknown>) {
  return supabase.from('agentes_pecas').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id)
}

// quantas telas/lâminas/cenas a peça tem, para mostrar no cartão
export function tamanho(p: Peca) {
  const n = p.conteudo.roteiro?.length ?? 0
  if (!n) return ''
  return p.tipo === 'stories' ? `${n} telas` : p.tipo === 'carrossel' ? `${n} lâminas` : p.tipo === 'reels' ? `${n} cenas` : p.tipo === 'video' ? `${n} blocos` : ''
}
