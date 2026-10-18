// Área "Agentes": a terceira área do sistema, ao lado de Comercial e Atendimento. Só para o administrador.
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { Marca } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { TrocaArea } from '../../components/TrocaArea'
import Sala from './Sala'
import AgenteMarketing from './AgenteMarketing'
import Central from './Central'
import AgentePlanejado from './AgentePlanejado'
import Aprovacoes from './Aprovacoes'
import Historico from './Historico'
import CentralMarca from './CentralMarca'
import Tarefas from './Tarefas'

export default function AreaAgentes() {
  const { perfil, isAdmin } = useAuth()
  const local = useLocation()
  const [menu, setMenu] = useState(false)
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [local.pathname])
  useEffect(() => { document.body.classList.toggle('menu-aberto', menu) }, [menu])
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="app area-agentes">
      <header className="topo-movel">
        <Link to="/agentes" className="topo-marca"><img src="/logo-unique.png" alt="Unique" /><span>Agentes</span></Link>
        <button className="btn btn-quadrado topo-menu" aria-label="Abrir menu" onClick={() => setMenu(true)}><Icone nome="menu" /></button>
      </header>
      {menu && <div className="fundo-menu" onClick={() => setMenu(false)} />}
      <aside className={`lateral${menu ? ' aberta' : ''}`}>
        <button className="btn btn-quadrado fechar-menu" aria-label="Fechar menu" onClick={() => setMenu(false)}><Icone nome="fechar" /></button>
        <Marca sub="Agentes" />
        <TrocaArea ativa="agentes" />
        <nav>
          <span className="nav-grupo">Operação</span>
          <NavLink to="/agentes" end><Icone nome="equipe" /> Visão geral</NavLink>
          <NavLink to="/agentes/tarefas"><Icone nome="check" /> Tarefas</NavLink>
          <NavLink to="/agentes/aprovacoes"><Icone nome="documento" /> Aprovações</NavLink>
          <NavLink to="/agentes/historico"><Icone nome="historico" /> Histórico</NavLink>
          <span className="nav-grupo">Gestão</span>
          <NavLink to="/agentes/marca"><Icone nome="livro" /> Base da marca</NavLink>
          <NavLink to="/agentes/central"><Icone nome="atualizar" /> Configurações</NavLink>
        </nav>
        <div className="lateral-rodape">
          <div className="avatar"><Icone nome="usuario" tam={20} /></div>
          <div>
            <div className="quem">{perfil?.nome || perfil?.email}</div>
            <div className="muted pequeno">Administrador</div>
            <button className="link pequeno" onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        </div>
      </aside>
      <nav className="barra-inferior">
        <NavLink to="/agentes" end><Icone nome="contatos" /><span>Sala</span></NavLink>
        <NavLink to="/agentes/aprovacoes"><Icone nome="documento" /><span>Aprovar</span></NavLink>
        <NavLink to="/agentes/marca"><Icone nome="livro" /><span>Marca</span></NavLink>
        <NavLink to="/" end><Icone nome="painel" /><span>Comercial</span></NavLink>
      </nav>
      <main className="conteudo">
        <Routes>
          <Route index element={<Sala />} />
          <Route path="marketing" element={<AgenteMarketing />} />
          <Route path="central" element={<Central />} />
          <Route path="aprovacoes" element={<Aprovacoes />} />
          <Route path="historico" element={<Historico />} />
          <Route path="marca" element={<CentralMarca />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path=":id" element={<AgentePlanejado />} />
          <Route path="*" element={<Navigate to="/agentes" replace />} />
        </Routes>
      </main>
    </div>
  )
}
