// Janela "Agendar no Instagram": as artes da peça em ordem (marcar quais entram), o vídeo do Reels, a legenda pronta
// para revisar (legenda + chamada + hashtags) e quando publicar (agora ou dia e hora). Ao confirmar, o sistema guarda o
// agendamento e publica sozinho no horário; dá para cancelar até lá.
import { useState } from 'react'
import { Modal } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { EMPRESA } from '../useMarketing'
import { Miniatura, pastaDa } from './arquivos'
import type { Rascunho } from './modelo'
import { NOME_FORMATO_PUB, agendar, comoJpeg, enviarVideo, type FormatoPublicacao, type MidiaPublicacao } from '../../instagram/publicacoes'

type Props = { peca: Peca; r: Rascunho; formato: FormatoPublicacao; usuario: string | null; aoFechar: () => void; aoAgendar: () => void }
const LIMITE = 2200
const agora = () => new Date()
// dia e hora sugeridos: o dia da peça e o horário dela (ou a próxima hora cheia)
function sugestao(peca: Peca) {
  const agora = new Date(Date.now() - 3 * 3600000)
  const dia = peca.dia && peca.dia >= agora.toISOString().slice(0, 10) ? peca.dia : agora.toISOString().slice(0, 10)
  const hora = /^\d{2}:\d{2}$/.test(peca.conteudo.horario ?? '') ? peca.conteudo.horario! : `${String(Math.min(23, agora.getUTCHours() + 1)).padStart(2, '0')}:00`
  return `${dia}T${hora}`
}

