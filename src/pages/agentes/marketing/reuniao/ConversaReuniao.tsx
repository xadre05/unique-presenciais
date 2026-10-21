// A conversa da Reunião de pauta: falas da equipe e do agente, respostas rápidas e a caixa de mensagem.
// Enter envia; Shift+Enter quebra a linha. Fechada (plano aprovado), fica só para leitura.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { BotaoDitado } from '../../../../components/BotaoDitado'
import type { Fala } from './dados'


type Props = { falas: Fala[]; pensando: boolean; somenteLeitura?: boolean; aoFalar: (texto: string) => void }

function Balao({ f, ultima, aoFalar }: { f: Fala; ultima: boolean; aoFalar: (t: string) => void }) {
  return (
    <div className={`rc-msg ${f.de}`}>
      {f.de === 'agente' && <span className="rc-foto"><Icone nome="mensagem" tam={20} /></span>}
      <div className="rc-corpo">
        <span className="rc-quem"><b>{f.de === 'agente' ? 'Agente de Marketing' : 'Você'}</b><small className="muted">{f.hora}</small></span>
        <p>{f.texto}</p>
        {f.de === 'agente' && ultima && !!f.opcoes?.length && <>
          <div className="rc-opcoes">{f.opcoes.map((o) => <button key={o} type="button" onClick={() => aoFalar(o)}>{o}</button>)}</div>
          <small className="muted rc-dica"><Icone nome="info" tam={13} /> O agente pergunta conforme o que ainda falta definir.</small></>}
      </div>
    </div>
  )
}

export function ConversaReuniao({ falas, pensando, somenteLeitura, aoFalar }: Props) {
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [falas.length, pensando])
  const enviar = (t: string) => { if (!t.trim() || pensando || somenteLeitura) return; aoFalar(t.trim()); setTexto('') }
  return (
    <section className="mk-painel rc-conversa">
      <header className="rc-cab"><Icone nome="mensagem" tam={24} /><h3>Conversa da reunião</h3><small className="muted"><i className="rc-ponto" /> Salva automaticamente.</small></header>
      <div className="rc-msgs">
        {falas.map((f, i) => <Balao key={i} f={f} ultima={i === falas.length - 1 && !somenteLeitura} aoFalar={enviar} />)}
        {pensando && <div className="rc-msg agente"><span className="rc-foto"><Icone nome="mensagem" tam={20} /></span><div className="rc-corpo"><span className="rc-quem"><b>Agente de Marketing</b></span><p className="mk-digitando"><i /><i /><i /></p></div></div>}
        <div ref={fim} />
      </div>
      {!somenteLeitura && (
        <div className="rc-entrada">
          <textarea rows={1} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva sua resposta ou traga uma ideia…" aria-label="Mensagem para o agente"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }} />
          <BotaoDitado aoFalar={(t) => setTexto((x) => (x.trim() ? `${x.trim()} ${t}` : t))} desativado={pensando} />
          <button type="button" className="rc-enviar" disabled={!texto.trim() || pensando} onClick={() => enviar(texto)} aria-label="Enviar"><Icone nome="enviar" tam={18} /></button>
        </div>
      )}
    </section>
  )
}
