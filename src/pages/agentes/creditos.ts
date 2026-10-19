// Créditos dos agentes: quem usa o sistema vê e limita o consumo em créditos, nunca em dólar.
// 1 crédito = US$ 0,01 de custo de IA (o servidor usa a mesma conta). O custo real em dólar fica para a área de controle.
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'

export const CREDITOS_POR_USD = 100
// arredonda para cima: um trabalho que custou US$ 0,031 gasta 4 créditos
export const creditosDe = (usd: number | null | undefined) => Math.ceil(Number(usd ?? 0) * CREDITOS_POR_USD - 1e-9)
export const textoCreditos = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'crédito' : 'créditos'}`
export const creditos = (usd: number | null | undefined) => textoCreditos(creditosDe(usd))

// o que cada tipo de trabalho é, para a tabela de custo médio (escrever é por peça)
const NOME_TIPO: Record<string, string> = {
  reuniao: 'Cada resposta na conversa de pauta', propor_plano: 'Proposta de plano (calendário)', escrever: 'Escrever uma peça',
  semana: 'Conteúdo de uma semana', ajuste: 'Ajustar uma peça', arte: 'Criar ou ajustar uma arte', referencia: 'Estudar uma referência',
  voz: 'Gerar o perfil de voz', teste_voz: 'Testar a voz da marca', conversa: 'Conversa para uma peça nova',
}
type Linha = { agente_id: string; tipo: string; custo_usd: number | null; criado_em: string; pedido: { peca_ids?: unknown[] } | null }
export type CustoMedio = { tipo: string; nome: string; media: number; vezes: number }

const inicioDoMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString() }

// consumo do mês (empresa e agente) e o custo médio de cada tipo de pedido nos últimos 90 dias
export function useConsumo(empresa: string, agente: string) {
  const q = useConsulta<Linha[]>(() => supabase.from('agentes_trabalhos').select('agente_id,tipo,custo_usd,criado_em,pedido')
    .eq('empresa_id', empresa).eq('status', 'pronto').gte('criado_em', new Date(Date.now() - 90 * 86400000).toISOString()).order('criado_em', { ascending: false }).limit(2000), [empresa])
  const lista = q.dados ?? []
  const mes = inicioDoMes()
  const doMes = lista.filter((t) => t.criado_em >= mes)
  const soma = (l: Linha[]) => creditosDe(l.reduce((s, t) => s + Number(t.custo_usd ?? 0), 0))
  const porTipo = new Map<string, { total: number; vezes: number }>()
  for (const t of lista.filter((x) => x.agente_id === agente && Number(x.custo_usd ?? 0) > 0)) {
    const n = t.tipo === 'escrever' ? Math.max(1, Array.isArray(t.pedido?.peca_ids) ? t.pedido.peca_ids.length : 1) : 1
    const a = porTipo.get(t.tipo) ?? { total: 0, vezes: 0 }
    porTipo.set(t.tipo, { total: a.total + Number(t.custo_usd) / n, vezes: a.vezes + 1 })
  }
  const medias: CustoMedio[] = [...porTipo.entries()].filter(([tipo]) => NOME_TIPO[tipo])
    .map(([tipo, a]) => ({ tipo, nome: NOME_TIPO[tipo], media: Math.max(1, creditosDe(a.total / a.vezes)), vezes: a.vezes }))
    .sort((a, b) => a.media - b.media)
  return { carregando: q.carregando, empresaMes: soma(doMes), agenteMes: soma(doMes.filter((t) => t.agente_id === agente)), medias }
}
