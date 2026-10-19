// Vídeo de referência (reels baixado): o navegador tira alguns quadros em sequência (o primeiro logo no início, para
// pegar o gancho) e só os quadros sobem. O vídeo inteiro não vai para o armazenamento nem para a IA.
const QUADROS = 10
const LADO = 768
const DURACAO_MAXIMA = 180

function esperar(v: HTMLVideoElement, evento: 'loadeddata' | 'seeked', acao?: () => void) {
  return new Promise<void>((ok, falha) => {
    const limite = setTimeout(() => falha(new Error('O vídeo demorou para abrir. Tente um MP4 ou mande prints das cenas.')), 15000)
    v.addEventListener(evento, () => { clearTimeout(limite); ok() }, { once: true })
    v.addEventListener('error', () => { clearTimeout(limite); falha(new Error('Não consegui abrir este vídeo no navegador. Envie MP4, ou mande prints das cenas principais.')) }, { once: true })
    acao?.()
  })
}

function momentos(duracao: number) {
  const fim = Math.min(duracao, DURACAO_MAXIMA) - 0.1
  return Array.from({ length: QUADROS }, (_, i) => (i === 0 ? Math.min(0.3, fim) : (fim * i) / (QUADROS - 1)))
}

export async function tirarQuadros(video: File): Promise<File[]> {
  const url = URL.createObjectURL(video)
  const v = document.createElement('video')
  v.muted = true; v.playsInline = true; v.preload = 'auto'
  try {
    await esperar(v, 'loadeddata', () => { v.src = url })
    if (!v.duration || !Number.isFinite(v.duration) || !v.videoWidth) throw new Error('Este vídeo não tem imagem que o navegador consiga ler. Mande prints das cenas.')
    const escala = Math.min(1, LADO / Math.max(v.videoWidth, v.videoHeight))
    const tela = document.createElement('canvas')
    tela.width = Math.round(v.videoWidth * escala); tela.height = Math.round(v.videoHeight * escala)
    const ctx = tela.getContext('2d')!
    const quadros: File[] = []
    for (const [i, t] of momentos(v.duration).entries()) {
      await esperar(v, 'seeked', () => { v.currentTime = t })
      ctx.drawImage(v, 0, 0, tela.width, tela.height)
      const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.8))
      if (blob) quadros.push(new File([blob], `quadro-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }))
    }
    return quadros
  } finally { URL.revokeObjectURL(url); v.removeAttribute('src') }
}
