// Gráficos simples dos Resultados (uma série cada, sem segundo eixo): colunas por dia e linha do total.
// Barras finas com ponta arredondada, grade discreta, dica ao passar o mouse ou tocar, valor escrito no maior ponto.
import { useState } from 'react'
import { milhar } from './dados'

export type Ponto = { rotulo: string; valor: number | null; dica: string }
const ALT = 160, ESQ = 36, BASE = 22, TOPO = 14

// arredonda o topo da escala para um número "limpo" (10, 20, 50, 100, 200…)
function topoLimpo(max: number) {
  if (max <= 0) return 10
  const p = 10 ** Math.floor(Math.log10(max)), r = max / p
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p
}
const curto = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')} mil` : String(v))

function Dica({ ponto, x, largura }: { ponto: Ponto; x: number; largura: number }) {
  return <div className="gr-dica" style={{ left: `${(x / largura) * 100}%` }}><b>{ponto.rotulo}</b><span>{ponto.dica}</span></div>
}

// colunas por dia; valor null = dia sem número ainda (aparece como um traço na base)
export function Colunas({ pontos, titulo }: { pontos: Ponto[]; titulo: string }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const passo = 34, largura = ESQ + pontos.length * passo + 4
  const max = topoLimpo(Math.max(0, ...pontos.map((p) => p.valor ?? 0)))
  const y = (v: number) => TOPO + (ALT - TOPO - BASE) * (1 - v / max)
  const iMax = pontos.reduce((m, p, i) => ((p.valor ?? -1) > (pontos[m]?.valor ?? -1) ? i : m), 0)
  const barra = Math.min(18, passo - 6)
  return (
    <figure className="gr-figura" aria-label={titulo}>
      <div className="gr-area">
        <svg viewBox={`0 0 ${largura} ${ALT}`} role="img" aria-label={titulo} onMouseLeave={() => setAtivo(null)}>
          {[0, max / 2, max].map((v) => <g key={v}><line x1={ESQ} x2={largura} y1={y(v)} y2={y(v)} className="gr-grade" /><text x={ESQ - 6} y={y(v) + 4} className="gr-eixo" textAnchor="end">{curto(v)}</text></g>)}
          {pontos.map((p, i) => {
            const cx = ESQ + i * passo + passo / 2, x = cx - barra / 2
            const topo = p.valor != null ? y(p.valor) : ALT - BASE
            const h = ALT - BASE - topo, r = Math.min(4, h / 2)
            return (
              <g key={p.rotulo + i} onMouseEnter={() => setAtivo(i)} onClick={() => setAtivo(i)}>
                <rect x={ESQ + i * passo} y={TOPO} width={passo} height={ALT - TOPO - BASE} className="gr-alvo" />
                {p.valor != null && h > 0
                  ? <path d={`M${x},${ALT - BASE} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + barra - r} Q${x + barra},${topo} ${x + barra},${topo + r} V${ALT - BASE} Z`} className={`gr-barra${ativo === i ? ' ativa' : ''}`} />
                  : <line x1={x} x2={x + barra} y1={ALT - BASE - 1} y2={ALT - BASE - 1} className="gr-vazio" />}
                {i % Math.ceil(pontos.length / 8) === 0 && <text x={cx} y={ALT - 6} className="gr-eixo" textAnchor="middle">{p.rotulo}</text>}
                {i === iMax && p.valor != null && ativo == null && <text x={cx} y={topo - 4} className="gr-valor" textAnchor="middle">{milhar(p.valor)}</text>}
              </g>
            )
          })}
          <line x1={ESQ} x2={largura} y1={ALT - BASE} y2={ALT - BASE} className="gr-base" />
        </svg>
        {ativo != null && pontos[ativo] && <Dica ponto={pontos[ativo]} x={ESQ + ativo * passo + passo / 2} largura={largura} />}
      </div>
    </figure>
  )
}

// linha do total por dia (só os dias com foto do total)
export function Linha({ pontos, titulo }: { pontos: Ponto[]; titulo: string }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const validos = pontos.filter((p) => p.valor != null) as (Ponto & { valor: number })[]
  if (validos.length < 2) return null
  const passo = Math.max(16, Math.min(40, 600 / validos.length)), largura = ESQ + 16 + (validos.length - 1) * passo + 16
  const min = Math.min(...validos.map((p) => p.valor)), max = Math.max(...validos.map((p) => p.valor))
  const folga = Math.max(10, Math.round((max - min) * 0.2))
  const lo = min - folga, hi = max + folga
  const y = (v: number) => TOPO + (ALT - TOPO - BASE) * (1 - (v - lo) / (hi - lo))
  const x = (i: number) => ESQ + 16 + i * passo
  return (
    <figure className="gr-figura" aria-label={titulo}>
      <div className="gr-area">
        <svg viewBox={`0 0 ${largura} ${ALT}`} role="img" aria-label={titulo} onMouseLeave={() => setAtivo(null)}>
          {[lo, (lo + hi) / 2, hi].map((v) => <g key={v}><line x1={ESQ} x2={largura} y1={y(v)} y2={y(v)} className="gr-grade" /><text x={ESQ - 6} y={y(v) + 4} className="gr-eixo" textAnchor="end">{curto(Math.round(v))}</text></g>)}
          <polyline points={validos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')} className="gr-linha" />
          {validos.map((p, i) => (
            <g key={p.rotulo} onMouseEnter={() => setAtivo(i)} onClick={() => setAtivo(i)}>
              <rect x={x(i) - passo / 2} y={TOPO} width={passo} height={ALT - TOPO - BASE} className="gr-alvo" />
              <circle cx={x(i)} cy={y(p.valor)} r={ativo === i ? 5 : 4} className="gr-ponto" />
              {(i === 0 || i === validos.length - 1 || i % Math.ceil(validos.length / 6) === 0) && <text x={x(i)} y={ALT - 6} className="gr-eixo" textAnchor="middle">{p.rotulo}</text>}
            </g>
          ))}
          <text x={x(validos.length - 1)} y={y(validos.at(-1)!.valor) - 9} className="gr-valor" textAnchor="end">{milhar(validos.at(-1)!.valor)}</text>
        </svg>
        {ativo != null && validos[ativo] && <Dica ponto={validos[ativo]} x={x(ativo)} largura={largura} />}
      </div>
    </figure>
  )
}
