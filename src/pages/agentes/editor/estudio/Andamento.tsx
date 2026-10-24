// Andamento da edição: em que passo o agente está, há quanto tempo, e uma barra que anda. A resposta do agente não
// diz quanto falta; a barra avança pelo tempo típico de cada passo e para perto do fim do passo até ele terminar.
import { useEffect, useState } from 'react'

const PASSOS = [
  { chave: /lendo|ouvindo|transcrev|baixando/i, nome: 'Ouvindo o vídeo', tipico: 90 },
  { chave: /editando|ajustando|tomadas/i, nome: 'O agente está montando a edição', tipico: 120 },
  { chave: /animando/i, nome: 'Animando as cenas', tipico: 60 },
]
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// porcentagem que o próprio texto já traz (ex.: "Lendo o áudio… 40%")
const porcentoDoTexto = (texto: string) => { const m = texto.match(/(\d{1,3})\s*%/); return m ? Math.min(100, Number(m[1])) / 100 : null }

export function Andamento({ texto }: { texto: string }) {
  const [inicio, setInicio] = useState(() => Date.now())
  const [agora, setAgora] = useState(() => Date.now())
  const indice = Math.max(0, PASSOS.findIndex((p) => p.chave.test(texto)))
  useEffect(() => { setInicio(Date.now()) }, [indice])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [])

  const passou = (agora - inicio) / 1000
  const noPasso = porcentoDoTexto(texto) ?? Math.min(0.9, passou / PASSOS[indice].tipico)
  const total = Math.round(((indice + noPasso) / PASSOS.length) * 100)
  return (
    <div className="es-andamento" role="status">
      <p>{texto}</p>
      <div className="es-andamento-barra"><span style={{ width: `${Math.max(3, total)}%` }} /></div>
      <p className="pequeno muted">Passo {indice + 1} de {PASSOS.length}: {PASSOS[indice].nome} · {mmss(passou)} neste passo · {total}%
        {passou > PASSOS[indice].tipico * 2 && ' · está demorando mais que o normal, mas continua trabalhando'}</p>
    </div>
  )
}
