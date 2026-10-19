// Tabela lado a lado de períodos (Comparar períodos e Antes × Depois dos marcos): ritmo de posts, alcance, salvos,
// compartilhamentos, crescimento de seguidores, quantos o agente fez, mix de formatos e o post que mais alcançou.
import type { ReactNode } from 'react'
import { NOME_TIPO, comSinal, crescimento, mediana, milhar, n, origemDe, type DiaSeguidores, type PostIG } from './dados'

export type Periodo = { nome: string; de: string; ate: string }
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

function numerosDo(posts: PostIG[], p: Periodo) {
  const ps = posts.filter((x) => x.publicado_em.slice(0, 10) >= p.de && x.publicado_em.slice(0, 10) <= p.ate)
  const semanas = Math.max(1, (new Date(p.ate).getTime() - new Date(p.de).getTime()) / 604800000)
  const soma = (k: keyof PostIG['metricas']) => ps.reduce((s, x) => s + n(x, k), 0)
  const porPost = (k: keyof PostIG['metricas']) => Math.round(soma(k) / Math.max(1, ps.length))
  const mix = [...new Set(ps.map((x) => x.tipo))].map((t) => `${NOME_TIPO[t] ?? t} ${Math.round((ps.filter((x) => x.tipo === t).length / Math.max(1, ps.length)) * 100)}%`).join(' · ')
  return {
    qtd: ps.length, porSemana: (ps.length / semanas).toFixed(1), mediana: mediana(ps.map((x) => n(x, 'alcance'))), somado: soma('alcance'),
    salvos: porPost('salvos'), comp: porPost('compartilhamentos'), ganhosNosPosts: soma('seguidores_ganhos'),
    doAgente: ps.filter((x) => origemDe(x) === 'agente').length, mix, melhor: [...ps].sort((a, b) => n(b, 'alcance') - n(a, 'alcance'))[0],
  }
}

function CelulaSeguidores({ seguidores, p }: { seguidores: DiaSeguidores[]; p: Periodo }) {
  const c = crescimento(seguidores, p.de, p.ate)
  if (c.saldo != null) return <>{comSinal(c.saldo)} <small className="muted">({milhar(c.inicio?.seguidores ?? undefined)} → {milhar(c.fim?.seguidores ?? undefined)})</small></>
  if (c.novos != null) return <>+{milhar(c.novos)} novos <small className="muted">({c.diasComNovos} dias informados)</small></>
  return <span className="muted">sem registro</span>
}

export function TabelaPeriodos({ posts, periodos, seguidores }: { posts: PostIG[]; periodos: Periodo[]; seguidores: DiaSeguidores[] }) {
  const linhas = periodos.map((p) => ({ p, ...numerosDo(posts, p) }))
  const celulas = (f: (l: (typeof linhas)[number]) => ReactNode, classe?: string) => linhas.map((l) => <td key={l.p.nome} className={classe}>{f(l)}</td>)
  return (
    <div className="ig-lista"><table className="tabela ig-tabela">
      <thead><tr><th />{linhas.map((l) => <th key={l.p.nome}>{l.p.nome}<small className="muted bloco-linha">{dm(l.p.de)} a {dm(l.p.ate)}</small></th>)}</tr></thead>
      <tbody>
        <tr><td>Posts</td>{celulas((l) => <>{l.qtd} <small className="muted">({l.porSemana}/semana)</small></>)}</tr>
        <tr><td>Feitos pelo agente</td>{celulas((l) => l.doAgente)}</tr>
        <tr><td>Alcance mediano</td>{celulas((l) => milhar(l.mediana))}</tr>
        <tr><td>Alcance somado</td>{celulas((l) => milhar(l.somado))}</tr>
        <tr><td>Salvos por post</td>{celulas((l) => milhar(l.salvos))}</tr>
        <tr><td>Compartilhamentos por post</td>{celulas((l) => milhar(l.comp))}</tr>
        <tr><td>Crescimento de seguidores</td>{celulas((l) => <CelulaSeguidores seguidores={seguidores} p={l.p} />, 'pequeno')}</tr>
        <tr><td>Seguidores ganhos nos posts</td>{celulas((l) => milhar(l.ganhosNosPosts))}</tr>
        <tr><td>Formatos</td>{celulas((l) => l.mix || '—', 'pequeno')}</tr>
        <tr><td>Post que mais alcançou</td>{celulas((l) => (l.melhor ? <>{milhar(n(l.melhor, 'alcance'))} · {(l.melhor.legenda ?? '').replace(/\s+/g, ' ').slice(0, 70)}{l.melhor.link && <> <a href={l.melhor.link} target="_blank" rel="noreferrer" className="link">abrir</a></>}</> : '—'), 'pequeno')}</tr>
      </tbody>
    </table></div>
  )
}
