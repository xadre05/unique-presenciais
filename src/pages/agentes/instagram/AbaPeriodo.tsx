// Resultados → Período (a aba que abre primeiro): o período escolhido (hoje, últimos 7 dias, esta semana…) comparado
// com o anterior do mesmo tamanho, Agente × Fora lado a lado, os posts do período (melhores primeiro, com Recriar) e um
// botão só: pedir ao agente o que funcionou neste período. A análise feita para o período aparece logo abaixo.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { NOME_TIPO, hojeBR, milhar, n, origemDe, somaDias, type DiaSeguidores, type FiltroAnalise, type Origem, type PostIG } from './dados'
import type { AnaliseGuardada } from './analises'
import { ATALHOS, doIntervalo, numeros, periodosDo, textoIntervalo, variacao, type Atalho, type Numeros } from './periodo'
import { VerAnalise } from './VerAnalise'

type Props = {
  empresa: string; posts: PostIG[]; seguidores: DiaSeguidores[]; medRef: number; analises: AnaliseGuardada[]
  analisando: boolean; aoAnalisar: (f: FiltroAnalise) => void; aoRecriar: (p: PostIG) => void; aoMudar: () => void
}
const ORIGENS: { id: '' | Origem; nome: string }[] = [{ id: '', nome: 'Agente e fora' }, { id: 'agente', nome: 'Só do agente' }, { id: 'fora', nome: 'Só de fora' }]

function Cartao({ rotulo, agora, antes, sub }: { rotulo: string; agora: number | null; antes: number | null; sub?: string }) {
  const v = variacao(agora, antes)
  return (
    <div className="pe-cartao"><small>{rotulo}</small><b>{agora == null ? '—' : milhar(agora)}</b>
      <span className="pe-var">{v == null ? <span className="muted">sem comparação</span> : <span className={v >= 0 ? 'ig-acima' : 'ig-abaixo'}>{v >= 0 ? '▲' : '▼'} {Math.abs(v)}%</span>}
        <span className="muted"> antes: {antes == null ? '—' : milhar(antes)}</span></span>
      {sub && <small className="muted">{sub}</small>}
    </div>
  )
}

function AgenteFora({ agente, fora }: { agente: PostIG[]; fora: PostIG[] }) {
  if (!agente.length) return <p className="muted pequeno pe-nota">Nenhum post feito pelo agente neste período. Quando ele começar a postar, Agente × Fora aparece aqui lado a lado.</p>
  const linha = (ps: PostIG[]) => ({ qtd: ps.length, med: ps.length ? [...ps].map((p) => n(p, 'alcance')).sort((a, b) => a - b)[Math.floor(ps.length / 2)] : 0, salvos: Math.round(ps.reduce((s, p) => s + n(p, 'salvos'), 0) / Math.max(1, ps.length)), comp: Math.round(ps.reduce((s, p) => s + n(p, 'compartilhamentos'), 0) / Math.max(1, ps.length)) })
  const a = linha(agente), f = linha(fora)
  return (
    <div className="ig-lista"><table className="tabela ig-tabela pe-af">
      <thead><tr><th /><th><span className="ig-origem agente">Agente</span></th><th><span className="ig-origem fora">Fora</span></th></tr></thead>
      <tbody>
        <tr><td>Posts</td><td>{a.qtd}</td><td>{f.qtd}</td></tr>
        <tr><td>Alcance mediano</td><td>{milhar(a.med)}</td><td>{milhar(f.med)}</td></tr>
        <tr><td>Salvos por post</td><td>{milhar(a.salvos)}</td><td>{milhar(f.salvos)}</td></tr>
        <tr><td>Compartilhamentos por post</td><td>{milhar(a.comp)}</td><td>{milhar(f.comp)}</td></tr>
      </tbody>
    </table></div>
  )
}

