// Área "Controle": o projeto do ecossistema (fases, épicos, semana, ideias), serviços pagos e a saúde das conexões. Só para o administrador.
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { Marca } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { TrocaArea } from '../../components/TrocaArea'
import PaginaServicos from './PaginaServicos'
import PaginaConexoes from './PaginaConexoes'
import PaginaProjeto from './projeto/PaginaProjeto'
import Configuracoes from '../Configuracoes'

export default function AreaControle() {
  const { perfil, isAdmin } = useAuth()
  const local = useLocation()
  const [menu, setMenu] = useState(false)
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [local.pathname])
  useEffect(() => { document.body.classList.toggle('menu-aberto', menu) }, [menu])
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="app area-controle">
      <header className="topo-movel">
        <Link to="/controle" className="topo-marca"><img src="/logo-unique.png" alt="Unique" /><span>Controle</span></Link>
        <button className="btn btn-quadrado topo-menu" aria-label="Abrir menu" onClick={() => setMenu(true)}><Icone nome="menu" /></button>
      </header>
      {menu && <div className="fundo-menu" onClick={() => setMenu(false)} />}
      <aside className={`lateral${menu ? ' aberta' : ''}`}>
        <button className="btn btn-quadrado fechar-menu" aria-label="Fechar menu" onClick={() => setMenu(false)}><Icone nome="fechar" /></button>
        <Marca sub="Controle" />
        <TrocaArea ativa="controle" />
        <nav>
          <span className="nav-grupo">Controle</span>
          <NavLink to="/controle" end><Icone nome="links" /> Está tudo no ar?</NavLink>
          <NavLink to="/controle/servicos"><Icone nome="moedas" /> Serviços pagos</NavLink>
          <span className="nav-grupo">Desenvolvimento</span>
          <NavLink to="/controle/projeto"><Icone nome="quadro" /> Projeto do ecossistema</NavLink>
          <span className="nav-grupo">Ajustes</span>
          <NavLink to="/controle/configuracoes"><Icone nome="equipe" /> Configurações</NavLink>
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
        <NavLink to="/controle" end><Icone nome="links" /><span>No ar?</span></NavLink>
        <NavLink to="/controle/servicos"><Icone nome="moedas" /><span>Serviços</span></NavLink>
        <NavLink to="/controle/projeto"><Icone nome="quadro" /><span>Projeto</span></NavLink>
      </nav>
      <main className="conteudo">
        <Routes>
          <Route index element={<PaginaConexoes />} />
          <Route path="servicos" element={<PaginaServicos />} />
          <Route path="projeto" element={<PaginaProjeto />} />
          <Route path="conexoes" element={<Navigate to="/controle" replace />} />
          <Route path="configuracoes" element={<Configuracoes area="controle" />} />
          <Route path="configuracoes/:aba" element={<Configuracoes area="controle" />} />
          <Route path="*" element={<Navigate to="/controle" replace />} />
        </Routes>
      </main>
    </div>
  )
}
