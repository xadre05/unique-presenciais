// O "?" das telas da área de Agentes: leva ao guia daquela tela na página Como usar.
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { guia } from './guias'

export function BotaoAjuda({ id }: { id: string }) {
  const g = guia(id)
  if (!g) return null
  return (
    <Link to={`/agentes/ajuda#${id}`} className="btn btn-quadrado cu-ajuda" title={`Como usar: ${g.titulo}`} aria-label={`Como usar: ${g.titulo}`}>
      <Icone nome="ajuda" tam={16} />
    </Link>
  )
}
