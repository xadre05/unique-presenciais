// CRM — NÚCLEO: peças visuais do Atendimento (cartão de número com ícone, avatar com iniciais).
// Estilo próprio do Atendimento (classes .at-*), sem mexer nas peças do Comercial.
import type { ReactNode } from 'react'
import { Icone } from '../components/Icone'

export function iniciais(nome: string | null | undefined) {
  const p = (nome ?? '').trim().split(/\s+/).filter((x) => x && !/^(de|da|do|dos|das|e)$/i.test(x))
  if (!p.length) return '?'
  return ((p[0][0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export function Avatar({ nome, grande }: { nome: string | null | undefined; grande?: boolean }) {
  return <span className={`at-avatar${grande ? ' grande' : ''}`} aria-hidden="true">{iniciais(nome)}</span>
}

// produto/assunto de interesse: etiqueta "interesse:…" (captura) ou a origem
export function interesseDe(tags: string[] | null | undefined, origem?: string | null) {
  const t = (tags ?? []).find((x) => x.startsWith('interesse:'))
  if (t) { const v = t.slice(10); return v.replace(/(^|\s)\S/g, (m) => m.toUpperCase()) }
  return origem ?? null
}

export function KpiAt({ icone, rotulo, valor, sub, tom, onClick, extra }: {
  icone: string; rotulo: string; valor: ReactNode; sub?: ReactNode; tom?: 'erro' | 'ok' | 'info' | 'ouro' | 'alerta'; onClick?: () => void; extra?: ReactNode
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`at-kpi${tom ? ' tom-' + tom : ''}${onClick ? ' clicavel' : ''}`} onClick={onClick}>
      <span className="at-kpi-icone"><Icone nome={icone} tam={20} /></span>
      <span className="at-kpi-corpo">
        <span className="at-kpi-rotulo">{rotulo}</span>
        <span className="at-kpi-valor">{valor}</span>
        {sub && <span className="at-kpi-sub">{sub}</span>}
        {extra}
      </span>
      {onClick && <span className="at-kpi-seta"><Icone nome="seta" tam={16} /></span>}
    </Tag>
  )
}
