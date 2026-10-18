// Filtros do Planejamento. Ficam na tela do agente (não no Quadro nem no Calendário), para continuarem
// selecionados ao trocar de visão e ao ir à Produção e voltar (regra 6).
import { hojeISO, segundaDe, somaDias, type Peca } from '../comum'
import { etapaDe } from './etapas'
import { redeDe, type Rede } from './redes'

export type Periodo = 'dia' | 'semana' | 'mes' | 'periodo'
export type Filtros = {
  periodo: Periodo; data: string; ate: string; visao: 'quadro' | 'calendario'
  canais: Rede[]; campanha: string; formato: string; situacao: string; busca: string
}
export const filtrosIniciais = (): Filtros => ({
  periodo: 'semana', data: segundaDe(hojeISO()), ate: somaDias(hojeISO(), 13), visao: 'quadro', canais: [], campanha: '', formato: '', situacao: '', busca: '',
})

const ultimoDoMes = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10) }
const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000) + 1

// intervalo que a tela mostra: no mês, começa na segunda da 1ª semana para o calendário fechar em semanas
export function intervaloDe(f: Filtros): { inicio: string; dias: number } {
  if (f.periodo === 'dia') return { inicio: f.data, dias: 1 }
  if (f.periodo === 'semana') return { inicio: segundaDe(f.data), dias: 7 }
  if (f.periodo === 'mes') { const primeiro = f.data.slice(0, 8) + '01'; const ini = segundaDe(primeiro); const n = diasEntre(ini, ultimoDoMes(primeiro)); return { inicio: ini, dias: Math.ceil(n / 7) * 7 } }
  return { inicio: f.data, dias: Math.max(1, Math.min(62, diasEntre(f.data, f.ate))) }
}

export function andar(f: Filtros, sentido: 1 | -1): string {
  if (f.periodo === 'dia') return somaDias(f.data, sentido)
  if (f.periodo === 'semana') return somaDias(segundaDe(f.data), 7 * sentido)
  const d = new Date(f.data.slice(0, 8) + '01T12:00:00'); d.setMonth(d.getMonth() + sentido)
  return d.toISOString().slice(0, 10)
}

export function rotuloPeriodo(f: Filtros) {
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', o)
  if (f.periodo === 'dia') return fmt(f.data, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (f.periodo === 'mes') return fmt(f.data, { month: 'long', year: 'numeric' })
  const ini = f.periodo === 'semana' ? segundaDe(f.data) : f.data
  const fim = f.periodo === 'semana' ? somaDias(ini, 6) : f.ate
  return `${fmt(ini, { day: 'numeric', month: 'short' })} – ${fmt(fim, { day: 'numeric', month: 'short', year: 'numeric' })}`.replace(/\./g, '')
}

export function aplicar(pecas: Peca[], f: Filtros) {
  const termo = f.busca.trim().toLowerCase()
  return pecas.filter((p) => (!f.campanha || p.conteudo.campanha === f.campanha)
    && (!f.canais.length || f.canais.includes(redeDe(p)))
    && (!f.formato || p.tipo === f.formato)
    && (!f.situacao || etapaDe(p) === f.situacao)
    && (!termo || p.titulo.toLowerCase().includes(termo)))
}

export const NOME_PERIODO: Record<Periodo, string> = { dia: 'neste dia', semana: 'nesta semana', mes: 'neste mês', periodo: 'neste período' }
