// Saldo na Carteira da Hotmart (por conta): disponível, a receber e os lançamentos futuros com data, informados à mão
// (Hotmart → Carteira → Extrato). Ao lado, as parcelas do Parcelado Hotmart já pagas neste mês, que a Hotmart libera
// de uma vez no dia 1º do mês seguinte ("Saldo de parcelas" no Extrato).
import { useState } from 'react'
import { brl, dataBR } from '../../../lib/format'
import { Erro, InputMoeda } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { somar, type Entrada } from '../dados'
import { jeitoEntrada } from './regras'
import type { Lancamento, Saldo, useSaldos } from './saldos'

function Editar({ atual, aoSalvar, aoCancelar }: { atual?: Saldo; aoSalvar: (s: Saldo) => Promise<void>; aoCancelar: () => void }) {
  const [disp, setDisp] = useState<number | null>(atual?.disponivel ?? null)
  const [lancs, setLancs] = useState<Lancamento[]>(atual?.lancamentos ?? [])
  const [salvando, setSalvando] = useState(false)
  const mudar = (i: number, x: Partial<Lancamento>) => setLancs((l) => l.map((v, j) => (j === i ? { ...v, ...x } : v)))
  const salvar = async () => {
    const validos = lancs.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.data) && l.valor > 0)
    setSalvando(true)
    await aoSalvar({ disponivel: disp ?? 0, a_receber: Math.round(somar(validos, (l) => l.valor) * 100) / 100, lancamentos: validos, em: new Date().toISOString() })
    setSalvando(false)
  }
  return (
    <div className="fin-saldo-editar">
      <label className="pequeno muted">Saldo disponível<InputMoeda valor={disp} onChange={setDisp} /></label>
      <span className="pequeno muted">Saldo a receber, um lançamento por data (Extrato, datas futuras)</span>
      {lancs.map((l, i) => (
        <div key={i} className="fin-lanc">
          <input type="date" value={l.data} onChange={(e) => mudar(i, { data: e.target.value })} aria-label="Data" />
          <InputMoeda valor={l.valor} onChange={(v) => mudar(i, { valor: v ?? 0 })} />
          <input value={l.descricao} onChange={(e) => mudar(i, { descricao: e.target.value })} placeholder="O que é (venda, antecipação…)" aria-label="Descrição" />
          <button type="button" className="btn btn-mini" aria-label="Tirar" onClick={() => setLancs((v) => v.filter((_, j) => j !== i))}><Icone nome="fechar" tam={12} /></button>
        </div>))}
      <button type="button" className="link pequeno" onClick={() => setLancs((v) => [...v, { data: '', valor: 0, descricao: '' }])}>+ lançamento a receber</button>
      <span className="ia-linha"><button className="btn btn-mini" onClick={aoCancelar}>Cancelar</button>
        <button className="btn btn-ouro btn-mini" disabled={salvando} onClick={salvar}>Salvar</button></span>
    </div>
  )
}

type Props = { pagasNoMes: Entrada[]; s: ReturnType<typeof useSaldos> }

export function SaldoHotmart({ pagasNoMes, s }: Props) {
  const [editando, setEditando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async (id: string, novo: Saldo) => {
    setErro(null)
    try { await s.salvar(id, novo); setEditando(null) } catch (e) { setErro((e as Error).message) }
  }
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>Na Carteira da Hotmart</h2><span className="muted pequeno">Hotmart → Carteira → Saldo e Extrato</span></div>
      <Erro msg={s.erro || erro} />
      <div className="fin-antecipa">{s.contas.map((c) => {
        const sd = s.saldos[c.id]
        const parcelas = somar(pagasNoMes.filter((e) => e.integracao_id === c.id && jeitoEntrada(e) === 'parcelado_hotmart'), (e) => e.liquido)
        return (
          <div key={c.id} className="fin-antecipa-conta">
            <b>{c.nome}</b>
            {editando === c.id ? <Editar atual={sd} aoSalvar={(n) => salvar(c.id, n)} aoCancelar={() => setEditando(null)} />
              : sd ? <>
                <span>Disponível para saque: <b>{brl(sd.disponivel)}</b></span>
                <span>A receber: <b>{brl(sd.a_receber)}</b></span>
                {(sd.lancamentos ?? []).length > 0 && <ul className="fin-lancs">{sd.lancamentos!.map((l, i) => <li key={i}><span>{dataBR(l.data).slice(0, 5)}</span><span className="muted">{l.descricao}</span><b>{brl(l.valor)}</b></li>)}</ul>}
                <span className="muted pequeno">Informado em {dataBR(sd.em.slice(0, 10))} · <button className="link" onClick={() => setEditando(c.id)}>atualizar</button></span>
              </> : <span className="muted pequeno">Saldo ainda não informado. <button className="link" onClick={() => setEditando(c.id)}>Informar</button></span>}
            {parcelas > 0 && <span className="pequeno fin-saldo-parcelas">Parcelas pagas pelos alunos neste mês: <b>{brl(parcelas)}</b>. A Hotmart libera no dia 1º do mês que vem, descontando o que ainda cobre da antecipação.</span>}
          </div>
        )
      })}</div>
    </section>
  )
}
