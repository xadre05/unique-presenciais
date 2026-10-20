// Financeiro: tipos, buscas e contas (regras puras, sem tela).
// O banco junta tudo em 4 visões: v_fin_entradas, v_fin_saidas, v_fin_a_receber e v_fin_parcelado (academy_010).
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type Entrada = {
  id: string; data: string; origem: 'hotmart' | 'presencial' | 'cobranca'; conta_id: string | null; integracao_id: string | null
  descricao: string | null; pessoa: string | null; email: string | null; bruto: number; taxa: number; liquido: number
  tipo: 'venda' | 'parcela' | 'recebimento'; forma: string | null; area: 'online' | 'presencial'; parcela: string | null
}
export type Saida = {
  id: string; origem: 'despesa' | 'comissao'; despesa_id: string | null; descricao: string; categoria: string; pessoa: string | null
  valor: number; vencimento: string | null; pago_em: string | null; conta_id: string | null; parcela: number | null; parcelas: number | null
  grupo: string | null; observacao: string | null
}
export type AReceber = {
  id: string; data: string | null; origem: 'hotmart' | 'presencial' | 'acordo'; integracao_id: string | null; conta_id: string | null
  descricao: string | null; pessoa: string | null; valor: number; parcela: string | null
}
export type Parcelado = {
  id: string; integracao_id: string; conta_id: string | null; email: string; nome: string | null; produto_nome: string | null; tipo: string
  np: number; pagas: number; faltam: number; liquido_parcela: number; proxima: string; a_receber: number
  antecipado_estimado: number; retido_estimado: number
}
export type Despesa = {
  id?: string; descricao: string; categoria: string; fornecedor: string | null; valor: number; vencimento: string; pago_em: string | null
  conta_id: string | null; observacao: string | null; grupo?: string | null; parcela?: number | null; parcelas?: number | null
}

export const ORIGEM_ENTRADA: Record<string, string> = { hotmart: 'Hotmart', presencial: 'Presencial', cobranca: 'Dívida recuperada' }
export const ORIGEM_RECEBER: Record<string, string> = { hotmart: 'Parcelas na Hotmart', presencial: 'Presencial', acordo: 'Acordos de dívida' }

export const CATEGORIAS = [
  'Anúncios e tráfego', 'Equipe e salários', 'Comissões', 'Ferramentas e sistemas', 'Impostos e contador', 'Aluguel e estrutura',
  'Conteúdo e produção', 'Eventos e presencial', 'Taxas bancárias', 'Pró-labore e retiradas', 'Outros',
]

// mês "2026-10" → primeiro e último dia
export function intervaloMes(mes: string): [string, string] {
  const [y, m] = mes.split('-').map(Number)
  const fim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return [`${mes}-01`, `${mes}-${String(fim).padStart(2, '0')}`]
}
export const mesDe = (iso: string) => iso.slice(0, 7)
export function somaMes(mes: string, n: number) {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const nomeMes = (mes: string, comAno = true) => `${NOMES_MES[Number(mes.slice(5, 7)) - 1]}${comAno ? '/' + mes.slice(2, 4) : ''}`

// o Supabase devolve no máximo 1000 linhas por vez: busca em páginas
type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
export async function buscarTudo<T>(fazer: (de: number, ate: number) => Pagina<T>): Promise<T[]> {
  const tudo: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fazer(de, de + 999)
    if (error) throw new Error(error.message)
    tudo.push(...(data ?? []))
    if (!data || data.length < 1000) return tudo
  }
}

export const entradasEntre = (ini: string, fim: string, conta: string) => buscarTudo<Entrada>((de, ate) => {
  let q = supabase.from('v_fin_entradas').select('*').gte('data', ini).lte('data', fim)
  if (conta) q = q.eq('conta_id', conta)
  return q.order('data', { ascending: false }).order('id').range(de, ate)
})

export const somar = <T,>(xs: T[], f: (x: T) => number | null | undefined) => xs.reduce((s, x) => s + Number(f(x) ?? 0), 0)

// despesa paga, atrasada ou a vencer
export function situacaoSaida(s: Pick<Saida, 'pago_em' | 'vencimento'>, hoje: string) {
  if (s.pago_em) return { rotulo: 'Paga', tom: 'ok' }
  if (s.vencimento && s.vencimento < hoje) return { rotulo: 'Atrasada', tom: 'erro' }
  return { rotulo: 'A pagar', tom: 'alerta' }
}

export function csv(linhas: (string | number | null)[][], nome: string) {
  const esc = (v: string | number | null) => { const t = v == null ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
  const blob = new Blob(['﻿' + linhas.map((l) => l.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; a.click(); URL.revokeObjectURL(a.href)
}
export const numCsv = (v: number | null | undefined) => (v == null ? '' : Number(v).toFixed(2).replace('.', ','))

// contas (bancos, Hotmart, espécie) para o filtro e para lançar despesa
export type ContaFin = { id: string; nome: string; tipo: string; ativa: boolean }
export function useContasFin() {
  const [contas, setContas] = useState<ContaFin[]>([])
  useEffect(() => { supabase.from('contas').select('id,nome,tipo,ativa').order('nome').then(({ data }) => setContas((data as ContaFin[]) ?? [])) }, [])
  return contas
}

// adapta uma busca em páginas ao formato do useConsulta ({ data, error })
export const comoConsulta = <T,>(p: Promise<T>) => p.then((data) => ({ data, error: null }), (e: Error) => ({ data: null, error: { message: e.message } }))
