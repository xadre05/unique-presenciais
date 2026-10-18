// Produção de conteúdo: a lista de todas as peças (avulsas ou de um plano), com filtros, e o editor de cada peça.
import { Icone } from '../../../components/Icone'
import type { Peca, Trabalho } from '../comum'
import { ETAPA, ETAPAS, etapaDe } from './etapas'
import { LISTA_REDES, REDES, nomeFormato, redeDe } from './redes'
import { andar, aplicarProducao, filtrosIniciais, rotuloPeriodo, type FiltrosProducao } from './filtros'
import { PaginaPeca } from './PaginaPeca'
import type { Campanha } from './useMarketing'
import type { Plano } from './planos'

const PERIODOS: { id: FiltrosProducao['periodo']; nome: string }[] = [{ id: 'todos', nome: 'Todos' }, { id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }, { id: 'mes', nome: 'Mês' }, { id: 'periodo', nome: 'Período' }]
const dataBR = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'Sem data')

type Props = {
  pecas: Peca[]; carregando: boolean; aberta: Peca | null; aoAbrir: (p: Peca) => void; aoFecharPeca: () => void; trabalhos: Trabalho[]; aoMudar: () => void
  campanhas: Campanha[]; planos: Plano[]; f: FiltrosProducao; mudar: (c: Partial<FiltrosProducao>) => void
}

function Periodo({ f, mudar }: Pick<Props, 'f' | 'mudar'>) {
  const comoPlanejamento = { ...filtrosIniciais(), periodo: f.periodo === 'todos' ? 'semana' as const : f.periodo, data: f.data, ate: f.ate }
  return (
    <div className="mk-barra mk-barra-2">
      <div className="mk-visoes">{PERIODOS.map((p) => <button key={p.id} className={f.periodo === p.id ? 'ativa' : ''} onClick={() => mudar({ periodo: p.id })}>{p.nome}</button>)}</div>
      {f.periodo === 'periodo' && <div className="mk-semana"><input type="date" value={f.data} onChange={(e) => mudar({ data: e.target.value })} /><span className="muted">até</span><input type="date" value={f.ate} min={f.data} onChange={(e) => mudar({ ate: e.target.value })} /></div>}
      {f.periodo !== 'todos' && f.periodo !== 'periodo' && (
        <div className="mk-semana">
          <button className="btn btn-quadrado" aria-label="Anterior" onClick={() => mudar({ data: andar(comoPlanejamento, -1) })}><Icone nome="esquerda" /></button>
          <b>{rotuloPeriodo(comoPlanejamento)}</b>
          <button className="btn btn-quadrado" aria-label="Próximo" onClick={() => mudar({ data: andar(comoPlanejamento, 1) })}><Icone nome="seta_dir" /></button>
        </div>
      )}
      <span className="muted pequeno mk-nota-filtro"><Icone nome="info" tam={14} /> O período filtra a lista; cada peça é produzida individualmente.</span>
    </div>
  )
}

export function Producao(pr: Props) {
  const { f, mudar } = pr
  if (pr.aberta) return <PaginaPeca peca={pr.aberta} trabalhos={pr.trabalhos} campanhas={pr.campanhas} planos={pr.planos} aoVoltar={pr.aoFecharPeca} aoMudar={pr.aoMudar} />
  const lista = aplicarProducao(pr.pecas, f).sort((a, b) => (a.dia ?? '9999').localeCompare(b.dia ?? '9999'))
  const vinculo = (p: Peca) => pr.planos.find((x) => x.id === p.conteudo.plano)?.nome ?? 'Avulsa'
  const campanha = (p: Peca) => pr.campanhas.find((x) => x.id === p.conteudo.campanha)?.nome
  return (
    <section className="mk-plano">
      <div className="mk-titulo-aba"><h2>Produção de conteúdo</h2><p className="muted">Abra uma peça para escrever, revisar ou finalizar.</p></div>
      <Periodo f={f} mudar={mudar} />
      <div className="mk-barra mk-barra-2">
        <label className="select-icone"><select value={f.campanha} onChange={(e) => mudar({ campanha: e.target.value })}><option value="">Todas as campanhas</option>{pr.campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label className="select-icone"><select value={f.plano} onChange={(e) => mudar({ plano: e.target.value })}><option value="">Todos os planejamentos</option><option value="avulsa">Peças avulsas</option>{pr.planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label className="select-icone"><select value={f.canal} onChange={(e) => mudar({ canal: e.target.value })}><option value="">Todos os canais</option>{LISTA_REDES.map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}</select></label>
        <label className="select-icone"><select value={f.situacao} onChange={(e) => mudar({ situacao: e.target.value })}><option value="">Todas as situações</option>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <label className="select-icone mk-busca"><Icone nome="busca" /><input value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Buscar peça…" /></label>
      </div>
      <h3 className="mk-lista-titulo">Peças <span className="muted pequeno">{lista.length} {lista.length === 1 ? 'resultado' : 'resultados'}</span></h3>
      <div className="mk-tabela-caixa">
        <table className="tabela mk-tabela">
          <thead><tr><th>Peça</th><th>Canal e formato</th><th>Data planejada</th><th>Vínculo</th><th>Situação</th><th /></tr></thead>
          <tbody>{lista.map((p) => {
            const e = etapaDe(p), r = redeDe(p)
            return (
              <tr key={p.id} onClick={() => pr.aoAbrir(p)}>
                <td><span className="mk-tab-peca"><Icone nome="documento" tam={16} /><b>{p.titulo}</b></span></td>
                <td>{p.conteudo.livre ? <span className="muted">A definir</span> : <span className="mk-tab-canal"><i style={{ background: REDES[r].cor }} />{REDES[r].nome} <span className="muted">· {nomeFormato(p.tipo, r)}</span></span>}</td>
                <td className="pequeno">{dataBR(p.dia)}</td>
                <td><span className="mk-chip-info">{vinculo(p)}</span>{campanha(p) && <span className="mk-chip-info camp">{campanha(p)}</span>}</td>
                <td>{e !== 'descartada' && <span className="mk-ponto" style={{ ['--cor-etapa' as string]: ETAPA[e].cor }}>{ETAPA[e].nome}</span>}</td>
                <td><button className="btn btn-contorno-ouro btn-mini" onClick={(ev) => { ev.stopPropagation(); pr.aoAbrir(p) }}>Abrir peça ›</button></td>
              </tr>
            )
          })}</tbody>
        </table>
        {!pr.carregando && !lista.length && <p className="muted mk-vazio">Nenhuma peça com esses filtros.</p>}
      </div>
      <div className="mk-convite"><span className="mk-convite-icone"><Icone nome="ideia" tam={22} /></span><span><b>Peça avulsa ou de um planejamento: o editor é o mesmo.</b><br /><span className="muted pequeno">Dia, semana, mês e período são filtros opcionais.</span></span></div>
    </section>
  )
}
