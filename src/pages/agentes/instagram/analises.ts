// Análises guardadas (marca_analises): cada pedido ao agente vira uma análise no histórico (antes a nova apagava a
// anterior). Cada aprendizado proposto recebe a decisão da equipe: ensinado (vai para a memória do agente) ou recusado.
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { lembrar } from '../memoria'
import type { Analise, FiltroAnalise } from './dados'

export type TipoAnalise = 'filtro' | 'periodos' | 'marco' | 'semanal'
export type Decisao = 'ensinado' | 'recusado'
export type AnaliseGuardada = {
  id: string; tipo: TipoAnalise; titulo: string | null; filtro: FiltroAnalise; resultado: Analise
  decisoes: Record<string, Decisao>; criado_em: string
}

export const NOME_TIPO_ANALISE: Record<TipoAnalise, string> = { filtro: 'Análise', periodos: 'Comparação', marco: 'Marco', semanal: 'Revisão semanal' }

export function useAnalises(empresa: string) {
  return useConsulta<AnaliseGuardada[]>(() => supabase.from('marca_analises').select('id,tipo,titulo,filtro,resultado,decisoes,criado_em')
    .eq('empresa_id', empresa).eq('rede', 'instagram').order('criado_em', { ascending: false }).limit(30), [empresa])
}

// aprendizados ainda sem decisão, somando todas as análises guardadas
export const pendentes = (a: AnaliseGuardada) => (a.resultado.aprendizados ?? []).filter((t) => !a.decisoes?.[t])

// grava a decisão (lê a análise antes, para não apagar a decisão que outra tela acabou de gravar)
async function gravarDecisoes(id: string, novas: Record<string, Decisao>) {
  const { data, error } = await supabase.from('marca_analises').select('decisoes').eq('id', id).single()
  if (error) throw new Error(msgErro(error))
  const { error: e2 } = await supabase.from('marca_analises').update({ decisoes: { ...(data.decisoes ?? {}), ...novas } }).eq('id', id)
  if (e2) throw new Error(msgErro(e2))
}

// ensina: o texto (editado ou não) vai para a memória do agente de marketing, com a análise de onde veio
export async function ensinar(empresa: string, a: AnaliseGuardada, original: string, texto: string) {
  const r = await lembrar(empresa, 'marketing', texto, 'resultado', a.titulo ?? NOME_TIPO_ANALISE[a.tipo])
  if (r.error) throw new Error(msgErro(r.error))
  await gravarDecisoes(a.id, { [original]: 'ensinado' })
}

export async function ensinarVarios(empresa: string, a: AnaliseGuardada, textos: { original: string; texto: string }[]) {
  for (const t of textos) {
    const r = await lembrar(empresa, 'marketing', t.texto, 'resultado', a.titulo ?? NOME_TIPO_ANALISE[a.tipo])
    if (r.error) throw new Error(msgErro(r.error))
  }
  await gravarDecisoes(a.id, Object.fromEntries(textos.map((t) => [t.original, 'ensinado' as Decisao])))
}

export const recusar = (a: AnaliseGuardada, original: string) => gravarDecisoes(a.id, { [original]: 'recusado' })
export const desfazer = async (a: AnaliseGuardada, original: string) => {
  const { data, error } = await supabase.from('marca_analises').select('decisoes').eq('id', a.id).single()
  if (error) throw new Error(msgErro(error))
  const d = { ...(data.decisoes ?? {}) } as Record<string, Decisao>
  delete d[original]
  const { error: e2 } = await supabase.from('marca_analises').update({ decisoes: d }).eq('id', a.id)
  if (e2) throw new Error(msgErro(e2))
}

export async function ligarRevisaoSemanal(empresa: string, ligada: boolean) {
  const { error } = await supabase.from('marca_conexoes').update({ revisao_semanal: ligada }).eq('empresa_id', empresa).eq('rede', 'instagram')
  if (error) throw new Error(msgErro(error))
}
