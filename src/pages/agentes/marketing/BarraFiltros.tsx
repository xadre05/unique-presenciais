// Topo igual no Planejamento e na Produção: título da aba, um painel com o período (a data fica sempre no
// mesmo lugar) e os filtros de peça com rótulo, na mesma ordem, com a busca à direita; embaixo, o resumo.
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { hojeISO, segundaDe, somaDias } from '../comum'
import { ETAPAS } from './etapas'
import { FORMATOS, REDES, nomeFormato, nomeGenerico, useRedes, type Rede } from './redes'
import { LogoRede } from './LogoRede'
import { andar, filtrosPecasVazios, rotuloPeriodo, type FiltrosPecas, type Periodo } from './filtros'
import type { Campanha } from './useMarketing'
import type { Plano } from './planos'

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function CabecalhoAba({ titulo, sub, children }: { titulo: string; sub: string; children?: ReactNode }) {
  return (
    <div className="mk-titulo-aba">
      <div><h2>{titulo}</h2><p className="muted">{sub}</p></div>
      {children && <div className="mk-titulo-acoes">{children}</div>}
    </div>
  )
}

// Quadro ou Calendário (fica no cabeçalho do Planejamento)
export function TrocaVisao({ visao, mudar }: { visao: 'quadro' | 'calendario'; mudar: (v: 'quadro' | 'calendario') => void }) {
  return (
    <div className="mk-visoes mk-visoes-grande">
      <button className={visao === 'quadro' ? 'ativa' : ''} onClick={() => mudar('quadro')}><Icone nome="quadro" /> Quadro</button>
      <button className={visao === 'calendario' ? 'ativa' : ''} onClick={() => mudar('calendario')}><Icone nome="agenda" /> Calendário</button>
    </div>
  )
}

type Tela = { periodo: Periodo | 'todos'; data: string; ate: string }
const OPCOES: { id: Periodo | 'todos'; nome: string }[] = [{ id: 'todos', nome: 'Todos' }, { id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }, { id: 'mes', nome: 'Mês' }, { id: 'periodo', nome: 'Período' }]

function LinhaPeriodo({ periodo, data, ate, mudar, comTodos }: Tela & { mudar: (c: Partial<Tela>) => void; comTodos?: boolean }) {
  const trocar = (p: Periodo | 'todos') => mudar({ periodo: p, data: p === 'semana' ? segundaDe(data) : data })
  const hoje = () => {
    const h = hojeISO()
    if (periodo === 'periodo') return mudar({ data: h, ate: ate > h ? ate : somaDias(h, 13) })
    mudar({ data: periodo === 'semana' ? segundaDe(h) : h })
  }
  return (
    <div className="mk-pf-periodo">
      <span className="mk-pf-rotulo">Período</span>
      <div className="mk-visoes">{OPCOES.filter((o) => comTodos || o.id !== 'todos').map((o) => <button key={o.id} className={periodo === o.id ? 'ativa' : ''} onClick={() => trocar(o.id)}>{o.id !== 'todos' && <Icone nome="agenda" tam={15} />} {o.nome}</button>)}</div>
      <div className="mk-navega">
        {periodo === 'todos' && <span className="mk-navega-rotulo muted">Todas as datas</span>}
        {periodo === 'periodo' && (<>
          <label className="mk-data"><Icone nome="agenda" tam={16} /><input type="date" value={data} onChange={(e) => mudar({ data: e.target.value })} aria-label="De" /></label>
          <span className="muted">até</span>
          <label className="mk-data"><Icone nome="agenda" tam={16} /><input type="date" value={ate} min={data} onChange={(e) => mudar({ ate: e.target.value })} aria-label="Até" /></label>
        </>)}
        {periodo !== 'todos' && periodo !== 'periodo' && (<>
          <button className="btn btn-quadrado" aria-label="Anterior" onClick={() => mudar({ data: andar({ periodo, data, ate }, -1) })}><Icone nome="esquerda" /></button>
          <span className="mk-navega-rotulo"><Icone nome="agenda" tam={16} /> {maiuscula(rotuloPeriodo({ periodo, data, ate }))}</span>
          <button className="btn btn-quadrado" aria-label="Próximo" onClick={() => mudar({ data: andar({ periodo, data, ate }, 1) })}><Icone nome="seta_dir" /></button>
        </>)}
      </div>
      {periodo !== 'todos' && <button className="btn mk-hoje" onClick={hoje}>Hoje</button>}
    </div>
  )
}

type PropsFiltros = { f: FiltrosPecas; mudar: (c: Partial<FiltrosPecas>) => void; campanhas: Campanha[]; planos: Plano[]; aoCriarCampanha?: () => void }

