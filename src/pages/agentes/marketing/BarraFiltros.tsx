// Barras do topo, iguais no Planejamento e na Produção: título da aba, período de visualização (a data fica
// sempre no mesmo lugar, qualquer que seja o período) e filtros de peça na mesma ordem, com a busca à direita.
import type { ReactNode } from 'react'
import { Icone } from '../../../components/Icone'
import { hojeISO, segundaDe } from '../comum'
import { ETAPAS } from './etapas'
import { REDES, nomeFormato, useRedes, type Formato, type Rede } from './redes'
import { LogoRede } from './LogoRede'
import { andar, filtrosPecasVazios, rotuloPeriodo, type FiltrosPecas, type Periodo } from './filtros'
import type { Campanha } from './useMarketing'
import type { Plano } from './planos'

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const FORMATOS: Formato[] = ['post', 'carrossel', 'reels', 'stories', 'video']

export function CabecalhoAba({ titulo, sub, children }: { titulo: string; sub: string; children?: ReactNode }) {
  return (
    <div className="mk-titulo-aba">
      <div><h2>{titulo}</h2><p className="muted">{sub}</p></div>
      {children && <div className="mk-titulo-acoes">{children}</div>}
    </div>
  )
}

type Tela = { periodo: Periodo | 'todos'; data: string; ate: string }
type PropsPeriodo = Tela & { mudar: (c: Partial<Tela>) => void; comTodos?: boolean; nota: string }
const OPCOES: { id: Periodo | 'todos'; nome: string }[] = [{ id: 'todos', nome: 'Todos' }, { id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }, { id: 'mes', nome: 'Mês' }, { id: 'periodo', nome: 'Período' }]

export function BarraPeriodo({ periodo, data, ate, mudar, comTodos, nota }: PropsPeriodo) {
  const trocar = (p: Periodo | 'todos') => mudar({ periodo: p, data: p === 'semana' ? segundaDe(data) : data })
  const opcoes = OPCOES.filter((o) => comTodos || o.id !== 'todos')
  return (
    <div className="mk-barra mk-periodo">
      <div className="mk-periodo-cab">
        <span className="mk-rotulo-barra">Período de visualização</span>
        <span className="muted pequeno mk-nota-filtro"><Icone nome="info" tam={14} /> {nota}</span>
      </div>
      <div className="mk-periodo-linha">
        <div className="mk-visoes">{opcoes.map((o) => <button key={o.id} className={periodo === o.id ? 'ativa' : ''} onClick={() => trocar(o.id)}>{o.id !== 'todos' && <Icone nome="agenda" tam={15} />} {o.nome}</button>)}</div>
        <div className="mk-navega">
          {periodo === 'todos' && <span className="mk-navega-rotulo muted">Todas as datas</span>}
          {periodo === 'periodo' && (<>
            <input type="date" value={data} onChange={(e) => mudar({ data: e.target.value })} aria-label="De" />
            <span className="muted">até</span>
            <input type="date" value={ate} min={data} onChange={(e) => mudar({ ate: e.target.value })} aria-label="Até" />
          </>)}
          {periodo !== 'todos' && periodo !== 'periodo' && (<>
            <button className="btn btn-quadrado" aria-label="Anterior" onClick={() => mudar({ data: andar({ periodo, data, ate }, -1) })}><Icone nome="esquerda" /></button>
            <span className="mk-navega-rotulo"><Icone nome="agenda" tam={16} /> {maiuscula(rotuloPeriodo({ periodo, data, ate }))}</span>
            <button className="btn btn-quadrado" aria-label="Próximo" onClick={() => mudar({ data: andar({ periodo, data, ate }, 1) })}><Icone nome="seta_dir" /></button>
            <button className="btn btn-contorno-ouro btn-mini" onClick={() => mudar({ data: periodo === 'semana' ? segundaDe(hojeISO()) : hojeISO() })}>Hoje</button>
          </>)}
        </div>
      </div>
    </div>
  )
}

