// Importação dos arquivos da Hotmart para o Financeiro (regras, sem tela): reconhece o arquivo pelo cabeçalho,
// converte as linhas e grava em lotes. Reimportar o mesmo arquivo não duplica (chave única por linha).
import { supabase } from '../../../lib/supabase'
import { dataHoraIso, dataIso, numero, type Linha } from './planilha'

export type TipoArquivo = 'extrato' | 'parcelado_vendas' | 'desconhecido'
export const NOME_TIPO: Record<TipoArquivo, string> = { extrato: 'Extrato da Carteira', parcelado_vendas: 'Parcelado Hotmart: vendas aprovadas', desconhecido: 'Arquivo não reconhecido' }

export function tipoDo(linhas: Linha[]): TipoArquivo {
  const c = Object.keys(linhas[0] ?? {})
  if (c.includes('Data da efetivação') && c.includes('Descrição') && c.includes('Saldo')) return 'extrato'
  if (c.includes('Faturamento Líquido') && c.includes('Antecipação')) return 'parcelado_vendas'
  return 'desconhecido'
}

function linhaExtrato(integracao: string, l: Linha) {
  const valor = numero(l['Valor']), saldo = numero(l['Saldo'])
  const efetivacao = dataIso(l['Data da efetivação'])
  if (!efetivacao) return null
  return {
    integracao_id: integracao, data_lancamento: dataIso(l['Data do lançamento']), data_efetivacao: efetivacao, status: l['Status'] || null,
    transacao: l['Transação'] || null, antecipacao_id: l['Identificador de antecipação'] || null, status_transacao: l['Status da transação'] || null,
    descricao: l['Descrição'], parcela: l['Parcela'] || null, valor, produto: l['Nome do produto'] || null, saldo, categoria: l['Categoria'] || null,
    // o saldo corrido torna única até a linha repetida (duas compras iguais no mesmo dia)
    chave: [integracao, l['Data do lançamento'], l['Data da efetivação'], l['Transação'], l['Descrição'], l['Parcela'], valor, saldo].join('|'),
  }
}

function linhaParcelado(integracao: string, l: Linha) {
  const data = dataHoraIso(l['Data do Pagamento'])
  if (!data || !l['Comprador']) return null
  const faturamento = numero(l['Faturamento Líquido'])
  return {
    integracao_id: integracao, comprador: l['Comprador'], produto: l['Produto'] || null, data_pagamento: data, faturamento, antecipacao: numero(l['Antecipação']),
    parcelas: Number(l['Quantidade de Parcelas']) || null, valor_parcela: numero(l['Valor da Parcela']), pagamento: l['Pagamento'] || null, status: l['Status'] || null,
    chave: [integracao, l['Comprador'].toLowerCase(), data, faturamento].join('|'),
  }
}

export type Resumo = { tipo: TipoArquivo; linhas: number; de: string | null; ate: string | null }
export function resumir(linhas: Linha[]): Resumo {
  const tipo = tipoDo(linhas)
  const datas = linhas.map((l) => dataIso(tipo === 'extrato' ? l['Data da efetivação'] : l['Data do Pagamento'])).filter(Boolean).sort() as string[]
  return { tipo, linhas: linhas.length, de: datas[0] ?? null, ate: datas.at(-1) ?? null }
}

// grava em lotes de 500; ignora as linhas que já estavam (mesma chave). Devolve quantas eram novas.
export async function gravar(integracao: string, linhas: Linha[], aoAvancar?: (feitas: number) => void) {
  const tipo = tipoDo(linhas)
  if (tipo === 'desconhecido') throw new Error('Este arquivo não é o Extrato nem as vendas do Parcelado Hotmart.')
  const tabela = tipo === 'extrato' ? 'hotmart_extrato' : 'hotmart_parcelado_vendas'
  const conv = tipo === 'extrato' ? linhaExtrato : linhaParcelado
  const todas = linhas.map((l) => conv(integracao, l)).filter(Boolean) as { chave: string }[]
  // linhas idênticas no mesmo arquivo (ex.: estorno de R$ 0,00 no mesmo saldo) são lançamentos distintos: numera a repetição
  const vistas = new Map<string, number>()
  const unicas = todas.map((r) => { const n = vistas.get(r.chave) ?? 0; vistas.set(r.chave, n + 1); return n ? { ...r, chave: `${r.chave}#${n}` } : r })
  let novas = 0
  for (let i = 0; i < unicas.length; i += 500) {
    const { data, error } = await supabase.from(tabela).upsert(unicas.slice(i, i + 500), { onConflict: 'chave', ignoreDuplicates: true }).select('id')
    if (error) throw new Error(error.message)
    novas += data?.length ?? 0
    aoAvancar?.(Math.min(i + 500, unicas.length))
  }
  return { total: unicas.length, novas }
}
