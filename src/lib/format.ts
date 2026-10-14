export const brl = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === ''
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const dataBR = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, dd] = d.slice(0, 10).split('-')
  return `${dd}/${m}/${y}`
}

export const dataHoraBR = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const hojeISO = () => {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const somaMeses = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}

export const mesAno = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const [y, m] = iso.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1]}/${y}`
}

export const FORMAS: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_maquininha: 'Cartão (maquininha)',
  hotmart_cartao: 'Hotmart — cartão',
  hotmart_parcelado: 'Hotmart — Parcelado Hotmart',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  outro: 'Outro',
}

export const SITUACAO_PARCELA: Record<string, { rotulo: string; tom: string }> = {
  recebida: { rotulo: 'Recebida', tom: 'ok' },
  considerada_paga: { rotulo: 'Considerada paga (baixa)', tom: 'alerta' },
  aguardando_conferencia: { rotulo: 'Aguardando conferência', tom: 'info' },
  atrasada: { rotulo: 'Atrasada', tom: 'erro' },
  a_vencer: { rotulo: 'A vencer', tom: 'neutro' },
  sem_vencimento: { rotulo: 'Sem vencimento', tom: 'alerta' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
}

export const SITUACAO_ALUNO: Record<string, { rotulo: string; tom: string }> = {
  quitado: { rotulo: 'Quitado', tom: 'ok' },
  considerado_pago: { rotulo: 'Considerado pago (baixa)', tom: 'alerta' },
  transferida: { rotulo: 'Transferida', tom: 'apagado' },
  em_dia: { rotulo: 'Em dia', tom: 'neutro' },
  atrasado: { rotulo: 'Atrasado', tom: 'erro' },
  aguardando_conferencia: { rotulo: 'Aguardando conferência', tom: 'info' },
  sem_pagamento: { rotulo: 'Sem pagamento lançado', tom: 'alerta' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
}

export const STATUS_MATRICULA: Record<string, string> = {
  reservada: 'Reservada (só matrícula)',
  confirmada: 'Inscrição confirmada',
  concluida: 'Concluiu o curso',
  faltou: 'Faltou',
  transferida: 'Transferida de turma',
  cancelada: 'Cancelada',
}

export const STATUS_TURMA: Record<string, string> = {
  planejada: 'Planejada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

export const ORIGENS: Record<string, string> = {
  venda: 'Venda',
  bonus_black: 'Bônus da Black',
  residencia: 'Residência',
  cortesia: 'Cortesia',
  transferencia: 'Transferência',
}

export const STATUS_COMISSAO: Record<string, { rotulo: string; tom: string }> = {
  pendente: { rotulo: 'Em apuração', tom: 'neutro' },
  liberada: { rotulo: 'Aprovada para pagar', tom: 'info' },
  paga: { rotulo: 'Paga', tom: 'ok' },
  cancelada: { rotulo: 'Cancelada', tom: 'apagado' },
}

export const whatsLink = (tel?: string | null) => {
  if (!tel) return null
  let d = tel.replace(/\D/g, '')
  if (d.length <= 11) d = '55' + d
  return `https://wa.me/${d}`
}
