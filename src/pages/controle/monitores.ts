// Monitor automático do Controle: o que foi conferido sozinho (sites, domínios, IAs, banco) e como mostrar.
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'

export type NivelMonitor = 'ok' | 'alerta' | 'erro'
export type Monitor = {
  id: string; nome: string; tipo: string; alvo: string | null; servico: string | null; ordem: number
  nivel: NivelMonitor | null; detalhe: string | null; verificado_em: string | null; desde: string | null
}

export const NOME_NIVEL: Record<NivelMonitor, string> = { ok: 'Funcionando', alerta: 'Atenção', erro: 'Com problema' }
export const TOM_NIVEL: Record<NivelMonitor, string> = { ok: 'ok', alerta: 'alerta', erro: 'erro' }
export const NOME_TIPO: Record<string, string> = { site: 'Site', dominio: 'Domínio', anthropic: 'Inteligência artificial', openai: 'Inteligência artificial', supabase: 'Banco de dados' }

export function useMonitores() {
  return useConsulta<Monitor[]>(() => supabase.from('controle_monitores').select('id,nome,tipo,alvo,servico,ordem,nivel,detalhe,verificado_em,desde').eq('ativo', true).order('ordem'), [])
}

export async function verificarAgora() {
  const { error } = await supabase.functions.invoke('controle-monitor', { body: {} })
  if (error) throw new Error(error.message)
}

// "há 5 min", "há 3 h" — a partir de um horário de referência (passado de fora para a tela não ler o relógio ao desenhar)
export function haQuanto(iso: string | null, agoraMs: number) {
  if (!iso) return 'ainda não verificado'
  const min = Math.max(0, Math.round((agoraMs - Date.parse(iso)) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`
}

const PESO: Record<NivelMonitor, number> = { ok: 0, alerta: 1, erro: 2 }
export function piorNivel(lista: Monitor[]): NivelMonitor | null {
  return lista.reduce<NivelMonitor | null>((pior, m) => (m.nivel && (!pior || PESO[m.nivel] > PESO[pior]) ? m.nivel : pior), null)
}
