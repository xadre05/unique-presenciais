// Produção de conteúdo: a lista de todas as peças (avulsas ou de um plano), com filtros e páginas, e o editor de cada peça.
// Cada linha mostra o formato (ícone), o canal (logo), a data e a situação; capa, legenda e roteiro são materiais
// dentro da peça, não linhas separadas.
import { useState, type ReactNode } from 'react'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import type { Peca, Trabalho } from '../comum'
import { ETAPA, etapaDe, moverPara, mudarPeca, nomeSituacao, type Etapa } from './etapas'
import { REDES, nomeFormato, redeDe } from './redes'
import { infoFormato } from './formatos'
import { LogoRede } from './LogoRede'
import { MenuPeca } from './CartaoPeca'
import { CabecalhoAba, PainelFiltros, Resumo } from './BarraFiltros'
import { aplicarProducao, type FiltrosProducao } from './filtros'
import { PaginaPeca } from './PaginaPeca'
import type { Campanha } from './useMarketing'
import type { Plano } from './planos'

const POR_PAGINA = 15
const dataBR = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'Sem data')

type Props = {
  pecas: Peca[]; carregando: boolean; aberta: Peca | null; aoAbrir: (p: Peca) => void; aoFecharPeca: () => void; trabalhos: Trabalho[]; aoMudar: () => void
  campanhas: Campanha[]; planos: Plano[]; f: FiltrosProducao; mudar: (c: Partial<FiltrosProducao>) => void; abasTopo?: ReactNode
}

function Linha({ p, planos, aoAbrir, aoMover, aoTirar }: { p: Peca; planos: Plano[]; aoAbrir: () => void; aoMover: (e: Etapa) => void; aoTirar: () => void }) {
  const info = infoFormato(p.tipo)
  const e = etapaDe(p)
  const r = redeDe(p)
  const plano = planos.find((x) => x.id === p.conteudo.plano)?.nome
  return (
    <tr onClick={aoAbrir}>
      <td>
        <span className="mk-lp-peca">
          <span className="mk-lp-icone" style={{ ['--cor-tipo' as string]: info.cor }}><Icone nome={info.icone} tam={20} /></span>
          <span><b>{p.titulo}</b><small className="muted">{p.conteudo.livre ? info.nome : nomeFormato(p.tipo, r)}{plano ? ` · ${plano}` : ''}</small></span>
        </span>
      </td>
      <td>{p.conteudo.livre ? <span className="muted">A definir</span> : <span className="mk-tab-canal"><LogoRede rede={r} tam={20} />{REDES[r].nome}</span>}</td>
      <td>{dataBR(p.dia)}</td>
      <td><span className="mk-situacao" style={{ ['--cor-etapa' as string]: e === 'descartada' ? '#777' : ETAPA[e].cor }}>{nomeSituacao(p)}</span></td>
      <td className="mk-lp-acoes" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="mk-pontos" aria-label="Abrir peça" onClick={aoAbrir}><Icone nome="seta_dir" tam={16} /></button>
        <MenuPeca etapa={e} aoAbrir={aoAbrir} aoMover={aoMover} aoTirar={e === 'descartada' ? undefined : aoTirar} />
      </td>
    </tr>
  )
}

function Lista(pr: Props) {
  const { f, mudar } = pr
  const [pagina, setPagina] = useState(1)
  const [erro, setErro] = useState<string | null>(null)
  const lista = aplicarProducao(pr.pecas, f).sort((a, b) => (a.dia ?? '9999').localeCompare(b.dia ?? '9999'))
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const atual = Math.min(pagina, paginas)
  const visiveis = lista.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)
  const mover = async (p: Peca, etapa: Etapa) => { const { error } = await moverPara(p, etapa); if (error) return setErro(msgErro(error)); pr.aoMudar() }
  const tirar = async (p: Peca) => { const { error } = await mudarPeca(p.id, { status: 'descartada' }); if (error) return setErro(msgErro(error)); pr.aoMudar() }
  const mudarFiltro = (c: Partial<FiltrosProducao>) => { setPagina(1); mudar(c) }
  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Produção de conteúdo" sub="Selecione uma peça para continuar a produção." />
      <PainelFiltros tela={{ periodo: f.periodo, data: f.data, ate: f.ate }} mudarTela={mudarFiltro} comTodos f={f} mudar={mudarFiltro} campanhas={pr.campanhas} planos={pr.planos} />
      <Resumo f={f} mudar={mudarFiltro} texto={`${lista.length} ${lista.length === 1 ? 'peça' : 'peças'}${f.periodo === 'todos' ? '' : ' no período'}`} />
      <Erro msg={erro} />
      <div className="mk-tabela-caixa">
        <table className="tabela mk-tabela mk-lista-producao">
          <thead><tr><th>Peça</th><th>Canal</th><th>Data planejada</th><th>Situação</th><th /></tr></thead>
          <tbody>{visiveis.map((p) => <Linha key={p.id} p={p} planos={pr.planos} aoAbrir={() => pr.aoAbrir(p)} aoMover={(e) => mover(p, e)} aoTirar={() => tirar(p)} />)}</tbody>
        </table>
        {!pr.carregando && !lista.length && <p className="muted mk-vazio">Nenhuma peça com esses filtros.</p>}
      </div>
      <div className="mk-paginacao">
        <span className="muted pequeno">{lista.length ? `${(atual - 1) * POR_PAGINA + 1}–${Math.min(atual * POR_PAGINA, lista.length)} de ${lista.length} peças` : '0 peças'}</span>
        <div className="mk-paginas">
          <button className="btn btn-quadrado" aria-label="Página anterior" disabled={atual <= 1} onClick={() => setPagina(atual - 1)}><Icone nome="esquerda" /></button>
          {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => <button key={n} className={`btn btn-quadrado${n === atual ? ' ativa' : ''}`} onClick={() => setPagina(n)}>{n}</button>)}
          <button className="btn btn-quadrado" aria-label="Próxima página" disabled={atual >= paginas} onClick={() => setPagina(atual + 1)}><Icone nome="seta_dir" /></button>
        </div>
        <span className="muted pequeno"><Icone nome="info" tam={14} /> Clique em uma linha para abrir a peça.</span>
      </div>
    </section>
  )
}

export function Producao(pr: Props) {
  if (pr.aberta) return <PaginaPeca peca={pr.aberta} trabalhos={pr.trabalhos} campanhas={pr.campanhas} planos={pr.planos} aoVoltar={pr.aoFecharPeca} aoMudar={pr.aoMudar} abasTopo={pr.abasTopo} />
  return <Lista {...pr} />
}
