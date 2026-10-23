// CRM — NÚCLEO: atalho de teclado com Ctrl (ou ⌘ no Mac) + uma tecla.
import { useEffect } from 'react'

export function useAtalho(tecla: string, fazer: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === tecla) { e.preventDefault(); fazer() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [tecla, fazer])
}
