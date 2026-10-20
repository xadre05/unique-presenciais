// Registrar um contato de cobrança: por onde falou, o que aconteceu (vira a situação da cobrança) e, se prometeu,
// a data. Tudo fica no histórico da cobrança, com quem registrou.
import { useState } from 'react'
import { Erro, Modal } from '../../components/ui'
import { hojeISO } from '../../lib/format'
import { registrarContato, type Cobranca, type SituacaoCobranca } from './dados'

const RESULTADOS: { texto: string; situacao?: SituacaoCobranca; data?: boolean }[] = [
  { texto: 'Mandei mensagem' },
  { texto: 'Prometeu pagar', situacao: 'prometeu', data: true },
  { texto: 'Disse que já pagou', situacao: 'prometeu' },
  { texto: 'Está negociando', situacao: 'negociando' },
  { texto: 'Não respondeu', situacao: 'sem_resposta' },
  { texto: 'Não vai pagar', situacao: 'nao_vai_pagar' },
]
const CANAIS: [string, string][] = [['whatsapp', 'WhatsApp'], ['ligacao', 'Ligação'], ['email', 'E-mail'], ['outro', 'Outro']]

type Props = { cobranca: Cobranca; eu: string; aoFechar: () => void; aoSalvar: () => void }

export function RegistrarContato({ cobranca, eu, aoFechar, aoSalvar }: Props) {
  const [canal, setCanal] = useState('whatsapp')
  const [resultado, setResultado] = useState(0)
  const [promessa, setPromessa] = useState(cobranca.promessa_em ?? hojeISO())
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const r = RESULTADOS[resultado]

  const salvar = async () => {
    setSalvando(true); setErro(null)
    try {
      await registrarContato(cobranca.id, {
        canal, resultado: r.data ? `${r.texto} até ${promessa.split('-').reverse().join('/')}` : r.texto, observacao: obs, situacao: r.situacao,
        ...(r.data ? { promessa_em: promessa } : r.situacao === 'prometeu' ? { promessa_em: hojeISO() } : {}),
      }, eu)
      aoSalvar()
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }

  return (
    <Modal titulo={`Registrar contato · ${cobranca.aluno_nome ?? ''}`} aberto onFechar={aoFechar}>
      <div className="cob-form">
        <span className="cob-rotulo">Por onde</span>
        <div className="cob-chips">{CANAIS.map(([id, nome]) => <button key={id} type="button" className={`mk-chip${canal === id ? ' ativo' : ''}`} onClick={() => setCanal(id)}>{nome}</button>)}</div>
        <span className="cob-rotulo">O que aconteceu</span>
        <div className="cob-chips">{RESULTADOS.map((x, i) => <button key={x.texto} type="button" className={`mk-chip${resultado === i ? ' ativo' : ''}`} onClick={() => setResultado(i)}>{x.texto}</button>)}</div>
        {r.data && <label className="cob-rotulo">Prometeu pagar até<input type="date" value={promessa} min={hojeISO()} onChange={(e) => e.target.value && setPromessa(e.target.value)} /></label>}
        <label className="cob-rotulo">Observação <small className="muted">(opcional)</small><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: vai trocar o cartão na Hotmart amanhã" /></label>
        {r.texto === 'Disse que já pagou' && <small className="muted">A cobrança fecha sozinha quando a Hotmart confirmar o pagamento (o sistema confere de hora em hora).</small>}
      </div>
      <Erro msg={erro} />
      <div className="cob-acoes"><button type="button" className="btn" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar'}</button></div>
    </Modal>
  )
}
