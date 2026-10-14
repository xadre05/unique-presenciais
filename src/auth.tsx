import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

export type Perfil = { id: string; nome: string; email: string | null; papel: 'pendente' | 'vendedora' | 'admin' | 'inativo' }

type Ctx = { session: Session | null; perfil: Perfil | null; carregando: boolean; recarregar: () => Promise<void>; isAdmin: boolean; recuperando: boolean; fimRecuperacao: () => void }
const AuthCtx = createContext<Ctx>({ session: null, perfil: null, carregando: true, recarregar: async () => {}, isAdmin: false, recuperando: false, fimRecuperacao: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperando, setRecuperando] = useState(false)

  const carregarPerfil = async (s: Session | null) => {
    if (!s) { setPerfil(null); return }
    const { data } = await supabase.from('perfis').select('*').eq('id', s.user.id).maybeSingle()
    setPerfil((data as Perfil) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await carregarPerfil(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') setRecuperando(true)
      setSession(s)
      setTimeout(() => { carregarPerfil(s) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthCtx.Provider value={{ session, perfil, carregando, recarregar: () => carregarPerfil(session), isAdmin: perfil?.papel === 'admin', recuperando, fimRecuperacao: () => setRecuperando(false) }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
