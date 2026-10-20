// Acordo fechado (valor, forma, parcelas, 1º vencimento) e pagamento que entrou do acordo (a cobradora informa, o
// administrador confere em Cobranças → Recebimentos; a comissão sai do que foi conferido).
import { useState } from 'react'
import { Erro, InputMoeda, InputNumero, Modal } from '../../components/ui'
import { brl, hojeISO } from '../../lib/format'
import { FORMAS_ACORDO, informarRecebimento, salvarAcordo, type Cobranca } from './dados'

type Props = { cobranca: Cobranca; eu: string; aoFechar: () => void; aoSalvar: () => void }

export function ModalAcordo({ cobranca: c, eu, aoFechar, aoSalvar }: Props) {
  const [valor, setValor] = useState(Number(c.acordo_valor ?? c.valor_restante ?? c.valor_vencido ?? 0))
  const [forma, setForma] = useState(c.acordo_forma ?? 'link_hotmart')
  const [parcelas, setParcelas] = useState(c.acordo_parcelas ?? 1)
  const [venc, setVenc] = useState(c.acordo_primeiro_venc ?? hojeISO())
  const [obs, setObs] = useState(c.acordo_obs ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!(valor > 0)) return setErro('Coloque o valor combinado.')
    setSalvando(true); setErro(null)
    try { await salvarAcordo(c, { acordo_valor: valor, acordo_forma: forma, acordo_parcelas: Math.max(1, parcelas), acordo_primeiro_venc: venc, acordo_obs: obs }, eu); aoSalvar() }
    catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Modal titulo={`Acordo · ${c.aluno_nome ?? ''}`} aberto onFechar={aoFechar}>
      <div className="cob-form">
        <p className="muted pequeno">Devia {brl(c.valor_restante ?? c.valor_vencido)} ({brl(c.valor_vencido)} já vencido). Registre o que foi combinado.</p>
        <label className="cob-rotulo">Valor total do acordo<InputMoeda valor={valor} onChange={(v) => setValor(v ?? 0)} /></label>
        <span className="cob-rotulo">Como vai pagar</span>
        <div className="cob-chips">{FORMAS_ACORDO.map(([id, nome]) => <button key={id} type="button" className={`mk-chip${forma === id ? ' ativo' : ''}`} onClick={() => setForma(id)}>{nome}</button>)}</div>
        <div className="cob-linha2">
          <label className="cob-rotulo">Em quantas vezes<InputNumero valor={parcelas} onChange={setParcelas} min={1} max={24} sufixo="x" /></label>
          <label className="cob-rotulo">1º vencimento<input type="date" value={venc} onChange={(e) => e.target.value && setVenc(e.target.value)} /></label>
        </div>
        {parcelas > 1 && valor > 0 && <small className="muted">{parcelas}x de {brl(valor / parcelas)}</small>}
        <label className="cob-rotulo">Observação <small className="muted">(opcional)</small><textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: desconto de 20% para quitar à vista" /></label>
      </div>
      <Erro msg={erro} />
      <div className="cob-acoes"><button type="button" className="btn" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar acordo'}</button></div>
    </Modal>
  )
}

export function ModalRecebimento({ cobranca: c, eu, aoFechar, aoSalvar }: Props) {
  const parcela = c.acordo_valor && c.acordo_parcelas ? Number(c.acordo_valor) / c.acordo_parcelas : Number(c.valor_vencido ?? 0)
  const [valor, setValor] = useState(Math.round(parcela * 100) / 100)
  const [data, setData] = useState(hojeISO())
  const [forma, setForma] = useState(c.acordo_forma ?? 'pix')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!(valor > 0)) return setErro('Coloque o valor que entrou.')
    setSalvando(true); setErro(null)
    try { await informarRecebimento(c.id, { valor, recebido_em: data, forma, observacao: obs }, eu); aoSalvar() }
    catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Modal titulo={`Pagamento do acordo · ${c.aluno_nome ?? ''}`} aberto onFechar={aoFechar}>
      <div className="cob-form">
        <p className="muted pequeno">Informe o que entrou. O administrador confere no extrato; a comissão conta depois da conferência.</p>
        <div className="cob-linha2">
          <label className="cob-rotulo">Valor recebido<InputMoeda valor={valor} onChange={(v) => setValor(v ?? 0)} /></label>
          <label className="cob-rotulo">Dia<input type="date" value={data} max={hojeISO()} onChange={(e) => e.target.value && setData(e.target.value)} /></label>
        </div>
        <div className="cob-chips">{FORMAS_ACORDO.map(([id, nome]) => <button key={id} type="button" className={`mk-chip${forma === id ? ' ativo' : ''}`} onClick={() => setForma(id)}>{nome}</button>)}</div>
        <label className="cob-rotulo">Observação <small className="muted">(opcional)</small><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: comprovante no WhatsApp" /></label>
      </div>
      <Erro msg={erro} />
      <div className="cob-acoes"><button type="button" className="btn" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Informar pagamento'}</button></div>
    </Modal>
  )
}
