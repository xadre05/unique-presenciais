// Área "Atendimento" da Unique: monta as telas do núcleo do CRM (src/crm) com o que é só da Unique
// (contatos cruzados com a Hotmart, listas manuais das vendedoras, resumo de compras no painel do contato).
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { Badge, Marca, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { useBaseCRM } from '../../crm/tipos'
import Conversas from '../../crm/Conversas'
import Funil from '../../crm/Funil'
import Disparos from '../../crm/Disparos'
import ConfigAtendimento from '../../crm/ConfigAtendimento'
import Contatos from '../crm/Contatos'
import Listas from '../crm/Listas'
import ListaTrabalho from '../crm/ListaTrabalho'
import { EMPRESA_UNIQUE, SEGMENTOS, STATUS_LISTA } from '../crm/comum'
import { brl, dataBR } from '../../lib/format'

type Resumo = { segmento: string | null; produtos: string[] | null; ultima_compra: string | null; aluno_presencial: boolean | null; reembolsou: boolean | null; total_liquido: number | null; listas: { campanha: string; status: string; vendedora: string | null; nota: string | null }[] }

// o que é da Unique no painel do contato: o que comprou, se é aluno, em que listas está
function ResumoUnique({ contatoId }: { contatoId: string }) {
  const [r, setR] = useState<Resumo | null>(null)
  useEffect(() => { supabase.rpc('resumo_do_contato', { p_contato: contatoId }).then(({ data }) => setR(data as Resumo)) }, [contatoId])
  if (!r) return null
  const seg = SEGMENTOS[r.segmento ?? 'frio']
  return (
    <div className="resumo-unique">
      <h3>Na Unique</h3>
      <div><Badge tom={seg?.tom}>{seg?.rotulo}</Badge>{r.aluno_presencial && <> <Badge tom="ouro">Aluno(a) presencial</Badge></>}{r.reembolsou && <> <Badge tom="erro">Já pediu reembolso</Badge></>}</div>
      {(r.produtos ?? []).length > 0
        ? <div className="pequeno">Comprou: <span className="muted">{(r.produtos ?? []).join(', ')}</span>{r.ultima_compra && <div className="muted">última compra em {dataBR(r.ultima_compra)}{r.total_liquido != null ? ` · ${brl(r.total_liquido)} no total` : ''}</div>}</div>
        : <div className="muted pequeno">Nenhuma compra na Hotmart com os e-mails dele.</div>}
      {r.listas.length > 0 && <div className="pequeno">{r.listas.map((l, i) => <div key={i}>{l.campanha}: <b>{STATUS_LISTA[l.status]?.rotulo}</b>{l.vendedora ? ` · ${l.vendedora}` : ''}{l.nota ? ` · “${l.nota}”` : ''}</div>)}</div>}
    </div>
  )
}

function AgenteIA() {
  return (
    <div className="pagina estreita">
      <h1>Agente IA</h1>
      <Vazio>Em construção. Aqui vai ficar a IA que faz o primeiro contato com o lead novo, responde dúvidas sobre os cursos com base no material da Unique e passa para a vendedora quando a pessoa quer comprar ou pede para falar com alguém.</Vazio>
    </div>
  )
}

export default function AreaAtendimento() {
  const { perfil, isAdmin } = useAuth()
  const base = useBaseCRM(EMPRESA_UNIQUE)
  const local = useLocation()
  const naConversa = local.pathname === '/atendimento' || local.pathname === '/atendimento/'
  const extra = (id: string) => <ResumoUnique contatoId={id} />
  const [menu, setMenu] = useState(false)
  useEffect(() => { setMenu(false) }, [local.pathname])
  useEffect(() => { document.body.classList.toggle('menu-aberto', menu) }, [menu])
  const itens = (<>
    <NavLink to="/atendimento" end><Icone nome="whats" /> Conversas</NavLink>
    <NavLink to="/atendimento/funil"><Icone nome="comissoes" /> Funil</NavLink>
    <NavLink to="/atendimento/listas"><Icone nome="lista" /> {isAdmin ? 'Listas manuais' : 'Minhas listas'}</NavLink>
    {isAdmin && <NavLink to="/atendimento/contatos"><Icone nome="contatos" /> Contatos</NavLink>}
    {isAdmin && <NavLink to="/atendimento/disparos"><Icone nome="sacola" /> Disparos</NavLink>}
    {isAdmin && <NavLink to="/atendimento/ia"><Icone nome="info" /> Agente IA</NavLink>}
    {isAdmin && <NavLink to="/atendimento/config"><Icone nome="equipe" /> Configurações</NavLink>}
  </>)
  return (
    <div className={`app area-atendimento${naConversa ? ' tela-cheia' : ''}`}>
      <header className="topo-movel">
        <Link to="/atendimento" className="topo-marca"><img src="/logo-unique.png" alt="Unique" /><span>Atendimento</span></Link>
        <button className="btn btn-quadrado topo-menu" aria-label="Abrir menu" onClick={() => setMenu(true)}><Icone nome="menu" /></button>
      </header>
      {menu && <div className="fundo-menu" onClick={() => setMenu(false)} />}
      <aside className={`lateral${menu ? ' aberta' : ''}`}>
        <button className="btn btn-quadrado fechar-menu" aria-label="Fechar menu" onClick={() => setMenu(false)}><Icone nome="fechar" /></button>
        <Marca sub="Atendimento" />
        <div className="troca-area"><Link to="/">Comercial</Link><span className="ativa">Atendimento</span></div>
        <nav>{itens}</nav>
        <div className="lateral-rodape">
          <div className="avatar"><Icone nome="usuario" tam={20} /></div>
          <div>
            <div className="quem">{perfil?.nome || perfil?.email}</div>
            <div className="muted pequeno">{isAdmin ? 'Administrador' : 'Atendimento'}</div>
            <button className="link pequeno" onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        </div>
      </aside>
      <nav className="barra-inferior">
        <NavLink to="/atendimento" end><Icone nome="whats" /><span>Conversas</span></NavLink>
        <NavLink to="/atendimento/funil"><Icone nome="comissoes" /><span>Funil</span></NavLink>
        <NavLink to="/atendimento/listas"><Icone nome="lista" /><span>Listas</span></NavLink>
        <NavLink to="/" end><Icone nome="painel" /><span>Comercial</span></NavLink>
        <button onClick={() => setMenu(true)}><Icone nome="menu" /><span>Mais</span></button>
      </nav>
      <main className="conteudo at-conteudo">
        <Routes>
          <Route index element={perfil ? <Conversas empresaId={EMPRESA_UNIQUE} usuarioId={perfil.id} base={base} painelExtra={extra} /> : null} />
          <Route path="funil" element={<div className="pagina larga"><h1>Funil</h1><Funil empresaId={EMPRESA_UNIQUE} base={base} painelExtra={extra} /></div>} />
          <Route path="listas" element={<Listas />} />
          <Route path="listas/:id" element={<ListaTrabalho />} />
          {isAdmin && <Route path="contatos" element={<Contatos />} />}
          {isAdmin && <Route path="disparos" element={<div className="pagina"><header className="pagina-topo"><div><h1>Disparos</h1><p className="muted">Mensagem para muitos contatos pelo número da empresa, no ritmo seguro de cada número. Para criar um, filtre em <Link to="/atendimento/contatos" className="link">Contatos</Link> e clique em “Disparar”.</p></div></header><Disparos empresaId={EMPRESA_UNIQUE} base={base} /></div>} />}
          {isAdmin && <Route path="ia" element={<AgenteIA />} />}
          {isAdmin && <Route path="config" element={<div className="pagina"><h1>Configurações do atendimento</h1><ConfigAtendimento empresaId={EMPRESA_UNIQUE} base={base} /></div>} />}
          <Route path="*" element={<Navigate to="/atendimento" replace />} />
        </Routes>
      </main>
    </div>
  )
}
