// Registrar um contato de cobrança: por onde falou, o que aconteceu (move a cobrança de etapa) e, se for o caso, a data
// prometida ou a data de retornar. Tudo fica no histórico, com quem registrou.
import { useState } from 'react'
import { Erro, Modal } from '../../components/ui'
import { hojeISO } from '../../lib/format'
import { registrarContato, type Cobranca, type Etapa } from './dados'

type Resultado = { texto: string; etapa?: Etapa; data?: 'promessa' | 'retornar' }
const RESULTADOS: Resultado[] = [
  { texto: 'Mandei mensagem', etapa: 'aguardando' },
  { texto: 'Não respondeu', etapa: 'aguardando', data: 'retornar' },
  { texto: 'Respondeu, está conversando', etapa: 'negociando' },
  { texto: 'Prometeu pagar', etapa: 'negociando', data: 'promessa' },
  { texto: 'Disse que já pagou', etapa: 'negociando' },
  { texto: 'Não vai pagar', etapa: 'sem_acordo' },
  { texto: 'Número errado' },
]
const CANAIS: [string, string][] = [['whatsapp', 'WhatsApp'], ['ligacao', 'Ligação'], ['email', 'E-mail'], ['outro', 'Outro']]
const dataBr = (iso: string) => iso.split('-').reverse().join('/')

type Props = { cobranca: Cobranca; eu: string; aoFechar: () => void; aoSalvar: () => void }

export function RegistrarContato({ cobranca, eu, aoFechar, aoSalvar }: Props) {
  const [canal, setCanal] = useState('whatsapp')
  const [i, setI] = useState(0)
  const [data, setData] = useState(cobranca.promessa_em ?? hojeISO())
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const r = RESULTADOS[i]

  const salvar = async () => {
    setSalvando(true); setErro(null)
    try {
      await registrarContato(cobranca, {
        canal, observacao: obs, etapa: r.etapa,
        resultado: r.data === 'promessa' ? `${r.texto} até ${dataBr(data)}` : r.data === 'retornar' ? `${r.texto} (retornar em ${dataBr(data)})` : r.texto,
        ...(r.data === 'promessa' ? { promessa_em: data, retornar_em: data } : r.data === 'retornar' ? { retornar_em: data } : {}),
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
        <div className="cob-chips">{RESULTADOS.map((x, k) => <button key={x.texto} type="button" className={`mk-chip${i === k ? ' ativo' : ''}`} onClick={() => setI(k)}>{x.texto}</button>)}</div>
        {r.data && <label className="cob-rotulo">{r.data === 'promessa' ? 'Prometeu pagar até' : 'Tentar de novo em'}<input type="date" value={data} min={hojeISO()} onChange={(e) => e.target.value && setData(e.target.value)} /></label>}
        <label className="cob-rotulo">Observação <small className="muted">(opcional)</small><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: vai trocar o cartão na Hotmart amanhã" /></label>
        {r.texto === 'Disse que já pagou' && <small className="muted">Se foi na Hotmart, a cobrança fecha sozinha quando ela confirmar. Se pagou por Pix ou boleto, use “Pagamento do acordo”.</small>}
      </div>
      <Erro msg={erro} />
      <div className="cob-acoes"><button type="button" className="btn" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Registrar'}</button></div>
    </Modal>
  )
}