function Canais({ f, mudar }: Pick<PropsFiltros, 'f' | 'mudar'>) {
  const ativas = useRedes()
  const todos = !f.canais.length
  const alternar = (r: Rede) => {
    const atual = todos ? [...ativas] : f.canais
    const novo = atual.includes(r) ? atual.filter((x) => x !== r) : [...atual, r]
    mudar({ canais: novo.length === ativas.length ? [] : novo })
  }
  return (
    <details className="mk-multi select-icone">
      <summary>{todos ? 'Canais' : <span className="mk-logos">{f.canais.map((c) => <LogoRede key={c} rede={c} />)}{f.canais.length === 1 ? REDES[f.canais[0]].nome : `${f.canais.length} canais`}</span>}</summary>
      <div className="mk-multi-lista">
        <label><input type="checkbox" checked={todos} onChange={() => mudar({ canais: [] })} /> Todos os canais</label>
        {ativas.map((r) => <label key={r}><input type="checkbox" checked={todos || f.canais.includes(r)} onChange={() => alternar(r)} /><LogoRede rede={r} /> {REDES[r].nome}</label>)}
      </div>
    </details>
  )
}

type PropsFiltros = { f: FiltrosPecas; mudar: (c: Partial<FiltrosPecas>) => void; campanhas: Campanha[]; planos: Plano[]; aoCriarCampanha?: () => void }

export function BarraFiltros({ f, mudar, campanhas, planos, aoCriarCampanha }: PropsFiltros) {
  const camp = campanhas.find((c) => c.id === f.campanha)
  const plano = f.plano === 'avulsa' ? 'Peças avulsas' : planos.find((p) => p.id === f.plano)?.nome
  const etiquetas = [
    camp && { txt: camp.nome, tirar: () => mudar({ campanha: '' }) },
    plano && { txt: plano, tirar: () => mudar({ plano: '' }) },
    f.canais.length > 0 && { txt: f.canais.map((c) => REDES[c].nome).join(', '), tirar: () => mudar({ canais: [] }) },
    f.formato && { txt: nomeFormato(f.formato), tirar: () => mudar({ formato: '' }) },
    f.situacao && { txt: ETAPAS.find((e) => e.id === f.situacao)?.nome ?? f.situacao, tirar: () => mudar({ situacao: '' }) },
    f.busca && { txt: `"${f.busca}"`, tirar: () => mudar({ busca: '' }) },
  ].filter(Boolean) as { txt: string; tirar: () => void }[]
  return (<>
    <div className="mk-filtros">
      <label className="select-icone"><select value={f.campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha?.() : mudar({ campanha: e.target.value }))}>
        <option value="">Campanhas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}{aoCriarCampanha && <option value="__nova">+ Nova campanha…</option>}
      </select></label>
      <label className="select-icone"><select value={f.plano} onChange={(e) => mudar({ plano: e.target.value })}>
        <option value="">Planejamentos</option><option value="avulsa">Peças avulsas</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select></label>
      <Canais f={f} mudar={mudar} />
      <label className="select-icone"><select value={f.formato} onChange={(e) => mudar({ formato: e.target.value })}><option value="">Formatos</option>{FORMATOS.map((k) => <option key={k} value={k}>{nomeFormato(k)}</option>)}</select></label>
      <label className="select-icone"><select value={f.situacao} onChange={(e) => mudar({ situacao: e.target.value })}><option value="">Situações</option>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
      <label className="select-icone mk-busca"><Icone nome="busca" /><input value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Buscar peça…" /></label>
    </div>
    {!!etiquetas.length && (
      <div className="mk-etiquetas">{etiquetas.map((e) => <span key={e.txt} className="mk-etiqueta">{e.txt}<button aria-label={`Tirar ${e.txt}`} onClick={e.tirar}><Icone nome="fechar" tam={13} /></button></span>)}
        <button className="link pequeno" onClick={() => mudar(filtrosPecasVazios())}>Limpar filtros</button></div>
    )}
  </>)
}

// Quadro ou Calendário (fica no cabeçalho do Planejamento)
export function TrocaVisao({ visao, mudar }: { visao: 'quadro' | 'calendario'; mudar: (v: 'quadro' | 'calendario') => void }) {
  return (
    <div className="mk-visoes">
      <button className={visao === 'quadro' ? 'ativa' : ''} onClick={() => mudar('quadro')}><Icone nome="quadro" /> Quadro</button>
      <button className={visao === 'calendario' ? 'ativa' : ''} onClick={() => mudar('calendario')}><Icone nome="agenda" /> Calendário</button>
    </div>
  )
}
