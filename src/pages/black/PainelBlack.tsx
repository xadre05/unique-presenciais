// Comercial → Black: o placar da Black Friday Limited Edition. Atualiza sozinho a cada minuto.
import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR } from '../../lib/format'
import { Erro, Kpi, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { META_RECEITA, META_VENDAS, nomeOrigem, pct, type Painel } from './dados'
import { Funil } from './Funil'
import { ListaPendentes } from './ListaPendentes'
import { QuadroVagas } from './QuadroVagas'

function Barra({ valor, meta }: { valor: number; meta: number }) {
  return <div className="blk-barra"><span style={{ width: `${Math.min(100, pct(valor, meta))}%` }} /></div>
}

export default function PainelBlack() {
  const q = useConsulta<Painel>(() => supabase.rpc('painel_black'), [])
  useEffect(() => { const t = setInterval(() => q.recarregar(), 60000); return () => clearInterval(t) }, [q.recarregar]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = q.dados
  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Black Friday Limited Edition</h1><p className="muted">O placar da campanha: da página até a compra na Hotmart. Atualiza sozinho a cada minuto.</p></div>
        <div className="acoes"><button className="btn btn-contorno" onClick={() => q.recarregar()}><Icone nome="atualizar" /> Atualizar</button></div></header>
      <Erro msg={q.erro} />
      {!p ? <Vazio>Carregando…</Vazio> : (<>
        <section className="kpis">
          <div className="kpi"><div className="kpi-rotulo">Vendas</div><div className="kpi-valor">{p.funil.compraram} <span className="muted pequeno">de {META_VENDAS}</span></div><Barra valor={p.funil.compraram} meta={META_VENDAS} /><div className="kpi-sub">{pct(p.funil.compraram, META_VENDAS)}% da meta{p.funil.desfeitas ? ` · ${p.funil.desfeitas} reembolso(s)` : ''}</div></div>
          <div className="kpi"><div className="kpi-rotulo">Faturamento bruto</div><div className="kpi-valor">{brl(p.receita.bruto)}</div><Barra valor={p.receita.bruto} meta={META_RECEITA} /><div className="kpi-sub">meta {brl(META_RECEITA)}</div></div>
          <Kpi rotulo="Líquido da Hotmart" valor={brl(p.receita.liquido)} sub="o que a Hotmart repassa" />
          <Kpi rotulo="Foram ao pagamento e não compraram" valor={String(p.pendentes.length)} tom={p.pendentes.length ? 'alerta' : undefined} sub="lista embaixo, para o time chamar" />
        </section>
        <Funil f={p.funil} />
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
            <p className="muted pequeno">R$ 250 por venda com vendedora (pelo link dela ou por "esse aluno é meu" aprovado).</p>
          </section>
        </div>
        <QuadroVagas vagas={p.vagas} />
        <ListaPendentes pendentes={p.pendentes} />
        <section className="bloco"><h2>Últimas vendas</h2>
          {!p.ultimas.length ? <Vazio>Nenhuma venda ainda.</Vazio> : (
            <table className="tabela compacta"><thead><tr><th>Quando</th><th>Aluna</th><th>Origem</th><th>Turma</th><th>Forma</th><th className="num">Valor</th></tr></thead>
              <tbody>{p.ultimas.map((v, i) => <tr key={i}><td className="pequeno">{dataBR(v.data)}</td><td>{v.nome ?? '—'}</td><td className="pequeno">{nomeOrigem(v.origem)}</td><td className="pequeno"><code>{v.turma || '—'}</code></td><td className="pequeno">{v.forma ?? '—'}</td><td className="num">{brl(v.valor)}</td></tr>)}</tbody></table>)}
        </section>
      </>)}
    </div>
  )
}
