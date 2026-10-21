// Mídias de apoio (fotos, prints, clipes) que cobrem a fala no vídeo editado. Os arquivos ficam no computador de quem
// edita; na peça fica só a lista (nome, tipo e o que é), na ordem que o agente usa para apontar cada uma.
import type { Cobertura } from './linhaTempo'

// caminho = mídia do banco de imagens da marca (guardada no sistema; abre sozinha, sem escolher o arquivo de novo)
export type MidiaApoio = { nome: string; tamanho: number; tipo: 'imagem' | 'video'; descricao?: string; caminho?: string }
export type MidiaPronta = { tipo: 'imagem' | 'video'; el: HTMLImageElement | HTMLVideoElement; largura: number; altura: number }

export const tipoDoArquivo = (f: File): 'imagem' | 'video' | null => (f.type.startsWith('image/') ? 'imagem' : f.type.startsWith('video/') ? 'video' : null)
export const mesmaMidia = (m: MidiaApoio, f: File) => m.nome === f.name && m.tamanho === f.size

const esperar = (el: HTMLElement, evento: string) => new Promise<void>((ok, erro) => {
  el.addEventListener(evento, () => ok(), { once: true })
  el.addEventListener('error', () => erro(new Error('Não consegui abrir uma das mídias de apoio.')), { once: true })
})

async function abrir(f: File): Promise<MidiaPronta> {
  const url = URL.createObjectURL(f)
  if (tipoDoArquivo(f) === 'video') {
    const v = Object.assign(document.createElement('video'), { src: url, muted: true, playsInline: true, preload: 'auto', loop: true })
    await esperar(v, 'loadeddata')
    return { tipo: 'video', el: v, largura: v.videoWidth, altura: v.videoHeight }
  }
  const img = new Image()
  img.src = url
  await esperar(img, 'load')
  return { tipo: 'imagem', el: img, largura: img.naturalWidth, altura: img.naturalHeight }
}

// abre as mídias na ordem da lista; a que não tiver arquivo escolhido fica vazia (a cobertura dela é pulada)
export async function prepararMidias(arquivos: (File | undefined)[]) {
  return Promise.all(arquivos.map((f) => (f ? abrir(f) : Promise.resolve(undefined))))
}

export function liberarMidias(prontas: (MidiaPronta | undefined)[]) {
  for (const m of prontas) { if (!m) continue; if (m.tipo === 'video') (m.el as HTMLVideoElement).pause(); URL.revokeObjectURL(m.el.src) }
}

// clipe de apoio toca só enquanto cobre a fala, sempre do começo
export function sincronizarClipes(prontas: (MidiaPronta | undefined)[], cob: Cobertura | undefined) {
  prontas.forEach((m, n) => {
    if (m?.tipo !== 'video') return
    const v = m.el as HTMLVideoElement
    const ativo = cob?.midia === n
    if (ativo && v.paused) { v.currentTime = 0; v.play().catch(() => undefined) }
    if (!ativo && !v.paused) v.pause()
  })
}

// miniatura pequena (JPEG, 320 px) para o agente ver o que é cada mídia e escolher onde usar
export async function miniatura(f: File): Promise<string> {
  const m = await abrir(f)
  try {
    if (m.tipo === 'video') {
      const v = m.el as HTMLVideoElement
      v.currentTime = Math.min(1, (v.duration || 2) / 2)
      await esperar(v, 'seeked')
    }
    const escala = 320 / Math.max(m.largura, m.altura)
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(m.largura * escala), height: Math.round(m.altura * escala) })
    c.getContext('2d')!.drawImage(m.el, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.7).split(',')[1]
  } finally { liberarMidias([m]) }
}

export const duracaoDe = (m: MidiaPronta | undefined) => (m?.tipo === 'video' ? (m.el as HTMLVideoElement).duration : undefined)

// quadros do vídeo bruto (pequenos) para o agente ver o enquadramento: onde está o rosto, o cenário, se a pessoa se mexe
export async function quadrosDoBruto(f: File, n = 4): Promise<{ t: number; miniatura: string }[]> {
  const url = URL.createObjectURL(f)
  const v = Object.assign(document.createElement('video'), { src: url, muted: true, playsInline: true, preload: 'auto' })
  try {
    await esperar(v, 'loadeddata')
    const escala = 360 / Math.max(v.videoWidth, v.videoHeight)
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(v.videoWidth * escala), height: Math.round(v.videoHeight * escala) })
    const ctx = c.getContext('2d')!
    const lista: { t: number; miniatura: string }[] = []
    for (let k = 0; k < n; k++) {
      const t = Math.max(0.5, (v.duration * (k + 0.5)) / n)
      v.currentTime = t
      await esperar(v, 'seeked')
      ctx.drawImage(v, 0, 0, c.width, c.height)
      lista.push({ t: Math.round(t * 10) / 10, miniatura: c.toDataURL('image/jpeg', 0.7).split(',')[1] })
    }
    return lista
  } catch { return [] } finally { URL.revokeObjectURL(url); v.removeAttribute('src') }
}

// Vídeo HDR (iPhone e Android recentes gravam assim): desenhado no canvas sai lavado e estourado. Detecta pela curva
// de cor do primeiro quadro e devolve um filtro que traz o brilho e a saturação de volta.
export const CORRECAO_HDR = 'brightness(0.84) contrast(1.12) saturate(1.18)'
export async function ehHdr(f: File) {
  const url = URL.createObjectURL(f)
  const v = Object.assign(document.createElement('video'), { src: url, muted: true, playsInline: true, preload: 'auto' })
  try {
    await esperar(v, 'loadeddata')
    const Quadro = (window as unknown as { VideoFrame?: new (v: HTMLVideoElement) => { colorSpace: { transfer?: string | null }; close: () => void } }).VideoFrame
    if (!Quadro) return false
    const q = new Quadro(v)
    const curva = q.colorSpace.transfer
    q.close()
    return curva === 'hlg' || curva === 'pq'
  } catch { return false } finally { URL.revokeObjectURL(url); v.removeAttribute('src') }
}
