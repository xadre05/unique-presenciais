// Resultados → Comparações: o histórico longo. Os anos lado a lado, o resumo por formato, o mesmo recorte em anos
// diferentes (ex.: jan–fev de 2024 × 2025 × 2026) e o antes × depois de uma data. Cada parte tem o seu botão de análise.
import { useState } from 'react'
import { NOME_TIPO, type DiaSeguidores, type FiltroAnalise, type PostIG } from './dados'
import type { AnaliseGuardada } from './analises'
import type { Marco } from './marcos'
import { ComparaAnos, PorFormato } from './Tabelas'
import { ComparaPeriodos } from './ComparaPeriodos'
import { AntesDepois } from './AntesDepois'

type Props = {
  empresa: string; posts: PostIG[]; seguidores: DiaSeguidores[]; datas: Marco[]; aoMudarDatas: () => void
  analises: AnaliseGuardada[]; analisando: boolean; aoAnalisar: (f: FiltroAnalise) => void; aoMudar: () => void
}

export function AbaComparacoes({ empresa, posts, seguidores, datas, aoMudarDatas, analises, analisando, aoAnalisar, aoMudar }: Props) {
  const [tipo, setTipo] = useState('')
  const [ano, setAno] = useState('')
  const tipos = [...new Set(posts.map((p) => p.tipo))]
  const anos = [...new Set(posts.map((p) => p.publicado_em.slice(0, 4)))].sort().reverse()
  const doTipo = posts.filter((p) => !tipo || p.tipo === tipo)
  const comum = { empresa, seguidores, analises, analisando, aoAnalisar, aoMudar }
  return (
    <div className="co-aba">
      <div className="ia-linha"><span className="muted pequeno">Formato</span>
        <span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Formato"><option value="">Todos os formatos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span></div>
      <AntesDepois key={datas.map((d) => d.id).join()} {...comum} posts={doTipo} datas={datas} aoMudarDatas={aoMudarDatas} />
      {anos.length > 1 && <ComparaPeriodos key={anos.join()} {...comum} posts={doTipo} anos={anos} tipo={tipo} />}
      <section className="mk-painel pe-bloco"><h4 className="pe-titulo">Os anos lado a lado</h4><ComparaAnos posts={doTipo} />
        <p className="muted pequeno">O alcance de 2024 não é comparável: a Meta mediu diferente (há reels com 190 mil visualizações marcando poucas centenas de alcance). Para 2024, compare por salvos e visualizações.</p></section>
      <section className="mk-painel pe-bloco"><h4 className="pe-titulo">Por formato</h4>
        <div className="ia-linha"><button type="button" className={`mk-chip${!ano ? ' ativo' : ''}`} onClick={() => setAno('')}>Todos os anos</button>
          {anos.map((a) => <button key={a} type="button" className={`mk-chip${ano === a ? ' ativo' : ''}`} onClick={() => setAno(a)}>{a}</button>)}</div>
        <PorFormato posts={posts.filter((p) => !ano || p.publicado_em.startsWith(ano))} /></section>
    </div>
  )
}
