// Dados do Agente de Marketing para um período (um dia ou uma semana): peças (de qualquer pedido), trabalhos em andamento,
// último erro e campanhas. Enquanto o agente trabalha, confere a cada 4 segundos.
import { useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { EMPRESA_UNIQUE } from '../../crm/comum'
import { somaDias, type Peca, type Trabalho } from '../comum'
import { planosDe } from './planos'

export const EMPRESA = EMPRESA_UNIQUE
export type Campanha = { id: string; nome: string; descricao?: string; inicio?: string; fim?: string }

export function useMarketing(inicio: string, dias = 7) {
  const fim = somaDias(inicio, dias - 1)
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing')
    .or(`and(dia.gte.${inicio},dia.lte.${fim}),dia.is.null`).neq('status', 'descartada').order('dia').order('ordem'), [inicio, dias])
  // todas as peças, para a lista da Produção (que não depende do período do Planejamento)
  const todas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').neq('status', 'descartada').order('atualizado_em', { ascending: false }).limit(500))
  const trabalhos = useConsulta<Trabalho[]>(() => supabase.from('agentes_trabalhos').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing')
    .order('criado_em', { ascending: false }).limit(8))
  const perfil = useConsulta<{ perfil: Record<string, unknown>; ativo: boolean } | null>(() => supabase.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').maybeSingle())

  const emAndamento = (trabalhos.dados ?? []).filter((t) => t.status === 'na_fila' || t.status === 'trabalhando')
  const ultimo = trabalhos.dados?.[0] ?? null
  const erro = ultimo?.status === 'erro' && ultimo.tipo !== 'ajuste' ? ultimo : null
  const ocupado = emAndamento.some((t) => t.tipo !== 'ajuste')

  useEffect(() => {
    if (!emAndamento.length) return
    // as peças também, para ver as que o agente cria e escreve aparecendo
    const t = setInterval(() => { trabalhos.recarregar(); pecas.recarregar(); todas.recarregar() }, 4000)
    return () => clearInterval(t)
  }, [emAndamento.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // quando um trabalho termina, recarrega as peças
  useEffect(() => { if (!emAndamento.length) { pecas.recarregar(); todas.recarregar() } }, [emAndamento.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const campanhas = (Array.isArray(perfil.dados?.perfil?.campanhas) ? perfil.dados?.perfil?.campanhas : []) as Campanha[]
  const planos = planosDe(perfil.dados?.perfil)
  return { pecas, todas, trabalhos, perfil, campanhas, planos, emAndamento, ocupado, erro }
}

// cria um trabalho e chama o agente; devolve o erro em texto, se houver
type TipoTrabalho = 'semana' | 'ideia' | 'escrever' | 'propor_plano'
export async function criarTrabalho(tipo: TipoTrabalho, pedido: Record<string, unknown>): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase.from('agentes_trabalhos').insert({ empresa_id: EMPRESA, agente_id: 'marketing', tipo, pedido }).select('id').single()
  if (error) return { id: null, erro: error.message }
  const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
  return { id: data.id, erro: r.error ? 'O agente não conseguiu começar. Tente de novo em instantes.' : null }
}
export const pedirTrabalho = async (tipo: TipoTrabalho, pedido: Record<string, unknown>) => (await criarTrabalho(tipo, pedido)).erro
