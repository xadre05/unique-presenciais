// "Hotmart": o que aconteceu de verdade na Carteira, mês a mês, pelo Extrato importado: vendas, tarifas, reembolsos,
// adiantamento e parcelas do Parcelado Hotmart, custo de antecipação, compras no cartão Hotmart e saques.
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { brl, hojeISO } from '../../../lib/format'
import { Erro, Kpi, Vazio } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { nomeMes, somar } from '../dados'
import { ImportarHotmart } from './ImportarHotmart'
import { CartaoHotmart } from './CartaoHotmart'

type Mes = { integracao_id: string; mes: string; grupo: string; n: number; valor: number }
const COLUNAS: [string, string, string[]][] = [
  ['vendas', 'Vendas', ['vendas']],
  ['tarifas', 'Tarifas Hotmart', ['tarifa_hotmart', 'tarifa_saque']],
  ['estornos', 'Reembolsos', ['estornos']],
  ['adiant', 'Adiantamento Parcelado', ['parcelado_adiantamento', 'parcelado_estorno']],
  ['mensal', 'Parcelas (dia 1º)', ['parcelado_mensal']],
  ['antecip', 'Custo antecipação', ['custo_antecipacao']],
  ['repasses', 'Coprodução e doações', ['repasses']],
  ['cartao', 'Cartão Hotmart', ['cartao']],
  ['saque', 'Saques', ['saque']],
]

export default function PaginaHotmart() {
  const contas = useConsulta<{ id: string; nome: string }[]>(() => supabase.from('integracoes').select('id,nome').eq('tipo', 'hotmart').order('ordem'), [])
  const meses = useConsulta<Mes[]>(() => supabase.from('v_fin_extrato_mes').select('*').order('mes', { ascending: false }), [])
  const [conta, setConta] = useState('')
  const [ano, setAno] = useState(() => hojeISO().slice(0, 4))
  const linhas = (meses.dados ?? []).filter((m) => (!conta || m.integracao_id === conta) && m.mes.startsWith(ano))
  const anos = [...new Set((meses.dados ?? []).map((m) => m.mes.slice(0, 4)))].sort().reverse()
  const lista = [...new Set(linhas.map((m) => m.mes))].sort().reverse()
  const val = (mes: string | null, grupos: string[]) => somar(linhas.filter((m) => (!mes || m.mes === mes) && grupos.includes(m.grupo)), (m) => m.valor)
  const ultimo = useMemo(() => (meses.dados ?? []).filter((m) => !conta || m.integracao_id === conta).map((m) => m.mes).sort().at(-1), [meses.dados, conta])
  const vendas = val(null, ['vendas']), tarifas = -val(null, ['tarifa_hotmart', 'tarifa_saque'])

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Hotmart</h1>
        <p className="muted">O que aconteceu de verdade na Carteira, mês a mês, pelo Extrato que a Hotmart exporta.</p></div></header>
      <ImportarHotmart contas={contas.dados ?? []} aoImportar={meses.recarregar} />
      <div className="filtros-lista fin-filtros">
        <label className="select-icone"><Icone nome="links" tam={16} /><select value={conta} onChange={(e) => setConta(e.target.value)} aria-label="Conta">
          <option value="">Todas as contas</option>{(contas.dados ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label className="select-icone"><Icone nome="agenda" tam={16} /><select value={ano} onChange={(e) => setAno(e.target.value)} aria-label="Ano">
          {(anos.length ? anos : [ano]).map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        {ultimo && <span className="muted pequeno">Extrato importado até {nomeMes(ultimo.slice(0, 7))}</span>}
      </div>
      <Erro msg={contas.erro || meses.erro} />
      {!lista.length ? <Vazio>Nenhum extrato importado para este filtro. Use "Escolher arquivos" acima.</Vazio> : <>
        <section className="kpis">
          <Kpi rotulo={`Vendas em ${ano}`} valor={brl(vendas)} tom="ok" sub="comissão de venda, antes das tarifas" />
          <Kpi rotulo="Tarifas Hotmart" valor={brl(tarifas)} sub={vendas ? `${((tarifas / vendas) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das vendas` : ''} />
          <Kpi rotulo="Custo de antecipação" valor={brl(-val(null, ['custo_antecipacao']))} tom="alerta" sub="o que pagaram para receber antes" />
          <Kpi rotulo="Cartão Hotmart" valor={brl(-val(null, ['cartao']))} sub="compras pagas com o saldo" />
          <Kpi rotulo="Saques para o banco" valor={brl(-val(null, ['saque']))} />
        </section>
        <section className="bloco sem-padding tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Mês</th>{COLUNAS.map(([id, nome]) => <th key={id} className="num">{nome}</th>)}</tr></thead>
            <tbody>{lista.map((m) => (
              <tr key={m}><td>{nomeMes(m.slice(0, 7))}</td>{COLUNAS.map(([id, , gs]) => { const v = val(m, gs); return <td key={id} className={`num${v < 0 ? ' fin-neg' : ''}`}>{v ? brl(v) : '—'}</td> })}</tr>))}
            </tbody>
            <tfoot><tr><td><b>{ano}</b></td>{COLUNAS.map(([id, , gs]) => <td key={id} className="num"><b>{brl(val(null, gs))}</b></td>)}</tr></tfoot>
          </table>
        </section>
        <CartaoHotmart conta={conta} ano={ano} />
        <p className="muted pequeno">Vendas e tarifas entram no mês em que a Hotmart efetivou o lançamento (quando o dinheiro ficou disponível), não no dia da compra.</p>
      </>}
    </div>
  )
}
