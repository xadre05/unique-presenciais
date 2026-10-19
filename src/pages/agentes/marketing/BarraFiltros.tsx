// Topo igual no Planejamento e na Produção: título da aba, um painel com o período (a data fica sempre no
// mesmo lugar) e os filtros de peça com rótulo, na mesma ordem, com a busca à direita; embaixo, o resumo.
import type { ReactNode } from 'react'
import { Icone } from '../../../components/Icone'
import { hojeISO, inicioDaSemana, somaDias } from '../comum'
import { ETAPAS } from './etapas'
import { SeletorCanais, SeletorFormatos } from './SeletoresFiltro'
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
  const trocar = (p: Periodo | 'todos') => mudar({ periodo: p, data: p === 'semana' ? inicioDaSemana(data) : data })
  const hoje = () => {
    const h = hojeISO()
    if (periodo === 'periodo') return mudar({ data: h, ate: ate > h ? ate : somaDias(h, 13) })
    mudar({ data: periodo === 'semana' ? inicioDaSemana(h) : h })
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
        <SeletorCanais f={f} mudar={mudar} />
        <SeletorFormatos f={f} mudar={mudar} />
        <label className="mk-pf-campo"><span>Situações</span><span className="select-icone"><select value={f.situacao} onChange={(e) => mudar({ situacao: e.target.value })}>
          <option value="">Todas</option>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select></span></label>
        <label className="select-icone mk-busca"><Icone nome="busca" /><input value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Buscar peça…" /></label>
      </div>
    </div>
  )
}

export const temFiltro = (f: FiltrosPecas) => !!(f.campanha || f.plano || f.canais.length || f.formatos.length || f.situacao || f.busca.trim())

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
