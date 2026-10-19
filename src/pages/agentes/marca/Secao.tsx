// Seção que abre e fecha: fechada mostra o título, um resumo de uma linha e o selo da situação.
import { useState, type ReactNode } from 'react'
import { Icone } from '../../../components/Icone'

import type { Selo } from './dados'
type Props = { titulo: string; icone: string; resumo?: ReactNode; selo?: Selo; aberta?: boolean; children: ReactNode }

export function Secao({ titulo, icone, resumo, selo, aberta: inicial = false, children }: Props) {
  const [aberta, setAberta] = useState(inicial)
  return (
    <section className={`bm-secao${aberta ? ' aberta' : ''}`}>
      <button type="button" className="bm-secao-cab" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
        <span className="bm-seta" aria-hidden>›</span>
        <Icone nome={icone} tam={20} />
        <b>{titulo}</b>
        <span className="bm-secao-resumo">{!aberta && resumo}</span>
        {selo && <span className={`badge badge-${selo.tom}`}>{selo.texto}</span>}
      </button>
      {aberta && <div className="bm-secao-corpo">{children}</div>}
    </section>
  )
}
