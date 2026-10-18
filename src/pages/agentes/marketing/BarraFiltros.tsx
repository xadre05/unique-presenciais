// Barras de filtro do Planejamento: período de visualização (dia, semana, mês, período) e filtros
// de visão, campanha, canais, formato, situação e busca, com os filtros ativos em etiquetas.
import { Icone } from '../../../components/Icone'
import { hojeISO, segundaDe } from '../comum'
import { ETAPAS } from './etapas'
import { LISTA_REDES, REDES, nomeFormato, type Formato, type Rede } from './redes'
import { andar, rotuloPeriodo, type Filtros, type Periodo } from './filtros'
import type { Campanha } from './useMarketing'

const PERIODOS: { id: Periodo; nome: string }[] = [{ id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }, { id: 'mes', nome: 'Mês' }, { id: 'periodo', nome: 'Período' }]
const FORMATOS: Formato[] = ['post', 'carrossel', 'reels', 'stories', 'video']

type Props = { f: Filtros; mudar: (c: Partial<Filtros>) => void; campanhas: Campanha[]; aoCriarCampanha: () => void }

export function BarraPeriodo({ f, mudar }: Pick<Props, 'f' | 'mudar'>) {
  const trocar = (p: Periodo) => mudar({ periodo: p, data: p === 'semana' ? segundaDe(f.data) : f.data })
  return (
    <div className="mk-barra mk-barra-periodo">
      <span className="mk-rotulo-barra">Período de visualização</span>
      <div className="mk-visoes">{PERIODOS.map((p) => <button key={p.id} className={f.periodo === p.id ? 'ativa' : ''} onClick={() => trocar(p.id)}><Icone nome="agenda" tam={16} /> {p.nome}</button>)}</div>
      {f.periodo === 'periodo' ? (
        <div className="mk-semana"><input type="date" value={f.data} onChange={(e) => mudar({ data: e.target.value })} /><span className="muted">até</span><input type="date" value={f.ate} min={f.data} onChange={(e) => mudar({ ate: e.target.value })} /></div>
      ) : (
        <div className="mk-semana">
          <button className="btn btn-quadrado" aria-label="Anterior" onClick={() => mudar({ data: andar(f, -1) })}><Icone nome="esquerda" /></button>
          <b><Icone nome="agenda" tam={16} /> {rotuloPeriodo(f)}</b>
          <button className="btn btn-quadrado" aria-label="Próximo" onClick={() => mudar({ data: andar(f, 1) })}><Icone nome="seta_dir" /></button>
          <button className="btn btn-contorno-ouro btn-mini" onClick={() => mudar({ data: f.periodo === 'semana' ? segundaDe(hojeISO()) : hojeISO() })}>Hoje</button>
        </div>
      )}
      <span className="muted pequeno mk-nota-filtro"><Icone nome="info" tam={14} /> Filtros alteram apenas a visualização.</span>
    </div>
  )
}

function Canais({ f, mudar }: Pick<Props, 'f' | 'mudar'>) {
  const todos = !f.canais.length
  const alternar = (r: Rede) => {
    const atual = todos ? [...LISTA_REDES] : f.canais
    const novo = atual.includes(r) ? atual.filter((x) => x !== r) : [...atual, r]
    mudar({ canais: novo.length === LISTA_REDES.length ? [] : novo })
  }
  return (
    <details className="mk-multi">
      <summary className="select-icone">{todos ? 'Todos os canais' : f.canais.map((c) => REDES[c].nome).join(', ')}</summary>
      <div className="mk-multi-lista">
        <label><input type="checkbox" checked={todos} onChange={() => mudar({ canais: [] })} /> Todos os canais</label>
        {LISTA_REDES.map((r) => <label key={r}><input type="checkbox" checked={todos || f.canais.includes(r)} onChange={() => alternar(r)} /><i style={{ background: REDES[r].cor }} /> {REDES[r].nome}</label>)}
      </div>
    </details>
  )
}

export function BarraFiltros({ f, mudar, campanhas, aoCriarCampanha }: Props) {
  const camp = campanhas.find((c) => c.id === f.campanha)
  const etiquetas = [
    f.periodo === 'dia' && { txt: new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR'), tirar: () => mudar({ periodo: 'semana', data: segundaDe(f.data) }) },
    camp && { txt: camp.nome, tirar: () => mudar({ campanha: '' }) },
    f.canais.length > 0 && { txt: f.canais.map((c) => REDES[c].nome).join(', '), tirar: () => mudar({ canais: [] }) },
    f.formato && { txt: nomeFormato(f.formato), tirar: () => mudar({ formato: '' }) },
    f.situacao && { txt: ETAPAS.find((e) => e.id === f.situacao)?.nome ?? f.situacao, tirar: () => mudar({ situacao: '' }) },
    f.busca && { txt: `"${f.busca}"`, tirar: () => mudar({ busca: '' }) },
  ].filter(Boolean) as { txt: string; tirar: () => void }[]
  return (<>
    <div className="mk-barra mk-barra-2">
      <div className="mk-visoes">
        <button className={f.visao === 'quadro' ? 'ativa' : ''} onClick={() => mudar({ visao: 'quadro' })}><Icone nome="quadro" /> Quadro</button>
        <button className={f.visao === 'calendario' ? 'ativa' : ''} onClick={() => mudar({ visao: 'calendario' })}><Icone nome="agenda" /> Calendário</button>
      </div>
      <label className="select-icone"><select value={f.campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha() : mudar({ campanha: e.target.value }))}>
        <option value="">Todas as campanhas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__nova">+ Nova campanha…</option>
      </select></label>
      <Canais f={f} mudar={mudar} />
      <label className="select-icone"><select value={f.formato} onChange={(e) => mudar({ formato: e.target.value })}><option value="">Todos os formatos</option>{FORMATOS.map((k) => <option key={k} value={k}>{nomeFormato(k)}</option>)}</select></label>
      <label className="select-icone"><select value={f.situacao} onChange={(e) => mudar({ situacao: e.target.value })}><option value="">Todas as situações</option>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
      <label className="select-icone mk-busca"><Icone nome="busca" /><input value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Buscar peça…" /></label>
    </div>
    {!!etiquetas.length && (
      <div className="mk-etiquetas">{etiquetas.map((e) => <span key={e.txt} className="mk-etiqueta">{e.txt}<button aria-label={`Tirar ${e.txt}`} onClick={e.tirar}><Icone nome="fechar" tam={13} /></button></span>)}
        <button className="link pequeno" onClick={() => mudar({ campanha: '', canais: [], formato: '', situacao: '', busca: '' })}>Limpar filtros</button></div>
    )}
  </>)
}
