// Quem mudou a base, quando e em que partes (as 30 últimas alterações, guardadas no próprio perfil).
import { Icone } from '../../../components/Icone'
import type { Alteracao } from './dados'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function HistoricoBase({ lista }: { lista: Alteracao[] }) {
  return (
    <section className="bm-cartao">
      <h3><Icone nome="historico" tam={20} /> Últimas alterações</h3>
      {lista.length ? (
        <ul className="bm-historico">{lista.slice(0, 6).map((a, i) => (
          <li key={i}><small className="muted">{quando(a.em)} · {a.por}</small><span>{a.partes.join(', ') || 'Sem mudança de texto'}</span></li>))}</ul>
      ) : <p className="muted pequeno">As alterações salvas a partir de agora aparecem aqui.</p>}
    </section>
  )
}
