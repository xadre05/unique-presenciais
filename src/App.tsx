import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Painel from './pages/Painel'
import Turmas from './pages/Turmas'
import TurmaDetalhe from './pages/TurmaDetalhe'
import MatriculaDetalhe from './pages/MatriculaDetalhe'
import NovaMatricula from './pages/NovaMatricula'
import Pagamentos from './pages/Pagamentos'
import Comissoes from './pages/Comissoes'
import Alunos from './pages/Alunos'
import AlunoPerfil from './pages/AlunoPerfil'
import Historico from './pages/Historico'
import Configuracoes from './pages/Configuracoes'
import Links from './pages/Links'
import Ajuda from './pages/Ajuda'
import Agenda from './pages/Agenda'
import PaginaCaptura from './pages/publico/PaginaCaptura'
import AreaAtendimento from './pages/atendimento/AreaAtendimento'
import AreaAgentes from './pages/agentes/AreaAgentes'
import { TrocaArea } from './components/TrocaArea'
import { Icone } from './components/Icone'
import { Marca } from './components/ui'

function Aguardando() {
  const { perfil, recarregar } = useAuth()
  const inativo = perfil?.papel === 'inativo'
  return (
    <div className="tela-centro">
      <div className="cartao-login">
        <Marca grande />
        {inativo ? (<>
          <h2>Acesso desativado</h2>
          <p className="muted">Seu acesso foi desativado. Fale com o administrador.</p>
        </>) : (<>
          <h2>Pronto, sua conta foi criada ✓</h2>
          <p>Agora falta só um passo: o administrador precisa <b>liberar o seu acesso</b>.</p>
          <p className="muted">Avise o Alexandre que você criou a conta com o e-mail <b>{perfil?.email}</b>. Quando ele liberar, clique no botão abaixo.</p>
          <button className="btn btn-ouro btn-bloco" onClick={() => recarregar()}>Já liberaram meu acesso — entrar</button>
        </>)}
        <button className="link pequeno" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    </div>
  )
}

