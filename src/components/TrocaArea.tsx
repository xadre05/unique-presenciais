// Troca entre as áreas do sistema (Comercial · Atendimento · Agentes), em blocos com ícone. Agentes só para o administrador.
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icone } from './Icone'

const AREAS = [
  { id: 'comercial', nome: 'Comercial', para: '/', icone: 'usuario' },
  { id: 'atendimento', nome: 'Atendimento', para: '/atendimento', icone: 'whats' },
  { id: 'agentes', nome: 'Agentes', para: '/agentes', icone: 'equipe', soAdmin: true },
] as const

export function TrocaArea({ ativa }: { ativa: (typeof AREAS)[number]['id'] }) {
  const { isAdmin } = useAuth()
  return (
    <div className="troca-area">
      {AREAS.filter((a) => isAdmin || !('soAdmin' in a)).map((a) => a.id === ativa
        ? <span key={a.id} className="ativa"><Icone nome={a.icone} tam={18} />{a.nome}</span>
        : <Link key={a.id} to={a.para}><Icone nome={a.icone} tam={18} />{a.nome}</Link>)}
    </div>
  )
}
