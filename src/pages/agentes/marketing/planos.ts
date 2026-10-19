// Planejamentos (planos de conteúdo): ficam no perfil do agente de Marketing; as peças do plano levam conteudo.plano = id.
import { atualizarPerfil } from '../memoria'
import { EMPRESA } from './useMarketing'

// briefing = a direção do plano (o que foi pedido ao agente), para reabrir e ajustar depois
export type Briefing = { modo: string; objetivo: string; publico: string; campanha: string; canais: { rede: string; formatos: string[] }[]; total: number; diasSemana: number[]; orientacao: string; link: string }
export type Plano = { id: string; nome: string; inicio: string; fim: string; objetivo?: string; status: 'briefing' | 'proposta' | 'aprovado'; criado_em: string; briefing?: Briefing; reuniao?: string }

export const planosDe = (perfil: Record<string, unknown> | undefined) => (Array.isArray(perfil?.planejamentos) ? perfil?.planejamentos : []) as Plano[]

export function salvarPlano(p: Plano) {
  return atualizarPerfil(EMPRESA, 'marketing', (perfil) => ({ ...perfil, planejamentos: [...planosDe(perfil).filter((x) => x.id !== p.id), p] }))
}

export function marcarPlano(id: string, status: Plano['status']) {
  return atualizarPerfil(EMPRESA, 'marketing', (perfil) => ({ ...perfil, planejamentos: planosDe(perfil).map((x) => (x.id === id ? { ...x, status } : x)) }))
}

const MES = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' })
const DM = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export function nomePadrao(modo: string, inicio: string, fim: string) {
  if (modo === 'dia') return `Plano do dia ${DM(inicio)}`
  if (modo === 'mes') return `Plano de ${MES(inicio)}`
  if (modo === 'semana') return `Semana ${DM(inicio)} a ${DM(fim)}`
  return `Plano de ${DM(inicio)} a ${DM(fim)}`
}
