// Campanhas no ar ou agendadas, no topo do Agente de Marketing: atalhos para criar o pacote de criativos, planejar
// a campanha com o agente ou mandar os materiais (página de vendas, roteiros, copy) que ele lê antes de escrever.
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { NOME_SITUACAO, TOM_SITUACAO, periodoCampanha, situacaoCampanha } from '../campanhas/dados'
import type { Campanha } from './useMarketing'

type Props = { campanhas: Campanha[]; aoPlanejar: (id: string) => void; aoPacote: (id: string) => void }

export function CampanhasAtivas({ campanhas, aoPlanejar, aoPacote }: Props) {
  const vivas = campanhas.filter((c) => ['ativa', 'agendada'].includes(situacaoCampanha(c))).slice(0, 3)
  if (!vivas.length) return null
  return (
    <div className="mk-camp-ativas">{vivas.map((c) => {
      const s = situacaoCampanha(c)
      return (
        <section key={c.id} className="mk-camp-ativa">
          <div className="mk-camp-ativa-txt">
            <span className={`badge ${TOM_SITUACAO[s]}`}>{NOME_SITUACAO[s]}</span>
            <b>{c.nome}</b><small className="muted">{periodoCampanha(c)}</small>
          </div>
          <div className="ia-linha">
            <button type="button" className="btn btn-ouro btn-mini" onClick={() => aoPacote(c.id)}><Icone nome="floco" tam={14} /> Pacote de criativos</button>
            <button type="button" className="btn btn-contorno-ouro btn-mini" onClick={() => aoPlanejar(c.id)}><Icone nome="agenda" tam={14} /> Planejar a campanha</button>
            <Link className="btn btn-mini" to={`/agentes/marca?aba=campanhas&campanha=${c.id}`}><Icone nome="documento" tam={14} /> Materiais</Link>
          </div>
        </section>
      )
    })}</div>
  )
}
