// CRM — NÚCLEO: caixa de escrever da conversa (mensagem ou nota interna, respostas prontas, sugestão da IA).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { servidorWhats, type BaseCRM, type Canal, type Conversa } from '../tipos'
import { RespostasProntas } from './RespostasProntas'
import { sugerirResposta } from './util'

type Props = { conv: Conversa; base: BaseCRM; canal: Canal | undefined; usuarioId: string; usuarioNome: string | null; foraJanela: boolean; aoEnviar: () => void }

export function Escrever({ conv, base, canal, usuarioId, usuarioNome, foraJanela, aoEnviar }: Props) {
  const ir = useNavigate()
  const [modoNota, setModoNota] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState<'enviando' | 'sugerindo' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gaveta, setGaveta] = useState(false)
  const sugestoes = !modoNota && texto.startsWith('/') ? base.respostas.filter((r) => r.atalho.toLowerCase().startsWith(texto.slice(1).toLowerCase())).slice(0, 6) : []

  const enviar = async () => {
    const t = texto.trim()
    if (!t || ocupado) return
    setOcupado('enviando'); setErro(null)
    if (modoNota) {
      const { error } = await supabase.rpc('crm_nota_interna', { p_conversa: conv.id, p_texto: t })
      if (error) setErro(error.message); else { setTexto(''); aoEnviar() }
    } else {
      try {
        await servidorWhats({ acao: 'enviar', conversa_id: conv.id, texto: t }); setTexto('')
        // quem responde passa a ser o responsável pela conversa
        if (conv.atendente_id !== usuarioId) await supabase.rpc('crm_assumir_conversa', { p_conversa: conv.id, p_atendente: usuarioId })
        aoEnviar()
      }
      catch (e) {
        // ficou gravada como "não enviada" (com o botão Tentar de novo): limpa a caixa para não mandar duas vezes
        if ((e as { registrada?: boolean }).registrada) { setTexto(''); aoEnviar() } else setErro((e as Error).message)
      }
    }
    setOcupado(null)
  }
  const sugerir = async () => {
    setOcupado('sugerindo'); setErro(null)
    try { setTexto(await sugerirResposta(conv.id)); setModoNota(false) } catch (e) { setErro((e as Error).message) }
    setOcupado(null)
  }

  return (
    <div className={`chat-escrever${modoNota ? ' modo-nota' : ''}`}>
      <div className="modo-escrever">
        <button className={!modoNota ? 'ativo' : ''} onClick={() => setModoNota(false)}>Mensagem</button>
        <button className={modoNota ? 'ativo' : ''} onClick={() => setModoNota(true)} title="Só a equipe vê; não vai para o WhatsApp">Nota interna</button>
        <span className="espaco" />
        {!modoNota && <button className="ce-prontas" onClick={() => setGaveta(true)}><Icone nome="raio" tam={14} /> Respostas prontas</button>}
      </div>
      {!modoNota && foraJanela && <div className="ce-janela pequeno"><Icone nome="alerta" tam={14} /> Faz mais de 24 h que a pessoa não escreve: pelo WhatsApp oficial, texto livre não sai. Use um modelo aprovado pela Meta ou espere ela responder.</div>}
      {sugestoes.length > 0 && <div className="sugestoes">{sugestoes.map((r) => <button key={r.id} onClick={() => setTexto(r.texto)}><b>/{r.atalho}</b> {r.texto.slice(0, 80)}</button>)}</div>}
      <div className="chat-caixa-texto">
        <textarea rows={2} value={texto} placeholder={modoNota ? 'Nota para a equipe (a pessoa não vê)…' : 'Escreva uma mensagem… (Enter envia, Shift+Enter pula linha)'}
          onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
        <div className="chat-barra">
          <span className="muted pequeno chat-dica">{modoNota ? 'Só a equipe vê' : 'Digite / para respostas prontas'}</span>
          {!modoNota && <button className="btn btn-mini ce-ia" onClick={sugerir} disabled={!!ocupado}><Icone nome="floco" tam={14} /> {ocupado === 'sugerindo' ? 'Escrevendo…' : 'Sugerir com IA'}</button>}
          <button className="btn btn-ouro" onClick={enviar} disabled={!!ocupado || !texto.trim()}>{ocupado === 'enviando' ? '…' : modoNota ? 'Anotar' : <><Icone nome="enviar" tam={15} /> Enviar</>}</button>
        </div>
      </div>
      <Erro msg={erro} />
      {!modoNota && canal && <div className="ce-rodape muted pequeno">Enviando pelo número {canal.nome}</div>}
      {gaveta && <RespostasProntas respostas={base.respostas} nome={conv.contato?.nome} atendente={usuarioNome}
        aoInserir={(t) => { setTexto(t); setGaveta(false) }} aoFechar={() => setGaveta(false)}
        aoGerenciar={base.souAdmin ? () => ir('/atendimento/config') : undefined} />}
    </div>
  )
}
