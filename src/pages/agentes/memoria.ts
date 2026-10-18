// Memória do agente: gostos e recusas da equipe, guardados no perfil do agente (agentes_empresa.perfil.memoria).
// Toda gravação lê o perfil atual antes, para não apagar o que outra tela salvou.
import { supabase } from '../../lib/supabase'

export type Lembranca = { texto: string; em: string; origem: 'ajuste' | 'descarte' | 'manual' }

export async function atualizarPerfil(empresa: string, agente: string, mudar: (p: Record<string, unknown>) => Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const { data } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', agente).maybeSingle()
  const atual = (data?.perfil ?? {}) as Record<string, unknown>
  return supabase.from('agentes_empresa').upsert({ empresa_id: empresa, agente_id: agente, perfil: mudar(atual), atualizado_em: new Date().toISOString(), ...extra }, { onConflict: 'empresa_id,agente_id' })
}

export const memoriaDe = (perfil: Record<string, unknown>) => (Array.isArray(perfil.memoria) ? perfil.memoria : []) as Lembranca[]

export function lembrar(empresa: string, agente: string, texto: string, origem: Lembranca['origem']) {
  const t = texto.trim()
  if (!t) return Promise.resolve({ error: null })
  return atualizarPerfil(empresa, agente, (p) => {
    const m = memoriaDe(p)
    if (m.some((x) => x.texto.toLowerCase() === t.toLowerCase())) return p
    return { ...p, memoria: [...m, { texto: t, em: new Date().toISOString(), origem }].slice(-40) }
  })
}

export function esquecer(empresa: string, agente: string, texto: string) {
  return atualizarPerfil(empresa, agente, (p) => ({ ...p, memoria: memoriaDe(p).filter((x) => x.texto !== texto) }))
}
