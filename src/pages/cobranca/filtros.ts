// Abas, filtros e ordem da fila de cobrança (regras puras, sem tela)
import { aberta, type Cobranca } from './dados'

export type Aba = 'a_contatar' | 'retornar' | 'aguardando' | 'negociando' | 'acordo' | 'negativacao' | 'resolvidas' | 'todas'
export type Idade = '' | 'ate6' | '6a24' | 'mais24'
export type Ordem = 'antigas' | 'valor' | 'recentes'
export type Filtro = { origem: '' | 'online' | 'presencial'; conta: string; idade: Idade; quem: string; busca: string }

export const ABAS: [Aba, string][] = [
  ['a_contatar', 'A contatar'], ['retornar', 'Retornar hoje'], ['aguardando', 'Aguardando resposta'], ['negociando', 'Negociando'],
  ['acordo', 'Acordo fechado'], ['negativacao', 'Negativação'], ['resolvidas', 'Resolvidas'], ['todas', 'Todas'],
]
export const IDADES: [Idade, string][] = [['', 'Qualquer idade'], ['ate6', 'Parou há até 6 meses'], ['6a24', 'De 6 meses a 2 anos'], ['mais24', 'Mais de 2 anos']]

export const mesesParado = (c: Pick<Cobranca, 'parou_em'>) => (c.parou_em ? (Date.now() - new Date(c.parou_em + 'T12:00:00').getTime()) / (30.44 * 864e5) : 0)

export function naAba(c: Cobranca, aba: Aba, hoje: string) {
  if (aba === 'todas') return true
  if (aba === 'resolvidas') return !aberta(c)
  if (!aberta(c)) return false
  if (aba === 'retornar') return !!c.retornar_em && c.retornar_em <= hoje
  if (aba === 'negativacao') return c.etapa === 'negativar' || c.etapa === 'negativado'
  return c.etapa === aba
}

export function passaFiltro(c: Cobranca, f: Filtro) {
  if (f.origem && c.origem !== f.origem) return false
  if (f.conta && c.integracao_id !== f.conta) return false
  if (f.quem && (f.quem === 'ninguem' ? !!c.responsavel_id : c.responsavel_id !== f.quem)) return false
  const m = mesesParado(c)
  if (f.idade === 'ate6' && m > 6) return false
  if (f.idade === '6a24' && (m <= 6 || m > 24)) return false
  if (f.idade === 'mais24' && m <= 24) return false
  const t = f.busca.trim().toLowerCase()
  return !t || `${c.aluno_nome ?? ''} ${c.email ?? ''} ${c.telefone ?? ''} ${c.produto ?? ''}`.toLowerCase().includes(t)
}

export function ordenar(xs: Cobranca[], ordem: Ordem) {
  const k = (c: Cobranca) => c.parou_em ?? '9999'
  return [...xs].sort((a, b) => ordem === 'valor' ? Number(b.valor_restante ?? 0) - Number(a.valor_restante ?? 0)
    : ordem === 'recentes' ? k(b).localeCompare(k(a)) : k(a).localeCompare(k(b)))
}

// prazo para negativar: a lei só permite até 5 anos depois de a dívida vencer
export function prazoNegativar(c: Pick<Cobranca, 'negativar_ate'>, hoje: string) {
  if (!c.negativar_ate) return null
  if (c.negativar_ate < hoje) return { tom: 'neutro', texto: 'Prazo para negativar já passou' }
  const dias = Math.round((new Date(c.negativar_ate).getTime() - new Date(hoje).getTime()) / 864e5)
  return { tom: dias <= 180 ? 'erro' : 'neutro', texto: `Negativar até ${c.negativar_ate.split('-').reverse().join('/')}` }
}

export const somaRestante = (xs: Cobranca[]) => xs.reduce((s, c) => s + Number(c.valor_restante ?? c.valor_vencido ?? 0), 0)
export const somaVencido = (xs: Cobranca[]) => xs.reduce((s, c) => s + Number(c.valor_vencido ?? 0), 0)
