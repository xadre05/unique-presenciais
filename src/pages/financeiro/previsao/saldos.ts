// Saldo da Carteira da Hotmart por conta, informado à mão (a integração não entrega): disponível, a receber e os
// lançamentos futuros com data (que entram na previsão pela v_fin_previsao). Fica em financeiro_config.saldos.
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'

export type Lancamento = { data: string; valor: number; descricao: string }
export type Saldo = { disponivel: number; a_receber: number; em: string; lancamentos?: Lancamento[] }
export type ContaHotmart = { id: string; nome: string; conta_id: string | null }

export function useSaldos() {
  const cfg = useConsulta<{ saldos: Record<string, Saldo> }>(() => supabase.from('financeiro_config').select('saldos').eq('id', true).single(), [])
  const contas = useConsulta<ContaHotmart[]>(() => supabase.from('integracoes').select('id,nome,conta_id').eq('tipo', 'hotmart').order('ordem'), [])
  const salvar = async (id: string, s: Saldo) => {
    const { error } = await supabase.from('financeiro_config').update({ saldos: { ...(cfg.dados?.saldos ?? {}), [id]: s } }).eq('id', true)
    if (error) throw new Error(error.message)
    cfg.recarregar()
  }
  return { saldos: cfg.dados?.saldos ?? {}, contas: contas.dados ?? [], erro: cfg.erro || contas.erro, salvar }
}
