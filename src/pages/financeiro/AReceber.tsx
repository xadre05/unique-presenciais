// O que ainda vai entrar, mês a mês: parcelas dos contratos em dia na Hotmart, parcelas do presencial e acordos de dívida.
// Mostra também quanto a Hotmart ainda segura da antecipação do Parcelado Hotmart (estimativa pela regra da Hotmart).
import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, hojeISO } from '../../lib/format'
import { Badge, Erro, InputNumero, Kpi, Vazio } from '../../components/ui'
import { FiltroTopo } from './FiltroTopo'
import { mesDe, nomeMes, ORIGEM_RECEBER, somaMes, somar, type AReceber as Linha, type Parcelado } from './dados'

export default function AReceber() {
  const hoje = hojeISO()
  const [conta, setConta] = useState('')
  const [mesAberto, setMesAberto] = useState(mesDe(hoje))
  const q = useConsulta<Linha[]>(() => supabase.from('v_fin_a_receber').select('*').order('data'), [])
  const parc = useConsulta<Parcelado[]>(() => supabase.from('v_fin_parcelado').select('*').order('proxima'), [])
  const cfg = useConsulta<{ antecipacao: Record<string, number> }>(() => supabase.from('financeiro_config').select('antecipacao').eq('id', true).single(), [])
  const integ = useConsulta<{ id: string; nome: string }[]>(() => supabase.from('integracoes').select('id,nome').eq('tipo', 'hotmart').order('ordem'), [])
  const [erro, setErro] = useState<string | null>(null)

  const linhas = useMemo(() => (q.dados ?? []).filter((r) => !conta || r.conta_id === conta), [q.dados, conta])
  const contratos = (parc.dados ?? []).filter((p) => !conta || p.conta_id === conta)
  const meses = Array.from({ length: 12 }, (_, i) => somaMes(mesDe(hoje), i))
  const porMes = (m: string, o?: string) => somar(linhas.filter((r) => r.data && mesDe(r.data) === m && (!o || r.origem === o)), (r) => r.valor)
  const depois = somar(linhas.filter((r) => r.data && mesDe(r.data) > meses[11]), (r) => r.valor)
  const semData = linhas.filter((r) => !r.data)
  const retido = somar(contratos, (p) => p.retido_estimado)
  const doMes = linhas.filter((r) => r.data && mesDe(r.data) === mesAberto)

  const salvarPct = async (integ: string, v: number) => {
    setErro(null)
    const nova = { ...(cfg.dados?.antecipacao ?? {}), [integ]: v }
    const { error } = await supabase.from('financeiro_config').update({ antecipacao: nova }).eq('id', true)
    if (error) setErro(error.message); else { cfg.recarregar(); parc.recarregar() }
  }

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>A receber</h1><p className="muted">O que ainda vai entrar, mês a mês. Dívida atrasada não entra aqui: ela está na cobrança.</p></div></header>
      <FiltroTopo semMes mes={mesAberto} aoMudarMes={setMesAberto} conta={conta} aoMudarConta={setConta} />
      <Erro msg={q.erro || parc.erro || cfg.erro || erro} />
      <section className="kpis">
        <Kpi rotulo="Total a receber" valor={brl(somar(linhas, (r) => r.valor))} tom="ok" sub={`${linhas.length} parcela(s)`} />
        <Kpi rotulo="Próximos 30 dias" valor={brl(somar(linhas.filter((r) => r.data && r.data <= somaDias(hoje, 30)), (r) => r.valor))} />
        <Kpi rotulo="Contratos em dia na Hotmart" valor={String(contratos.length)} sub={brl(somar(contratos, (p) => p.a_receber))} />
        <Kpi rotulo="A Hotmart ainda segura (estimativa)" valor={brl(retido)} tom={retido > 0 ? 'alerta' : undefined} sub="parcelas que vão pagar a antecipação" />
      </section>

      <section className="bloco sem-padding tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Mês</th>{Object.values(ORIGEM_RECEBER).map((o) => <th key={o} className="num">{o}</th>)}<th className="num">Total</th></tr></thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m} className={`linha-clicavel${m === mesAberto ? ' fin-linha-ativa' : ''}`} onClick={() => setMesAberto(m)}>
                <td>{nomeMes(m)}</td>{Object.keys(ORIGEM_RECEBER).map((o) => <td key={o} className="num">{porMes(m, o) ? brl(porMes(m, o)) : '—'}</td>)}<td className="num forte">{brl(porMes(m))}</td>
              </tr>
            ))}
            {depois > 0 && <tr><td className="muted">Depois</td><td colSpan={3} /><td className="num">{brl(depois)}</td></tr>}
            {semData.length > 0 && <tr><td className="muted">Sem data</td><td colSpan={3} className="muted pequeno">parcelas do presencial sem vencimento</td><td className="num">{brl(somar(semData, (r) => r.valor))}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="bloco">
        <h2>Em {nomeMes(mesAberto)}</h2>
        {!doMes.length ? <Vazio>Nada previsto para este mês.</Vazio> : (
          <table className="tabela">
            <thead><tr><th>Data</th><th>Pessoa</th><th>Produto</th><th>Origem</th><th className="num">Valor</th></tr></thead>
            <tbody>{doMes.map((r) => <tr key={r.id}><td className="pequeno">{dataBR(r.data)}</td><td className="pequeno">{r.pessoa ?? '—'}</td>
              <td className="pequeno"><div className="at-corta">{r.descricao}</div>{r.parcela && <div className="muted">parcela {r.parcela}</div>}</td>
              <td><Badge tom={r.origem === 'hotmart' ? 'info' : r.origem === 'acordo' ? 'ok' : 'ouro'}>{ORIGEM_RECEBER[r.origem]}</Badge></td><td className="num">{brl(r.valor)}</td></tr>)}</tbody>
          </table>
        )}
      </section>

      <section className="bloco">
        <h2>Antecipação do Parcelado Hotmart</h2>
        <p className="muted pequeno">A Hotmart adianta uma parte da venda em até 30 dias. Depois, as parcelas que os alunos pagam ficam com a Hotmart até cobrir esse adiantamento; só o que passar disso volta a cair na sua conta. A conta abaixo é uma estimativa por contrato. O número exato vem do Extrato da Hotmart.</p>
        <div className="fin-antecipa">
          {(integ.dados ?? []).map(({ id: k, nome }) => {
            const cs = (parc.dados ?? []).filter((p) => p.integracao_id === k)
            return (
              <div key={k} className="fin-antecipa-conta">
                <b>{nome}</b>
                <label className="pequeno muted">Quanto a Hotmart adianta
                  <InputNumero valor={Number(cfg.dados?.antecipacao?.[k] ?? 0)} onChange={(v) => salvarPct(k, v)} min={0} max={50} sufixo="%" /></label>
                <span className="pequeno">{cs.length} contrato(s) em dia · faltam {brl(somar(cs, (p) => p.a_receber))}</span>
                <span className="pequeno">A Hotmart ainda segura <b>{brl(somar(cs, (p) => p.retido_estimado))}</b> → cai na conta <b>{brl(somar(cs, (p) => p.a_receber - p.retido_estimado))}</b></span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function somaDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