export function AgendarPublicacao({ peca, r, formato, usuario, aoFechar, aoAgendar }: Props) {
  const artes = r.artes.map((a) => a.arquivo).filter(Boolean) as string[]
  const [marcadas, setMarcadas] = useState<string[]>(formato === 'imagem' || formato === 'stories' ? artes.slice(0, 1) : formato === 'reels' ? artes.slice(0, 1) : artes)
  const [video, setVideo] = useState<File | null>(null)
  const [legenda, setLegenda] = useState(() => [r.legenda, r.cta, r.hashtags].map((x) => x.trim()).filter(Boolean).join('\n\n'))
  const [modo, setModo] = useState<'agora' | 'depois'>('depois')
  const [quando, setQuando] = useState(() => sugestao(peca))
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const umaSo = formato === 'imagem' || formato === 'stories' || formato === 'reels'
  const alternar = (c: string) => setMarcadas((l) => (umaSo ? (l.includes(c) ? [] : [c]) : l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))
  const hashtags = (legenda.match(/#[\p{L}\d_]+/gu) ?? []).length
  const precisaVideo = formato === 'reels'
  const faltando = precisaVideo ? (!video ? 'Envie o vídeo do Reels.' : null)
    : formato === 'carrossel' ? (marcadas.length < 2 ? 'Marque pelo menos 2 lâminas.' : marcadas.length > 10 ? 'O carrossel aceita até 10 lâminas.' : null)
      : formato === 'stories' ? (!marcadas.length && !video ? 'Marque a arte ou envie um vídeo.' : null) : (!marcadas.length ? 'Marque a arte do post.' : null)
  const dataHora = new Date(`${quando}:00-03:00`)
  const [aberturaMs] = useState(() => agora().getTime())
  const passado = modo === 'depois' && dataHora.getTime() < aberturaMs - 60000

  const confirmar = async () => {
    setErro(null)
    try {
      const midias: MidiaPublicacao[] = []
      // a ordem marcada é a ordem da peça
      for (const [i, c] of artes.filter((a) => marcadas.includes(a)).entries()) {
        setEtapa(`Preparando a arte ${i + 1}…`)
        midias.push({ bucket: 'arquivos', caminho: await comoJpeg(c, pastaDa(peca.id)), tipo: 'imagem' })
      }
      if (video) { setEtapa('Enviando o vídeo (pode levar alguns minutos)…'); midias.push({ bucket: 'videos', caminho: await enviarVideo(EMPRESA, peca.id, video), tipo: 'video' }) }
      setEtapa(modo === 'agora' ? 'Publicando no Instagram…' : 'Agendando…')
      await agendar(EMPRESA, { pecaId: peca.id, formato, midias, legenda: formato === 'stories' ? '' : legenda, quando: modo === 'agora' ? agora() : dataHora, agora: modo === 'agora' })
      aoAgendar()
    } catch (e) { setErro((e as Error).message); setEtapa(null) }
  }

  return (
    <Modal titulo={`Agendar no Instagram · ${NOME_FORMATO_PUB[formato]}`} aberto onFechar={etapa ? () => undefined : aoFechar} largo>
      <div className="ag-corpo">
        <section>
          <h5 className="reu-subtitulo">{formato === 'carrossel' ? 'Lâminas (na ordem da peça)' : formato === 'reels' ? 'Capa do Reels (opcional)' : 'Arte'}</h5>
          {artes.length ? <ul className="ag-artes">{artes.map((c, i) => (
            <li key={c} className={marcadas.includes(c) ? 'marcada' : ''}><button type="button" onClick={() => alternar(c)} aria-pressed={marcadas.includes(c)}>
              <Miniatura caminho={c} proporcao={r.visual.proporcao} /><span className="ag-num">{marcadas.includes(c) ? <Icone nome="check" tam={13} /> : i + 1}</span></button></li>))}</ul>
            : <p className="muted pequeno">A peça ainda não tem arte enviada.</p>}
          {(formato === 'reels' || formato === 'stories') && (
            <label className="ag-video"><span className="muted pequeno">{formato === 'reels' ? 'Vídeo do Reels (MP4 ou MOV, vertical 9:16, até 300 MB)' : 'Ou um vídeo para o story'}</span>
              <input type="file" accept="video/mp4,video/quicktime" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
              {video && <small className="muted">{video.name} · {(video.size / 1048576).toFixed(0)} MB</small>}</label>)}
        </section>
        {formato !== 'stories' && <section>
          <h5 className="reu-subtitulo">Legenda <small className={`muted${legenda.length > LIMITE ? ' erro-txt' : ''}`}>{legenda.length}/{LIMITE}{hashtags > 30 ? ' · máximo de 30 hashtags' : ''}</small></h5>
          <textarea className="ag-legenda" rows={9} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
        </section>}
        <section>
          <h5 className="reu-subtitulo">Quando</h5>
          <div className="ag-quando">
            <label><input type="radio" checked={modo === 'depois'} onChange={() => setModo('depois')} /> Agendar para</label>
            <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} disabled={modo !== 'depois'} aria-label="Dia e hora (Brasília)" />
            <label><input type="radio" checked={modo === 'agora'} onChange={() => setModo('agora')} /> Publicar agora</label>
          </div>
          {passado && <p className="erro-txt pequeno">Esse horário já passou.</p>}
        </section>
        <p className="nota pequeno">{modo === 'agora' ? 'O post sai agora' : `O post sai sozinho em ${dataHora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`} no Instagram {usuario ? `@${usuario}` : 'da empresa'}, com as mídias e a legenda acima.{modo === 'depois' ? ' Dá para cancelar até lá.' : ''}</p>
        {erro && <p className="erro-txt pequeno">{erro}</p>}
        <div className="ia-linha ag-acoes">
          {faltando && <span className="muted pequeno">{faltando}</span>}
          <button type="button" className="btn" disabled={!!etapa} onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn btn-ouro" disabled={!!etapa || !!faltando || passado || legenda.length > LIMITE} onClick={confirmar}>
            <Icone nome="enviar" tam={15} /> {etapa ?? (modo === 'agora' ? 'Publicar agora' : 'Agendar')}</button>
        </div>
      </div>
    </Modal>
  )
}