function PostsDoPeriodo({ posts, medRef, aoRecriar }: { posts: PostIG[]; medRef: number; aoRecriar: (p: PostIG) => void }) {
  if (!posts.length) return <p className="muted pequeno pe-nota">Nenhum post publicado neste período.</p>
  return (
    <ul className="pe-posts">{[...posts].sort((a, b) => n(b, 'alcance') - n(a, 'alcance')).map((p) => {
      const v = variacao(n(p, 'alcance'), medRef)
      return (
        <li key={p.id} className="pe-post">
          {p.miniatura ? <img src={p.miniatura} alt="" loading="lazy" /> : <span className="ig-sem-foto"><Icone nome="video" tam={18} /></span>}
          <div>
            <span className="pe-post-topo"><b>{new Date(p.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {NOME_TIPO[p.tipo] ?? p.tipo}</b><span className={`ig-origem ${origemDe(p)}`}>{origemDe(p) === 'agente' ? 'Agente' : 'Fora'}</span></span>
            <small>Alcance {milhar(n(p, 'alcance'))}{v != null && <span className={v >= 0 ? 'ig-acima' : 'ig-abaixo'}> ({v >= 0 ? '+' : ''}{v}%)</span>} · {milhar(n(p, 'salvos'))} salvos · {milhar(n(p, 'compartilhamentos'))} compart.</small>
            <small className="muted pe-legenda">{(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 120)}</small>
            <span className="pe-post-acoes">{p.link && <a href={p.link} target="_blank" rel="noreferrer" className="btn btn-mini">Abrir</a>}
              <button type="button" className="btn btn-mini btn-contorno-ouro" onClick={() => aoRecriar(p)}><Icone nome="trocar" tam={13} /> Recriar</button></span>
          </div>
        </li>
      )
    })}</ul>
  )
}

const mesmoPeriodo = (a: AnaliseGuardada, de: string, ate: string, tipo: string, origem: string) => {
  const ps = a.filtro?.periodos ?? []
  return a.tipo === 'periodos' && ps.at(-1)?.de === de && ps.at(-1)?.ate === ate && (a.filtro.tipo ?? '') === tipo && (a.filtro.origem ?? '') === origem
}

export function AbaPeriodo({ empresa, posts, seguidores, medRef, analises, analisando, aoAnalisar, aoRecriar, aoMudar }: Props) {
  const [atalho, setAtalho] = useState<Atalho>('7dias')
  const [datas, setDatas] = useState(() => ({ de: somaDias(hojeBR(), -13), ate: hojeBR() }))
  const [tipo, setTipo] = useState('')
  const [origem, setOrigem] = useState<'' | Origem>('')
  const { atual, anterior } = periodosDo(atalho, datas)
  const filtrados = posts.filter((p) => (!tipo || p.tipo === tipo) && (!origem || origemDe(p) === origem))
  const pa = doIntervalo(filtrados, atual), pb = doIntervalo(filtrados, anterior)
  const a: Numeros = numeros(pa, atual, seguidores), b: Numeros = numeros(pb, anterior, seguidores)
  const tipos = [...new Set(posts.map((p) => p.tipo))]
  const analise = analises.find((x) => mesmoPeriodo(x, atual.de, atual.ate, tipo, origem))
  const filtro: FiltroAnalise = { periodos: [{ nome: `${anterior.nome} (antes)`, de: anterior.de, ate: anterior.ate }, { nome: atual.nome, de: atual.de, ate: atual.ate }], ...(tipo ? { tipo } : {}), ...(origem ? { origem } : {}) }
  const poucos = pa.length + pb.length < 5
  return (
    <div className="pe-aba">
      <div className="pe-filtros">
        <div className="ia-linha">{ATALHOS.map((x) => <button key={x.id} type="button" className={`mk-chip${atalho === x.id ? ' ativo' : ''}`} onClick={() => setAtalho(x.id)}>{x.nome}</button>)}</div>
        <div className="ia-linha">
          {atalho === 'datas' && <><input type="date" value={datas.de} onChange={(e) => e.target.value && setDatas((d) => ({ ...d, de: e.target.value }))} aria-label="De" /><span className="muted pequeno">a</span><input type="date" value={datas.ate} onChange={(e) => e.target.value && setDatas((d) => ({ ...d, ate: e.target.value }))} aria-label="Até" /></>}
          <span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Formato"><option value="">Todos os formatos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span>
          <span className="select-icone"><select value={origem} onChange={(e) => setOrigem(e.target.value as '' | Origem)} aria-label="Quem fez">{ORIGENS.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></span>
        </div>
      </div>
      <p className="pe-comparando muted pequeno"><b>{atual.nome}</b> ({textoIntervalo(atual)}) comparado com <b>{anterior.nome.toLowerCase()}</b> ({textoIntervalo(anterior)})</p>
      <div className="pe-cartoes">
        <Cartao rotulo="Posts" agora={a.posts} antes={b.posts} />
        <Cartao rotulo="Alcance somado" agora={a.alcance} antes={b.alcance} />
        <Cartao rotulo="Alcance mediano por post" agora={a.mediana} antes={b.mediana} />
        <Cartao rotulo="Salvos" agora={a.salvos} antes={b.salvos} />
        <Cartao rotulo="Compartilhamentos" agora={a.compartilhamentos} antes={b.compartilhamentos} />
        <Cartao rotulo={a.seguidoresSaldo ? 'Seguidores (saldo)' : 'Novos seguidores'} agora={a.seguidores} antes={b.seguidores} sub={a.seguidores == null ? 'o Instagram ainda está fechando estes dias' : !a.seguidoresSaldo && atual.ate >= somaDias(hojeBR(), -1) ? 'os 2 últimos dias ainda estão fechando' : undefined} />
      </div>
      <section className="mk-painel pe-bloco"><h4 className="pe-titulo">Agente × Fora</h4><AgenteFora agente={pa.filter((p) => origemDe(p) === 'agente')} fora={pa.filter((p) => origemDe(p) === 'fora')} /></section>
      <section className="mk-painel pe-bloco"><h4 className="pe-titulo">Posts do período <span className="muted pequeno">(% contra a mediana dos últimos 90 dias: {milhar(medRef)})</span></h4>
        <PostsDoPeriodo posts={pa} medRef={medRef} aoRecriar={aoRecriar} /></section>
      <section className="mk-painel pe-bloco">
        <div className="pe-pedir"><div><h4 className="pe-titulo">O que funcionou neste período</h4>
          <span className="muted pequeno">O agente compara com {anterior.nome.toLowerCase()}, post a post, e propõe o que ensinar a ele. Cerca de 10 créditos.</span></div>
          <button type="button" className="btn btn-ouro" disabled={analisando || poucos} onClick={() => aoAnalisar(filtro)}><Icone nome="floco" tam={16} /> {analisando ? 'Analisando… (até 1 minuto)' : analise ? 'Pedir de novo' : 'Pedir ao agente'}</button></div>
        {poucos && <p className="muted pequeno">Precisa de pelo menos 5 posts somando os dois períodos.</p>}
        {analise && <VerAnalise empresa={empresa} analise={analise} aoMudar={aoMudar} />}
      </section>
    </div>
  )
}
