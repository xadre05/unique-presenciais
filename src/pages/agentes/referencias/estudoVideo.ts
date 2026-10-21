// Estudo de um vídeo baixado de um canal, todo no navegador (o vídeo não sobe): quadros nos momentos certos (mais
// juntos no gancho), quantos cortes por minuto (troca brusca de imagem entre amostras de meio em meio segundo) e a
// fala transcrita com o segundo de cada frase. Só os quadros pequenos e o texto vão para o sistema.
import { audioDoVideo } from '../marketing/edicao/audio'
import { transcrever } from '../marketing/edicao/dados'

export type Quadro = { arquivo: Blob; segundo: number }
export type EstudoVideo = { duracao: number; quadros: Quadro[]; cortes_por_min?: number; palavras_por_min?: number; fala?: string }

const LADO = 512
const AMOSTRA_CORTES = 0.5 // segundos entre amostras para contar cortes
const JANELA_CORTES = 120 // mede os cortes só nos primeiros 2 minutos (é onde o estilo aparece e é rápido)
const LIMIAR_CORTE = 25 // diferença média de brilho (0 a 255) que conta como troca de imagem (corte de cena, zoom, imagem por cima)
const FALA_MAX = 600 // transcreve até 10 minutos de fala
const AUDIO_MAX_VIDEO = 30 * 60 // vídeo acima de 30 minutos: sem transcrição (o navegador não aguenta abrir o áudio)

function esperar(v: HTMLVideoElement, evento: 'loadeddata' | 'seeked', acao?: () => void) {
  return new Promise<void>((ok, falha) => {
    const limite = setTimeout(() => falha(new Error('O vídeo demorou para abrir. Tente um MP4.')), 15000)
    v.addEventListener(evento, () => { clearTimeout(limite); ok() }, { once: true })
    v.addEventListener('error', () => { clearTimeout(limite); falha(new Error('Não consegui abrir este vídeo no navegador. Envie MP4.')) }, { once: true })
    acao?.()
  })
}

// reels: 3 quadros no gancho e o resto espalhado; vídeo longo: 5 nos primeiros 30 s e o resto espalhado
export function momentos(duracao: number) {
  const fim = duracao - 0.2
  const gancho = (duracao <= 180 ? [0.3, 1.2, 2.5] : [0.5, 3, 8, 15, 30]).filter((t) => t < fim)
  const inicio = duracao <= 180 ? 4 : 45
  const resto = 16 - gancho.length
  const espalhados = fim > inicio ? Array.from({ length: resto }, (_, i) => inicio + ((fim - inicio) * (i + 1)) / resto) : []
  return [...gancho, ...espalhados]
}

function brilho(ctx: CanvasRenderingContext2D, l: number, a: number) {
  const d = ctx.getImageData(0, 0, l, a).data
  const b = new Uint8Array(l * a)
  for (let i = 0; i < b.length; i++) b[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10
  return b
}

async function contarCortes(v: HTMLVideoElement) {
  const janela = Math.min(v.duration, JANELA_CORTES)
  if (janela < 5) return undefined
  const tela = Object.assign(document.createElement('canvas'), { width: 48, height: 48 })
  const ctx = tela.getContext('2d', { willReadFrequently: true })!
  let anterior: Uint8Array | null = null
  let cortes = 0
  for (let t = 0.1; t < janela; t += AMOSTRA_CORTES) {
    await esperar(v, 'seeked', () => { v.currentTime = t })
    ctx.drawImage(v, 0, 0, 48, 48)
    const atual = brilho(ctx, 48, 48)
    if (anterior) {
      let soma = 0
      for (let i = 0; i < atual.length; i++) soma += Math.abs(atual[i] - anterior[i])
      if (soma / atual.length > LIMIAR_CORTE) cortes++
    }
    anterior = atual
  }
  return (cortes / janela) * 60
}

async function tirarQuadros(v: HTMLVideoElement): Promise<Quadro[]> {
  const escala = Math.min(1, LADO / Math.max(v.videoWidth, v.videoHeight))
  const tela = Object.assign(document.createElement('canvas'), { width: Math.round(v.videoWidth * escala), height: Math.round(v.videoHeight * escala) })
  const ctx = tela.getContext('2d')!
  const quadros: Quadro[] = []
  for (const segundo of momentos(v.duration)) {
    await esperar(v, 'seeked', () => { v.currentTime = segundo })
    ctx.drawImage(v, 0, 0, tela.width, tela.height)
    const arquivo = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.78))
    if (arquivo) quadros.push({ arquivo, segundo })
  }
  return quadros
}

// a fala em linhas de ~12 palavras com o segundo em que cada uma começa; sem áudio ou sem crédito, segue sem fala
async function fala(arquivo: File, duracao: number) {
  if (duracao > AUDIO_MAX_VIDEO) return {}
  try {
    const { wav } = await audioDoVideo(arquivo, FALA_MAX)
    const { palavras } = await transcrever('', wav)
    if (!palavras.length) return {}
    const linhas: string[] = []
    for (let i = 0; i < palavras.length; i += 12) linhas.push(`[${palavras[i].i.toFixed(0)}s] ${palavras.slice(i, i + 12).map((p) => p.p).join(' ')}`)
    return { fala: linhas.join('\n').slice(0, 6000), palavras_por_min: palavras.length / (Math.min(duracao, FALA_MAX) / 60) }
  } catch { return {} }
}

export async function estudarArquivo(arquivo: File, etapa: (t: string) => void): Promise<EstudoVideo> {
  const url = URL.createObjectURL(arquivo)
  const v = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto' })
  try {
    await esperar(v, 'loadeddata', () => { v.src = url })
    if (!v.duration || !Number.isFinite(v.duration) || !v.videoWidth) throw new Error('Este vídeo não tem imagem que o navegador consiga ler.')
    etapa('tirando os quadros')
    const quadros = await tirarQuadros(v)
    etapa('medindo os cortes')
    const cortes_por_min = await contarCortes(v)
    const duracao = v.duration
    etapa('transcrevendo a fala')
    return { duracao, quadros, cortes_por_min, ...await fala(arquivo, duracao) }
  } finally { URL.revokeObjectURL(url); v.removeAttribute('src') }
}
