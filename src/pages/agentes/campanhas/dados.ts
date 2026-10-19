// Campanhas da Base da marca: o que é de um momento (Black, lançamento, semana de vendas, ganhar seguidores).
// Ficam no perfil do agente de Marketing. Preço e condições ficam no produto ligado; aqui fica a comunicação.
import { atualizarPerfil } from '../memoria'
import { hojeISO } from '../comum'
import type { Campanha } from '../marketing/useMarketing'

export type CampanhaGuardada = Campanha & { encerrada?: boolean }
export type SituacaoCampanha = 'ativa' | 'agendada' | 'encerrada' | 'sem_data'

export const NOME_SITUACAO: Record<SituacaoCampanha, string> = { ativa: 'Ativa', agendada: 'Agendada', encerrada: 'Encerrada', sem_data: 'Sem período' }
export const TOM_SITUACAO: Record<SituacaoCampanha, string> = { ativa: 'badge-ok', agendada: 'badge-info', encerrada: 'badge-apagado', sem_data: 'badge-alerta' }

export const campanhaVazia = (): CampanhaGuardada => ({ id: crypto.randomUUID(), nome: '', inicio: '', fim: '', hora_fim: '23:59', descricao: '' })
export const campanhasDe = (perfil: Record<string, unknown>) => (Array.isArray(perfil.campanhas) ? perfil.campanhas : []) as CampanhaGuardada[]

// encerrada à mão, ou já passou do último dia; sem data de início ou fim continua valendo
export function situacaoCampanha(c: CampanhaGuardada, hoje = hojeISO()): SituacaoCampanha {
  if (c.encerrada || (c.fim && c.fim < hoje)) return 'encerrada'
  if (c.inicio && c.inicio > hoje) return 'agendada'
  if (!c.inicio && !c.fim) return 'sem_data'
  return 'ativa'
}

export const dataBR = (iso?: string) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '')
export function periodoCampanha(c: CampanhaGuardada) {
  if (!c.inicio && !c.fim) return 'Sem período definido'
  if (!c.fim) return `A partir de ${dataBR(c.inicio)}`
  if (!c.inicio) return `Até ${dataBR(c.fim)}`
  return `${dataBR(c.inicio)} a ${dataBR(c.fim)}`
}

// uma linha para o cartão da lista: a oferta, o objetivo ou o começo da mensagem
export const linhaCampanha = (c: CampanhaGuardada) => c.oferta?.trim() || c.objetivo?.trim() || c.descricao?.trim().split('\n')[0] || 'Sem descrição'

const limpa = (s?: string) => s?.trim() || undefined
export const campanhaLimpa = (c: CampanhaGuardada): CampanhaGuardada => ({
  ...c, nome: c.nome.trim(), objetivo: limpa(c.objetivo), oferta: limpa(c.oferta), comunicacao: limpa(c.comunicacao),
  descricao: limpa(c.descricao), link: limpa(c.link), inicio: c.inicio || undefined, fim: c.fim || undefined,
  hora_fim: c.fim ? c.hora_fim || '23:59' : undefined,
})

export function gravarCampanhas(empresa: string, mudar: (l: CampanhaGuardada[]) => CampanhaGuardada[]) {
  return atualizarPerfil(empresa, 'marketing', (p) => ({ ...p, campanhas: mudar(campanhasDe(p)) }))
}
