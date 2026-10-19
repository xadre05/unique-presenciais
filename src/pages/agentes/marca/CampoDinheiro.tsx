// Valor em reais: mostra "R$ 4.997,60" e guarda o número. As setas sobem e descem de 1 em 1 real.
import { useState } from 'react'
import { reais } from './dados'

type Props = { valor?: number; aoMudar: (v?: number) => void; rotulo: string }

const ler = (s: string) => {
  const digitos = s.replace(/\D/g, '')
  return digitos ? Number(digitos) / 100 : undefined
}

export function CampoDinheiro({ valor, aoMudar, rotulo }: Props) {
  // enquanto digita, mostra o que está sendo digitado; fora disso, sempre o valor guardado (inclusive ao descartar)
  const [foco, setFoco] = useState(false)
  const [texto, setTexto] = useState('')
  return (
    <span className="bm-dinheiro">
      <input inputMode="numeric" aria-label={rotulo} value={foco ? texto : reais(valor)} placeholder="R$ 0,00"
        onFocus={() => { setTexto(reais(valor)); setFoco(true) }} onBlur={() => setFoco(false)}
        onChange={(e) => { const v = ler(e.target.value); aoMudar(v); setTexto(reais(v)) }} />
      <span className="bm-setas">
        <button type="button" aria-label={`Aumentar ${rotulo}`} onClick={() => aoMudar((valor ?? 0) + 1)}>▲</button>
        <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => aoMudar(Math.max(0, (valor ?? 0) - 1))}>▼</button>
      </span>
    </span>
  )
}
