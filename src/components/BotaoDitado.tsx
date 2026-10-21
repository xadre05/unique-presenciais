// Botão de microfone: a pessoa fala e o texto entra no campo (reconhecimento de voz do próprio navegador, em
// português, sem custo e sem gravar áudio no sistema). Some nos navegadores que não têm esse recurso.
import { useEffect, useRef, useState } from 'react'
import { Icone } from './Icone'

type Reconhecimento = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null
  start: () => void; stop: () => void
}
type Construtor = new () => Reconhecimento
const API = (window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor })
const Reconhecedor = API.SpeechRecognition ?? API.webkitSpeechRecognition

export function BotaoDitado({ aoFalar, desativado }: { aoFalar: (texto: string) => void; desativado?: boolean }) {
  const [ouvindo, setOuvindo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const rec = useRef<Reconhecimento | null>(null)
  const recebe = useRef(aoFalar)
  useEffect(() => { recebe.current = aoFalar }, [aoFalar])
  useEffect(() => () => rec.current?.stop(), [])
  if (!Reconhecedor) return null

  const alternar = () => {
    if (ouvindo) { rec.current?.stop(); return }
    const r = new Reconhecedor()
    r.lang = 'pt-BR'; r.continuous = true; r.interimResults = false
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) recebe.current(e.results[i][0].transcript.trim())
    }
    r.onerror = (e) => setAviso(e.error === 'not-allowed' ? 'Libere o microfone para este site no navegador.' : null)
    r.onend = () => setOuvindo(false)
    rec.current = r; setAviso(null); setOuvindo(true); r.start()
  }
  return (
    <button type="button" className={`btn-ditado${ouvindo ? ' ouvindo' : ''}`} onClick={alternar} disabled={desativado}
      aria-pressed={ouvindo} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar em vez de digitar'} title={aviso ?? (ouvindo ? 'Ouvindo… clique para parar' : 'Falar em vez de digitar')}>
      <Icone nome="microfone" tam={18} />
    </button>
  )
}
