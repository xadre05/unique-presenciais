// Troca entre as áreas do sistema (Comercial · Atendimento · Agentes). Agentes só para o administrador.
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

const AREAS = [
  { id: 'comercial', nome: 'Comercial', para: '/' },
  { id: 'atendimento', nome: 'Atendimento', para: '/atendimento' },
  { id: 'agentes', nome: 'Agentes', para: '/agentes', soAdmin: true },
] as const

export function TrocaArea({ ativa }: { ativa: (typeof AREAS)[number]['id'] }) {
  const { isAdmin } = useAuth()
  return (
    <div className="troca-area">
      {AREAS.filter((a) => isAdmin || !('soAdmin' in a)).map((a) => a.id === ativa
        ? <span key={a.id} className="ativa">{a.nome}</span>
        : <Link key={a.id} to={a.para}>{a.nome}</Link>)}
    </div>
  )
}
