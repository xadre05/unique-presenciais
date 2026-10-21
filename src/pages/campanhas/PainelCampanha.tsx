// Comercial → Campanhas: escolhe a campanha e vê o placar dela (página → CRM → Hotmart). Atualiza sozinho a cada minuto.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, hojeISO } from '../../lib/format'
import { Erro, Kpi, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { campanhaAtual, nomeOrigem, pct, type Campanha, type Painel } from './dados'
import { Funil } from './Funil'
import { ListaPendentes } from './ListaPendentes'
import { QuadroVagas } from './QuadroVagas'
import { FormCampanha } from './FormCampanha'

function Barra({ valor, meta }: { valor: number; meta: number }) {
  return <div className="blk-barra"><span style={{ width: `${Math.min(100, pct(valor, meta))}%` }} /></div>
}

function Placar({ p }: { p: Painel }) {
  const mv = p.campanha.meta_vendas, mr = p.campanha.meta_receita
  return (
    <section className="kpis">
      <div className="kpi"><div className="kpi-rotulo">Vendas</div><div className="kpi-valor">{p.funil.compraram}{mv ? <span className="muted pequeno"> de {mv}</span> : null}</div>
        {mv ? <Barra valor={p.funil.compraram} meta={mv} /> : null}<div className="kpi-sub">{mv ? `${pct(p.funil.compraram, mv)}% da meta` : 'sem meta'}{p.funil.fora_hotmart ? ` · ${p.funil.fora_hotmart} por Pix direto` : ''}{p.funil.desfeitas ? ` · ${p.funil.desfeitas} reembolso(s)` : ''}</div></div>
      <div className="kpi"><div className="kpi-rotulo">Faturamento bruto</div><div className="kpi-valor">{brl(p.receita.bruto)}</div>
        {mr ? <Barra valor={p.receita.bruto} meta={mr} /> : null}<div className="kpi-sub">{mr ? `meta ${brl(mr)}` : 'sem meta'}</div></div>
      <Kpi rotulo="Líquido" valor={brl(p.receita.liquido)} sub={p.receita.fora_hotmart ? `Hotmart + ${brl(p.receita.fora_hotmart)} de Pix direto` : 'o que a Hotmart repassa'} />
      <Kpi rotulo="Foram ao pagamento e não compraram" valor={String(p.pendentes.length)} tom={p.pendentes.length ? 'alerta' : undefined} sub="lista embaixo, para o time chamar" />
    </section>
  )
}

function Tabelas({ p }: { p: Painel }) {
  return (
    <div className="blk-duas">
      <section className="bloco"><h2>De onde vêm</h2>
        {!p.por_origem.length ? <Vazio>Ainda sem leads nem vendas.</Vazio> : (
          <table className="tabela compacta"><thead><tr><th>Origem</th><th className="num">Leads</th><th className="num">Vendas</th><th className="num">Conversão</th><th className="num">Líquido</th></tr></thead>
            <tbody>{p.por_origem.map((o) => <tr key={o.origem}><td>{nomeOrigem(o.origem)}</td><td className="num">{o.leads}</td><td className="num forte">{o.vendas}</td><td className="num">{o.leads ? `${pct(o.vendas, o.leads)}%` : '—'}</td><td className="num">{brl(o.liquido)}</td></tr>)}</tbody></table>)}
      </section>
      <section className="bloco"><h2>Por vendedora</h2>
        {!p.por_vendedora.length ? <Vazio>Nenhuma venda com vendedora ainda.</Vazio> : (
          <table className="tabela compacta"><thead><tr><th>Vendedora</th><th className="num">Vendas</th><th className="num">Comissão</th></tr></thead>
            <tbody>{p.por_vendedora.map((v) => <tr key={v.nome}><td>{v.nome}</td><td className="num forte">{v.vendas}</td><td className="num">{brl(v.comissao ?? 0)}</td></tr>)}</tbody></table>)}
      </section>
    </div>
  )
}

export default function PainelCampanha() {
  const [params, setParams] = useSearchParams()
  const [editar, setEditar] = useState<Campanha | null | undefined>(undefined)
  const lista = useConsulta<(Campanha & { id: string })[]>(() => supabase.from('campanhas_vendas').select('*').order('inicio', { ascending: false, nullsFirst: false }), [])
  const escolhida = params.get('c') ?? campanhaAtual(lista.dados ?? [], hojeISO())?.id ?? null
  const q = useConsulta<Painel | null>(() => (escolhida ? supabase.rpc('painel_campanha', { p_id: escolhida }) : Promise.resolve({ data: null, error: null })), [escolhida])
  useEffect(() => { const t = setInterval(() => q.recarregar(), 60000); return () => clearInterval(t) }, [q.recarregar]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = q.dados
  const atual = (lista.dados ?? []).find((c) => c.id === escolhida) ?? null

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Campanhas</h1><p className="muted">O placar de cada campanha: da página até a compra na Hotmart, por origem e por vendedora.</p></div>
        <div className="acoes">
          {atual && <button className="btn btn-contorno" onClick={() => setEditar(atual)}><Icone nome="lapis" /> Editar campanha</button>}
          <button className="btn btn-ouro" onClick={() => setEditar(null)}><Icone nome="mais" /> Nova campanha</button></div></header>
      <div className="fin-filtros"><label className="select-icone"><select value={escolhida ?? ''} onChange={(e) => setParams({ c: e.target.value })} aria-label="Campanha">
        {(lista.dados ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}{c.inicio ? ` · ${dataBR(c.inicio)}${c.fim ? ` a ${dataBR(c.fim)}` : ''}` : ''}</option>)}
      </select></label></div>
      <Erro msg={lista.erro || q.erro} />
      {!escolhida ? <Vazio>Nenhuma campanha cadastrada. Use “Nova campanha”.</Vazio> : !p ? <Vazio>Carregando…</Vazio> : (<>
        <Placar p={p} />
        <Funil f={p.funil} />
        <Tabelas p={p} />
        {p.vagas.length > 0 && <QuadroVagas vagas={p.vagas} />}
        <ListaPendentes pendentes={p.pendentes} />
        <section className="bloco"><h2>Últimas vendas</h2>
          {!p.ultimas.length ? <Vazio>Nenhuma venda ainda.</Vazio> : (
            <table className="tabela compacta"><thead><tr><th>Quando</th><th>Aluna</th><th>Origem</th><th>Turma</th><th>Forma</th><th className="num">Valor</th></tr></thead>
              <tbody>{p.ultimas.map((v, i) => <tr key={i}><td className="pequeno">{dataBR(v.data)}</td><td>{v.nome ?? '—'}</td><td className="pequeno">{nomeOrigem(v.origem)}</td><td className="pequeno"><code>{v.turma || '—'}</code></td><td className="pequeno">{v.forma ?? '—'}</td><td className="num">{brl(v.valor)}</td></tr>)}</tbody></table>)}
        </section>
      </>)}
      {editar !== undefined && <FormCampanha inicial={editar} aoFechar={() => setEditar(undefined)} aoSalvar={(id) => { setEditar(undefined); lista.recarregar(); setParams({ c: id }); q.recarregar() }} />}
    </div>
  )
}
