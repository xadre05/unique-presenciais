// "Área de trabalho": lista suspensa para andar entre Comercial, Atendimento e Agentes (Agentes só para o administrador).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { Icone } from './Icone'

const AREAS = [
  { id: 'comercial', nome: 'Comercial', para: '/', icone: 'painel' },
  { id: 'atendimento', nome: 'Atendimento', para: '/atendimento', icone: 'whats' },
  { id: 'agentes', nome: 'Agentes', para: '/agentes', icone: 'equipe', soAdmin: true },
] as const

export function TrocaArea({ ativa }: { ativa: (typeof AREAS)[number]['id'] }) {
  const { isAdmin } = useAuth()
  const [aberta, setAberta] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberta) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberta])
  const atual = AREAS.find((a) => a.id === ativa)!
  return (
    <div className="troca-area-v2" ref={caixa}>
      <span className="troca-rotulo">Área de trabalho</span>
      <button className={`troca-botao${aberta ? ' aberta' : ''}`} onClick={() => setAberta((v) => !v)} aria-expanded={aberta}>
        <Icone nome={atual.icone} tam={18} /><span>{atual.nome}</span><Icone nome="seta" tam={14} />
      </button>
      {aberta && (
        <div className="troca-lista">
          {AREAS.filter((a) => isAdmin || !('soAdmin' in a)).map((a) => (
            <Link key={a.id} to={a.para} className={a.id === ativa ? 'ativa' : ''} onClick={() => setAberta(false)}><Icone nome={a.icone} tam={18} />{a.nome}</Link>
          ))}
        </div>
      )}
    </div>
  )
}
