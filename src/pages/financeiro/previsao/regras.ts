// Previsão de caixa (regras, sem tela): períodos, como cada dinheiro entra (forma) e agrupamento por semana.
// O banco entrega cada entrada esperada em v_fin_previsao (academy_012) e o que já entrou em v_fin_entradas.
import { intervaloMes, mesDe, somaMes, type Entrada } from '../dados'

export type Situacao = 'a_vencer' | 'na_hotmart' | 'atrasada' | 'sem_data' | 'a_conferir'
// a_vencer e na_hotmart (já pago, esperando o dia 1º) contam como "vai entrar"; o resto é pendência
export const vaiEntrar = (p: Previsto) => p.situacao === 'a_vencer' || p.situacao === 'na_hotmart'
export type Previsto = {
  id: string; data: string | null; origem: 'hotmart' | 'presencial' | 'acordo'; integracao_id: string | null; conta_id: string | null
  descricao: string | null; pessoa: string | null; email: string | null; parcela: string | null
  valor_aluno: number; valor: number; situacao: Situacao; forma: string | null; automatico: boolean; plano: string | null
  data_credito: string | null   // quando o dinheiro fica disponível (Hotmart: dia 1º do mês seguinte ao pagamento)
}
export const quando = (p: Previsto) => p.data_credito ?? p.data

export type Periodo = 'mes' | '30d' | 'proximo' | '3m' | '12m'
export const PERIODOS: [Periodo, string][] = [['mes', 'Este mês'], ['30d', 'Próximos 30 dias'], ['proximo', 'Próximo mês'], ['3m', 'Próximos 3 meses'], ['12m', 'Próximos 12 meses']]

// início e fim do período; "já entrou" só faz sentido quando o período começa antes de hoje (este mês)
export function intervaloDo(p: Periodo, hoje: string): [string, string] {
  const mes = mesDe(hoje)
  if (p === 'mes') return intervaloMes(mes)
  if (p === 'proximo') return intervaloMes(somaMes(mes, 1))
  if (p === '30d') return [hoje, somaDias(hoje, 30)]
  if (p === '3m') return [hoje, intervaloMes(somaMes(mes, 2))[1]]
  return [hoje, intervaloMes(somaMes(mes, 11))[1]]
}

export function somaDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// como o dinheiro entra, em poucas famílias que dá para filtrar
export type Jeito = 'parcelado_hotmart' | 'cartao' | 'pix' | 'boleto' | 'dinheiro' | 'acordo' | 'outro'
export const NOME_JEITO: Record<Jeito, string> = {
  parcelado_hotmart: 'Parcelado Hotmart', cartao: 'Cartão', pix: 'Pix', boleto: 'Boleto', dinheiro: 'Dinheiro', acordo: 'Acordo de dívida', outro: 'Outro',
}
export const DICA_JEITO: Record<Jeito, string> = {
  parcelado_hotmart: 'A Hotmart cobra o aluno sozinha todo mês',
  cartao: 'Venda no cartão (Hotmart ou maquininha)', pix: 'Pix', boleto: 'Boleto à vista', dinheiro: 'Em espécie',
  acordo: 'Parcelas de acordos de dívida', outro: 'Transferência ou forma não informada',
}

function jeitoDaForma(forma: string | null): Jeito {
  const f = (forma ?? '').toLowerCase()
  if (/card|cartao|apple|google|paypal/.test(f)) return 'cartao'
  if (f.includes('pix')) return 'pix'
  if (f.includes('billet') || f.includes('boleto')) return 'boleto'
  if (f.includes('dinheiro') || f.includes('especie')) return 'dinheiro'
  if (f === 'acordo') return 'acordo'
  return 'outro'
}
export const jeitoPrevisto = (p: Previsto): Jeito => (p.origem === 'hotmart' ? 'parcelado_hotmart' : p.origem === 'acordo' ? 'acordo' : jeitoDaForma(p.forma))
export const jeitoEntrada = (e: Entrada): Jeito => (e.origem === 'hotmart' && e.tipo === 'parcela' ? 'parcelado_hotmart' : jeitoDaForma(e.forma))

export const NOME_SITUACAO: Record<Situacao, string> = { a_vencer: 'A vencer', na_hotmart: 'Já pago, na Hotmart', atrasada: 'Atrasada', sem_data: 'Sem data combinada', a_conferir: 'Aluno avisou que pagou' }
export const TOM_SITUACAO: Record<Situacao, string> = { a_vencer: 'info', na_hotmart: 'ok', atrasada: 'erro', sem_data: 'alerta', a_conferir: 'ouro' }
// o que fazer com cada pendência, em uma frase
export const ACAO_SITUACAO: Record<Situacao, string> = {
  a_vencer: '', na_hotmart: '', atrasada: 'Cobrar o aluno', sem_data: 'Combinar a data com o aluno', a_conferir: 'Conferir no banco e dar baixa',
}

// semana (segunda a domingo) de uma data, para a linha do tempo
export function semanaDe(iso: string) {
  const d = new Date(iso + 'T12:00:00'); const dia = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dia)
  return d.toISOString().slice(0, 10)
}
