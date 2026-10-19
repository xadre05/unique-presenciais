// Comparar o mesmo recorte em anos diferentes (ex.: janeiro e fevereiro de 2024, 2025 e 2026): ritmo de posts,
// alcance, salvos, compartilhamentos, seguidores ganhos, mix de formatos e o post que mais alcançou. O botão pede ao
// agente que explique o que fez a diferença.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { NOME_TIPO, mediana, milhar, n, type FiltroAnalise, type PostIG } from './dados'

type Recorte = 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'ano' | 'livre'
type Periodo = { nome: string; de: string; ate: string }
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const TAMANHO: Record<Exclude<Recorte, 'livre'>, number> = { mes: 1, bimestre: 2, trimestre: 3, semestre: 6, ano: 12 }
const NOME_RECORTE: Record<Recorte, string> = { mes: 'Mês', bimestre: 'Bimestre', trimestre: 'Trimestre', semestre: 'Semestre', ano: 'Ano inteiro', livre: 'Datas livres' }
const doisDig = (x: number) => String(x).padStart(2, '0')
const ultimoDia = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()

// opções do recorte: "Jan–Fev", "1º trimestre"…, com o mês de início (1 a 12)
function opcoes(r: Recorte) {
  if (r === 'livre' || r === 'ano') return []
  const t = TAMANHO[r]
  return Array.from({ length: 12 / t }, (_, i) => ({ inicio: i * t + 1, nome: t === 1 ? MESES[i] : r === 'bimestre' ? `${MESES[i * t]}–${MESES[i * t + t - 1]}` : `${i + 1}º ${r}` }))
}

function periodosDe(r: Recorte, inicio: number, anos: string[], livre: { de: string; ate: string }): Periodo[] {
  const hoje = new Date().toISOString().slice(0, 10)
  return anos.map((a) => {
    const ano = Number(a)
    if (r === 'livre') return { nome: a, de: `${a}${livre.de.slice(4)}`, ate: `${a}${livre.ate.slice(4)}` }
    const ini = r === 'ano' ? 1 : inicio, fim = r === 'ano' ? 12 : inicio + TAMANHO[r] - 1
    const ate = `${a}-${doisDig(fim)}-${doisDig(ultimoDia(ano, fim))}`
    return { nome: a, de: `${a}-${doisDig(ini)}-01`, ate: ate > hoje ? hoje : ate }
  }).filter((p) => p.de <= p.ate)
}

function numeros(posts: PostIG[], p: Periodo) {
  const ps = posts.filter((x) => x.publicado_em.slice(0, 10) >= p.de && x.publicado_em.slice(0, 10) <= p.ate)
  const semanas = Math.max(1, (new Date(p.ate).getTime() - new Date(p.de).getTime()) / 604800000)
  const soma = (k: keyof PostIG['metricas']) => ps.reduce((s, x) => s + n(x, k), 0)
  const mix = [...new Set(ps.map((x) => x.tipo))].map((t) => `${NOME_TIPO[t] ?? t} ${Math.round((ps.filter((x) => x.tipo === t).length / Math.max(1, ps.length)) * 100)}%`).join(' · ')
  const melhor = [...ps].sort((a, b) => n(b, 'alcance') - n(a, 'alcance'))[0]
  return { qtd: ps.length, porSemana: (ps.length / semanas).toFixed(1), mediana: mediana(ps.map((x) => n(x, 'alcance'))), somado: soma('alcance'),
    salvos: Math.round(soma('salvos') / Math.max(1, ps.length)), comp: Math.round(soma('compartilhamentos') / Math.max(1, ps.length)), seguidores: soma('seguidores_ganhos'), mix, melhor }
}

type Props = { posts: PostIG[]; anos: string[]; tipo: string; analisando: boolean; aoAnalisar: (f: FiltroAnalise) => void }

