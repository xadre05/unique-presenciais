// Agente de Marketing → Resultados: os posts do Instagram com as métricas, filtrados por ano e formato, comparados
// com a mediana do filtro, a comparação entre os anos, o resumo por formato e a análise do agente (no mesmo filtro).
// Atualiza sozinho todo dia de manhã; "Atualizar agora" lê na hora; o histórico desde 2024 é trazido uma vez.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { CabecalhoAba } from '../marketing/BarraFiltros'
import { NOME_TIPO, acaoInstagram, mediana, milhar, n, useConexao, usePostsInstagram, useSeguidores, type FiltroAnalise, type PostIG } from './dados'
import { AnaliseInstagram } from './AnaliseInstagram'
import { ComparaAnos, PorFormato } from './Tabelas'
import { ComparaPeriodos } from './ComparaPeriodos'
import { SeguidoresInstagram } from './SeguidoresInstagram'

type Ordem = 'recentes' | 'alcance' | 'salvos'

function ListaPosts({ posts, med }: { posts: PostIG[]; med: number }) {
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  const lista = [...posts].sort((a, b) => (ordem === 'alcance' ? n(b, 'alcance') - n(a, 'alcance') : ordem === 'salvos' ? n(b, 'salvos') - n(a, 'salvos') : b.publicado_em.localeCompare(a.publicado_em)))
  const comparar = (v: number) => (med && v ? Math.round(((v - med) / med) * 100) : null)
  return (
    <>
      <div className="ia-linha"><span className="muted pequeno">Ordenar por</span>
        {(['recentes', 'alcance', 'salvos'] as Ordem[]).map((o) => <button key={o} type="button" className={`mk-chip${ordem === o ? ' ativo' : ''}`} onClick={() => setOrdem(o)}>{o === 'recentes' ? 'Mais recentes' : o === 'alcance' ? 'Maior alcance' : 'Mais salvos'}</button>)}</div>
      <div className="ig-lista">
        <table className="tabela ig-tabela">
          <thead><tr><th>Post</th><th>Alcance</th><th>Curtidas</th><th>Coment.</th><th>Salvos</th><th>Compart.</th><th /></tr></thead>
          <tbody>{lista.map((p) => { const dif = comparar(n(p, 'alcance')); return (
            <tr key={p.id}>
              <td className="ig-post">{p.miniatura ? <img src={p.miniatura} alt="" loading="lazy" /> : <span className="ig-sem-foto"><Icone nome="video" tam={16} /></span>}
                <span><b>{new Date(p.publicado_em).toLocaleDateString('pt-BR')} · {NOME_TIPO[p.tipo] ?? p.tipo}</b><small>{(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 110)}</small></span></td>
              <td>{milhar(n(p, 'alcance'))}{dif !== null && <small className={dif >= 0 ? 'ig-acima' : 'ig-abaixo'}>{dif >= 0 ? '+' : ''}{dif}%</small>}</td>
              <td>{milhar(n(p, 'curtidas'))}</td><td>{milhar(n(p, 'comentarios'))}</td><td>{milhar(n(p, 'salvos'))}</td><td>{milhar(n(p, 'compartilhamentos'))}</td>
              <td>{p.link && <a href={p.link} target="_blank" rel="noreferrer" className="btn btn-mini">Abrir</a>}</td>
            </tr>) })}</tbody>
        </table>
      </div>
    </>
  )
}

// ano e formato escolhidos viram o filtro da análise (de, até, tipo)
const filtroDe = (ano: string, tipo: string): FiltroAnalise => ({ ...(ano ? { de: `${ano}-01-01`, ate: `${ano}-12-31` } : {}), ...(tipo ? { tipo } : {}) })

