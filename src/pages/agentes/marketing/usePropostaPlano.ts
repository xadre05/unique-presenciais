// A proposta de calendário de um plano: as peças propostas, o pedido ao agente (e o ajuste), acrescentar e aprovar.
// Usado pela Reunião de pauta e pela página antiga de Planejar conteúdos (planos feitos antes da reunião).
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import type { Peca } from '../comum'
import { mudarPeca } from './etapas'
import { marcarPlano, type Plano } from './planos'
import { EMPRESA, criarTrabalho, pedirTrabalho } from './useMarketing'

export type StatusProposta = 'vazio' | 'aguardando' | 'proposta' | 'aprovado'

export function usePropostaPlano(plano: Plano | null, aoMudou: () => void) {
  const pecas = useConsulta<Peca[]>(() => plano ? supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').eq('conteudo->>plano', plano.id).neq('status', 'descartada').order('dia').order('ordem') : Promise.resolve({ data: [], error: null }), [plano?.id])
  const [trabalho, setTrabalho] = useState<string | null>(null)
  const [resumo, setResumo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const lista = pecas.dados ?? []

  // enquanto o agente monta (ou ajusta) a proposta, confere a cada 3 segundos
  useEffect(() => {
    if (!trabalho) return
    const t = setInterval(async () => {
      const { data: tr } = await supabase.from('agentes_trabalhos').select('status,erro,resumo').eq('id', trabalho).maybeSingle()
      if (tr?.status === 'pronto') { setTrabalho(null); setResumo(tr.resumo); pecas.recarregar(); aoMudou() }
      if (tr?.status === 'erro') { setTrabalho(null); setErro(tr.erro) }
    }, 3000)
    return () => clearInterval(t)
  }, [trabalho]) // eslint-disable-line react-hooks/exhaustive-deps

  // pede a proposta (ou o ajuste dela); a nova substitui as peças propostas antes
  const pedirProposta = async (pedido: Record<string, unknown>, ajuste?: string) => {
    setErro(null)
    const anteriores = ajuste ? { ajuste, anteriores: lista.map((x) => ({ dia: x.dia, rede: x.conteudo.rede ?? 'instagram', tipo: x.tipo, titulo: x.titulo, angulo: x.conteudo.objetivo })) } : {}
    const { id, erro: e } = await criarTrabalho('propor_plano', { ...pedido, ...anteriores, substituir: lista.map((x) => x.id) })
    if (e || !id) { setErro(e ?? 'Não foi possível pedir a proposta.'); return false }
    setTrabalho(id); setResumo(null)
    return true
  }
  const acrescentar = async (dia: string) => {
    if (!plano) return
    const m = await pedirTrabalho('ideia', { pecas: [{ tipo: 'carrossel', rede: 'instagram', dia, titulo: 'Nova peça', plano: plano.id, proposta: plano.status !== 'aprovado' }] })
    if (m) return setErro(m)
    setTimeout(() => pecas.recarregar(), 1500)
  }
  // aprova: as peças saem da proposta e entram em Ideias
  const aprovar = async () => {
    if (!plano) return [] as string[]
    setEnviando(true)
    await Promise.all(lista.map((p) => mudarPeca(p.id, { conteudo: { ...p.conteudo, proposta: undefined } })))
    await marcarPlano(plano.id, 'aprovado')
    setEnviando(false); aoMudou()
    return lista.map((p) => p.id)
  }
  const status: StatusProposta = trabalho ? 'aguardando' : !lista.length ? 'vazio' : plano?.status === 'aprovado' ? 'aprovado' : 'proposta'
  return { pecas, lista, trabalho, resumo, erro, setErro, enviando, status, pedirProposta, acrescentar, aprovar }
}
