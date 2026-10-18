// Filtros do Planejamento. Ficam na tela do agente (não no Quadro nem no Calendário), para continuarem
// selecionados ao trocar de visão e ao ir à Produção e voltar (regra 6).
import { hojeISO, segundaDe, somaDias, type Peca } from '../comum'
import { etapaDe } from './etapas'
import { redeDe, type Rede } from './redes'

export type Periodo = 'dia' | 'semana' | 'mes' | 'periodo'
// os mesmos filtros de peça valem no Planejamento e na Produção (mesma barra, mesma ordem)
export type FiltrosPecas = { campanha: string; plano: string; canais: Rede[]; formatos: string[]; situacao: string; busca: string }
export const filtrosPecasVazios = (): FiltrosPecas => ({ campanha: '', plano: '', canais: [], formatos: [], situacao: '', busca: '' })
export type Filtros = { periodo: Periodo; data: string; ate: string; visao: 'quadro' | 'calendario' } & FiltrosPecas
export const filtrosIniciais = (): Filtros => ({ periodo: 'semana', data: segundaDe(hojeISO()), ate: somaDias(hojeISO(), 13), visao: 'quadro', ...filtrosPecasVazios() })
type PeriodoTela = { periodo: Periodo; data: string; ate: string }

const ultimoDoMes = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10) }
const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000) + 1

// intervalo que a tela mostra (e que a busca de peças usa)
export function intervaloDe(f: PeriodoTela): { inicio: string; dias: number } {
  if (f.periodo === 'dia') return { inicio: f.data, dias: 1 }
  if (f.periodo === 'semana') return { inicio: segundaDe(f.data), dias: 7 }
  // mês fechado: só do dia 1 ao último dia daquele mês
  if (f.periodo === 'mes') { const primeiro = f.data.slice(0, 8) + '01'; return { inicio: primeiro, dias: diasEntre(primeiro, ultimoDoMes(primeiro)) } }
  return { inicio: f.data, dias: Math.max(1, Math.min(92, diasEntre(f.data, f.ate))) }
}

export function andar(f: PeriodoTela, sentido: 1 | -1): string {
  if (f.periodo === 'dia') return somaDias(f.data, sentido)
  if (f.periodo === 'semana') return somaDias(segundaDe(f.data), 7 * sentido)
  const d = new Date(f.data.slice(0, 8) + '01T12:00:00'); d.setMonth(d.getMonth() + sentido)
  return d.toISOString().slice(0, 10)
}

export function rotuloPeriodo(f: PeriodoTela) {
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', o)
  if (f.periodo === 'dia') return fmt(f.data, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).replace('.', '')
  if (f.periodo === 'mes') return fmt(f.data, { month: 'long', year: 'numeric' })
  const ini = f.periodo === 'semana' ? segundaDe(f.data) : f.data
  const fim = f.periodo === 'semana' ? somaDias(ini, 6) : f.ate
  return `${fmt(ini, { day: 'numeric', month: 'short' })} – ${fmt(fim, { day: 'numeric', month: 'short', year: 'numeric' })}`.replace(/\./g, '')
}

function combina(p: Peca, f: FiltrosPecas) {
  const termo = f.busca.trim().toLowerCase()
  return (!f.campanha || p.conteudo.campanha === f.campanha)
    && (!f.plano || (f.plano === 'avulsa' ? !p.conteudo.plano : p.conteudo.plano === f.plano))
    && (!f.canais.length || f.canais.includes(redeDe(p)))
    && (!f.formatos.length || f.formatos.includes(p.tipo))
    && (!f.situacao || etapaDe(p) === f.situacao)
    && (!termo || p.titulo.toLowerCase().includes(termo))
}

// propostas de plano ainda não aprovadas não aparecem no quadro, no calendário nem na lista
export const aplicar = (pecas: Peca[], f: FiltrosPecas) => pecas.filter((p) => !p.conteudo.proposta && combina(p, f))

export const NOME_PERIODO: Record<Periodo, string> = { dia: 'neste dia', semana: 'nesta semana', mes: 'neste mês', periodo: 'neste período' }

// filtros da lista da Produção (o período pode ser "Todos": aqui o padrão é ver todas as peças)
export type FiltrosProducao = { periodo: 'todos' | Periodo; data: string; ate: string } & FiltrosPecas
export const filtrosProducaoIniciais = (): FiltrosProducao => ({ periodo: 'todos', data: hojeISO(), ate: somaDias(hojeISO(), 13), ...filtrosPecasVazios() })

export function aplicarProducao(pecas: Peca[], f: FiltrosProducao) {
  const lista = aplicar(pecas, f)
  if (f.periodo === 'todos') return lista
  const { inicio, dias } = intervaloDe({ periodo: f.periodo, data: f.data, ate: f.ate })
  const fim = somaDias(inicio, dias - 1)
  return lista.filter((p) => p.dia && p.dia >= inicio && p.dia <= fim)
}
