// CRM — NÚCLEO: foto, áudio, vídeo e documento dentro da conversa (link temporário do arquivo guardado no sistema),
// com a transcrição do áudio logo abaixo.
import { useEffect, useState } from 'react'
import { Icone } from '../../components/Icone'
import { servidorWhats, type Mensagem } from '../tipos'
import { linkDoArquivo } from './util'

export function MidiaDaMensagem({ m, aoMudar }: { m: Mensagem; aoMudar: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [transcrevendo, setTranscrevendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { if (m.midia_url) linkDoArquivo(m.midia_url).then(setUrl) }, [m.midia_url])
  if (!m.midia_url) return m.tipo !== 'texto' && m.direcao === 'entrada' && !m.erro ? <div className="msg-midia-espera muted pequeno">Baixando o arquivo…</div> : null
  const transcrever = async () => {
    setTranscrevendo(true); setErro(null)
    try { await servidorWhats({ acao: 'transcrever', mensagem_id: m.id }); aoMudar() } catch (e) { setErro((e as Error).message) }
    setTranscrevendo(false)
  }
  if (!url) return <div className="msg-midia-espera muted pequeno">Carregando…</div>
  return (
    <div className="msg-midia">
      {m.tipo === 'imagem' && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.midia_nome ?? 'foto'} loading="lazy" /></a>}
      {m.tipo === 'video' && <video src={url} controls preload="metadata" />}
      {m.tipo === 'audio' && <>
        <audio src={url} controls preload="metadata" />
        {m.transcricao
          ? <div className="msg-transcricao pequeno"><Icone nome="texto" tam={13} /> {m.transcricao}</div>
          : <button className="link pequeno" onClick={transcrever} disabled={transcrevendo}>{transcrevendo ? 'Transcrevendo…' : 'Transcrever áudio'}</button>}
      </>}
      {(m.tipo === 'documento' || m.tipo === 'figurinha') && <a className="msg-doc" href={url} target="_blank" rel="noreferrer"><Icone nome="arquivo" tam={18} /> {m.midia_nome ?? 'Abrir arquivo'}</a>}
      {erro && <div className="erro-txt pequeno">{erro}</div>}
    </div>
  )
}
