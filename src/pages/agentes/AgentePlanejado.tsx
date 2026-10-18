// Página de um agente que ainda está sendo construído: quem é e o que vai fazer.
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import { visualDe, type AgenteSala } from './comum'

export default function AgentePlanejado() {
  const { id = '' } = useParams()
  const sala = useConsulta<AgenteSala[]>(() => supabase.rpc('agentes_sala', { p_empresa: EMPRESA_UNIQUE }))
  const a = (sala.dados ?? []).find((x) => x.agente_id === id)
  if (!sala.carregando && !a) return <div className="pagina"><Vazio>Agente não encontrado. <Link to="/agentes" className="link">Voltar para a sala</Link></Vazio></div>
  return (
    <div className="pagina">
      <div className="migalha"><Link to="/agentes" className="link">← Sala dos agentes</Link></div>
      {a && (
        <header className="agente-topo" style={{ ['--cor-agente' as string]: visualDe(id).cor }}>
          <Retrato agente={id} estado="parado" tam={150} />
          <div>
            <h1>{a.nome}</h1>
            <p className="agente-papel">{a.papel}</p>
            <p>{a.descricao}</p>
            <span className="sala-pilula tom-neutro">Planejado: em construção</span>
          </div>
        </header>
      )}
    </div>
  )
}