export function ComparaPeriodos({ posts, anos, tipo, analisando, aoAnalisar }: Props) {
  const [recorte, setRecorte] = useState<Recorte>('bimestre')
  const [inicio, setInicio] = useState(1)
  const [escolhidos, setEscolhidos] = useState<string[]>(anos)
  const [livre, setLivre] = useState({ de: `${anos[0] ?? '2026'}-01-01`, ate: `${anos[0] ?? '2026'}-02-28` })
  const periodos = periodosDe(recorte, inicio, [...escolhidos].sort(), livre)
  const linhas = periodos.map((p) => ({ p, ...numeros(posts, p) }))
  const marcar = (a: string) => setEscolhidos((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]))
  return (
    <section className="mk-painel ig-compara">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="grafico" tam={22} /></span>
        <div><h3>Comparar períodos</h3><span className="muted pequeno">O mesmo recorte em anos diferentes{tipo ? ` · só ${NOME_TIPO[tipo] ?? tipo}` : ''}.</span></div></header>
      <div className="ig-compara-filtros">
        <span className="select-icone"><select value={recorte} onChange={(e) => { setRecorte(e.target.value as Recorte); setInicio(1) }} aria-label="Recorte">
          {(Object.keys(NOME_RECORTE) as Recorte[]).map((r) => <option key={r} value={r}>{NOME_RECORTE[r]}</option>)}</select></span>
        {opcoes(recorte).length > 0 && <span className="select-icone"><select value={inicio} onChange={(e) => setInicio(Number(e.target.value))} aria-label="Qual">
          {opcoes(recorte).map((o) => <option key={o.inicio} value={o.inicio}>{o.nome}</option>)}</select></span>}
        {recorte === 'livre' && <><input type="date" value={livre.de} onChange={(e) => setLivre((l) => ({ ...l, de: e.target.value }))} aria-label="De" /><input type="date" value={livre.ate} onChange={(e) => setLivre((l) => ({ ...l, ate: e.target.value }))} aria-label="Até" /><small className="muted">(dia e mês; o ano vem da escolha ao lado)</small></>}
        <span className="ia-linha">{anos.map((a) => <button key={a} type="button" className={`mk-chip${escolhidos.includes(a) ? ' ativo' : ''}`} onClick={() => marcar(a)}>{a}</button>)}</span>
      </div>
      {linhas.length ? (
        <div className="ig-lista"><table className="tabela ig-tabela">
          <thead><tr><th />{linhas.map((l) => <th key={l.p.nome}>{l.p.nome}<small className="muted bloco-linha">{l.p.de.slice(8, 10)}/{l.p.de.slice(5, 7)} a {l.p.ate.slice(8, 10)}/{l.p.ate.slice(5, 7)}</small></th>)}</tr></thead>
          <tbody>
            <tr><td>Posts</td>{linhas.map((l) => <td key={l.p.nome}>{l.qtd} <small className="muted">({l.porSemana}/semana)</small></td>)}</tr>
            <tr><td>Alcance mediano</td>{linhas.map((l) => <td key={l.p.nome}>{milhar(l.mediana)}</td>)}</tr>
            <tr><td>Alcance somado</td>{linhas.map((l) => <td key={l.p.nome}>{milhar(l.somado)}</td>)}</tr>
            <tr><td>Salvos por post</td>{linhas.map((l) => <td key={l.p.nome}>{milhar(l.salvos)}</td>)}</tr>
            <tr><td>Compartilhamentos por post</td>{linhas.map((l) => <td key={l.p.nome}>{milhar(l.comp)}</td>)}</tr>
            <tr><td>Seguidores ganhos nos posts</td>{linhas.map((l) => <td key={l.p.nome}>{milhar(l.seguidores)}</td>)}</tr>
            <tr><td>Formatos</td>{linhas.map((l) => <td key={l.p.nome} className="pequeno">{l.mix || '—'}</td>)}</tr>
            <tr><td>Post que mais alcançou</td>{linhas.map((l) => <td key={l.p.nome} className="pequeno">{l.melhor ? <>{milhar(n(l.melhor, 'alcance'))} · {(l.melhor.legenda ?? '').replace(/\s+/g, ' ').slice(0, 70)}{l.melhor.link && <> <a href={l.melhor.link} target="_blank" rel="noreferrer" className="link">abrir</a></>}</> : '—'}</td>)}</tr>
          </tbody>
        </table></div>
      ) : <p className="muted pequeno">Escolha pelo menos um ano.</p>}
      <p className="muted pequeno">"Seguidores ganhos nos posts" soma o que o Instagram informa por post (nem todo post informa). O total de seguidores dia a dia passa a ser guardado a partir de hoje.</p>
      <div className="ia-linha"><button type="button" className="btn btn-contorno-ouro" disabled={analisando || periodos.length < 2} onClick={() => aoAnalisar({ periodos, ...(tipo ? { tipo } : {}) })}>
        <Icone nome="floco" tam={16} /> {analisando ? 'Analisando… (até 1 minuto)' : 'Pedir ao agente: o que fez a diferença?'}</button>
        {periodos.length < 2 && <span className="muted pequeno">Escolha dois anos ou mais para comparar.</span>}</div>
    </section>
  )
}
