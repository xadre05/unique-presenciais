// Caminho no topo das páginas do Agente de Marketing (reunião, plano antigo): mostra onde a pessoa está
// ("Agente de Marketing › Reunião de pauta › Semana 26/10–01/11") e volta com um clique.
import { Icone } from '../../../components/Icone'

type Passo = { texto: string; aoClicar?: () => void }

export function Caminho({ passos }: { passos: Passo[] }) {
  return (
    <nav className="pp-trilha mk-caminho" aria-label="Onde você está">
      {passos.map((p, i) => (
        <span key={i} className="mk-caminho-passo">
          {i > 0 && <span aria-hidden="true">›</span>}
          {p.aoClicar
            ? <button type="button" onClick={p.aoClicar}>{i === 0 && <Icone nome="esquerda" tam={14} />}{p.texto}</button>
            : <b aria-current="page">{p.texto}</b>}
        </span>
      ))}
    </nav>
  )
}
