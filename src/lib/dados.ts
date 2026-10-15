import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Conta, Opcao, Vendedora } from './types'

export function useConsulta<T>(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await fn()
    if (error) setErro(error.message)
    else { setErro(null); setDados(data as T) }
    setCarregando(false)
  }, deps)
  useEffect(() => { carregar() }, [carregar])
  return { dados, erro, carregando, recarregar: carregar }
}

export function useCadastros() {
  const [contas, setContas] = useState<Conta[]>([])
  const [vendedoras, setVendedoras] = useState<Vendedora[]>([])
  const [cursos, setCursos] = useState<Opcao[]>([])
  const [turmas, setTurmas] = useState<(Opcao & { status: string; curso_id: string; data_inicio: string | null; data_fim: string | null; curso_nome: string; vendas_abertas: boolean; vagas: number; inscritos: number })[]>([])
  const carregar = useCallback(async () => {
    const [c, v, cu, t] = await Promise.all([
      supabase.from('contas').select('*').order('nome'),
      supabase.from('vendedoras').select('*').order('nome'),
      supabase.from('cursos').select('id,nome').eq('ativo', true).order('nome'),
      supabase.from('v_turmas').select('id,nome,status,curso_id,data_inicio,data_fim,curso_nome,vendas_abertas,vagas,inscritos').order('data_inicio', { ascending: true, nullsFirst: false }),
    ])
    setContas((c.data as Conta[]) ?? [])
    setVendedoras((v.data as Vendedora[]) ?? [])
    setCursos((cu.data as Opcao[]) ?? [])
    setTurmas((t.data as never) ?? [])
  }, [])
  useEffect(() => { carregar() }, [carregar])
  return { contas, vendedoras, cursos, turmas, recarregar: carregar }
}

export const msgErro = (e: unknown) => {
  const m = (e as { message?: string })?.message || String(e)
  if (m.includes('row-level security')) return 'Você não tem permissão para fazer isso.'
  if (m.includes('matricula_ativa_unica')) return 'Esse aluno já tem matrícula ativa nessa turma.'
  return m
}

// Id da vendedora ligada ao login atual (vendedora); null para admin ou sem vínculo.
export function minhaVendedoraId(vendedoras: { id: string; perfil_id: string | null }[], perfilId: string | null | undefined) {
  return perfilId ? vendedoras.find((v) => v.perfil_id === perfilId)?.id ?? null : null
}
