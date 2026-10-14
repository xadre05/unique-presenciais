import { useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
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
import Historico from './pages/Historico'
import Equipe from './pages/Equipe'
import Links from './pages/Links'
import Ajuda from './pages/Ajuda'
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
  return (
    <div className="app">
      <aside className="lateral">
        <Marca />
        <nav>
          <NavLink to="/" end>Painel</NavLink>
          <NavLink to="/turmas">Turmas</NavLink>
          <NavLink to="/pagamentos">Pagamentos</NavLink>
          <NavLink to="/alunos">Alunos</NavLink>
          <NavLink to="/comissoes">{isAdmin ? 'Comissões' : 'Minhas comissões'}</NavLink>
          <NavLink to="/links">Links de pagamento</NavLink>
          {isAdmin && <NavLink to="/historico">Histórico</NavLink>}
          {isAdmin && <NavLink to="/equipe">Equipe e cadastros</NavLink>}
          <NavLink to="/ajuda" className="nav-ajuda">Como usar</NavLink>
        </nav>
        <NavLink to="/matricula/nova" className="btn btn-ouro btn-bloco">+ Nova matrícula</NavLink>
        <div className="lateral-rodape">
          <div className="quem">{perfil?.nome || perfil?.email}</div>
          <div className="muted pequeno">{isAdmin ? 'Administrador' : 'Vendedora'}</div>
          <button className="link pequeno" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </aside>
      <main className="conteudo">
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/turmas" element={<Turmas />} />
          <Route path="/turmas/:id" element={<TurmaDetalhe />} />
          <Route path="/matricula/nova" element={<NovaMatricula />} />
          <Route path="/matricula/:id" element={<MatriculaDetalhe />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/alunos" element={<Alunos />} />
          <Route path="/comissoes" element={<Comissoes />} />
          <Route path="/links" element={<Links />} />
          <Route path="/ajuda" element={<Ajuda />} />
          {isAdmin && <Route path="/historico" element={<Historico />} />}
          {isAdmin && <Route path="/equipe" element={<Equipe />} />}
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
  return <Layout />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Portao />
      </BrowserRouter>
    </AuthProvider>
  )
}
