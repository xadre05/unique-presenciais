// Gráfico simples de barras: entrou x saiu por mês (sem biblioteca; só CSS)
import { brl } from '../../lib/format'
import { nomeMes } from './dados'

export type Ponto = { mes: string; entrou: number; saiu: number }

export function Barras({ pontos, aoClicar, ativo }: { pontos: Ponto[]; aoClicar?: (mes: string) => void; ativo?: string }) {
  const max = Math.max(1, ...pontos.flatMap((p) => [p.entrou, p.saiu]))
  return (
    <div className="fin-barras" role="img" aria-label="Entrou e saiu por mês">
      {pontos.map((p) => (
        <button key={p.mes} type="button" className={`fin-barra-mes${p.mes === ativo ? ' ativo' : ''}`} onClick={() => aoClicar?.(p.mes)}
          title={`${nomeMes(p.mes)}\nEntrou: ${brl(p.entrou)}\nSaiu: ${brl(p.saiu)}\nResultado: ${brl(p.entrou - p.saiu)}`}>
          <span className="fin-barra-par">
            <span className="fin-barra fin-barra-entrou" style={{ height: `${(p.entrou / max) * 100}%` }} />
            <span className="fin-barra fin-barra-saiu" style={{ height: `${(p.saiu / max) * 100}%` }} />
          </span>
          <span className="fin-barra-rotulo">{nomeMes(p.mes, false)}</span>
        </button>
      ))}
    </div>
  )
}
