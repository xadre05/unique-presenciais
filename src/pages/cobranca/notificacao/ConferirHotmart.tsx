// Conferência de uma dívida na Hotmart antes de notificar: o sistema mostra por que ficou em dúvida;
// quem conferiu marca "confere" (pode notificar) ou "não deve" (sai da cobrança). Fica no histórico.
import { useState } from 'react'
import { brl, dataBR } from '../../../lib/format'
import { Campo, Erro, Modal } from '../../../components/ui'
import { mudarCampos, registrarContato, type Cobranca } from '../dados'
import type { Conferencia } from './modelo'

type Props = { c: Cobranca; k: Conferencia | undefined; eu: string; aoFechar: () => void; aoSalvar: () => void }

export function ConferirHotmart({ c, k, eu, aoFechar, aoSalvar }: Props) {
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async (confere: boolean) => {
    if (!obs.trim()) return setErro('Escreva o que você viu na Hotmart (fica de prova).')
    setSalvando(true); setErro(null)
    try {
      if (confere) await mudarCampos(c.id, { conferido_hotmart_em: new Date().toISOString(), conferido_hotmart_por: eu, conferido_hotmart_obs: obs.trim() })
      else await mudarCampos(c.id, { etapa: 'encerrada' })
      await registrarContato(c, { canal: 'sistema', resultado: confere ? 'Conferido na Hotmart: a dívida confere' : 'Conferido na Hotmart: não deve (saiu da cobrança)', observacao: obs.trim() }, eu)
      aoSalvar()
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Modal titulo={`Conferir na Hotmart · ${c.aluno_nome ?? ''}`} aberto onFechar={aoFechar} largo>
      <p className="muted pequeno">Procure na Hotmart pelo e-mail <b>{c.email}</b> (Vendas → Parcelado Hotmart / Minhas vendas) e compare com o que o sistema calculou.</p>
      <dl className="gaveta-dados">
        <dt>Curso</dt><dd>{c.produto}</dd>
        <dt>Comprou em</dt><dd>{dataBR(k?.compra_em)}</dd>
        <dt>Parcelas</dt><dd>{k?.pagas ?? '—'} paga(s) de {k?.np ?? '—'} · {brl(k?.valor_parcela)} cada</dd>
        <dt>Sem pagamento desde</dt><dd>{dataBR(k?.parou_em)} · {k?.vencidas ?? '—'} vencida(s) = {brl(Number(k?.vencidas ?? 0) * Number(k?.valor_parcela ?? 0))}</dd>
        <dt>Na Hotmart</dt><dd>{k?.status_hotmart ?? '—'}{k?.nao_pagas_hotmart != null ? ` · lista ${k.nao_pagas_hotmart} parcela(s) em aberto` : ''}</dd>
      </dl>
      <div className="faixa-alerta"><span><b>Por que conferir:</b> {(k?.duvidas ?? []).join('; ')}.</span></div>
      <Campo rotulo="O que você viu na Hotmart"><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Parcelado de 12x R$ 296; pagou 3; parcelas 4 a 12 em aberto desde 10/03/2024." /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes">
        <button className="btn" onClick={aoFechar}>Cancelar</button>
        <button className="btn btn-perigo" disabled={salvando} onClick={() => salvar(false)}>Não deve (tirar da cobrança)</button>
        <button className="btn btn-ouro" disabled={salvando} onClick={() => salvar(true)}>Confere: pode notificar</button>
      </div>
    </Modal>
  )
}
