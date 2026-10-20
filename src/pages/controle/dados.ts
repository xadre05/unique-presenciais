// Área Controle: tipos e regras dos serviços pagos (situação, custo por mês, textos).
import { brl } from '../../lib/format'

export type Ciclo = 'mensal' | 'anual' | 'credito' | 'por_uso'
export type Servico = {
  id?: string; nome: string; categoria: string; para_que: string | null
  valor: number | null; moeda: 'BRL' | 'USD'; ciclo: Ciclo
  proximo_vencimento: string | null; alerta_dias: number
  saldo: number | null; saldo_minimo: number | null; saldo_em: string | null
  forma_pagamento: string | null; conta_email: string | null; painel_url: string | null
  responsavel: string | null; situacao: 'ativo' | 'cancelar' | 'cancelado'; observacao: string | null; ordem: number
}

export const CATEGORIAS = ['Inteligência artificial', 'Sistema e banco de dados', 'Hospedagem e domínios', 'Vendas', 'Atendimento e WhatsApp', 'Anúncios', 'Ferramentas', 'Outro']
export const NOME_CICLO: Record<Ciclo, string> = { mensal: 'Mensal', anual: 'Anual', credito: 'Crédito pré-pago', por_uso: 'Cobra pelo uso' }

export const SERVICO_NOVO: Servico = {
  nome: '', categoria: CATEGORIAS[0], para_que: null, valor: null, moeda: 'BRL', ciclo: 'mensal', proximo_vencimento: null,
  alerta_dias: 7, saldo: null, saldo_minimo: null, saldo_em: null, forma_pagamento: null, conta_email: null, painel_url: null,
  responsavel: null, situacao: 'ativo', observacao: null, ordem: 100,
}

export type Situacao = 'vencido' | 'saldo_baixo' | 'vence_logo' | 'cancelar' | 'sem_data' | 'em_dia' | 'cancelado'
export const NOME_SITUACAO: Record<Situacao, string> = {
  vencido: 'Vencido', saldo_baixo: 'Crédito acabando', vence_logo: 'Vence logo', cancelar: 'Cancelar antes de vencer',
  sem_data: 'Falta preencher', em_dia: 'Em dia', cancelado: 'Cancelado',
}
export const TOM_SITUACAO: Record<Situacao, string> = {
  vencido: 'erro', saldo_baixo: 'erro', vence_logo: 'alerta', cancelar: 'alerta', sem_data: 'info', em_dia: 'ok', cancelado: 'apagado',
}
export const ORDEM_SITUACAO: Situacao[] = ['vencido', 'saldo_baixo', 'vence_logo', 'cancelar', 'sem_data', 'em_dia', 'cancelado']

export function diasAte(iso: string, hoje: string) {
  return Math.round((Date.parse(iso + 'T12:00:00Z') - Date.parse(hoje + 'T12:00:00Z')) / 86400000)
}

export function situacaoServico(s: Servico, hoje: string): Situacao {
  if (s.situacao === 'cancelado') return 'cancelado'
  if (s.proximo_vencimento && s.proximo_vencimento < hoje) return 'vencido'
  if (s.saldo != null && s.saldo_minimo != null && s.saldo <= s.saldo_minimo) return 'saldo_baixo'
  if (s.proximo_vencimento && diasAte(s.proximo_vencimento, hoje) <= s.alerta_dias) return s.situacao === 'cancelar' ? 'cancelar' : 'vence_logo'
  if (s.situacao === 'cancelar') return 'cancelar'
  const temCusto = s.ciclo === 'por_uso' || s.ciclo === 'credito' ? s.saldo != null || s.valor != null : s.proximo_vencimento != null
  return temCusto ? 'em_dia' : 'sem_data'
}

export const dinheiro = (v: number | null, moeda: 'BRL' | 'USD') =>
  v == null ? '—' : moeda === 'USD' ? `US$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : brl(v)

// Quanto pesa por mês: mensal = valor; anual = valor/12; crédito e por uso = o valor informado como média do mês.
export function custoMes(s: Servico) {
  if (s.situacao === 'cancelado' || s.valor == null) return 0
  return s.ciclo === 'anual' ? s.valor / 12 : s.valor
}

export function textoVencimento(s: Servico, hoje: string) {
  if (!s.proximo_vencimento) return s.ciclo === 'por_uso' ? 'Sem vencimento' : 'Sem data'
  const d = diasAte(s.proximo_vencimento, hoje)
  if (d < 0) return `Venceu há ${-d} dia${d === -1 ? '' : 's'}`
  if (d === 0) return 'Vence hoje'
  return `Em ${d} dia${d === 1 ? '' : 's'}`
}
