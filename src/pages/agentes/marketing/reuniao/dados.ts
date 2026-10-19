// Reunião de pauta: tipos, período de cada escopo e acesso ao banco (tabela agentes_reunioes) e ao agente.
// O agente responde na hora (não vira trabalho na fila); cada fala é guardada na reunião com a ata atualizada.
import { supabase } from '../../../../lib/supabase'
import { msgErro, useConsulta } from '../../../../lib/dados'
import { hojeISO, segundaDe, somaDias } from '../../comum'
import { EMPRESA, type Campanha } from '../useMarketing'

export type TipoEscopo = 'dia' | 'dias' | 'semana' | 'mes' | 'campanha'
// canais: os escolhidos no Planejar (vazio = o agente sugere na reunião); entram na ata para o agente já partir deles
export type Escopo = { tipo: TipoEscopo; inicio: string; fim: string; campanha?: string; texto?: string; canais?: string[] }
export type Assunto = { tema: string; porque?: string; rede?: string; tipo?: string; dia?: string }
export type CanalAta = { rede: string; formatos: string[]; quantidade: number }
export type Ata = { objetivo?: string; publico?: string; inicio?: string; fim?: string; campanha?: string; canais?: CanalAta[]; total?: number; assuntos?: Assunto[]; evitar?: string[]; observacoes?: string }
export type Fala = { de: 'equipe' | 'agente'; texto: string; opcoes?: string[]; hora: string }
export type Reuniao = { id: string; titulo: string; escopo: Escopo; mensagens: Fala[]; ata: Ata; plano_id: string | null; status: 'aberta' | 'plano' | 'fechada'; criado_em: string; atualizado_em: string }

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fimDoMes = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10) }
export const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// período sugerido para cada escopo, a partir de uma data (a da tela ou hoje)
export function periodoDe(tipo: TipoEscopo, data: string, campanha?: Campanha): { inicio: string; fim: string } {
  const base = data || hojeISO()
  if (tipo === 'dia') return { inicio: base, fim: base }
  if (tipo === 'dias') return { inicio: base, fim: somaDias(base, 2) }
  if (tipo === 'semana') { const i = segundaDe(base); return { inicio: i, fim: somaDias(i, 6) } }
  if (tipo === 'mes') { const i = base.slice(0, 8) + '01'; return { inicio: i, fim: fimDoMes(i) } }
  const inicio = campanha?.inicio && campanha.inicio > hojeISO() ? campanha.inicio : hojeISO()
  return { inicio, fim: campanha?.fim && campanha.fim >= inicio ? campanha.fim : somaDias(inicio, 13) }
}

export function tituloDe(e: Escopo, campanha?: Campanha) {
  const base = tituloBase(e, campanha)
  return campanha && e.tipo !== 'campanha' ? `${base} · ${campanha.nome}` : base
}

function tituloBase(e: Escopo, campanha?: Campanha) {
  if (e.tipo === 'dia') return e.inicio === hojeISO() ? `Hoje, ${dm(e.inicio)}` : `Dia ${dm(e.inicio)}`
  if (e.tipo === 'campanha') return `Campanha ${campanha?.nome ?? ''} · ${dm(e.inicio)}–${dm(e.fim)}`.trim()
  if (e.tipo === 'mes') return `Mês de ${new Date(e.inicio + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long' })}`
  return `${e.tipo === 'semana' ? 'Semana' : 'Dias'} ${dm(e.inicio)}–${dm(e.fim)}`
}

// todas as datas do período (o plano usa só estas)
export function datasDe(inicio: string, fim: string) {
  const r: string[] = []
  for (let d = inicio; d <= fim && r.length < 92; d = somaDias(d, 1)) r.push(d)
  return r
}

export function useReunioes() {
  return useConsulta<Reuniao[]>(() => supabase.from('agentes_reunioes').select('id,titulo,escopo,mensagens,ata,plano_id,status,criado_em,atualizado_em')
    .eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').eq('ativo', true).order('criado_em', { ascending: false }).limit(60))
}

export async function lerReuniao(id: string) {
  const { data, error } = await supabase.from('agentes_reunioes').select('id,titulo,escopo,mensagens,ata,plano_id,status,criado_em,atualizado_em').eq('id', id).maybeSingle()
  if (error) throw new Error(msgErro(error))
  return data as Reuniao | null
}

export async function criarReuniao(titulo: string, escopo: Escopo) {
  const { data, error } = await supabase.from('agentes_reunioes').insert({ empresa_id: EMPRESA, agente_id: 'marketing', titulo, escopo, ata: { inicio: escopo.inicio, fim: escopo.fim, ...(escopo.canais?.length ? { canais: escopo.canais.map((rede) => ({ rede, formatos: [], quantidade: 0 })) } : {}) } }).select('id,titulo,escopo,mensagens,ata,plano_id,status,criado_em,atualizado_em').single()
  if (error) throw new Error(msgErro(error))
  return data as Reuniao
}

export async function gravarReuniao(id: string, campos: Partial<Pick<Reuniao, 'mensagens' | 'ata' | 'plano_id' | 'status' | 'titulo'>>) {
  const { error } = await supabase.from('agentes_reunioes').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(msgErro(error))
}

export const arquivarReuniao = (id: string) => supabase.from('agentes_reunioes').update({ ativo: false }).eq('id', id)

type RespostaAgente = { resposta: string; opcoes: string[]; ata: Ata; pronta: boolean }
// manda a conversa ao agente; ele responde e devolve a ata atualizada
export async function falarNaReuniao(r: Reuniao, mensagens: Fala[], ata: Ata): Promise<RespostaAgente> {
  const corpo = { empresa: EMPRESA, reuniao: { id: r.id, escopo: r.escopo, ata, mensagens: mensagens.map(({ de, texto }) => ({ de, texto })) } }
  const { data, error } = await supabase.functions.invoke('agentes', { body: corpo })
  const d = data as (RespostaAgente & { erro?: string }) | null
  if (error || !d || d.erro) throw new Error(d?.erro ?? 'O agente não respondeu. Tente de novo.')
  return d
}

// a ata está pronta para virar plano: período, pelo menos um canal com formato e um assunto
export const ataCompleta = (a: Ata) => !!(a.inicio && a.fim && a.canais?.some((c) => c.formatos?.length) && a.assuntos?.length)
export const totalDa = (a: Ata) => a.total || (a.canais ?? []).reduce((s, c) => s + Number(c.quantidade || 0), 0) || (a.assuntos ?? []).length || 1
