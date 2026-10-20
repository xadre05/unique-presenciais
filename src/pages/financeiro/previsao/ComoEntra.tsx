// Quadro "como o dinheiro entra": por forma (Parcelado Hotmart, cartão, Pix…), o que já entrou, o que vai entrar e o
// que está pendente. Clicar numa linha filtra a página por aquela forma.
import { brl } from '../../../lib/format'
import { somar, type Entrada } from '../dados'
import { DICA_JEITO, NOME_JEITO, jeitoEntrada, jeitoPrevisto, type Jeito, type Previsto } from './regras'

type Props = { entradas: Entrada[]; previstos: Previsto[]; pendentes: Previsto[]; jeito: Jeito | ''; aoEscolher: (j: Jeito | '') => void }

export function ComoEntra({ entradas, previstos, pendentes, jeito, aoEscolher }: Props) {
  const linhas = (Object.keys(NOME_JEITO) as Jeito[]).map((j) => ({
    j, entrou: somar(entradas.filter((e) => jeitoEntrada(e) === j), (e) => e.liquido),
    vai: somar(previstos.filter((p) => jeitoPrevisto(p) === j), (p) => p.valor),
    pend: somar(pendentes.filter((p) => jeitoPrevisto(p) === j), (p) => p.valor),
  })).filter((l) => l.entrou || l.vai || l.pend)
  if (!linhas.length) return null
  return (
    <section className="bloco sem-padding tabela-wrap">
      <table className="tabela">
        <thead><tr><th>Como entra</th><th className="num">Já entrou</th><th className="num">Vai entrar</th><th className="num">Pendente</th></tr></thead>
        <tbody>{linhas.map((l) => (
          <tr key={l.j} className={`linha-clicavel${jeito === l.j ? ' fin-linha-ativa' : ''}`} onClick={() => aoEscolher(jeito === l.j ? '' : l.j)} title="Filtrar por esta forma">
            <td><b>{NOME_JEITO[l.j]}</b><div className="muted pequeno">{DICA_JEITO[l.j]}</div></td>
            <td className="num">{l.entrou ? brl(l.entrou) : '—'}</td><td className="num">{l.vai ? brl(l.vai) : '—'}</td>
            <td className="num">{l.pend ? brl(l.pend) : '—'}</td>
          </tr>))}
        </tbody>
      </table>
    </section>
  )
}
