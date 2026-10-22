// Conversa de teste com a IA de cobrança: você escreve como se fosse a pessoa (no número de teste) e vê o que a IA
// responderia, com a dívida real dela. Nada sai pelo WhatsApp de verdade.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Erro, Modal } from '../../../components/ui'
import type { Cobranca } from '../dados'

type Msg = { id: string; direcao: string; texto: string | null; criado_em: string }

export function TesteIA({ c, aoFechar }: { c: Cobranca; aoFechar: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [nota, setNota] = useState<string | null>(null)

  const carregar = async (id: string) => {
    const { data } = await supabase.from('crm_mensagens').select('id,direcao,texto,criado_em').eq('conversa_id', id).order('criado_em').limit(100)
    setMsgs((data ?? []) as Msg[])
  }

  const enviar = async () => {
    if (!texto.trim()) return
    setOcupado(true); setErro(null); setNota(null)
    const { data, error } = await supabase.functions.invoke('cobranca-agente', { body: { acao: 'simular', cobranca_id: c.id, texto: texto.trim() } })
    setOcupado(false)
    if (error || data?.erro) return setErro(data?.erro ?? error?.message ?? 'Não deu certo.')
    setTexto('')
    if (data.acao && data.acao !== 'nenhuma') setNota(`A IA marcou: ${data.acao}${data.acao === 'acordo' ? ' (o acordo foi gravado nesta cobrança)' : ''}`)
    if (data.conversa) await carregar(data.conversa)
  }

  return (
    <Modal titulo={`Testar a IA · ${c.aluno_nome ?? ''}`} aberto onFechar={aoFechar}>
      <p className="muted pequeno">Escreva como se você fosse essa pessoa. A IA responde com os dados reais da dívida dela. Atenção: se a IA fechar um acordo no teste, ele fica gravado nesta cobrança.</p>
      <div className="ia-chat">
        {!msgs.length && <p className="muted pequeno">Ex.: “Recebi um e-mail de cobrança, que valor é esse?”</p>}
        {msgs.map((m) => <div key={m.id} className={`ia-msg ${m.direcao === 'entrada' ? 'pessoa' : 'ia'}`}>{m.texto}</div>)}
        {ocupado && <div className="ia-msg ia muted">digitando…</div>}
      </div>
      {nota && <p className="pequeno nota">{nota}</p>}
      <Erro msg={erro} />
      <div className="ia-enviar">
        <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }} placeholder="Mensagem da pessoa…" />
        <button type="button" className="btn btn-ouro" disabled={ocupado || !texto.trim()} onClick={enviar}>Enviar</button>
      </div>
    </Modal>
  )
}
