// CRM — NÚCLEO: tipos e acesso ao servidor do atendimento (sem nada da Unique).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Canal = {
  id: string; empresa_id: string; nome: string; tipo: 'teste' | 'whatsapp_qr' | 'whatsapp_oficial'; telefone: string | null
  status: 'desconectado' | 'conectando' | 'conectado' | 'erro'; status_info: string | null; ritmo_por_hora: number
  janela_inicio: string; janela_fim: string; config: Record<string, string>; ativo: boolean; atendente_id: string | null
}
export type Etapa = { id: string; empresa_id: string; nome: string; ordem: number; cor: string | null; final: 'ganho' | 'perdido' | null }
export type Conversa = {
  id: string; empresa_id: string; contato_id: string; canal_id: string; status: 'aberta' | 'resolvida'; atendente_id: string | null
  com_ia: boolean; nao_lidas: number; ultima_mensagem: string | null; ultima_em: string | null; ultima_direcao: string | null
  aguardando_resposta: boolean; criado_em: string
  contato?: { id: string; nome: string | null; telefone: string | null; etapa_id: string | null }
}
export type Mensagem = {
  id: string; conversa_id: string; direcao: 'entrada' | 'saida'; autor: 'contato' | 'atendente' | 'ia' | 'sistema' | 'disparo'
  autor_id: string | null; tipo: string; texto: string | null; midia_url: string | null; status: string; erro: string | null; criado_em: string
}
export type Nota = { id: string; conversa_id: string; autor_id: string | null; texto: string; criado_em: string }
export type Membro = { usuario_id: string; nome: string | null; papel: 'admin' | 'atendente'; ativo: boolean; disponivel: boolean; recebe_leads: boolean }
export type Resposta = { id: string; atalho: string; texto: string }
export type ConfigEmpresa = { rodizio?: boolean; prazo_primeiro_contato_min?: number; devolver_fila_min?: number | null; canal_padrao?: string; tentativas_max?: number; dias_entre_tentativas?: number }
export type Passo = { apos_horas: number; tipo: 'tarefa' | 'mensagem'; titulo?: string; texto?: string }
export type Cadencia = { id: string; nome: string; passos: Passo[]; ativa: boolean; tipo_tarefa: string }

export const TIPO_CANAL: Record<Canal['tipo'], string> = {
  teste: 'Número de teste (simulador)',
  whatsapp_qr: 'WhatsApp por QR code (servidor próprio)',
  whatsapp_oficial: 'WhatsApp API oficial (Meta)',
}
export const STATUS_CANAL: Record<Canal['status'], { rotulo: string; tom: string }> = {
  conectado: { rotulo: 'Conectado', tom: 'ok' }, conectando: { rotulo: 'Conectando', tom: 'alerta' },
  desconectado: { rotulo: 'Desconectado', tom: 'apagado' }, erro: { rotulo: 'Com erro', tom: 'erro' },
}

/** Chama a função do servidor do WhatsApp (enviar, simular...). */
export async function servidorWhats<T = Record<string, unknown>>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('crm-whatsapp', { body: corpo })
  if (error) {
    let msg = error.message, registrada = false
    try { const r = await (error as { context?: Response }).context?.json(); if (r?.erro) msg = r.erro; registrada = !!r?.mensagem } catch { /* sem corpo */ }
    // registrada: a mensagem ficou gravada como "não enviada" (dá para tentar de novo por ela)
    throw Object.assign(new Error(msg), { registrada })
  }
  if ((data as { erro?: string })?.erro) throw new Error((data as { erro: string }).erro)
  return data as T
}

/** Dados básicos da empresa no CRM: números, etapas, equipe, respostas rápidas e se eu sou admin. */
export function useBaseCRM(empresaId: string) {
  const [canais, setCanais] = useState<Canal[]>([])
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [equipe, setEquipe] = useState<Membro[]>([])
  const [respostas, setRespostas] = useState<Resposta[]>([])
  const [souAdmin, setSouAdmin] = useState(false)
  const [config, setConfig] = useState<ConfigEmpresa>({})
  const [motivos, setMotivos] = useState<string[]>([])
  const [cadencias, setCadencias] = useState<Cadencia[]>([])
  const carregar = useCallback(async () => {
    const [c, e, q, cfg, mp, cad, r, a] = await Promise.all([
      supabase.from('crm_canais').select('*').eq('empresa_id', empresaId).order('criado_em'),
      supabase.from('crm_etapas').select('*').eq('empresa_id', empresaId).order('ordem'),
      supabase.rpc('crm_membros_empresa', { p_empresa: empresaId }),
      supabase.from('crm_empresas').select('config').eq('id', empresaId).maybeSingle(),
      supabase.from('crm_motivos_perda').select('nome').eq('empresa_id', empresaId).order('ordem'),
      supabase.from('crm_cadencias').select('id,nome,passos,ativa,tipo_tarefa').eq('empresa_id', empresaId).order('nome'),
      supabase.from('crm_respostas').select('id,atalho,texto').eq('empresa_id', empresaId).order('atalho'),
      supabase.rpc('crm_sou_admin', { p_empresa: empresaId }),
    ])
    setCanais((c.data as Canal[]) ?? []); setEtapas((e.data as Etapa[]) ?? []); setEquipe((q.data as Membro[]) ?? [])
    setRespostas((r.data as Resposta[]) ?? []); setSouAdmin(a.data === true)
    setConfig(((cfg.data as { config?: ConfigEmpresa } | null)?.config) ?? {})
    setMotivos(((mp.data as { nome: string }[]) ?? []).map((x) => x.nome))
    setCadencias((cad.data as Cadencia[]) ?? [])
  }, [empresaId])
  useEffect(() => { carregar() }, [carregar])
  const nomeDe = (id: string | null | undefined) => (id ? equipe.find((m) => m.usuario_id === id)?.nome ?? 'Alguém da equipe' : null)
  return { canais, etapas, equipe, respostas, souAdmin, config, motivos, cadencias, nomeDe, recarregar: carregar }
}
export type BaseCRM = ReturnType<typeof useBaseCRM>

export const horaCurta = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso), hoje = new Date()
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ontem = new Date(hoje.getTime() - 864e5)
  if (d.toDateString() === ontem.toDateString()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
