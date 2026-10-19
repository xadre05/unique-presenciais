// Resultados → Posts: a lista completa com os filtros em cima (quando, formato, quem fez, busca na legenda e ordem)
// e 30 por vez ("Mostrar mais"). Cada post tem a etiqueta Agente/Fora (clicável) e Recriar.
import { useMemo, useState } from 'react'
import { NOME_TIPO, hojeBR, mediana, milhar, n, origemDe, somaDias, type Origem, type PostIG } from './dados'
import { ListaPosts } from './ListaPosts'

type Quando = '30' | '90' | 'ano' | 'tudo' | string
type Ordem = 'recentes' | 'alcance' | 'salvos' | 'compartilhamentos'
const ORDENS: { id: Ordem; nome: string }[] = [{ id: 'recentes', nome: 'Mais recentes' }, { id: 'alcance', nome: 'Maior alcance' }, { id: 'salvos', nome: 'Mais salvos' }, { id: 'compartilhamentos', nome: 'Mais compartilhados' }]
const POR_VEZ = 30

type Props = { posts: PostIG[]; aoMudar: () => void; aoRecriar: (p: PostIG) => void }

export function AbaPosts({ posts, aoMudar, aoRecriar }: Props) {
  const [quando, setQuando] = useState<Quando>('90')
  const [tipo, setTipo] = useState('')
  const [origem, setOrigem] = useState<'' | Origem>('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  const [mostrar, setMostrar] = useState(POR_VEZ)
  const [hoje] = useState(hojeBR)
  const anos = useMemo(() => [...new Set(posts.map((p) => p.publicado_em.slice(0, 4)))].sort().reverse(), [posts])
  const tipos = useMemo(() => [...new Set(posts.map((p) => p.tipo))], [posts])
  const lista = useMemo(() => {
    const desde = quando === '30' ? somaDias(hoje, -29) : quando === '90' ? somaDias(hoje, -89) : quando === 'ano' ? somaDias(hoje, -364) : ''
    const termo = busca.trim().toLowerCase()
    return posts.filter((p) => (quando === 'tudo' || (desde ? p.publicado_em.slice(0, 10) >= desde : p.publicado_em.startsWith(quando)))
      && (!tipo || p.tipo === tipo) && (!origem || origemDe(p) === origem) && (!termo || (p.legenda ?? '').toLowerCase().includes(termo)))
      .sort((a, b) => (ordem === 'recentes' ? b.publicado_em.localeCompare(a.publicado_em) : n(b, ordem) - n(a, ordem)))
  }, [posts, quando, tipo, origem, busca, ordem, hoje])
  const med = useMemo(() => mediana(lista.map((p) => n(p, 'alcance'))), [lista])
  const mudar = <T,>(f: (v: T) => void) => (v: T) => { f(v); setMostrar(POR_VEZ) }
  return (
    <div className="po-aba">
      <div className="po-filtros">
        <span className="select-icone"><select value={quando} onChange={(e) => mudar(setQuando)(e.target.value)} aria-label="Quando">
          <option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="ano">Últimos 12 meses</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}<option value="tudo">Tudo</option></select></span>
        <span className="select-icone"><select value={tipo} onChange={(e) => mudar(setTipo)(e.target.value)} aria-label="Formato"><option value="">Todos os formatos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span>
        <span className="select-icone"><select value={origem} onChange={(e) => mudar(setOrigem)(e.target.value as '' | Origem)} aria-label="Quem fez"><option value="">Agente e fora</option><option value="agente">Só do agente</option><option value="fora">Só de fora</option></select></span>
        <span className="select-icone"><select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordem">{ORDENS.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></span>
        <input className="po-busca" type="search" value={busca} onChange={(e) => mudar(setBusca)(e.target.value)} placeholder="Buscar na legenda…" />
      </div>
      <p className="muted pequeno">{lista.length} {lista.length === 1 ? 'post' : 'posts'} · alcance mediano {milhar(med)} (o % de cada post compara com ele)</p>
      {lista.length ? <ListaPosts posts={lista.slice(0, mostrar)} med={med} aoMudar={aoMudar} aoRecriar={aoRecriar} /> : <p className="muted pequeno">Nenhum post com esses filtros.</p>}
      {lista.length > mostrar && <button type="button" className="btn po-mais" onClick={() => setMostrar((m) => m + POR_VEZ)}>Mostrar mais {Math.min(POR_VEZ, lista.length - mostrar)} (de {lista.length - mostrar} restantes)</button>}
    </div>
  )
}
