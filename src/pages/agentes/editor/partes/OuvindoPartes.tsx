// Andamento de "ouvir as partes": uma linha por parte (já ouvida, ouvindo agora com % e tempo, ou na fila), para a
// pessoa saber o que está acontecendo, quanto falta e que não travou. Parte já ouvida antes não é ouvida de novo.
import { useEffect, useState } from 'react'
import { Icone } from '../../../../components/Icone'

export type EstadoParte = { nome: string; situacao: 'fila' | 'ouvindo' | 'ouvida' | 'guardada'; texto?: string; fracao?: number; inicio?: number }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function OuvindoPartes({ estados }: { estados: EstadoParte[] }) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const prontas = estados.filter((e) => e.situacao === 'ouvida' || e.situacao === 'guardada').length
  return (
    <div className="pt-ouvindo" role="status">
      <p className="pequeno"><b>Ouvindo as partes: {prontas} de {estados.length} prontas</b></p>
      <ul>
        {estados.map((e, k) => {
          const passou = e.inicio ? (agora - e.inicio) / 1000 : 0
          const pct = Math.round((e.fracao ?? 0) * 100)
          return (
            <li key={k} className={`pt-ouvindo-${e.situacao}`}>
              <span className="pt-ouvindo-nome">{k + 1}. {e.nome}</span>
              {e.situacao === 'ouvindo' ? <>
                <span className="pt-ouvindo-barra"><i style={{ width: `${Math.max(3, pct)}%` }} /></span>
                <span className="muted">{pct}% · {mmss(passou)}{e.texto ? ` · ${e.texto}` : ''}{passou > 240 && !pct ? ' · arquivo grande, continua trabalhando' : ''}</span>
              </> : <span className="muted">{e.situacao === 'fila' ? 'na fila' : e.situacao === 'guardada' ? <><Icone nome="check" tam={13} /> já ouvida antes (sem custo)</> : <><Icone nome="check" tam={13} /> ouvida</>}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
