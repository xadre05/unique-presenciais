// Área "Atendimento" da Unique: monta as telas do núcleo do CRM (src/crm) com o que é só da Unique
// (contatos cruzados com a Hotmart, listas manuais das vendedoras, resumo de compras no painel do contato).
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth'
import { Badge, Marca, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { TrocaArea } from '../../components/TrocaArea'
import { useBaseCRM } from '../../crm/tipos'
import Conversas, { type Aba } from '../../crm/Conversas'
import MinhaFila from '../../crm/MinhaFila'
import PainelGestor from '../../crm/PainelGestor'
import Funil from '../../crm/Funil'
import Disparos from '../../crm/Disparos'
import ConfigAtendimento from '../../crm/ConfigAtendimento'
import Captura from '../../crm/Captura'
import { AvisoNumeros, AvisosConversas } from '../../crm/Avisos'
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
      <div className="cc-botoes">
        <Link className="btn btn-contorno-ouro btn-bloco" to={`/atendimento/contatos?abrir=${contatoId}`}><Icone nome="historico" tam={16} /> Ver histórico</Link>
        <Link className="btn btn-ouro btn-bloco" to="/matricula/nova"><Icone nome="mais" tam={16} /> Nova matrícula</Link>
      </div>
    </div>
  )
}

function AgenteIA() {
  return (
    <div className="pagina estreita">
      <h1>Agente IA</h1>
      <Vazio>O Agente de Atendimento agora mora na área <Link to="/agentes" className="link">Agentes</Link>, junto com os outros agentes de IA. Ele vai fazer o primeiro contato com o lead novo aqui nas Conversas, responder dúvidas sobre os cursos e passar para a vendedora quando a pessoa quiser comprar. Entra quando o WhatsApp estiver ligado.</Vazio>
    </div>
  )
}

export default function AreaAtendimento() {
  const { perfil, isAdmin } = useAuth()
  const base = useBaseCRM(EMPRESA_UNIQUE)
  const local = useLocation()
  const naConversa = local.pathname === '/atendimento' || local.pathname === '/atendimento/'
  const extra = (id: string) => <ResumoUnique contatoId={id} />
  const nav = useNavigate()
  const qs = new URLSearchParams(local.search)
  const abrirConversa = (id: string) => nav(id ? `/atendimento?c=${id}` : '/atendimento?aba=fila')
  const [menu, setMenu] = useState(false)
  useEffect(() => { setMenu(false) }, [local.pathname])
  useEffect(() => { document.body.classList.toggle('menu-aberto', menu) }, [menu])
  const itens = (<>
    <NavLink to="/atendimento/fila"><Icone nome="check" /> Minha fila</NavLink>
    <NavLink to="/atendimento" end><Icone nome="whats" /> Conversas</NavLink>
    <NavLink to="/atendimento/funil"><Icone nome="comissoes" /> Funil</NavLink>
    <NavLink to="/atendimento/listas"><Icone nome="lista" /> {isAdmin ? 'Listas manuais' : 'Minhas listas'}</NavLink>
    {isAdmin && <NavLink to="/atendimento/painel"><Icone nome="grafico" /> Painel</NavLink>}
    {isAdmin && <NavLink to="/atendimento/contatos"><Icone nome="contatos" /> Contatos</NavLink>}
    {isAdmin && <NavLink to="/atendimento/captura"><Icone nome="importar" /> Captura de leads</NavLink>}
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
        <TrocaArea ativa="atendimento" />
        <nav>{itens}</nav>
        <div className="lateral-rodape">
          <div className="avatar"><Icone nome="usuario" tam={20} /></div>
          <div>
            <div className="quem">{perfil?.nome || perfil?.email}</div>
            <div className="muted pequeno">{isAdmin ? 'Administrador' : 'Atendimento'}</div>
            <button className="link pequeno" onClick={() => supabase.auth.signOut()}>Sair</button>
            <div id="avisos-slot" />
          </div>
        </div>
      </aside>
      <nav className="barra-inferior">
        <NavLink to="/atendimento/fila"><Icone nome="check" /><span>Fila</span></NavLink>
        <NavLink to="/atendimento" end><Icone nome="whats" /><span>Conversas</span></NavLink>
        <NavLink to="/atendimento/listas"><Icone nome="lista" /><span>Listas</span></NavLink>
        <NavLink to="/" end><Icone nome="painel" /><span>Comercial</span></NavLink>
        <button onClick={() => setMenu(true)}><Icone nome="menu" /><span>Mais</span></button>
      </nav>
      <main className="conteudo at-conteudo">
        <AvisoNumeros empresaId={EMPRESA_UNIQUE} onAbrirConfig={isAdmin ? () => nav('/atendimento/config') : undefined} />
        <Routes>
          <Route index element={perfil ? <Conversas key={local.search} empresaId={EMPRESA_UNIQUE} usuarioId={perfil.id} base={base} painelExtra={extra} inicial={qs.get('c')} abaInicial={(qs.get('aba') as Aba) ?? null} /> : null} />
          <Route path="fila" element={perfil ? <MinhaFila key={qs.get('quem') ?? 'eu'} empresaId={EMPRESA_UNIQUE} usuarioId={perfil.id} base={base} abrirConversa={abrirConversa} abrirAba={(a) => nav(`/atendimento?aba=${a}`)} quemInicial={qs.get('quem')} prazoMin={base.config.prazo_primeiro_contato_min ?? 5} /> : null} />
          {isAdmin && <Route path="painel" element={<PainelGestor empresaId={EMPRESA_UNIQUE} base={base} ir={(d) => nav(d.fila ? `/atendimento/fila?quem=${d.fila}` : `/atendimento?aba=${d.aba ?? 'todas'}`)} />} />}
          <Route path="funil" element={<div className="pagina larga at-pagina"><header className="pagina-topo at-titulo-pagina"><div><h1>Funil de vendas</h1><p className="muted">Acompanhe as oportunidades e as próximas ações.</p></div></header><Funil empresaId={EMPRESA_UNIQUE} base={base} painelExtra={extra} /></div>} />
          <Route path="listas" element={<Listas />} />
          <Route path="listas/:id" element={<ListaTrabalho />} />
          {isAdmin && <Route path="contatos" element={<Contatos />} />}
          {isAdmin && <Route path="disparos" element={<div className="pagina"><header className="pagina-topo"><div><h1>Disparos</h1><p className="muted">Mensagem para muitos contatos pelo número da empresa, no ritmo seguro de cada número. Para criar um, filtre em <Link to="/atendimento/contatos" className="link">Contatos</Link> e clique em “Disparar”.</p></div></header><Disparos empresaId={EMPRESA_UNIQUE} base={base} /></div>} />}
          {isAdmin && <Route path="captura" element={<Captura empresaId={EMPRESA_UNIQUE} base={base} />} />}
          {isAdmin && <Route path="ia" element={<AgenteIA />} />}
          {isAdmin && <Route path="config" element={<div className="pagina"><h1>Configurações do atendimento</h1><ConfigAtendimento empresaId={EMPRESA_UNIQUE} base={base} /></div>} />}
          <Route path="*" element={<Navigate to="/atendimento" replace />} />
        </Routes>
      </main>
      {perfil && <AvisosConversas empresaId={EMPRESA_UNIQUE} usuarioId={perfil.id} abrir={(id) => nav(`/atendimento?c=${id}`)} abrirFila={() => nav('/atendimento/fila')} urlDe={(k) => (k.startsWith('t-') ? '/atendimento/fila' : `/atendimento?c=${k}`)} slotControles="avisos-slot" />}
    </div>
  )
}
