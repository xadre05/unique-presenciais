// Monta o vídeo final no navegador, sem servidor: toca o bruto trecho a trecho, desenha cada quadro num canvas (o
// mesmo desenho da prévia), grava o canvas + o áudio (fala e música de fundo) com o MediaRecorder e devolve o arquivo
// (MP4 quando o navegador permite). Leva o tempo do próprio vídeo; a aba precisa ficar aberta e visível enquanto monta.
import { ativo, type LinhaTempo } from './linhaTempo'
import { desenharQuadro } from './desenho'
import type { Visual } from './acabamento'
import { liberarMidias, prepararMidias, sincronizarClipes } from './midias'
import { mesaDeSom, TocadorEfeitos } from './efeitos'
import { Cenas } from './cenas'

// 4,5 Mbps: qualidade de Reels (o Instagram recomprime) e arquivo pequeno (~35 MB por minuto) para caber no envio
const TAMANHO = { vertical: [1080, 1920], horizontal: [1920, 1080] } as const
export type Musica = { arquivo: File; volume: number }

export function formatoGravacao() {
  const opcoes = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  return opcoes.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

const esperar = (v: HTMLVideoElement, evento: string) => new Promise<void>((ok) => v.addEventListener(evento, () => ok(), { once: true }))

// música em loop, baixinha, com 1,5 s de entrada e saída suaves
async function tocarMusica(audio: AudioContext, destino: AudioNode, m: Musica, duracao: number) {
  const buffer = await audio.decodeAudioData(await m.arquivo.arrayBuffer())
  const fonte = audio.createBufferSource()
  const volume = audio.createGain()
  fonte.buffer = buffer; fonte.loop = true
  const agora = audio.currentTime
  volume.gain.setValueAtTime(0, agora)
  volume.gain.linearRampToValueAtTime(m.volume, agora + 1.5)
  volume.gain.setValueAtTime(m.volume, agora + Math.max(1.5, duracao - 1.5))
  volume.gain.linearRampToValueAtTime(0, agora + duracao + 0.3)
  fonte.connect(volume).connect(destino)
  fonte.start()
  return fonte
}

export async function montarVideo(arquivo: File, linha: LinhaTempo, vertical: boolean, aoAvancar: (fracao: number) => void, apoio: (File | undefined)[] = [], musica?: Musica, cor?: string, codigos: (string | undefined)[] = [], visual?: Visual): Promise<Blob> {
  const v = document.createElement('video')
  v.src = URL.createObjectURL(arquivo); v.playsInline = true; v.preload = 'auto'
  await esperar(v, 'loadedmetadata')
  const midias = await prepararMidias(apoio)
  const [L, A] = TAMANHO[vertical ? 'vertical' : 'horizontal']
  const canvas = Object.assign(document.createElement('canvas'), { width: L, height: A })
  const ctx = canvas.getContext('2d')!
  const cenas = codigos.some(Boolean) ? new Cenas(codigos, L, A) : undefined
  await cenas?.pronto
  // áudio do bruto (e a música) vão para a gravação sem tocar na caixa de som
  const audio = new AudioContext()
  const gravacao = audio.createMediaStreamDestination()
  const saida = mesaDeSom(audio, gravacao)
  audio.createMediaElementSource(v).connect(saida)
  const fluxo = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...gravacao.stream.getAudioTracks()])
  const tipo = formatoGravacao()
  // o armazenamento aceita até 50 MB por arquivo: vídeo longo sai com menos bits por segundo para caber (com folga)
  const taxa = Math.max(1_200_000, Math.min(4_500_000, Math.floor((44 * 8 * 1024 * 1024) / Math.max(1, linha.duracao)) - 192_000))
  const gravador = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: taxa })
  const partes: Blob[] = []
  gravador.ondataavailable = (e) => { if (e.data.size) partes.push(e.data) }
  let feito = 0
  let fundo: AudioBufferSourceNode | undefined
  const efeitos = new TocadorEfeitos(audio, saida, linha.efeitos)
  // vídeo sem imagem (narração de vídeo sem gravar): o quadro segue o relógio da tela, não os quadros do vídeo
  const proximo = (f: () => void) => (v.videoWidth ? v.requestVideoFrameCallback(f) : requestAnimationFrame(f))
  const quadro = () => { sincronizarClipes(midias, ativo(linha.coberturas, v.currentTime)); desenharQuadro(ctx, v, linha, midias, cor, cenas, visual); efeitos.passo(v.currentTime) }
  try {
    for (const [k, trecho] of linha.trechos.entries()) {
      v.currentTime = trecho.ini
      await esperar(v, 'seeked')
      efeitos.posicionar(trecho.ini)
      quadro()
      if (k === 0) { gravador.start(1000); if (musica) fundo = await tocarMusica(audio, saida, musica, linha.duracao) } else gravador.resume()
      await v.play()
      await new Promise<void>((ok) => {
        let feitoTrecho = false
        const terminar = () => { if (feitoTrecho) return; feitoTrecho = true; v.pause(); ok() }
        // trecho que vai até o fim do bruto: o vídeo acaba e para de mandar quadros, então o fim vem pelo evento
        v.addEventListener('ended', terminar, { once: true })
        const passo = () => {
          if (feitoTrecho) return
          quadro()
          aoAvancar(Math.min(1, (feito + v.currentTime - trecho.ini) / linha.duracao))
          if (v.currentTime >= trecho.fim || v.ended) terminar(); else proximo(passo)
        }
        proximo(passo)
      })
      gravador.pause()
      feito += trecho.fim - trecho.ini
    }
    const fim = new Promise<void>((ok) => { gravador.onstop = () => ok() })
    gravador.stop()
    await fim
  } finally {
    fundo?.stop(); audio.close(); URL.revokeObjectURL(v.src); liberarMidias(midias); cenas?.fechar()
  }
  return new Blob(partes, { type: tipo.split(';')[0] })
}
