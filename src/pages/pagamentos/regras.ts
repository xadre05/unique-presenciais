// Regras da tela de Pagamentos (presencial), sem tela: rótulos da situação, filtros de vencimento, ordem e o texto da data
import type { ParcelaV } from '../../lib/types'
import { brl, dataBR, hojeISO, whatsLink } from '../../lib/format'
import { turmaCurta } from '../Agenda'

export const POR_PAGINA = 25

// rótulo da situação como a equipe fala (o banco usa outros nomes)
export const SITUACAO: Record<string, { rotulo: string; tom: string }> = {
  atrasada: { rotulo: 'Vencida', tom: 'erro' }, sem_vencimento: { rotulo: 'Definir vencimento', tom: 'alerta' }, a_vencer: { rotulo: 'Em aberto', tom: 'neutro' },
  aguardando_conferencia: { rotulo: 'A conferir', tom: 'info' }, recebida: { rotulo: 'Recebida', tom: 'ok' },
  considerada_paga: { rotulo: 'Baixada', tom: 'alerta' }, cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
}

export const SITUACOES: [string, string][] = [
  ['pendentes', 'Em aberto'], ['', 'Todas'], ['atrasada', 'Vencidas'], ['hoje', 'Vencem hoje'], ['a_vencer', 'A vencer'], ['aguardando_conferencia', 'A conferir'],
  ['sem_vencimento', 'Sem vencimento'], ['recebida', 'Recebidas'], ['considerada_paga', 'Baixadas'], ['cancelada', 'Canceladas'],
]
export const ATALHOS: [string, string][] = [['atrasada', 'Vencidas'], ['hoje', 'Vencem hoje'], ['aguardando_conferencia', 'A conferir'], ['sem_vencimento', 'Sem vencimento'], ['recebida', 'Recebidas']]

export type Periodo = '' | 'hoje' | '7dias' | 'mes' | 'proximo' | 'periodo'
export const PERIODOS: [Periodo, string][] = [['', 'Qualquer data'], ['hoje', 'Hoje'], ['7dias', 'Próximos 7 dias'], ['mes', 'Este mês'], ['proximo', 'Mês que vem'], ['periodo', 'Escolher período…']]

const iso = (d: Date) => d.toISOString().slice(0, 10)
// de/até do vencimento para cada período ("periodo" usa as datas escolhidas)
export function intervalo(p: Periodo, de: string, ate: string): [string, string] {
  const h = new Date(hojeISO() + 'T12:00:00')
  if (p === 'hoje') return [iso(h), iso(h)]
  if (p === '7dias') return [iso(h), iso(new Date(h.getTime() + 7 * 864e5))]
  if (p === 'mes') return [iso(new Date(h.getFullYear(), h.getMonth(), 1, 12)), iso(new Date(h.getFullYear(), h.getMonth() + 1, 0, 12))]
  if (p === 'proximo') return [iso(new Date(h.getFullYear(), h.getMonth() + 1, 1, 12)), iso(new Date(h.getFullYear(), h.getMonth() + 2, 0, 12))]
  if (p === 'periodo') return [de, ate]
  return ['', '']
}

// prioridade: vencidas, sem data, a conferir, a vencer; dentro de cada uma, o vencimento mais antigo primeiro
const ORDEM: Record<string, number> = { atrasada: 0, sem_vencimento: 1, aguardando_conferencia: 2, a_vencer: 3, recebida: 4, considerada_paga: 5, cancelada: 6 }
export const ordenar = (xs: ParcelaV[]) => [...xs].sort((a, b) => (ORDEM[a.situacao] ?? 9) - (ORDEM[b.situacao] ?? 9) || (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))

// texto embaixo da data: atraso, "vence hoje", "em N dias"
export function sobreVencimento(p: ParcelaV): { texto: string; tom: string } | null {
  if (p.situacao === 'atrasada') return { texto: `${p.dias_atraso} ${p.dias_atraso === 1 ? 'dia' : 'dias'} em atraso`, tom: 'erro-txt' }
  if (p.situacao !== 'a_vencer' || !p.vencimento) return null
  const dias = Math.round((new Date(p.vencimento + 'T12:00:00').getTime() - new Date(hojeISO() + 'T12:00:00').getTime()) / 864e5)
  if (dias === 0) return { texto: 'Vence hoje', tom: 'alerta-txt' }
  return dias > 0 && dias <= 7 ? { texto: `Em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, tom: 'alerta-txt' } : null
}

export const somaValor = (xs: ParcelaV[], recebido = false) => xs.reduce((s, p) => s + Number((recebido ? p.valor_recebido : null) ?? p.valor ?? 0), 0)

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0]

// WhatsApp com a mensagem de cobrança da parcela
export function linkCobranca(p: ParcelaV) {
  const base = whatsLink(p.aluno_whatsapp)
  if (!base) return null
  const msg = `Olá, ${primeiroNome(p.aluno_nome)}! Tudo bem? Aqui é da Unique HOF Academy. ` +
    `Consta em aberto a parcela ${p.numero}/${p.total_parcelas} do curso ${turmaCurta(p.turma_nome)}, no valor de ${brl(p.valor)}` +
    (p.vencimento ? `, com vencimento em ${dataBR(p.vencimento)}` : '') +
    `. Consegue verificar para a gente? Se já pagou, é só nos mandar o comprovante e desconsiderar esta mensagem.`
  return `${base}?text=${encodeURIComponent(msg)}`
}

