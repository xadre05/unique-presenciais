// Prévia da edição na hora, sem montar o arquivo: toca o vídeo bruto pulando o que foi cortado e desenha cada quadro
// com o MESMO desenho da montagem (mídias de apoio, tela dividida, texto e legenda). A música toca junto, baixinha.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { ativo, proximoTempo, tempoBruto, tempoFinal, type LinhaTempo } from './linhaTempo'
import { desenharQuadro } from './desenho'
import { liberarMidias, prepararMidias, sincronizarClipes, type MidiaPronta } from './midias'
import type { Musica } from './montagem'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const TAM_PREVIA = { vertical: [540, 960], horizontal: [960, 540] } as const

function usarMidias(apoio: (File | undefined)[]) {
  const [prontas, setProntas] = useState<(MidiaPronta | undefined)[]>([])
  useEffect(() => {
    let vivo = true, abertas: (MidiaPronta | undefined)[] = []
    prepararMidias(apoio).then((m) => { abertas = m; if (vivo) setProntas(m); else liberarMidias(m) }).catch(() => setProntas([]))
    return () => { vivo = false; liberarMidias(abertas) }
  }, [apoio])
  return prontas
}

function usarMusica(musica?: Musica) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!musica) { setUrl(null); return }
    const u = URL.createObjectURL(musica.arquivo); setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [musica?.arquivo])
  return url
}

export function PreviaVideo({ url, linha, vertical, apoio = [], musica }: { url: string; linha: LinhaTempo; vertical: boolean; apoio?: (File | undefined)[]; musica?: Musica }) {
  const video = useRef<HTMLVideoElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const som = useRef<HTMLAudioElement>(null)
  const [t, setT] = useState(0)
  const [tocando, setTocando] = useState(false)
  const midias = usarMidias(apoio)
  const urlMusica = usarMusica(musica)

  useEffect(() => {
    let quadro = 0
    const passo = () => {
      const v = video.current, ctx = tela.current?.getContext('2d')
      if (v && !v.paused) {
        const alvo = proximoTempo(v.currentTime, linha.trechos)
        if (alvo === null) { v.pause(); v.currentTime = linha.trechos[0]?.ini ?? 0 }
        else if (alvo - v.currentTime > 0.03) v.currentTime = alvo
        setT(v.currentTime)
      }
      if (v && ctx && v.readyState >= 2) { sincronizarClipes(midias, v.paused ? undefined : ativo(linha.coberturas, v.currentTime)); desenharQuadro(ctx, v, linha, midias) }
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [linha, midias])

  useEffect(() => { if (video.current) { video.current.currentTime = linha.trechos[0]?.ini ?? 0; setT(video.current.currentTime) } }, [url, linha])
  useEffect(() => { if (som.current) som.current.volume = Math.min(1, musica?.volume ?? 0.12) }, [musica?.volume, urlMusica])

  const alternar = () => {
    const v = video.current; if (!v) return
    if (v.paused) { v.play(); som.current?.play().catch(() => undefined) } else { v.pause(); som.current?.pause() }
  }
  const irPara = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = video.current, caixa = e.currentTarget.getBoundingClientRect()
    if (!v) return
    v.currentTime = tempoBruto(((e.clientX - caixa.left) / caixa.width) * linha.duracao, linha.trechos); setT(v.currentTime)
  }
  const final = tempoFinal(t, linha.trechos)
  const [L, A] = TAM_PREVIA[vertical ? 'vertical' : 'horizontal']

  return (
    <div className="ev-previa">
      <div className={`ev-quadro${vertical ? ' vertical' : ''}`} onClick={alternar}>
        <canvas ref={tela} width={L} height={A} />
        <video ref={video} src={url} playsInline className="ev-fonte" onPlay={() => setTocando(true)} onPause={() => setTocando(false)} />
        {urlMusica && <audio ref={som} src={urlMusica} loop />}
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
