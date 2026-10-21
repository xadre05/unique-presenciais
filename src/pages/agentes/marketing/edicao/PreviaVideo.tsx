// Prévia da edição na hora, sem montar o arquivo: toca o vídeo bruto pulando o que foi cortado, com legenda,
// texto na tela e zoom por cima. É a mesma linha do tempo que a montagem usa.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { ativo, proximoTempo, tempoBruto, tempoFinal, type LinhaTempo } from './linhaTempo'
import { Legenda, TextoNaTela } from './Sobreposicoes'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function PreviaVideo({ url, linha, vertical }: { url: string; linha: LinhaTempo; vertical: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const [t, setT] = useState(0)
  const [tocando, setTocando] = useState(false)

  useEffect(() => {
    let quadro = 0
    const passo = () => {
      const v = video.current
      if (v && !v.paused) {
        const alvo = proximoTempo(v.currentTime, linha.trechos)
        if (alvo === null) { v.pause(); v.currentTime = linha.trechos[0]?.ini ?? 0 }
        else if (alvo - v.currentTime > 0.03) v.currentTime = alvo
        setT(v.currentTime)
      }
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [linha])

  useEffect(() => { if (video.current) { video.current.currentTime = linha.trechos[0]?.ini ?? 0; setT(video.current.currentTime) } }, [url, linha])

  const alternar = () => { const v = video.current; if (!v) return; if (v.paused) v.play(); else v.pause() }
  const irPara = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = video.current, caixa = e.currentTarget.getBoundingClientRect()
    if (!v) return
    v.currentTime = tempoBruto(((e.clientX - caixa.left) / caixa.width) * linha.duracao, linha.trechos); setT(v.currentTime)
  }
  const zoom = ativo(linha.zooms, t)
  const grupo = ativo(linha.legendas, t)
  const texto = ativo(linha.textos, t)
  const final = tempoFinal(t, linha.trechos)

  return (
    <div className="ev-previa">
      <div className={`ev-quadro${vertical ? ' vertical' : ''}`} onClick={alternar}>
        <video ref={video} src={url} playsInline onPlay={() => setTocando(true)} onPause={() => setTocando(false)}
          style={{ transform: `scale(${zoom?.escala ?? 1})` }} />
        {texto && <TextoNaTela texto={texto.texto} posicao={texto.posicao} />}
        {grupo && <Legenda grupo={grupo} t={t} caixaAlta={linha.caixaAlta} posicao={linha.posicaoLegenda} />}
        {!tocando && <span className="ev-play"><Icone nome="video" tam={28} /></span>}
      </div>
      <div className="ev-controles">
        <button type="button" className="btn btn-mini" onClick={alternar}>{tocando ? 'Pausar' : 'Tocar'}</button>
        <div className="ev-barra" onClick={irPara} role="slider" aria-valuenow={final} aria-valuemax={linha.duracao} aria-label="Posição no vídeo editado">
          <span style={{ width: `${linha.duracao ? (final / linha.duracao) * 100 : 0}%` }} />
        </div>
        <span className="muted pequeno">{mmss(final)} / {mmss(linha.duracao)}</span>
      </div>
    </div>
  )
}
