// CRM — NÚCLEO: caixa de escrever da conversa — mensagem ou nota interna (com @menção), respostas prontas, sugestão da
// IA, emoji, arquivo, modelo aprovado da Meta e envio agendado.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { servidorWhats, type BaseCRM, type Canal, type Conversa } from '../tipos'
import { RespostasProntas } from './RespostasProntas'
import { EscolherModelo, type EnvioModelo } from './Modelos'
import { BotaoAgendar, BotaoAnexo, BotaoEmoji } from './Ferramentas'
import { sugerirResposta, subirArquivo } from './util'

type Props = { conv: Conversa; base: BaseCRM; canal: Canal | undefined; usuarioId: string; usuarioNome: string | null; foraJanela: boolean; aoEnviar: () => void; aoDigitar?: () => void }

// @Nome na nota interna: quem foi mencionado recebe uma tarefa ("fulano mencionou você")
function mencionados(texto: string, base: BaseCRM) {
  return base.equipe.filter((m) => m.ativo && m.nome && texto.toLowerCase().includes(`@${m.nome.split(' ')[0].toLowerCase()}`))
}

export function Escrever({ conv, base, canal, usuarioId, usuarioNome, foraJanela, aoEnviar, aoDigitar }: Props) {
  const ir = useNavigate()
  const [modoNota, setModoNota] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState<'enviando' | 'sugerindo' | 'subindo' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gaveta, setGaveta] = useState(false)
  const [modelo, setModelo] = useState(false)
  const oficial = canal?.tipo === 'whatsapp_oficial'
  const modelos = base.modelos.filter((m) => m.canal_id === conv.canal_id)
  const sugestoes = !modoNota && texto.startsWith('/') ? base.respostas.filter((r) => r.atalho.toLowerCase().startsWith(texto.slice(1).toLowerCase())).slice(0, 6) : []
  const arroba = modoNota ? texto.match(/@(\p{L}*)$/u) : null
  const pessoas = arroba ? base.equipe.filter((m) => m.ativo && m.nome && m.nome.toLowerCase().startsWith(arroba[1].toLowerCase())).slice(0, 6) : []

  // envia pelo servidor; quem responde passa a ser o responsável pela conversa
  const mandar = async (corpo: Record<string, unknown>) => {
    try {
      await servidorWhats({ acao: 'enviar', conversa_id: conv.id, ...corpo })
      if (conv.atendente_id !== usuarioId) await supabase.rpc('crm_assumir_conversa', { p_conversa: conv.id, p_atendente: usuarioId })
      return true
    } catch (e) {
      // ficou gravada como "não enviada" (com o botão Tentar de novo): não manda duas vezes
      if ((e as { registrada?: boolean }).registrada) return true
      setErro((e as Error).message); return false
    }
  }
  const anotar = async (t: string) => {
    const { error } = await supabase.rpc('crm_nota_interna', { p_conversa: conv.id, p_texto: t })
    if (error) { setErro(error.message); return false }
    const quem = mencionados(t, base).filter((m) => m.usuario_id !== usuarioId)
    if (quem.length) await supabase.from('crm_tarefas').insert(quem.map((m) => ({ empresa_id: conv.empresa_id, contato_id: conv.contato_id, responsavel_id: m.usuario_id, tipo: 'outro', origem: 'mencao',
      titulo: `${usuarioNome ?? 'Alguém da equipe'} mencionou você numa conversa`, nota: t.slice(0, 500) })))
    return true
  }
  const enviar = async () => {
    const t = texto.trim()
    if (!t || ocupado) return
    setOcupado('enviando'); setErro(null)
    const ok = modoNota ? await anotar(t) : await mandar({ texto: t })
    if (ok) { setTexto(''); aoEnviar() }
    setOcupado(null)
  }
  const enviarArquivo = async (f: File) => {
    setOcupado('subindo'); setErro(null)
    try { const midia = await subirArquivo(conv.empresa_id, f); if (await mandar({ midia: { ...midia, legenda: texto.trim() || undefined } })) { setTexto(''); aoEnviar() } }
    catch (e) { setErro((e as Error).message) }
    setOcupado(null)
  }
  const enviarModelo = async (m: EnvioModelo) => {
    setOcupado('enviando'); setErro(null)
    if (await mandar({ modelo: m })) { setModelo(false); aoEnviar() }
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
        <button className={modoNota ? 'ativo' : ''} onClick={() => setModoNota(true)} title="Só a equipe vê; não vai para o WhatsApp. Use @nome para chamar alguém">Nota interna</button>
        <span className="espaco" />
        {!modoNota && oficial && <button className={`ce-prontas${modelo ? ' on' : ''}`} onClick={() => setModelo(!modelo)}><Icone nome="documento" tam={14} /> Modelo</button>}
        {!modoNota && <button className="ce-prontas" onClick={() => setGaveta(true)}><Icone nome="raio" tam={14} /> Respostas prontas</button>}
      </div>
      {!modoNota && foraJanela && !modelo && <div className="ce-janela pequeno"><Icone nome="alerta" tam={14} /> Faz mais de 24 h que a pessoa não escreve: pelo WhatsApp oficial, texto livre não sai. <button className="link pequeno" onClick={() => setModelo(true)}>Enviar um modelo aprovado</button></div>}
      {!modoNota && modelo && <EscolherModelo modelos={modelos} nomeContato={conv.contato?.nome} enviando={ocupado === 'enviando'} aoEnviar={enviarModelo} aoCancelar={() => setModelo(false)} />}
      {sugestoes.length > 0 && <div className="sugestoes">{sugestoes.map((r) => <button key={r.id} onClick={() => setTexto(r.texto)}><b>/{r.atalho}</b> {r.texto.slice(0, 80)}</button>)}</div>}
      {pessoas.length > 0 && <div className="sugestoes">{pessoas.map((m) => <button key={m.usuario_id} onClick={() => setTexto(texto.replace(/@(\p{L}*)$/u, `@${m.nome!.split(' ')[0]} `))}><b>@{m.nome}</b></button>)}</div>}
      <div className="chat-caixa-texto">
        <textarea rows={2} value={texto} placeholder={modoNota ? 'Nota para a equipe (a pessoa não vê). Use @nome para chamar alguém…' : 'Escreva uma mensagem… (Enter envia, Shift+Enter pula linha)'}
          onChange={(e) => { setTexto(e.target.value); aoDigitar?.() }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
        <div className="chat-barra">
          {!modoNota && <>
            <BotaoAnexo desativado={!!ocupado} aoEscolher={enviarArquivo} />
            <BotaoEmoji aoEscolher={(e) => setTexto(texto + e)} />
            <BotaoAgendar conv={conv} texto={texto} aoAgendar={() => { setTexto(''); aoEnviar() }} />
          </>}
          <span className="muted pequeno chat-dica">{ocupado === 'subindo' ? 'Enviando arquivo…' : modoNota ? 'Só a equipe vê' : 'Digite / para respostas prontas'}</span>
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
