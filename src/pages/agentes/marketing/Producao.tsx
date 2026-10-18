// Produção de conteúdo: a lista de todas as peças (avulsas ou de um plano), com filtros, e o editor de cada peça.
import { Icone } from '../../../components/Icone'
import type { Peca, Trabalho } from '../comum'
import { ETAPA, etapaDe } from './etapas'
import { REDES, nomeFormato, redeDe } from './redes'
import { LogoRede } from './LogoRede'
import { CabecalhoAba, PainelFiltros, Resumo } from './BarraFiltros'
import { aplicarProducao, type FiltrosProducao } from './filtros'
import { PaginaPeca } from './PaginaPeca'
import type { Campanha } from './useMarketing'
import type { Plano } from './planos'

const dataBR = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'Sem data')

type Props = {
  pecas: Peca[]; carregando: boolean; aberta: Peca | null; aoAbrir: (p: Peca) => void; aoFecharPeca: () => void; trabalhos: Trabalho[]; aoMudar: () => void
  campanhas: Campanha[]; planos: Plano[]; f: FiltrosProducao; mudar: (c: Partial<FiltrosProducao>) => void
}

export function Producao(pr: Props) {
  const { f, mudar } = pr
  if (pr.aberta) return <PaginaPeca peca={pr.aberta} trabalhos={pr.trabalhos} campanhas={pr.campanhas} planos={pr.planos} aoVoltar={pr.aoFecharPeca} aoMudar={pr.aoMudar} />
  const lista = aplicarProducao(pr.pecas, f).sort((a, b) => (a.dia ?? '9999').localeCompare(b.dia ?? '9999'))
  const vinculo = (p: Peca) => pr.planos.find((x) => x.id === p.conteudo.plano)?.nome ?? 'Avulsa'
  const campanha = (p: Peca) => pr.campanhas.find((x) => x.id === p.conteudo.campanha)?.nome
  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Produção de conteúdo" sub="Abra uma peça para escrever, revisar ou finalizar." />
      <PainelFiltros tela={{ periodo: f.periodo, data: f.data, ate: f.ate }} mudarTela={mudar} comTodos f={f} mudar={mudar} campanhas={pr.campanhas} planos={pr.planos} />
      <Resumo f={f} mudar={mudar} texto={`${lista.length} ${lista.length === 1 ? 'peça' : 'peças'}${f.periodo === 'todos' ? '' : ' no período'} · cada peça é produzida individualmente`} />
      <div className="mk-tabela-caixa">
        <table className="tabela mk-tabela">
          <thead><tr><th>Peça</th><th>Canal e formato</th><th>Data planejada</th><th>Vínculo</th><th>Situação</th><th /></tr></thead>
          <tbody>{lista.map((p) => {
            const e = etapaDe(p), r = redeDe(p)
            return (
              <tr key={p.id} onClick={() => pr.aoAbrir(p)}>
                <td><span className="mk-tab-peca"><Icone nome="documento" tam={16} /><b>{p.titulo}</b></span></td>
                <td>{p.conteudo.livre ? <span className="muted">A definir</span> : <span className="mk-tab-canal"><LogoRede rede={r} />{REDES[r].nome} <span className="muted">· {nomeFormato(p.tipo, r)}</span></span>}</td>
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
