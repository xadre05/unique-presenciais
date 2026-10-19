// A conversa da Reunião de pauta: falas da equipe e do agente, respostas rápidas e a caixa de mensagem.
// Enter envia; Shift+Enter quebra a linha. Fechada (plano aprovado), fica só para leitura.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Fala } from './dados'

const SUGESTOES = ['O que funcionou melhor nas últimas semanas?', 'Quero focar na campanha', 'Menos vídeo, mais carrossel', 'Pode montar o plano']

type Props = { falas: Fala[]; pensando: boolean; somenteLeitura?: boolean; aoFalar: (texto: string) => void }

function Balao({ f, ultima, aoFalar }: { f: Fala; ultima: boolean; aoFalar: (t: string) => void }) {
  return (
    <div className={`mk-msg ${f.de}`}>
      <span className={`mk-msg-foto${f.de === 'agente' ? ' avatar' : ''}`}>{f.de === 'agente' ? <img src="/agentes/marketing-avatar.webp?v=1" alt="" /> : <Icone nome="usuario" tam={18} />}</span>
      <div><p>{f.texto}<small>{f.hora}</small></p>
        {f.de === 'agente' && ultima && !!f.opcoes?.length && <div className="mk-msg-opcoes">{f.opcoes.map((o) => <button key={o} type="button" className="mk-chip" onClick={() => aoFalar(o)}>{o}</button>)}</div>}
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
    <section className="mk-conversa reu-conversa">
      <div className="mk-msgs">
        {falas.map((f, i) => <Balao key={i} f={f} ultima={i === falas.length - 1 && !somenteLeitura} aoFalar={enviar} />)}
        {pensando && <div className="mk-msg agente"><span className="mk-msg-foto avatar"><img src="/agentes/marketing-avatar.webp?v=1" alt="" /></span><div><p className="mk-digitando"><i /><i /><i /></p></div></div>}
        <div ref={fim} />
      </div>
      {!somenteLeitura && <>
        <div className="mk-msg-entrada">
          <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responda, discorde, peça outra ideia…" aria-label="Mensagem para o agente"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }} />
          <button type="button" className="mk-msg-enviar" disabled={!texto.trim() || pensando} onClick={() => enviar(texto)} aria-label="Enviar"><Icone nome="enviar" tam={18} /></button>
        </div>
        <div className="mk-msg-sugestoes"><span className="pequeno muted"><Icone nome="ideia" tam={14} /> Para puxar a conversa</span>
          {SUGESTOES.map((s) => <button key={s} type="button" className="mk-chip" disabled={pensando} onClick={() => enviar(s)}>{s}</button>)}</div>
      </>}
    </section>
  )
}