export function ResultadosInstagram({ empresa }: { empresa: string }) {
  const conexao = useConexao(empresa)
  const posts = usePostsInstagram(empresa)
  const seguidores = useSeguidores(empresa)
  const historico = useMemo(() => seguidores.dados ?? [], [seguidores.dados])
  const [ano, setAno] = useState('')
  const [tipo, setTipo] = useState('')
  const [fazendo, setFazendo] = useState<'analisar' | 'sincronizar' | 'historico' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const todos = useMemo(() => posts.dados ?? [], [posts.dados])
  const anos = useMemo(() => [...new Set(todos.map((p) => p.publicado_em.slice(0, 4)))].sort().reverse(), [todos])
  const tipos = useMemo(() => [...new Set(todos.map((p) => p.tipo))], [todos])
  const lista = useMemo(() => todos.filter((p) => (!ano || p.publicado_em.startsWith(ano)) && (!tipo || p.tipo === tipo)), [todos, ano, tipo])
  const med = useMemo(() => mediana(lista.map((p) => n(p, 'alcance'))), [lista])
  const maisAntigo = todos.at(-1)?.publicado_em.slice(0, 10) ?? ''
  const c = conexao.dados
  const agir = async (acao: 'analisar' | 'sincronizar' | 'historico', filtro?: FiltroAnalise) => {
    setErro(null); setAviso(null); setFazendo(acao)
    try {
      await acaoInstagram(empresa, acao, acao === 'analisar' ? filtro ?? filtroDe(ano, tipo) : undefined)
      if (acao === 'analisar') document.querySelector('.ig-analise')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (acao === 'historico') setAviso('Buscando os posts desde 2024 com as métricas. Leva alguns minutos: volte e recarregue a página.')
      conexao.recarregar(); posts.recarregar(); seguidores.recarregar()
    } catch (e) { setErro((e as Error).message) }
    setFazendo(null)
  }
  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Resultados" sub="O que os posts publicados entregaram e o que o agente aprendeu com eles. Hoje: Instagram." />
      {!conexao.carregando && c?.status !== 'conectado' && (
        <div className="mk-vazio-grande"><Icone nome="grafico" tam={30} /><p>O Instagram ainda não está ligado.</p>
          <span className="muted pequeno">Ligue em <Link to="/agentes/central?aba=integracoes">Configurações → Integrações</Link>. Depois disso o agente lê os posts e as métricas todo dia.</span></div>
      )}
      {c?.status === 'conectado' && (<>
        <div className="ig-barra">
          <div className="ia-linha">
            <button type="button" className={`mk-chip${!ano ? ' ativo' : ''}`} onClick={() => setAno('')}>Todos os anos</button>
            {anos.map((a) => <button key={a} type="button" className={`mk-chip${ano === a ? ' ativo' : ''}`} onClick={() => setAno(a)}>{a}</button>)}
            <span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Formato">
              <option value="">Todos os formatos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span>
          </div>
          <div className="ig-atualiza">
            <span className="muted pequeno"><Icone nome="relogio" tam={14} /> Atualiza sozinho todo dia às 6h. Última leitura: {c.sincronizado_em ? new Date(c.sincronizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('sincronizar')}><Icone nome="atualizar" tam={13} /> {fazendo === 'sincronizar' ? 'Lendo…' : 'Atualizar agora'}</button>
            {maisAntigo > '2024-01-31' && <button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('historico')}><Icone nome="historico" tam={13} /> Trazer histórico desde 2024</button>}
          </div>
        </div>
        {aviso && <p className="nota pequeno">{aviso}</p>}
        <div className="ig-cartoes">
          <div><small>Posts no filtro</small><b>{lista.length}</b></div>
          <div><small>Alcance mediano por post</small><b>{milhar(med)}</b></div>
          <div><small>Desde</small><b>{maisAntigo ? new Date(maisAntigo + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—'}</b></div>
        </div>
        <SeguidoresInstagram historico={historico} atual={c.seguidores} />
        {!ano && anos.length > 1 && <><h4 className="reu-subtitulo">Comparação entre os anos{tipo ? ` · ${NOME_TIPO[tipo] ?? tipo}` : ''}</h4><ComparaAnos posts={lista} /></>}
        {lista.length > 0 && <><h4 className="reu-subtitulo">Por formato{ano ? ` · ${ano}` : ''}</h4><PorFormato posts={lista} /></>}
        {anos.length > 1 && <ComparaPeriodos key={anos.join()} posts={todos.filter((p) => !tipo || p.tipo === tipo)} seguidores={historico} anos={anos} tipo={tipo} analisando={fazendo === 'analisar'} aoAnalisar={(f) => agir('analisar', f)} />}
        <AnaliseInstagram empresa={empresa} analise={c.analise} analisando={fazendo === 'analisar'} aoAnalisar={() => agir('analisar')} podeAnalisar={lista.length >= 5}
          rotuloFiltro={`${ano || 'todos os anos'}${tipo ? ` · ${NOME_TIPO[tipo] ?? tipo}` : ''}`} />
        <Erro msg={erro} />
        {lista.length > 0 ? <ListaPosts posts={lista} med={med} /> : <p className="muted pequeno">Nenhum post neste filtro.</p>}
        <p className="muted pequeno">Os números vêm do Instagram e não separam o que foi impulsionado (anúncio) do orgânico.</p>
      </>)}
    </section>
  )
}
