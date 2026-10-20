// Antecipação por aluno (Parcelado Hotmart): quanto a Hotmart já adiantou de cada contrato, quanto ela já recuperou
// com as parcelas pagas, quanto ainda vai segurar e quanto ainda chega para vocês. Estimativa pelo percentual de
// cada conta (A receber → Antecipação); o número exato está no Extrato da Hotmart.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { brl } from '../../../lib/format'
import { Vazio } from '../../../components/ui'
import { somar, type Parcelado } from '../dados'

export function Antecipacao({ contratos }: { contratos: Parcelado[] }) {
  const [busca, setBusca] = useState('')
  const lista = contratos.filter((c) => c.tipo === 'SMART_INSTALLMENT' && c.antecipado_estimado > 0)
    .filter((c) => !busca || `${c.nome} ${c.email} ${c.produto_nome}`.toLowerCase().includes(busca.toLowerCase()))
  const recuperado = (c: Parcelado) => Math.min(c.antecipado_estimado, c.pagas * c.liquido_parcela)
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>Antecipação por aluno</h2>
        <input className="fin-busca" type="search" placeholder="Buscar aluno ou curso" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      <p className="muted pequeno">No Parcelado Hotmart, a Hotmart adianta uma parte do contrato logo depois da venda. Depois, as parcelas que o aluno paga ficam com ela até cobrir esse adiantamento; só o que passar disso cai na sua conta. Estimativa pelo percentual de cada conta (<Link className="link" to="/financeiro/receber">ajustar em A receber</Link>).</p>
      {!lista.length ? <Vazio>Nenhum contrato com antecipação em aberto.</Vazio> : (
        <div className="tabela-wrap"><table className="tabela">
          <thead><tr><th>Aluno</th><th className="num">Parcelas pagas</th><th className="num">Contrato</th><th className="num">Vocês já receberam adiantado</th><th className="num">Já devolvido pelas parcelas</th><th className="num">Falta devolver</th><th className="num">Ainda chega para vocês</th></tr></thead>
          <tbody>{lista.map((c) => (
            <tr key={c.id}>
              <td className="pequeno"><b>{c.nome ?? c.email}</b><div className="muted at-corta">{c.produto_nome}</div></td>
              <td className="num pequeno">{c.pagas} de {c.np}<div className="muted">{brl(c.liquido_parcela)} cada</div></td>
              <td className="num">{brl(c.np * c.liquido_parcela)}</td>
              <td className="num">{brl(c.antecipado_estimado)}</td>
              <td className="num">{brl(recuperado(c))}</td>
              <td className="num">{c.retido_estimado > 0 ? <b>{brl(c.retido_estimado)}</b> : '—'}</td>
              <td className="num"><b>{brl(c.a_receber - c.retido_estimado)}</b></td>
            </tr>))}
          </tbody>
          <tfoot><tr><td colSpan={3}><b>Total ({lista.length} contrato(s))</b></td><td className="num">{brl(somar(lista, (c) => c.antecipado_estimado))}</td>
            <td className="num">{brl(somar(lista, recuperado))}</td><td className="num"><b>{brl(somar(lista, (c) => c.retido_estimado))}</b></td>
            <td className="num"><b>{brl(somar(lista, (c) => c.a_receber - c.retido_estimado))}</b></td></tr></tfoot>
        </table></div>
      )}
    </section>
  )
}
