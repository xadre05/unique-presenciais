// CRM — NÚCLEO: ferramentas da caixa de escrever — anexar arquivo, emoji e agendar envio.
import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import type { Conversa } from '../tipos'

const EMOJIS = '😊 😉 😍 🥰 😂 🙏 👏 👍 👌 🙌 💛 ❤️ ✨ 🎉 🔥 ✅ 📌 📅 ⏰ 💳 📲 🤝 💬 🙂 😅 🤗 💪 🌟'.split(' ')

export function BotaoEmoji({ aoEscolher }: { aoEscolher: (e: string) => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <span className="ce-pop-ancora">
      <button type="button" className="btn-icone" title="Emoji" onClick={() => setAberto(!aberto)}>😊</button>
      {aberto && <div className="ce-pop ce-emojis" onMouseLeave={() => setAberto(false)}>{EMOJIS.map((e) => <button key={e} onClick={() => { aoEscolher(e); setAberto(false) }}>{e}</button>)}</div>}
    </span>
  )
}

export function BotaoAnexo({ desativado, aoEscolher }: { desativado?: boolean; aoEscolher: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (<>
    <button type="button" className="btn-icone" title="Anexar foto, áudio, vídeo ou documento" disabled={desativado} onClick={() => ref.current?.click()}><Icone nome="arquivo" tam={18} /></button>
    <input ref={ref} type="file" hidden accept="image/jpeg,image/png,audio/*,video/mp4,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) aoEscolher(f); e.target.value = '' }} />
  </>)
}

const paraInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const amanha9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d }

/** Agenda o texto da caixa para sair numa data e hora (opcional: só se a pessoa não tiver respondido). */
export function BotaoAgendar({ conv, texto, aoAgendar }: { conv: Conversa; texto: string; aoAgendar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [quando, setQuando] = useState(() => paraInput(amanha9()))
  const [soSem, setSoSem] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const agendar = async () => {
    setErro(null)
    const em = new Date(quando)
    if (!(em.getTime() > Date.now())) return setErro('Escolha uma data e hora no futuro.')
    const { error } = await supabase.from('crm_agendadas').insert({ empresa_id: conv.empresa_id, conversa_id: conv.id, texto: texto.trim(), enviar_em: em.toISOString(), so_sem_resposta: soSem })
    if (error) return setErro(error.message)
    setAberto(false); aoAgendar()
  }
  return (
    <span className="ce-pop-ancora">
      <button type="button" className="btn-icone" title="Agendar envio" disabled={!texto.trim()} onClick={() => setAberto(!aberto)}><Icone nome="relogio" tam={18} /></button>
      {aberto && <div className="ce-pop ce-agendar">
        <b>Agendar esta mensagem</b>
        <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        <label className="check pequeno"><input type="checkbox" checked={soSem} onChange={(e) => setSoSem(e.target.checked)} /> Só enviar se a pessoa não tiver respondido até lá</label>
        <Erro msg={erro} />
        <div className="rp-acoes"><button className="btn btn-mini" onClick={() => setAberto(false)}>Cancelar</button><button className="btn btn-ouro btn-mini" onClick={agendar}>Agendar</button></div>
      </div>}
    </span>
  )
}

export type Agendada = { id: string; texto: string; enviar_em: string; so_sem_resposta: boolean; status: string; erro: string | null }

/** Mensagens agendadas desta conversa (ainda não enviadas), com opção de cancelar. */
export function ListaAgendadas({ itens, aoMudar }: { itens: Agendada[]; aoMudar: () => void }) {
  const cancelar = async (id: string) => { await supabase.from('crm_agendadas').update({ status: 'cancelada' }).eq('id', id); aoMudar() }
  const pendentes = itens.filter((a) => a.status === 'agendada')
  if (!pendentes.length) return null
  return (
    <div className="ce-agendadas">
      {pendentes.map((a) => (
        <div key={a.id} className="ce-agendada pequeno">
          <Icone nome="relogio" tam={14} /><span>Agendada para <b>{new Date(a.enviar_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</b>{a.so_sem_resposta ? ' (se não responder)' : ''}: <span className="muted">{a.texto.slice(0, 90)}</span></span>
          <button className="link pequeno" onClick={() => cancelar(a.id)}>cancelar</button>
        </div>
      ))}
    </div>
  )
}
