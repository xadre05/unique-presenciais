// Etapas de uma peça no quadro do Planejamento. Guardadas sem mudar o banco:
// status (rascunho / aprovada / postada / descartada) + conteudo.etapa para "ideia" e "em produção".
import { supabase } from '../../../lib/supabase'
import type { Peca } from '../comum'
import { FORMATO, infoFormato } from './formatos'
import { configDe } from './peca/editor'

export type Etapa = 'ideia' | 'producao' | 'revisao' | 'pronto' | 'publicado'

export const ETAPAS: { id: Etapa; nome: string; icone: string; cor: string }[] = [
  { id: 'ideia', nome: 'Ideias', icone: 'ideia', cor: '#9a9aa3' },
  { id: 'producao', nome: 'Em produção', icone: 'atualizar', cor: '#a46ee6' },
  { id: 'revisao', nome: 'Em revisão', icone: 'olho', cor: '#e0a93b' },
  { id: 'pronto', nome: 'Pronto', icone: 'check', cor: '#4cbf73' },
  { id: 'publicado', nome: 'Publicado', icone: 'enviar', cor: '#4f8fe6' },
]
export const ETAPA: Record<Etapa, (typeof ETAPAS)[number]> = Object.fromEntries(ETAPAS.map((e) => [e.id, e])) as Record<Etapa, (typeof ETAPAS)[number]>

export const COR_TIPO: Record<string, string> = Object.fromEntries(Object.entries(FORMATO).map(([k, f]) => [k, f.cor]))

// nome da situação no cartão e na lista: "Ideia salva", "Roteiro em elaboração", "Texto em revisão", "Aprovado"…
export function nomeSituacao(p: Peca) {
  const e = etapaDe(p)
  if (e === 'descartada') return 'Fora do planejamento'
  const material = infoFormato(p.tipo).material
  if (e === 'ideia') return p.conteudo.proposta ? 'Proposta do agente' : 'Ideia salva'
  // texto aprovado: falta a etapa do meio (arte, gravação, capa) ou a revisão final
  const c = p.conteudo as { aprovado_texto?: unknown; producao_ok?: unknown }
  if (c.aprovado_texto && (e === 'producao' || e === 'revisao')) {
    const e2 = configDe(p.tipo).etapa2
    return e2 && !c.producao_ok ? e2.pendente : 'Revisão final pendente'
  }
  if (e === 'producao') return `${material} em elaboração`
  if (e === 'revisao') return `${material} em revisão`
  return e === 'pronto' ? 'Aprovado' : 'Publicado'
}

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
  if (p.tipo === 'post' || p.tipo === 'email' || p.tipo === 'artigo') return ''
  return `${n} ${infoFormato(p.tipo).campos.roteiro[0].toLowerCase().split(' ')[0]}`
}
