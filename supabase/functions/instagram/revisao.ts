// Revisão semanal automática (19/10/2026): toda segunda, para cada empresa que ligou a revisão, o agente compara a
// semana passada (domingo a sábado) com as 4 semanas antes dela e propõe aprendizados. A equipe aprova na tela.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { analisar } from './analise.ts'

const somaDias = (dia: string, dias: number) => new Date(new Date(dia + 'T12:00:00Z').getTime() + dias * 86400000).toISOString().slice(0, 10)
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)

// semana passada completa (domingo a sábado antes de hoje) e as 4 semanas anteriores a ela
export function periodosDaSemana(hoje = hojeBR()) {
  const sabado = somaDias(hoje, -new Date(hoje + 'T12:00:00Z').getUTCDay() - 1)
  const domingo = somaDias(sabado, -6)
  return [
    { nome: '4 semanas antes', de: somaDias(domingo, -28), ate: somaDias(domingo, -1) },
    { nome: 'Semana passada', de: domingo, ate: sabado },
  ]
}

export const revisaoSemanal = (db: SupabaseClient, empresa: string) => analisar(db, empresa, { periodos: periodosDaSemana() }, 'semanal')

export async function revisaoTodas(db: SupabaseClient) {
  const { data } = await db.from('marca_conexoes').select('empresa_id').eq('rede', 'instagram').eq('status', 'conectado').eq('revisao_semanal', true)
  const feitas: Record<string, string> = {}
  for (const c of data ?? []) {
    try { const r = await revisaoSemanal(db, c.empresa_id); feitas[c.empresa_id] = String(r.id) } catch (e) { feitas[c.empresa_id] = (e as Error).message; console.error('revisão semanal', c.empresa_id, (e as Error).message) }
  }
  return feitas
}
