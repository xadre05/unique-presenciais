// Dados da sala: o catálogo dos agentes junto com o que o banco sabe de cada um (ligado, trabalhos, custo).
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { EMPRESA_UNIQUE } from '../crm/comum'
import type { Estado } from './Personagem'
import { CATALOGO, type AgenteCatalogo, type AgenteSala, type Config } from './comum'

export type AgenteNaSala = AgenteCatalogo & { disponivel: boolean; ativo: boolean; estado: Estado; dados: AgenteSala | null }

export function estadoDo(a: AgenteSala | null): Estado {
  if (!a?.disponivel) return 'em_breve'
  if (a.status_agora === 'trabalhando' || a.status_agora === 'na_fila') return 'trabalhando'
  if (a.status_agora === 'erro') return 'erro'
  if (a.aguardando > 0) return 'esperando'
  return 'parado'
}

export function useSala() {
  const sala = useConsulta<AgenteSala[]>(() => supabase.rpc('agentes_sala', { p_empresa: EMPRESA_UNIQUE }))
  const cfg = useConsulta<Config | null>(() => supabase.from('agentes_config').select('*').eq('empresa_id', EMPRESA_UNIQUE).maybeSingle())
  // aqui é a Unique (Academy): os agentes só do Clinical ficam no sistema das clínicas
  const agentes: AgenteNaSala[] = CATALOGO.filter((c) => c.escopo !== 'clinical').map((c) => {
    const d = (sala.dados ?? []).find((x) => x.agente_id === c.id) ?? null
    return { ...c, dados: d, disponivel: !!d?.disponivel, ativo: !!d?.ativo, estado: estadoDo(d) }
  })
  const trabalhando = agentes.some((a) => a.estado === 'trabalhando')
  // enquanto alguém trabalha, a sala se atualiza sozinha
  useEffect(() => {
    if (!trabalhando) return
    const t = setInterval(() => sala.recarregar(), 5000)
    return () => clearInterval(t)
  }, [trabalhando]) // eslint-disable-line react-hooks/exhaustive-deps
  return { agentes, cfg: cfg.dados ?? null, cfgCarregando: cfg.carregando, erro: sala.erro, recarregar: sala.recarregar }
}
