// Saldo na Carteira da Hotmart (por conta): o disponível e o "a receber" não vêm pela integração, então são
// informados à mão (com a data). Ao lado, as parcelas do Parcelado Hotmart já pagas neste mês, que a Hotmart
// libera de uma vez no dia 1º do mês seguinte ("Saldo de parcelas" no Extrato).
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { brl, dataBR } from '../../../lib/format'
import { Erro, InputMoeda } from '../../../components/ui'
import { somar, type Entrada } from '../dados'
import { jeitoEntrada } from './regras'

type Saldo = { disponivel: number; a_receber: number; em: string }
type Config = { saldos: Record<string, Saldo> }
type Conta = { id: string; nome: string; conta_id: string | null }

function Editar({ atual, aoSalvar, aoCancelar }: { atual?: Saldo; aoSalvar: (s: Saldo) => void; aoCancelar: () => void }) {
  const [disp, setDisp] = useState<number | null>(atual?.disponivel ?? null)
  const [rec, setRec] = useState<number | null>(atual?.a_receber ?? null)
  return (
    <div className="fin-saldo-editar">
      <label className="pequeno muted">Saldo disponível<InputMoeda valor={disp} onChange={setDisp} /></label>
      <label className="pequeno muted">Saldo a receber<InputMoeda valor={rec} onChange={setRec} /></label>
      <span className="ia-linha"><button className="btn btn-mini" onClick={aoCancelar}>Cancelar</button>
        <button className="btn btn-ouro btn-mini" onClick={() => aoSalvar({ disponivel: disp ?? 0, a_receber: rec ?? 0, em: new Date().toISOString() })}>Salvar</button></span>
    </div>
  )
}

export function SaldoHotmart({ pagasNoMes }: { pagasNoMes: Entrada[] }) {
  const cfg = useConsulta<Config>(() => supabase.from('financeiro_config').select('saldos').eq('id', true).single(), [])
  const contas = useConsulta<Conta[]>(() => supabase.from('integracoes').select('id,nome,conta_id').eq('tipo', 'hotmart').order('ordem'), [])
  const [editando, setEditando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async (id: string, s: Saldo) => {
    setErro(null)
    const { error } = await supabase.from('financeiro_config').update({ saldos: { ...(cfg.dados?.saldos ?? {}), [id]: s } }).eq('id', true)
    if (error) return setErro(error.message)
    setEditando(null); cfg.recarregar()
  }
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>Na Carteira da Hotmart</h2><span className="muted pequeno">Hotmart → Carteira → Saldo</span></div>
      <Erro msg={cfg.erro || contas.erro || erro} />
      <div className="fin-antecipa">{(contas.dados ?? []).map((c) => {
        const s = cfg.dados?.saldos?.[c.id]
        const parcelas = somar(pagasNoMes.filter((e) => e.integracao_id === c.id && jeitoEntrada(e) === 'parcelado_hotmart'), (e) => e.liquido)
        return (
          <div key={c.id} className="fin-antecipa-conta">
            <b>{c.nome}</b>
            {editando === c.id ? <Editar atual={s} aoSalvar={(n) => salvar(c.id, n)} aoCancelar={() => setEditando(null)} />
              : s ? <>
                <span>Disponível para saque: <b>{brl(s.disponivel)}</b></span>
                <span>A receber (a liberar): <b>{brl(s.a_receber)}</b></span>
                <span className="muted pequeno">Informado em {dataBR(s.em.slice(0, 10))} · <button className="link" onClick={() => setEditando(c.id)}>atualizar</button></span>
              </> : <span className="muted pequeno">Saldo ainda não informado. <button className="link" onClick={() => setEditando(c.id)}>Informar</button></span>}
            {parcelas > 0 && <span className="pequeno fin-saldo-parcelas">Parcelas já pagas neste mês: <b>{brl(parcelas)}</b>. A Hotmart libera no dia 1º do mês que vem, descontando o que ainda cobre da antecipação.</span>}
          </div>
        )
      })}</div>
    </section>
  )
}
