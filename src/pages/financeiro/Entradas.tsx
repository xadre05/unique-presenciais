// Tudo o que entrou no mês: vendas e parcelas da Hotmart (com a taxa que a Hotmart ficou), parcelas do presencial
// pagas fora da Hotmart e dívidas recuperadas fora da Hotmart.
import { useMemo, useState } from 'react'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, FORMAS, hojeISO } from '../../lib/format'
import { Badge, Erro, Kpi, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { FiltroTopo } from './FiltroTopo'
import { comoConsulta, csv, entradasEntre, intervaloMes, mesDe, nomeMes, numCsv, ORIGEM_ENTRADA, somar, type Entrada } from './dados'

const POR_VEZ = 100

export default function Entradas() {
  const [mes, setMes] = useState(mesDe(hojeISO()))
  const [conta, setConta] = useState('')
  const [origem, setOrigem] = useState('')
  const [area, setArea] = useState('')
  const [busca, setBusca] = useState('')
  const [qtd, setQtd] = useState(POR_VEZ)
  const [ini, fim] = intervaloMes(mes)
  const q = useConsulta<Entrada[]>(() => comoConsulta(entradasEntre(ini, fim, conta)), [ini, fim, conta])
  const t = busca.trim().toLowerCase()
  const linhas = useMemo(() => (q.dados ?? []).filter((e) => (!origem || e.origem === origem) && (!area || e.area === area)
    && (!t || `${e.pessoa ?? ''} ${e.email ?? ''} ${e.descricao ?? ''}`.toLowerCase().includes(t))), [q.dados, origem, area, t])

  const exportar = () => csv([
    ['Data', 'Origem', 'Área', 'Descrição', 'Pessoa', 'Parcela', 'Forma', 'Bruto', 'Taxa Hotmart', 'Líquido'],
    ...linhas.map((e) => [dataBR(e.data), ORIGEM_ENTRADA[e.origem], e.area, e.descricao, e.pessoa, e.parcela, FORMAS[e.forma ?? ''] ?? e.forma, numCsv(e.bruto), numCsv(e.taxa), numCsv(e.liquido)]),
  ], `entradas-${mes}.csv`)

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Entradas</h1><p className="muted">Tudo o que entrou em {nomeMes(mes)}, já sem a taxa da Hotmart.</p></div>
        <button className="btn btn-contorno" onClick={exportar} disabled={!linhas.length}><Icone nome="exportar" /> Exportar CSV</button></header>
      <FiltroTopo mes={mes} aoMudarMes={(m) => { setMes(m); setQtd(POR_VEZ) }} conta={conta} aoMudarConta={setConta}>
        <label className="select-icone"><select value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label="Origem">
          <option value="">Todas as origens</option>{Object.entries(ORIGEM_ENTRADA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
        <label className="select-icone"><select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área">
          <option value="">Online e presencial</option><option value="online">Só online</option><option value="presencial">Só presencial</option></select></label>
        <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar pessoa ou produto" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      </FiltroTopo>
      <Erro msg={q.erro} />
      <section className="kpis">
        <Kpi rotulo="Líquido (o que fica para a empresa)" valor={brl(somar(linhas, (e) => e.liquido))} tom="ok" sub={`${linhas.length} recebimento(s)`} />
        <Kpi rotulo="Bruto" valor={brl(somar(linhas, (e) => e.bruto))} sub="antes das taxas" />
        <Kpi rotulo="Taxas da Hotmart" valor={brl(somar(linhas, (e) => e.taxa))} sub="o que a Hotmart ficou" />
        <Kpi rotulo="Parcelas x vendas novas" valor={`${linhas.filter((e) => e.tipo === 'parcela').length} / ${linhas.filter((e) => e.tipo === 'venda').length}`} sub={`parcelas ${brl(somar(linhas.filter((e) => e.tipo === 'parcela'), (e) => e.liquido))}`} />
      </section>
      {q.carregando && !q.dados ? <Vazio>Carregando…</Vazio> : !linhas.length ? <Vazio>Nada entrou com esses filtros.</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Descrição</th><th>Pessoa</th><th>Origem</th><th className="num">Bruto</th><th className="num">Taxa</th><th className="num">Líquido</th></tr></thead>
            <tbody>{linhas.slice(0, qtd).map((e) => (
              <tr key={e.id}>
                <td className="pequeno">{dataBR(e.data)}</td>
                <td><div className="at-corta">{e.descricao}</div><div className="muted pequeno">{e.tipo === 'parcela' && e.parcela ? `parcela ${e.parcela}` : e.tipo === 'venda' ? 'venda' : 'recebimento'}{e.forma ? ` · ${FORMAS[e.forma] ?? e.forma.toLowerCase().replace(/_/g, ' ')}` : ''}</div></td>
                <td className="pequeno"><div className="at-corta">{e.pessoa ?? '—'}</div></td>
                <td><Badge tom={e.origem === 'hotmart' ? 'info' : e.origem === 'cobranca' ? 'ok' : 'ouro'}>{ORIGEM_ENTRADA[e.origem]}</Badge>{e.area === 'presencial' && e.origem !== 'presencial' && <div className="muted pequeno">curso presencial</div>}</td>
                <td className="num pequeno">{brl(e.bruto)}</td>
                <td className="num pequeno muted">{Number(e.taxa) > 0 ? brl(e.taxa) : '—'}</td>
                <td className="num forte">{brl(e.liquido)}</td>
              </tr>
            ))}</tbody>
          </table>
          {linhas.length > qtd && <button className="btn btn-bloco" onClick={() => setQtd(qtd + POR_VEZ)}>Mostrar mais ({linhas.length - qtd})</button>}
        </div>
      )}
      <p className="muted pequeno">No Parcelado Hotmart cada linha é uma parcela que o aluno pagou. Quando a Hotmart adianta parte da venda (antecipação), o dinheiro cai na conta antes, e as parcelas seguintes pagam esse adiantamento. Essa diferença de data só aparece com o Extrato da Hotmart.</p>
    </div>
  )
}
