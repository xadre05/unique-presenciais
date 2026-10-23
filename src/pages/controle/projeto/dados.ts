// Controle → Projeto: o desenvolvimento do ecossistema como uma fábrica de software.
// Épico (projeto grande, dentro de uma fase) → entregas (cabem numa semana e dá para testar) → tarefas.
// Ideia nova cai na caixa de ideias e é triada: vira entrega de um épico, entra numa entrega ou é descartada.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hojeISO } from '../../../lib/format'

export type StatusEpico = 'planejado' | 'andamento' | 'concluido' | 'pausado'
export type StatusEntrega = 'espera' | 'semana' | 'construindo' | 'testar' | 'publicado'
export type Quem = 'claude' | 'alexandre' | 'equipe'

export type Epico = { id: string; nome: string; descricao: string | null; fase: number; ordem: number; status: StatusEpico; criado_em: string }
export type Entrega = {
  id: string; epico_id: string; nome: string; pronto_quando: string | null; status: StatusEntrega; semana: string | null
  ordem: number; resumo: string | null; publicado_em: string | null; criado_em: string
}
export type Tarefa = { id: string; entrega_id: string; titulo: string; quem: Quem; feito: boolean; ordem: number }
export type Ideia = { id: string; texto: string; status: 'nova' | 'triada' | 'descartada'; epico_id: string | null; entrega_id: string | null; criado_em: string }

export const FASES: Record<number, { nome: string; quando: string }> = {
  1: { nome: 'Black e caixa', quando: '23/10 a 30/11/2026' },
  2: { nome: 'Motor único', quando: 'dezembro/2026' },
  3: { nome: 'Base e agentes', quando: 'jan a fev/2027' },
  4: { nome: 'Planejador', quando: 'março/2027' },
  5: { nome: 'Produtos para vender', quando: '2º trimestre/2027' },
}

export const STATUS_EPICO: Record<StatusEpico, { rotulo: string; tom: string }> = {
  planejado: { rotulo: 'Planejado', tom: 'neutro' }, andamento: { rotulo: 'Em andamento', tom: 'ouro' },
  concluido: { rotulo: 'Concluído', tom: 'ok' }, pausado: { rotulo: 'Pausado', tom: 'apagado' },
}

// colunas do quadro, na ordem do trabalho
export const COLUNAS: { status: StatusEntrega; rotulo: string; explica: string }[] = [
  { status: 'semana', rotulo: 'Nesta semana', explica: 'Escolhida para a semana, ainda não começou' },
  { status: 'construindo', rotulo: 'Construindo', explica: 'Claude está fazendo' },
  { status: 'testar', rotulo: 'Para você testar', explica: 'Pronta: falta você testar e aprovar' },
  { status: 'publicado', rotulo: 'Publicado', explica: 'Aprovada e no ar' },
]
export const NOME_STATUS: Record<StatusEntrega, string> = { espera: 'Na lista de espera', semana: 'Nesta semana', construindo: 'Construindo', testar: 'Para você testar', publicado: 'Publicado' }
export const TOM_STATUS: Record<StatusEntrega, string> = { espera: 'neutro', semana: 'info', construindo: 'ouro', testar: 'alerta', publicado: 'ok' }
export const NOME_QUEM: Record<Quem, string> = { claude: 'Claude', alexandre: 'Alexandre', equipe: 'Equipe' }

/** Domingo da semana de uma data (a semana vai de domingo a sábado). */
export function domingoDe(iso = hojeISO()) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}
export const sabadoDe = (domingo: string) => { const d = new Date(domingo + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) }

/** Quantas entregas do épico já foram publicadas, de quantas. */
export function progressoEpico(e: Epico, entregas: Entrega[]) {
  const doEpico = entregas.filter((x) => x.epico_id === e.id)
  return { feitas: doEpico.filter((x) => x.status === 'publicado').length, total: doEpico.length }
}

export type Projeto = { epicos: Epico[]; entregas: Entrega[]; tarefas: Tarefa[]; ideias: Ideia[] }

/** Tudo do projeto de uma vez (são poucas linhas) e um jeito de gravar que recarrega depois. */
export function useProjeto() {
  const [dados, setDados] = useState<Projeto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    const [ep, en, ta, id] = await Promise.all([
      supabase.from('proj_epicos').select('*').order('fase').order('ordem'),
      supabase.from('proj_entregas').select('*').order('ordem').order('criado_em'),
      supabase.from('proj_tarefas').select('*').order('ordem').order('criado_em'),
      supabase.from('proj_ideias').select('*').order('criado_em', { ascending: false }),
    ])
    const falha = ep.error ?? en.error ?? ta.error ?? id.error
    if (falha) { setErro(falha.message); return }
    setErro(null)
    setDados({ epicos: ep.data as Epico[], entregas: en.data as Entrega[], tarefas: ta.data as Tarefa[], ideias: id.data as Ideia[] })
  }, [])
  useEffect(() => { carregar() }, [carregar])

  // grava e recarrega; devolve o erro em vez de estourar a tela
  const gravar = useCallback(async (acao: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await acao()
    if (error) { setErro(error.message); return false }
    await carregar()
    return true
  }, [carregar])
  return { dados, erro, recarregar: carregar, gravar }
}
export type UsoProjeto = ReturnType<typeof useProjeto>

/** Mudar a entrega de coluna: escolher para a semana marca o domingo; publicar marca a data. */
export function camposDoStatus(status: StatusEntrega, atual: Entrega): Partial<Entrega> {
  const c: Partial<Entrega> = { status }
  if (status !== 'espera' && !atual.semana) c.semana = domingoDe()
  if (status === 'espera') c.semana = null
  c.publicado_em = status === 'publicado' ? atual.publicado_em ?? new Date().toISOString() : null
  return c
}
