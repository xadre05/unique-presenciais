// Agente de Marketing → Resultados: os posts do Instagram com as métricas, comparados com a mediana da conta,
// o resumo por formato e a análise do agente (o que funcionou, o que não, recomendações e aprendizados).
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { CabecalhoAba } from '../marketing/BarraFiltros'
import { acaoInstagram, mediana, milhar, useConexao, usePostsInstagram, type PostIG } from './dados'
import { AnaliseInstagram } from './AnaliseInstagram'

const NOME_TIPO: Record<string, string> = { reels: 'Reels', carrossel: 'Carrossel', imagem: 'Imagem', video: 'Vídeo' }
type Ordem = 'recentes' | 'alcance' | 'salvos'
const n = (p: PostIG, k: keyof PostIG['metricas']) => Number(p.metricas[k] ?? 0)

function PorFormato({ posts }: { posts: PostIG[] }) {
  const tipos = [...new Set(posts.map((p) => p.tipo))]
  const media = (ps: PostIG[], k: keyof PostIG['metricas']) => Math.round(ps.reduce((s, p) => s + n(p, k), 0) / Math.max(1, ps.length))
  const linhas = tipos.map((t) => { const ps = posts.filter((p) => p.tipo === t); return { t, qtd: ps.length, alcance: mediana(ps.map((p) => n(p, 'alcance'))), salvos: media(ps, 'salvos'), comp: media(ps, 'compartilhamentos') } })
    .sort((a, b) => b.alcance - a.alcance)
  return (
    <table className="tabela ig-tabela">
      <thead><tr><th>Formato</th><th>Posts</th><th>Alcance mediano</th><th>Salvos por post</th><th>Compartilhamentos por post</th></tr></thead>
      <tbody>{linhas.map((l) => <tr key={l.t}><td>{NOME_TIPO[l.t] ?? l.t}</td><td>{l.qtd}</td><td>{milhar(l.alcance)}</td><td>{milhar(l.salvos)}</td><td>{milhar(l.comp)}</td></tr>)}</tbody>
    </table>
  )
}

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

export function ResultadosInstagram({ empresa }: { empresa: string }) {
  const conexao = useConexao(empresa)
  const posts = usePostsInstagram(empresa)
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const lista = useMemo(() => posts.dados ?? [], [posts.dados])
  const med = useMemo(() => mediana(lista.map((p) => n(p, 'alcance'))), [lista])
  const c = conexao.dados
  const analisar = async () => {
    setErro(null); setAnalisando(true)
    try { await acaoInstagram(empresa, 'analisar'); conexao.recarregar() } catch (e) { setErro((e as Error).message) }
    setAnalisando(false)
  }
  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Resultados" sub="O que os posts publicados entregaram e o que o agente aprendeu com eles." />
      {!conexao.carregando && c?.status !== 'conectado' && (
        <div className="mk-vazio-grande"><Icone nome="grafico" tam={30} /><p>O Instagram ainda não está ligado.</p>
          <span className="muted pequeno">Ligue em <Link to="/agentes/marca">Base da marca → Redes sociais</Link>. Depois disso o agente lê os posts e as métricas todo dia.</span></div>
      )}
      {c?.status === 'conectado' && (<>
        <div className="ig-cartoes">
          <div><small>Posts lidos (últimos 6 meses)</small><b>{lista.length}</b></div>
          <div><small>Alcance mediano por post</small><b>{milhar(med)}</b></div>
          <div><small>Seguidores</small><b>{milhar(c.seguidores ?? undefined)}</b></div>
          <div><small>Última leitura</small><b>{c.sincronizado_em ? new Date(c.sincronizado_em).toLocaleDateString('pt-BR') : '—'}</b></div>
        </div>
        {lista.length > 0 && <PorFormato posts={lista} />}
        <AnaliseInstagram empresa={empresa} analise={c.analise} analisando={analisando} aoAnalisar={analisar} podeAnalisar={lista.length >= 5} />
        <Erro msg={erro} />
        {lista.length > 0 ? <ListaPosts posts={lista} med={med} /> : <p className="muted pequeno">Os posts ainda estão sendo lidos. Volte em alguns minutos ou clique em Atualizar agora na Base da marca.</p>}
      </>)}
    </section>
  )
}
