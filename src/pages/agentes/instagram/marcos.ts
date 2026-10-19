// Marcos (marca_marcos): datas em que algo mudou ("a partir de 20/10, novo jeito de postar"). Cada marco compara o
// depois (do dia do marco até hoje) com o antes (o mesmo número de dias logo antes do marco).
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { hojeBR, somaDias } from './dados'

export type Marco = { id: string; dia: string; nome: string; descricao: string | null; criado_em: string }

export function useMarcos(empresa: string) {
  return useConsulta<Marco[]>(() => supabase.from('marca_marcos').select('id,dia,nome,descricao,criado_em')
    .eq('empresa_id', empresa).eq('rede', 'instagram').eq('ativo', true).order('dia', { ascending: false }), [empresa])
}

export async function criarMarco(empresa: string, m: { dia: string; nome: string; descricao: string }) {
  const { error } = await supabase.from('marca_marcos').insert({ empresa_id: empresa, rede: 'instagram', dia: m.dia, nome: m.nome.trim(), descricao: m.descricao.trim() || null })
  if (error) throw new Error(msgErro(error))
}

export async function tirarMarco(id: string) {
  const { error } = await supabase.from('marca_marcos').update({ ativo: false }).eq('id', id)
  if (error) throw new Error(msgErro(error))
}

// depois: do marco até hoje; antes: o mesmo número de dias, terminando na véspera do marco
export function antesEDepois(m: Pick<Marco, 'dia'>, hoje = hojeBR()) {
  const dias = Math.max(0, Math.round((new Date(hoje + 'T12:00:00Z').getTime() - new Date(m.dia + 'T12:00:00Z').getTime()) / 86400000) + 1)
  if (dias <= 0) return { dias: 0, periodos: [] }
  return {
    dias,
    periodos: [
      { nome: 'Antes', de: somaDias(m.dia, -dias), ate: somaDias(m.dia, -1) },
      { nome: 'Depois', de: m.dia, ate: hoje },
    ],
  }
}
