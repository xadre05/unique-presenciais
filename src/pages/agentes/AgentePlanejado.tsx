// Página de um agente que ainda está sendo construído: quem é e o que vai fazer.
import { Voltar } from '../../components/Voltar'
import { Link, useParams } from 'react-router-dom'
import { Vazio } from '../../components/ui'
import { Retrato } from './Retrato'
import { CATALOGO } from './comum'

export default function AgentePlanejado() {
  const { id = '' } = useParams()
  const a = CATALOGO.find((x) => x.id === id)
  if (!a) return <div className="pagina"><Vazio>Agente não encontrado. <Link to="/agentes" className="link">Voltar para a sala</Link></Vazio></div>
  return (
    <div className="pagina">
      <div className="migalha"><Voltar para="/agentes" texto="Sala dos agentes" /></div>
      <header className="agente-topo" style={{ ['--cor-agente' as string]: a.cor }}>
        <Retrato agente={a.id} estado="parado" alto={300} />
        <div>
          <h1>Agente de {a.nome}</h1>
          <p className="agente-papel">{a.papel} · {a.escopo === 'ambos' ? 'Academy e Clinical' : a.escopo === 'academy' ? 'Academy' : 'Clinical'}</p>
          <p>{a.descricao}</p>
          <span className="sala-pilula tom-neutro">Em breve: em construção</span>
        </div>
      </header>
    </div>
  )
}
