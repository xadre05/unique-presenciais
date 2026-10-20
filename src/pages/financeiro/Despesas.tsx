// Contas a pagar e pagas: despesas lançadas à mão + comissões das vendedoras (que vêm sozinhas do Comercial).
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, hojeISO } from '../../lib/format'
import { Badge, Erro, Kpi, Modal, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { FiltroTopo } from './FiltroTopo'
import { NovaDespesa } from './NovaDespesa'
import { CATEGORIAS, csv, intervaloMes, mesDe, nomeMes, numCsv, situacaoSaida, somar, type Despesa, type Saida } from './dados'

type Aba = 'a_pagar' | 'mes' | 'todas'

export default function Despesas() {
  const hoje = hojeISO()
  const [aba, setAba] = useState<Aba>('a_pagar')
  const [mes, setMes] = useState(mesDe(hoje))
  const [conta, setConta] = useState('')
  const [categoria, setCategoria] = useState('')
  const [editar, setEditar] = useState<Despesa | null | undefined>(undefined)
  const [apagar, setApagar] = useState<Saida | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const q = useConsulta<Saida[]>(() => supabase.from('v_fin_saidas').select('*').order('vencimento'), [])
  const [ini, fim] = intervaloMes(mes)

  const linhas = useMemo(() => (q.dados ?? []).filter((s) => (!conta || s.conta_id === conta) && (!categoria || s.categoria === categoria) && (
    aba === 'a_pagar' ? !s.pago_em
      : aba === 'mes' ? ((s.pago_em ?? s.vencimento ?? '') >= ini && (s.pago_em ?? s.vencimento ?? '') <= fim)
        : true)), [q.dados, conta, categoria, aba, ini, fim])
  const atrasadas = linhas.filter((s) => !s.pago_em && s.vencimento && s.vencimento < hoje)

  const pagar = async (s: Saida) => {
    setErro(null)
    const { error } = await supabase.from('despesas').update({ pago_em: hoje }).eq('id', s.despesa_id!)
    if (error) setErro(error.message); else q.recarregar()
  }
  const excluir = async (s: Saida, todas: boolean) => {
    setErro(null)
    const r = todas && s.grupo ? supabase.from('despesas').delete().eq('grupo', s.grupo).is('pago_em', null) : supabase.from('despesas').delete().eq('id', s.despesa_id!)
    const { error } = await r
    setApagar(null)
    if (error) setErro(error.message); else q.recarregar()
  }
  const abrirEdicao = async (s: Saida) => {
    const { data, error } = await supabase.from('despesas').select('*').eq('id', s.despesa_id!).single()
    if (error) setErro(error.message); else setEditar(data as Despesa)
  }
  const exportar = () => csv([['Vencimento', 'Pago em', 'Descrição', 'Categoria', 'Fornecedor/pessoa', 'Valor', 'Situação'],
    ...linhas.map((s) => [dataBR(s.vencimento), s.pago_em ? dataBR(s.pago_em) : '', s.descricao, s.categoria, s.pessoa, numCsv(s.valor), situacaoSaida(s, hoje).rotulo])], `despesas-${aba === 'mes' ? mes : aba}.csv`)

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Despesas</h1><p className="muted">O que a empresa paga. As comissões das vendedoras entram aqui sozinhas quando são liberadas no Comercial.</p></div>
        <div className="acoes"><button className="btn btn-contorno" onClick={exportar} disabled={!linhas.length}><Icone nome="exportar" /> Exportar CSV</button>
          <button className="btn btn-ouro" onClick={() => setEditar(null)}><Icone nome="mais" /> Nova despesa</button></div></header>
      <nav className="abas">
        <button className={aba === 'a_pagar' ? 'ativa' : ''} onClick={() => setAba('a_pagar')}>A pagar <span className="muted">{(q.dados ?? []).filter((s) => !s.pago_em).length}</span></button>
        <button className={aba === 'mes' ? 'ativa' : ''} onClick={() => setAba('mes')}>Do mês</button>
        <button className={aba === 'todas' ? 'ativa' : ''} onClick={() => setAba('todas')}>Todas</button>
      </nav>
      <FiltroTopo semMes={aba !== 'mes'} mes={mes} aoMudarMes={setMes} conta={conta} aoMudarConta={setConta}>
        <label className="select-icone"><select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria"><option value="">Todas as categorias</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
      </FiltroTopo>
      <Erro msg={q.erro || erro} />
      <section className="kpis">
        <Kpi rotulo={aba === 'mes' ? `Total de ${nomeMes(mes)}` : 'Total'} valor={brl(somar(linhas, (s) => s.valor))} sub={`${linhas.length} conta(s)`} />
        <Kpi rotulo="Já pagas" valor={brl(somar(linhas.filter((s) => s.pago_em), (s) => s.valor))} tom="ok" />
        <Kpi rotulo="Atrasadas" valor={brl(somar(atrasadas, (s) => s.valor))} tom={atrasadas.length ? 'erro' : undefined} sub={`${atrasadas.length} conta(s)`} />
      </section>
      {q.carregando && !q.dados ? <Vazio>Carregando…</Vazio> : !linhas.length ? <Vazio>{aba === 'a_pagar' ? 'Nada a pagar. Use “Nova despesa” para lançar o que a empresa paga (anúncios, equipe, ferramentas, impostos…).' : 'Nenhuma despesa com esses filtros.'}</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          <table className="tabela">
            <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>{linhas.map((s) => {
              const st = situacaoSaida(s, hoje)
              return (
                <tr key={s.id}>
                  <td className="pequeno">{dataBR(s.vencimento)}{s.pago_em && <div className="muted">pago {dataBR(s.pago_em)}</div>}</td>
                  <td><div className="at-corta">{s.descricao}</div><div className="muted pequeno">{s.pessoa ?? ''}{s.parcelas ? ` · ${s.parcela}/${s.parcelas}` : ''}</div></td>
                  <td className="pequeno">{s.categoria}</td>
                  <td className="num forte">{brl(s.valor)}</td>
                  <td><Badge tom={st.tom}>{st.rotulo}</Badge></td>
                  <td className="celula-acao"><div className="pg-acoes">
                    {s.origem === 'despesa' ? (<>
                      {!s.pago_em && <button className="btn btn-mini btn-contorno-ouro" onClick={() => pagar(s)}>Paguei hoje</button>}
                      <button className="btn btn-mini" onClick={() => abrirEdicao(s)}>Editar</button>
                      <button className="btn-icone" onClick={() => setApagar(s)} aria-label="Excluir"><Icone nome="lixeira" tam={16} /></button>
                    </>) : <Link className="btn btn-mini" to="/comissoes">Ver comissões</Link>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}
      {editar !== undefined && <NovaDespesa inicial={editar} aoFechar={() => setEditar(undefined)} aoSalvar={() => { setEditar(undefined); q.recarregar() }} />}
      {apagar && <Modal titulo="Excluir despesa" aberto onFechar={() => setApagar(null)}>
        <p>Excluir <b>{apagar.descricao}</b> ({brl(apagar.valor)})?</p>
        <div className="modal-acoes"><button className="btn" onClick={() => setApagar(null)}>Cancelar</button>
          {apagar.grupo && <button className="btn btn-perigo" onClick={() => excluir(apagar, true)}>Todas as não pagas desta série</button>}
          <button className="btn btn-perigo" onClick={() => excluir(apagar, false)}>Só esta</button></div>
      </Modal>}
    </div>
  )
}
