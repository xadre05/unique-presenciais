// Pedir ao agente que reescreva uma peça: ajuste pedido pela equipe, troca de formato ou escrever uma ideia.
import { supabase } from '../../../lib/supabase'
import type { Peca, Trabalho } from '../comum'
import { EMPRESA } from './useMarketing'

export async function pedirAjuste(peca: Peca, instrucao: string, opcoes: { lembrar?: boolean; tipo_novo?: string } = {}) {
  const { data, error } = await supabase.from('agentes_trabalhos').insert({
    empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'ajuste', pedido: { peca_id: peca.id, instrucao, ...opcoes },
  }).select('id').single()
  if (error) return error.message
  const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
  return r.error ? 'O agente não conseguiu começar. Tente de novo.' : null
}

export const instrucaoNovoDia = (dia: string) =>
  `A peça foi mudada para o dia ${dia}. Ajuste o que depender da data (dia da semana, "hoje", "amanhã", contagem regressiva); o resto fica igual.`
export const instrucaoNovoFormato = (tipo: string) =>
  `Transforme esta peça no formato ${tipo}, mantendo a mesma ideia e mensagem.`

// trabalho de ajuste desta peça: o que está rodando agora e o último que terminou
export function ajustesDa(peca: Peca | null, trabalhos: Trabalho[]) {
  const daPeca = peca ? trabalhos.filter((t) => (t.tipo === 'ajuste' && t.pedido.peca_id === peca.id) || (t.tipo === 'escrever' && ((t.pedido.peca_ids as string[] | undefined) ?? []).includes(peca.id))) : []
  return {
    rodando: daPeca.find((t) => t.status === 'na_fila' || t.status === 'trabalhando') ?? null,
    ultimo: daPeca.find((t) => t.status === 'pronto' || t.status === 'erro') ?? null,
  }
}
