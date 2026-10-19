// Seguidores dia a dia: a leitura diária (6h, ou "Atualizar agora") tira uma foto do total de seguidores, e o
// Instagram informa os novos seguidores de cada dia (só dos últimos 30 dias). Cartões com o crescimento recente e a
// tabela por dia, semana ou mês.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { comSinal, crescimento, hojeBR, milhar, somaDias, type DiaSeguidores } from './dados'

type Agrupar = 'dia' | 'semana' | 'mes'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const NOME_AGRUPAR: Record<Agrupar, string> = { dia: 'Por dia', semana: 'Por semana', mes: 'Por mês' }

// segunda-feira da semana do dia
const segundaDa = (dia: string) => somaDias(dia, -((new Date(dia + 'T12:00:00Z').getUTCDay() + 6) % 7))
const chaveDe = (dia: string, a: Agrupar) => (a === 'dia' ? dia : a === 'semana' ? segundaDa(dia) : dia.slice(0, 7))
const nomeDe = (k: string, a: Agrupar) =>
  a === 'dia' ? new Date(k + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    : a === 'semana' ? `Semana de ${k.slice(8, 10)}/${k.slice(5, 7)}` : `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`

// uma linha por dia, semana ou mês: total no fim, variação contra o fim do grupo anterior e novos somados
function linhasDe(h: DiaSeguidores[], a: Agrupar) {
  const grupos = new Map<string, DiaSeguidores[]>()
  for (const x of h) { const k = chaveDe(x.dia, a); grupos.set(k, [...(grupos.get(k) ?? []), x]) }
  let anterior: number | null = null
  const linhas = [...grupos.entries()].map(([k, dias]) => {
    const fim = dias.filter((x) => x.seguidores != null).at(-1)?.seguidores ?? null
    const variacao = fim != null && anterior != null ? fim - anterior : null
    if (fim != null) anterior = fim
    const comNovos = dias.filter((x) => x.novos != null)
    return { k, fim, variacao, novos: comNovos.length ? comNovos.reduce((s, x) => s + Number(x.novos ?? 0), 0) : null }
  })
  return linhas.reverse()
}

function Cartao({ titulo, h, de, ate }: { titulo: string; h: DiaSeguidores[]; de: string; ate: string }) {
  const c = crescimento(h, de, ate)
  const valor = c.saldo != null ? comSinal(c.saldo) : c.novos != null ? `+${milhar(c.novos)}` : '—'
  const legenda = c.saldo != null ? `de ${milhar(c.inicio?.seguidores ?? undefined)} para ${milhar(c.fim?.seguidores ?? undefined)}`
    : c.novos != null ? 'novos seguidores (Instagram)' : 'ainda sem registro'
  return <div><small>{titulo}</small><b>{valor}</b><small>{legenda}</small></div>
}

export function SeguidoresInstagram({ historico, atual }: { historico: DiaSeguidores[]; atual: number | null }) {
  const [agrupar, setAgrupar] = useState<Agrupar>('dia')
  const hoje = hojeBR()
  const linhas = linhasDe(historico, agrupar)
  return (
    <section className="mk-painel ig-seguidores">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="alunos" tam={22} /></span>
        <div><h3>Seguidores dia a dia</h3><span className="muted pequeno">Uma foto do total por dia, tirada na leitura das 6h.</span></div></header>
      <div className="ig-cartoes">
        <div><small>Seguidores agora</small><b>{milhar(atual ?? undefined)}</b><small>{historico.some((x) => x.seguidores != null) ? `registro desde ${historico.find((x) => x.seguidores != null)?.dia.split('-').reverse().join('/')}` : 'primeira foto na próxima leitura'}</small></div>
        <Cartao titulo="Últimos 7 dias" h={historico} de={somaDias(hoje, -6)} ate={hoje} />
        <Cartao titulo="Últimos 30 dias" h={historico} de={somaDias(hoje, -29)} ate={hoje} />
        <Cartao titulo="Neste mês" h={historico} de={hoje.slice(0, 8) + '01'} ate={hoje} />
      </div>
      {linhas.length > 0 ? (<>
        <div className="ia-linha">{(Object.keys(NOME_AGRUPAR) as Agrupar[]).map((a) => <button key={a} type="button" className={`mk-chip${agrupar === a ? ' ativo' : ''}`} onClick={() => setAgrupar(a)}>{NOME_AGRUPAR[a]}</button>)}</div>
        <div className="ig-lista ig-seg-tabela"><table className="tabela ig-tabela">
          <thead><tr><th>{agrupar === 'dia' ? 'Dia' : agrupar === 'semana' ? 'Semana' : 'Mês'}</th><th>Seguidores (no fim)</th><th>Variação</th><th title="O que o Instagram informa de novos seguidores; não desconta quem deixou de seguir">Novos (Instagram)</th></tr></thead>
          <tbody>{linhas.map((l) => (
            <tr key={l.k}><td>{nomeDe(l.k, agrupar)}</td><td>{l.fim != null ? l.fim.toLocaleString('pt-BR') : '—'}</td>
              <td>{l.variacao != null ? <span className={l.variacao >= 0 ? 'ig-acima' : 'ig-abaixo'}>{comSinal(l.variacao)}</span> : '—'}</td>
              <td>{l.novos != null ? `+${l.novos.toLocaleString('pt-BR')}` : '—'}</td></tr>))}</tbody>
        </table></div>
      </>) : <p className="muted pequeno">O registro começa na próxima leitura (todo dia às 6h, ou agora mesmo em "Atualizar agora").</p>}
      <p className="muted pequeno">"Variação" é a diferença do total de um registro para o outro (ganhos menos quem deixou de seguir). "Novos" é o que o Instagram informa por dia e só existe dos últimos 30 dias; por isso os dias antes do primeiro registro têm novos, mas não têm o total.</p>
    </section>
  )
}
