// Comparar o mesmo recorte em anos diferentes (ex.: janeiro e fevereiro de 2024, 2025 e 2026), lado a lado
// (TabelaPeriodos). Os períodos escolhidos sobem para "Pedir análise", onde o agente explica o que fez a diferença.
import { useEffect, useState } from 'react'
import { Icone } from '../../../components/Icone'
import { NOME_TIPO, type DiaSeguidores, type PostIG } from './dados'
import { TabelaPeriodos, type Periodo } from './TabelaPeriodos'

type Recorte = 'mes' | 'bimestre' | 'trimestre' | 'semestre' | 'ano' | 'livre'
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

type Props = { posts: PostIG[]; seguidores: DiaSeguidores[]; anos: string[]; tipo: string; aoMudar: (periodos: Periodo[], rotulo: string) => void }

export function ComparaPeriodos({ posts, seguidores, anos, tipo, aoMudar }: Props) {
  const [recorte, setRecorte] = useState<Recorte>('bimestre')
  const [inicio, setInicio] = useState(1)
  const [escolhidos, setEscolhidos] = useState<string[]>(anos)
  const [livre, setLivre] = useState({ de: `${anos[0] ?? '2026'}-01-01`, ate: `${anos[0] ?? '2026'}-02-28` })
  const periodos = periodosDe(recorte, inicio, [...escolhidos].sort(), livre)
  const rotulo = recorte === 'livre' ? `${livre.de.slice(8, 10)}/${livre.de.slice(5, 7)} a ${livre.ate.slice(8, 10)}/${livre.ate.slice(5, 7)}` : recorte === 'ano' ? 'ano inteiro' : opcoes(recorte).find((o) => o.inicio === inicio)?.nome ?? ''
  const chave = JSON.stringify(periodos)
  // os períodos escolhidos aqui viram uma das opções de "Pedir análise"
  useEffect(() => { aoMudar(periodos, rotulo) }, [chave, rotulo]) // eslint-disable-line react-hooks/exhaustive-deps
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
      {periodos.length ? <TabelaPeriodos posts={posts} periodos={periodos} seguidores={seguidores} />
        : <p className="muted pequeno">Escolha pelo menos um ano.</p>}
      <p className="muted pequeno">"Seguidores ganhos nos posts" soma o que o Instagram informa por post (nem todo post informa). "Crescimento de seguidores" usa o registro dia a dia, que começou em outubro de 2026: períodos anteriores aparecem como "sem registro".</p>
      <p className="muted pequeno">Para o agente explicar o que fez a diferença, escolha "A comparação de períodos" em Pedir análise, mais abaixo.</p>
    </section>
  )
}
