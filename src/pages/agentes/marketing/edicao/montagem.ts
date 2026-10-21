// Monta o vídeo final no navegador, sem servidor: toca o bruto trecho a trecho, desenha cada quadro num canvas com
// zoom, texto na tela e legenda, grava o canvas + o áudio com o MediaRecorder e devolve o arquivo (MP4 quando o
// navegador permite). Leva o tempo do próprio vídeo; a aba precisa ficar aberta e visível enquanto monta.
import { ativo, type GrupoLegenda, type LinhaTempo } from './linhaTempo'

const TAMANHO = { vertical: [1080, 1920], horizontal: [1920, 1080] } as const
const DOURADO = '#D4AF37'

export function formatoGravacao() {
  const opcoes = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  return opcoes.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

function desenharVideo(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, escala: number) {
  const { width: L, height: A } = ctx.canvas
  const base = Math.max(L / v.videoWidth, A / v.videoHeight) * escala
  const w = v.videoWidth * base, h = v.videoHeight * base
  ctx.drawImage(v, (L - w) / 2, (A - h) / 2, w, h)
}

function caixaArredondada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
}

function desenharTexto(ctx: CanvasRenderingContext2D, texto: string, posicao: 'topo' | 'meio') {
  const { width: L, height: A } = ctx.canvas
  ctx.font = `800 ${Math.round(L * 0.06)}px system-ui, sans-serif`
  const linhas = quebrar(ctx, texto.toUpperCase(), L * 0.8)
  const alt = L * 0.075, y0 = posicao === 'topo' ? A * 0.12 : A * 0.4
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + L * 0.06
  ctx.fillStyle = 'rgba(0,0,0,.6)'; caixaArredondada(ctx, (L - larg) / 2, y0, larg, alt * linhas.length + L * 0.03, 16)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  linhas.forEach((l, k) => ctx.fillText(l, L / 2, y0 + L * 0.015 + k * alt))
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  const linhas: string[] = []
  let atual = ''
  for (const p of texto.split(/\s+/)) {
    const tenta = atual ? `${atual} ${p}` : p
    if (ctx.measureText(tenta).width > max && atual) { linhas.push(atual); atual = p } else atual = tenta
  }
  if (atual) linhas.push(atual)
  return linhas
}

function desenharLegenda(ctx: CanvasRenderingContext2D, g: GrupoLegenda, t: number, caixaAlta: boolean, posicao: 'baixo' | 'meio') {
  const { width: L, height: A } = ctx.canvas
  ctx.font = `800 ${Math.round(L * 0.068)}px system-ui, sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3
  const palavras = g.palavras.map((w) => ({ ...w, texto: caixaAlta ? w.texto.toUpperCase() : w.texto }))
  const espaco = ctx.measureText(' ').width
  // quebra em linhas que cabem em 88% da largura
  const linhas: (typeof palavras)[] = [[]]
  let larg = 0
  for (const w of palavras) {
    const lw = ctx.measureText(w.texto).width
    if (larg + lw > L * 0.88 && linhas.at(-1)!.length) { linhas.push([]); larg = 0 }
    linhas.at(-1)!.push(w); larg += lw + espaco
  }
  const alt = L * 0.085, base = posicao === 'meio' ? A * 0.58 : A * 0.8
  linhas.forEach((linha, k) => {
    const total = linha.reduce((s, w) => s + ctx.measureText(w.texto).width + espaco, -espaco)
    let x = (L - total) / 2
    for (const w of linha) {
      ctx.fillStyle = t >= w.ini ? (w.destaque ? DOURADO : '#fff') : 'rgba(255,255,255,.55)'
      ctx.fillText(w.texto, x, base + k * alt)
      x += ctx.measureText(w.texto).width + espaco
    }
  })
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
}

function desenharQuadro(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, linha: LinhaTempo) {
  const t = v.currentTime
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  desenharVideo(ctx, v, ativo(linha.zooms, t)?.escala ?? 1)
  const texto = ativo(linha.textos, t)
  if (texto) desenharTexto(ctx, texto.texto, texto.posicao)
  const grupo = ativo(linha.legendas, t)
  if (grupo) desenharLegenda(ctx, grupo, t, linha.caixaAlta, linha.posicaoLegenda)
}

const esperar = (v: HTMLVideoElement, evento: string) => new Promise<void>((ok) => v.addEventListener(evento, () => ok(), { once: true }))

export async function montarVideo(arquivo: File, linha: LinhaTempo, vertical: boolean, aoAvancar: (fracao: number) => void): Promise<Blob> {
  const v = document.createElement('video')
  v.src = URL.createObjectURL(arquivo); v.playsInline = true; v.preload = 'auto'
  await esperar(v, 'loadedmetadata')
  const [L, A] = TAMANHO[vertical ? 'vertical' : 'horizontal']
  const canvas = Object.assign(document.createElement('canvas'), { width: L, height: A })
  const ctx = canvas.getContext('2d')!
  // áudio do bruto vai para a gravação sem tocar na caixa de som
  const audio = new AudioContext()
  const saida = audio.createMediaStreamDestination()
  audio.createMediaElementSource(v).connect(saida)
  const fluxo = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...saida.stream.getAudioTracks()])
  const tipo = formatoGravacao()
  const gravador = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: 8_000_000 })
  const partes: Blob[] = []
  gravador.ondataavailable = (e) => { if (e.data.size) partes.push(e.data) }
  let feito = 0
  try {
    for (const [k, trecho] of linha.trechos.entries()) {
      v.currentTime = trecho.ini
      await esperar(v, 'seeked')
      desenharQuadro(ctx, v, linha)
      if (k === 0) gravador.start(1000); else gravador.resume()
      await v.play()
      await new Promise<void>((ok) => {
        const passo = () => {
          desenharQuadro(ctx, v, linha)
          aoAvancar(Math.min(1, (feito + v.currentTime - trecho.ini) / linha.duracao))
          if (v.currentTime >= trecho.fim || v.ended) { v.pause(); ok() } else v.requestVideoFrameCallback(passo)
        }
        v.requestVideoFrameCallback(passo)
      })
      gravador.pause()
      feito += trecho.fim - trecho.ini
    }
    const fim = new Promise<void>((ok) => { gravador.onstop = () => ok() })
    gravador.stop()
    await fim
  } finally {
    audio.close(); URL.revokeObjectURL(v.src)
  }
  return new Blob(partes, { type: tipo.split(';')[0] })
}
