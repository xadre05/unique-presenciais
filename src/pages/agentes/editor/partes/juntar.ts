// Junta várias partes gravadas (ex.: a Patrícia gravou em 3 pedaços) num vídeo só, SEM refazer a imagem: os quadros e
// o som de cada parte são copiados como estão, um depois do outro (rápido, sem perder qualidade). Só funciona quando
// as partes foram gravadas do mesmo jeito (mesmo celular e mesma configuração), o que é o normal.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, EncodedAudioPacketSource, EncodedPacket, EncodedPacketSink, EncodedVideoPacketSource, Input, Mp4OutputFormat, Output } from 'mediabunny'

type Lida = Awaited<ReturnType<typeof abrir>>

async function abrir(f: File) {
  const entrada = new Input({ source: new BlobSource(f), formats: ALL_FORMATS })
  const video = await entrada.getPrimaryVideoTrack()
  const audio = await entrada.getPrimaryAudioTrack()
  if (!video) throw new Error(`"${f.name}" não tem imagem de vídeo.`)
  return {
    nome: f.name, video, audio, duracao: await entrada.computeDuration(),
    cfgVideo: await video.getDecoderConfig(), cfgAudio: audio ? await audio.getDecoderConfig() : null,
  }
}

const bytes = (d?: AllowSharedBufferSource | null) => {
  if (!d) return new Uint8Array()
  if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength)
  return new Uint8Array(d as ArrayBuffer)
}
const iguais = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

// as partes precisam ter o mesmo formato de imagem e de som para emendar sem refazer
function conferir(partes: Lida[]) {
  const [p] = partes
  for (const q of partes.slice(1)) {
    const mesmo = q.cfgVideo?.codec === p.cfgVideo?.codec && q.video.codedWidth === p.video.codedWidth && q.video.codedHeight === p.video.codedHeight
      && iguais(bytes(q.cfgVideo?.description), bytes(p.cfgVideo?.description))
      && (q.cfgAudio?.codec ?? '') === (p.cfgAudio?.codec ?? '') && (q.cfgAudio?.sampleRate ?? 0) === (p.cfgAudio?.sampleRate ?? 0)
    if (!mesmo) throw new Error(`"${q.nome}" foi gravado num formato diferente de "${p.nome}" (outra resolução ou configuração da câmera). Grave as partes no mesmo celular e com a mesma configuração.`)
  }
}

// partes gravadas de jeitos diferentes: refaz cada uma no mesmo formato (mais lento, mas emenda qualquer coisa)
async function normalizar(f: File, largura: number, altura: number, aoProgresso?: (fracao: number) => void) {
  const destino = new BufferTarget()
  const conversao = await Conversion.init({
    input: new Input({ source: new BlobSource(f), formats: ALL_FORMATS }),
    output: new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: destino }),
    video: { codec: 'avc', width: largura, height: altura, fit: 'contain', frameRate: 30, bitrate: 8_000_000, forceTranscode: true },
    audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2, bitrate: 192_000, forceTranscode: true },
  })
  if (aoProgresso) conversao.onProgress = (p) => aoProgresso(p)
  await conversao.execute()
  return new File([destino.buffer!], f.name.replace(/\.\w+$/, '') + '-ajustado.mp4', { type: 'video/mp4' })
}

export async function juntarVideos(arquivos: File[], nome: string, aoProgresso?: (fracao: number, texto?: string) => void): Promise<{ arquivo: File; duracoes: number[] }> {
  let partes = await Promise.all(arquivos.map(abrir))
  try { conferir(partes) } catch {
    // formatos diferentes: deixa todas iguais à primeira (largura e altura de exibição) e tenta de novo
    const p0 = partes[0].video, girado = p0.rotation === 90 || p0.rotation === 270
    const L = girado ? p0.codedHeight : p0.codedWidth, A = girado ? p0.codedWidth : p0.codedHeight
    const ajustados: File[] = []
    for (const [k, f] of arquivos.entries()) ajustados.push(await normalizar(f, L, A, (fr) => aoProgresso?.((k + fr) / arquivos.length * 0.8, `Ajustando a parte ${k + 1} de ${arquivos.length} para o mesmo formato…`)))
    partes = await Promise.all(ajustados.map(abrir))
    conferir(partes)
  }
  const [p] = partes
  const destino = new BufferTarget()
  const saida = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: destino })
  const fonteVideo = new EncodedVideoPacketSource(p.video.codec!)
  saida.addVideoTrack(fonteVideo, { rotation: p.video.rotation })
  const fonteAudio = p.audio && p.audio.codec ? new EncodedAudioPacketSource(p.audio.codec) : null
  if (fonteAudio) saida.addAudioTrack(fonteAudio)
  await saida.start()
  const total = partes.reduce((s, x) => s + x.duracao, 0)
  let base = 0, primeiroV = true, primeiroA = true
  for (const parte of partes) {
    for await (const pk of new EncodedPacketSink(parte.video).packets()) {
      await fonteVideo.add(new EncodedPacket(pk.data, pk.type, Math.max(0, pk.timestamp) + base, pk.duration), primeiroV ? { decoderConfig: p.cfgVideo! } : undefined)
      primeiroV = false
      aoProgresso?.(Math.min(0.99, (base + pk.timestamp) / total), 'Juntando as partes…')
    }
    if (fonteAudio && parte.audio) {
      for await (const pk of new EncodedPacketSink(parte.audio).packets()) {
        if (pk.timestamp < 0) continue // amostras de "aquecimento" do áudio no começo de cada parte
        await fonteAudio.add(new EncodedPacket(pk.data, pk.type, pk.timestamp + base, pk.duration), primeiroA ? { decoderConfig: p.cfgAudio! } : undefined)
        primeiroA = false
      }
    }
    base += parte.duracao
  }
  await saida.finalize()
  aoProgresso?.(1)
  return { arquivo: new File([destino.buffer!], nome, { type: 'video/mp4' }), duracoes: partes.map((x) => x.duracao) }
}
