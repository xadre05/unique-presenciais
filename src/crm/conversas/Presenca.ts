// CRM — NÚCLEO: quem mais está com esta conversa aberta agora (e se está digitando), para duas pessoas não
// responderem a mesma pessoa ao mesmo tempo. Usa a presença em tempo real do Supabase; nada fica gravado.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type Presente = { usuario: string; nome: string; digitando: boolean }

export function usePresenca(conversaId: string, usuarioId: string, nome: string | null) {
  const [outros, setOutros] = useState<Presente[]>([])
  const canal = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const parar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const ch = supabase.channel(`presenca-${conversaId}`, { config: { presence: { key: usuarioId } } })
    ch.on('presence', { event: 'sync' }, () => {
      const estado = ch.presenceState<Presente>()
      setOutros(Object.entries(estado).filter(([k]) => k !== usuarioId).map(([, v]) => v[v.length - 1]).filter(Boolean))
    }).subscribe((s) => { if (s === 'SUBSCRIBED') ch.track({ usuario: usuarioId, nome: nome ?? 'Alguém', digitando: false }) })
    canal.current = ch
    return () => { clearTimeout(parar.current); supabase.removeChannel(ch); canal.current = null }
  }, [conversaId, usuarioId, nome])
  // chamado a cada tecla: avisa que está digitando e para de avisar 4 s depois da última tecla
  const digitando = () => {
    const ch = canal.current
    if (!ch) return
    if (!parar.current) ch.track({ usuario: usuarioId, nome: nome ?? 'Alguém', digitando: true })
    clearTimeout(parar.current)
    parar.current = setTimeout(() => { parar.current = undefined; ch.track({ usuario: usuarioId, nome: nome ?? 'Alguém', digitando: false }) }, 4000)
  }
  return { outros, digitando }
}