function Layout() {
  const { perfil, isAdmin } = useAuth()
  const [menu, setMenu] = useState(false)
  const local = useLocation()
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [local.pathname, local.search])
  useEffect(() => { document.body.classList.toggle('menu-aberto', menu) }, [menu])
  return (
    <div className="app">
      {/* celular: barra de cima com logo, nova matrícula e menu */}
      <header className="topo-movel">
        <Link to="/" className="topo-marca"><img src="/logo-unique.png" alt="Unique" /><span>Comercial</span></Link>
        <Link to="/matricula/nova" className="btn btn-ouro btn-quadrado" aria-label="Nova matrícula"><Icone nome="mais" /></Link>
        <button className="btn btn-quadrado topo-menu" aria-label="Abrir menu" onClick={() => setMenu(true)}><Icone nome="menu" /></button>
      </header>
      {menu && <div className="fundo-menu" onClick={() => setMenu(false)} />}
      <aside className={`lateral${menu ? ' aberta' : ''}`}>
        <button className="btn btn-quadrado fechar-menu" aria-label="Fechar menu" onClick={() => setMenu(false)}><Icone nome="fechar" /></button>
        <Marca />
        <TrocaArea ativa="comercial" />
        <nav>
          <NavLink to="/" end><Icone nome="painel" /> Painel</NavLink>
          <NavLink to="/turmas"><Icone nome="turmas" /> Turmas</NavLink>
          <NavLink to="/agenda"><Icone nome="agenda" /> Agenda</NavLink>
          <NavLink to="/pagamentos"><Icone nome="pagamentos" /> Pagamentos</NavLink>
          <NavLink to="/alunos"><Icone nome="alunos" /> Alunos</NavLink>
          <NavLink to="/comissoes"><Icone nome="comissoes" /> {isAdmin ? 'Comissões' : 'Minhas comissões'}</NavLink>
          <NavLink to="/links"><Icone nome="links" /> Links de pagamento</NavLink>
          {isAdmin && <NavLink to="/historico"><Icone nome="historico" /> Histórico</NavLink>}
          {isAdmin && <NavLink to="/configuracoes"><Icone nome="equipe" /> Configurações</NavLink>}
          <NavLink to="/ajuda" className="nav-ajuda"><Icone nome="ajuda" /> Como usar</NavLink>
        </nav>
        <NavLink to="/matricula/nova" className="btn btn-ouro btn-bloco btn-grande"><Icone nome="mais" /> Nova matrícula</NavLink>
        <div className="lateral-rodape">
          <div className="avatar"><Icone nome="usuario" tam={20} /></div>
          <div>
            <div className="quem">{perfil?.nome || perfil?.email}</div>
            <div className="muted pequeno">{isAdmin ? 'Administrador' : 'Vendedora'}</div>
            <button className="link pequeno" onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        </div>
      </aside>
      {/* celular: atalhos embaixo */}
      <nav className="barra-inferior">
        <NavLink to="/" end><Icone nome="painel" /><span>Painel</span></NavLink>
        <NavLink to="/atendimento"><Icone nome="whats" /><span>Atendimento</span></NavLink>
        <NavLink to="/alunos"><Icone nome="alunos" /><span>Alunos</span></NavLink>
        <NavLink to="/comissoes"><Icone nome="comissoes" /><span>Comissões</span></NavLink>
        <button onClick={() => setMenu(true)}><Icone nome="menu" /><span>Mais</span></button>
      </nav>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/turmas" element={<Turmas />} />
          <Route path="/turmas/:id" element={<TurmaDetalhe />} />
          <Route path="/matricula/nova" element={<NovaMatricula />} />
          <Route path="/matricula/:id" element={<MatriculaDetalhe />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/alunos" element={<Alunos />} />
          <Route path="/alunos/:id" element={<AlunoPerfil />} />
          <Route path="/comissoes" element={<Comissoes />} />
          <Route path="/links" element={<Links />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/listas/*" element={<Navigate to="/atendimento/listas" replace />} />
          <Route path="/contatos" element={<Navigate to="/atendimento/contatos" replace />} />
          <Route path="/ajuda" element={<Ajuda />} />
          {isAdmin && <Route path="/historico" element={<Historico />} />}
          {isAdmin && <Route path="/configuracoes" element={<Configuracoes />} />}
          {isAdmin && <Route path="/configuracoes/:aba" element={<Configuracoes />} />}
          {isAdmin && <Route path="/equipe" element={<Navigate to="/configuracoes/equipe" replace />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

function NovaSenha() {
  const { fimRecuperacao } = useAuth()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha.length < 8) return setErro('A senha precisa de pelo menos 8 caracteres.')
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) return setErro(error.message)
    fimRecuperacao()
  }
  return (
    <div className="tela-centro">
      <form className="cartao-login" onSubmit={salvar}>
        <Marca grande />
        <h2>Criar nova senha</h2>
        <label className="campo"><span className="campo-rotulo">Nova senha</span><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus /></label>
        {erro && <div className="erro">{erro}</div>}
        <button className="btn btn-ouro btn-bloco">Salvar senha</button>
      </form>
    </div>
  )
}

function Portao() {
  const { session, perfil, carregando, recuperando } = useAuth()
  if (recuperando) return <NovaSenha />
  if (carregando) return <div className="tela-centro muted">Carregando…</div>
  if (!session) return <Login />
  if (!perfil) return <div className="tela-centro muted">Carregando seu perfil…</div>
  if (perfil.papel !== 'admin' && perfil.papel !== 'vendedora') return <Aguardando />
  return (
    <Routes>
      <Route path="/atendimento/*" element={<AreaAtendimento />} />
      <Route path="/agentes/*" element={<AreaAgentes />} />
      <Route path="*" element={<Layout />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/f/:slug" element={<PaginaCaptura />} />
          <Route path="*" element={<Portao />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
