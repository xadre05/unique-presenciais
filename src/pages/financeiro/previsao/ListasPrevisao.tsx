// Listas da Previsão de caixa: pendências (com o que fazer), o que vai entrar semana a semana e o que já entrou.
import { useState } from 'react'
import { brl, dataBR } from '../../../lib/format'
import { Badge, Vazio } from '../../../components/ui'
import { somar, type Entrada } from '../dados'
import { ACAO_SITUACAO, NOME_JEITO, NOME_SITUACAO, TOM_SITUACAO, jeitoEntrada, jeitoPrevisto, quando, semanaDe, type Previsto } from './regras'

const dm = (iso: string | null) => (iso ? dataBR(iso).slice(0, 5) : 'sem data')

function Linha({ p, mostrarSituacao }: { p: Previsto; mostrarSituacao?: boolean }) {
  const segura = p.valor_aluno - p.valor
  return (
    <tr>
      <td className="pequeno">{dm(mostrarSituacao ? p.data : quando(p))}{!mostrarSituacao && p.data_credito && p.data_credito !== p.data && <div className="muted">aluno paga {dm(p.data)}</div>}</td>
      <td className="pequeno"><b>{p.pessoa ?? '—'}</b><div className="muted at-corta">{p.descricao}{p.parcela ? ` · parcela ${p.parcela}` : ''}</div></td>
      <td><Badge tom={p.automatico ? 'info' : 'neutro'}>{NOME_JEITO[jeitoPrevisto(p)]}</Badge></td>
      {mostrarSituacao && <td className="pequeno"><Badge tom={TOM_SITUACAO[p.situacao]}>{NOME_SITUACAO[p.situacao]}</Badge>
        {ACAO_SITUACAO[p.situacao] && <div className="muted">{ACAO_SITUACAO[p.situacao]}</div>}</td>}
      <td className="num"><b>{brl(p.valor)}</b>{segura > 0.5 && <div className="muted pequeno">aluno paga {brl(p.valor_aluno)}; {brl(segura)} fica com a Hotmart</div>}</td>
    </tr>
  )
}

export function Pendencias({ linhas }: { linhas: Previsto[] }) {
  if (!linhas.length) return null
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>Pendências</h2><span className="muted">{brl(somar(linhas, (p) => p.valor))} sem data certa para entrar</span></div>
      <p className="muted pequeno">Dinheiro que pode entrar logo se alguém agir: parcela atrasada, parcela sem data combinada ou aluno que avisou que pagou e ninguém conferiu no banco.</p>
      <table className="tabela">
        <thead><tr><th>Data</th><th>Quem</th><th>Forma</th><th>Situação</th><th className="num">Valor</th></tr></thead>
        <tbody>{linhas.map((p) => <Linha key={p.id} p={p} mostrarSituacao />)}</tbody>
      </table>
    </section>
  )
}

export function LinhaDoTempo({ linhas, titulo }: { linhas: Previsto[]; titulo: string }) {
  const semanas = [...new Set(linhas.map((p) => semanaDe(quando(p)!)))].sort()
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>{titulo}</h2><span className="muted">{brl(somar(linhas, (p) => p.valor))}</span></div>
      <p className="muted pequeno">No Parcelado Hotmart, a parcela que o aluno paga durante o mês só fica disponível no dia 1º do mês seguinte (a Hotmart junta tudo em "Saldo de parcelas").</p>
      {!linhas.length ? <Vazio>Nada previsto neste período com estes filtros.</Vazio> : (
        <table className="tabela">
          <thead><tr><th>Cai na conta</th><th>Quem</th><th>Forma</th><th className="num">Chega para vocês</th></tr></thead>
          {semanas.map((s) => {
            const da = linhas.filter((p) => semanaDe(quando(p)!) === s)
            return (
              <tbody key={s}>
                <tr className="fin-semana"><td colSpan={3}>Semana de {dm(s)}</td><td className="num">{brl(somar(da, (p) => p.valor))}</td></tr>
                {da.map((p) => <Linha key={p.id} p={p} />)}
              </tbody>
            )
          })}
        </table>
      )}
    </section>
  )
}

export function JaEntrou({ linhas }: { linhas: Entrada[] }) {
  const [todas, setTodas] = useState(false)
  if (!linhas.length) return null
  const vistas = todas ? linhas : linhas.slice(0, 15)
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>O que já entrou</h2><span className="muted">{brl(somar(linhas, (e) => e.liquido))} líquido</span></div>
      <table className="tabela">
        <thead><tr><th>Data</th><th>Quem</th><th>Forma</th><th className="num">Líquido</th></tr></thead>
        <tbody>{vistas.map((e) => (
          <tr key={e.id}><td className="pequeno">{dm(e.data)}</td>
            <td className="pequeno"><b>{e.pessoa ?? '—'}</b><div className="muted at-corta">{e.descricao}{e.parcela ? ` · parcela ${e.parcela}` : ''}</div></td>
            <td><Badge tom="ok">{NOME_JEITO[jeitoEntrada(e)]}</Badge></td><td className="num">{brl(e.liquido)}</td></tr>))}
        </tbody>
      </table>
      {linhas.length > 15 && <button className="link pequeno" onClick={() => setTodas(!todas)}>{todas ? 'Mostrar menos' : `Ver as ${linhas.length}`}</button>}
      <p className="muted pequeno">Vendas da Hotmart aparecem aqui na data da compra. O dinheiro fica "a liberar" na Carteira da Hotmart até o prazo de liberação da sua conta.</p>
    </section>
  )
}
