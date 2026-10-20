// Área "Financeiro": o dinheiro da empresa, ao lado de Comercial, Atendimento e Agentes. Só para o administrador.
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { Marca } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { TrocaArea } from '../../components/TrocaArea'
import VisaoGeral from './VisaoGeral'
import PaginaPrevisao from './previsao/PaginaPrevisao'
import Entradas from './Entradas'
import AReceber from './AReceber'
import Despesas from './Despesas'

export default function AreaFinanceiro() {
  const { perfil, isAdmin } = useAuth()
  const local = useLocation()
  const [menu, setMenu] = useState(false)
  useEffect(() => { setMenu(false); window.scrollTo(0, 0) }, [local.pathname])
  useEffect(() => { document.body.classList.toggle('menu-aberto', menu) }, [menu])
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="app area-financeiro">
      <header className="topo-movel">
        <Link to="/financeiro" className="topo-marca"><img src="/logo-unique.png" alt="Unique" /><span>Financeiro</span></Link>
        <button className="btn btn-quadrado topo-menu" aria-label="Abrir menu" onClick={() => setMenu(true)}><Icone nome="menu" /></button>
      </header>
      {menu && <div className="fundo-menu" onClick={() => setMenu(false)} />}
      <aside className={`lateral${menu ? ' aberta' : ''}`}>
        <button className="btn btn-quadrado fechar-menu" aria-label="Fechar menu" onClick={() => setMenu(false)}><Icone nome="fechar" /></button>
        <Marca sub="Financeiro" />
        <TrocaArea ativa="financeiro" />
        <nav>
          <span className="nav-grupo">Dinheiro</span>
          <NavLink to="/financeiro" end><Icone nome="agenda" /> Previsão de caixa</NavLink>
          <NavLink to="/financeiro/geral"><Icone nome="grafico" /> Visão geral</NavLink>
          <NavLink to="/financeiro/entradas"><Icone nome="moedas" /> Entradas</NavLink>
          <NavLink to="/financeiro/receber"><Icone nome="agenda" /> A receber</NavLink>
          <NavLink to="/financeiro/despesas"><Icone nome="dinheiro" /> Despesas</NavLink>
          <span className="nav-grupo">Ligado a outras áreas</span>
          <NavLink to="/cobrancas"><Icone nome="alerta" /> Dívidas (cobrança)</NavLink>
          <NavLink to="/comissoes"><Icone nome="comissoes" /> Comissões</NavLink>
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
        <NavLink to="/financeiro" end><Icone nome="agenda" /><span>Previsão</span></NavLink>
        <NavLink to="/financeiro/geral"><Icone nome="grafico" /><span>Geral</span></NavLink>
        <NavLink to="/financeiro/entradas"><Icone nome="moedas" /><span>Entradas</span></NavLink>
        <NavLink to="/financeiro/receber"><Icone nome="agenda" /><span>A receber</span></NavLink>
        <NavLink to="/financeiro/despesas"><Icone nome="dinheiro" /><span>Despesas</span></NavLink>
      </nav>
      <main className="conteudo">
        <Routes>
          <Route index element={<PaginaPrevisao />} />
          <Route path="geral" element={<VisaoGeral />} />
          <Route path="entradas" element={<Entradas />} />
          <Route path="receber" element={<AReceber />} />
          <Route path="despesas" element={<Despesas />} />
          <Route path="*" element={<Navigate to="/financeiro" replace />} />
        </Routes>
      </main>
    </div>
  )
}