function Canais({ f, mudar }: Pick<PropsFiltros, 'f' | 'mudar'>) {
  const ativas = useRedes()
  const todos = !f.canais.length
  const caixa = useRef<HTMLDetailsElement>(null)
  // fecha ao clicar fora ou apertar Esc (o <details> sozinho fica aberto)
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current?.open && !caixa.current.contains(e.target as Node)) caixa.current.open = false }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && caixa.current) caixa.current.open = false }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [])
  const definir = (canais: Rede[]) => {
    const vale = (canais.length ? canais : ativas).some((r) => REDES[r].formatos.includes(f.formato as never))
    mudar({ canais, ...(f.formato && !vale ? { formato: '' } : {}) })
  }
  const alternar = (r: Rede) => {
    const atual = todos ? [...ativas] : f.canais
    const novo = atual.includes(r) ? atual.filter((x) => x !== r) : [...atual, r]
    definir(novo.length === ativas.length ? [] : novo)
  }
  return (
    <div className="mk-pf-campo"><span>Canais</span>
      <details ref={caixa} className="mk-multi select-icone">
        <summary>{todos ? 'Todos' : <span className="mk-logos">{f.canais.map((c) => <LogoRede key={c} rede={c} />)}{f.canais.length === 1 ? REDES[f.canais[0]].nome : `${f.canais.length} canais`}</span>}</summary>
        <div className="mk-multi-lista">
          <label><input type="checkbox" checked={todos} onChange={() => definir([])} /> Todos os canais</label>
          {ativas.map((r) => <label key={r}><input type="checkbox" checked={todos || f.canais.includes(r)} onChange={() => alternar(r)} /><LogoRede rede={r} /> {REDES[r].nome}</label>)}
          <Link to="/agentes/marca" className="mk-multi-rodape"><Icone nome="mais" tam={14} /> Ligar outros canais</Link>
        </div>
      </details>
    </div>
  )
}

// formatos dos canais em foco: com um canal, o nome que ele usa (Reels, Shorts…); com vários, o nome geral (Vídeo curto)
function Formatos({ f, mudar }: Pick<PropsFiltros, 'f' | 'mudar'>) {
  const ativas = useRedes()
  const canais = f.canais.length ? f.canais : ativas
  const opcoes = FORMATOS.filter((k) => canais.some((r) => REDES[r].formatos.includes(k)))
  const rotulo = (k: string) => (canais.length === 1 ? nomeFormato(k, canais[0]) : nomeGenerico(k))
  return (
    <label className="mk-pf-campo"><span>Formatos</span><span className="select-icone"><select value={f.formato} onChange={(e) => mudar({ formato: e.target.value })}>
      <option value="">Todos</option>{opcoes.map((k) => <option key={k} value={k}>{rotulo(k)}</option>)}
    </select></span></label>
  )
}

export function PainelFiltros({ tela, mudarTela, comTodos, ...pf }: PropsFiltros & { tela: Tela; mudarTela: (c: Partial<Tela>) => void; comTodos?: boolean }) {
  const { f, mudar, campanhas, planos, aoCriarCampanha } = pf
  return (
    <div className="mk-painel-filtros">
      <LinhaPeriodo {...tela} mudar={mudarTela} comTodos={comTodos} />
      <div className="mk-pf-filtros">
        <label className="mk-pf-campo"><span>Campanhas</span><span className="select-icone"><select value={f.campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha?.() : mudar({ campanha: e.target.value }))}>
          <option value="">Todas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}{aoCriarCampanha && <option value="__nova">+ Nova campanha…</option>}
        </select></span></label>
        <label className="mk-pf-campo"><span>Planejamentos</span><span className="select-icone"><select value={f.plano} onChange={(e) => mudar({ plano: e.target.value })}>
          <option value="">Todos</option><option value="avulsa">Peças avulsas</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></span></label>
        <Canais f={f} mudar={mudar} />
        <Formatos f={f} mudar={mudar} />
        <label className="mk-pf-campo"><span>Situações</span><span className="select-icone"><select value={f.situacao} onChange={(e) => mudar({ situacao: e.target.value })}>
          <option value="">Todas</option>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select></span></label>
        <label className="select-icone mk-busca"><Icone nome="busca" /><input value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Buscar peça…" /></label>
      </div>
    </div>
  )
}

export const temFiltro = (f: FiltrosPecas) => !!(f.campanha || f.plano || f.canais.length || f.formato || f.situacao || f.busca.trim())

// linha abaixo do painel: quantas peças, (opcional) navegação do calendário e "Limpar filtros"
export function Resumo({ texto, f, mudar, meio, direita }: { texto: string; f: FiltrosPecas; mudar: (c: Partial<FiltrosPecas>) => void; meio?: ReactNode; direita?: ReactNode }) {
  return (
    <div className="mk-resumo">
      <span className="muted">{texto}</span>
      {meio && <div className="mk-resumo-meio">{meio}</div>}
      <div className="mk-resumo-dir">{direita}{temFiltro(f) && <button className="link" onClick={() => mudar(filtrosPecasVazios())}>Limpar filtros</button>}</div>
    </div>
  )
}
