// Tira só o áudio do vídeo bruto, no navegador, para transcrever: mono, 16 kHz, WAV (≈ 2 MB por minuto).
// O vídeo em si nunca sai do computador de quem edita.
const TAXA = 16000

export async function audioDoVideo(arquivo: File): Promise<{ wav: Blob; duracao: number }> {
  const bruto = await arquivo.arrayBuffer()
  const ctx = new AudioContext()
  let decodificado: AudioBuffer
  try {
    decodificado = await ctx.decodeAudioData(bruto)
  } catch {
    throw new Error('Não consegui ler o áudio deste vídeo. Grave em MP4 (no iPhone: Ajustes → Câmera → Formatos → Mais Compatível) ou converta o arquivo e tente de novo.')
  } finally {
    ctx.close()
  }
  const quadros = Math.ceil(decodificado.duration * TAXA)
  const off = new OfflineAudioContext(1, quadros, TAXA)
  const fonte = off.createBufferSource()
  fonte.buffer = decodificado
  fonte.connect(off.destination)
  fonte.start()
  const mono = await off.startRendering()
  return { wav: paraWav(mono.getChannelData(0)), duracao: decodificado.duration }
}

function paraWav(amostras: Float32Array) {
  const dados = new DataView(new ArrayBuffer(44 + amostras.length * 2))
  const texto = (pos: number, s: string) => { for (let i = 0; i < s.length; i++) dados.setUint8(pos + i, s.charCodeAt(i)) }
  texto(0, 'RIFF'); dados.setUint32(4, 36 + amostras.length * 2, true); texto(8, 'WAVE')
  texto(12, 'fmt '); dados.setUint32(16, 16, true); dados.setUint16(20, 1, true); dados.setUint16(22, 1, true)
  dados.setUint32(24, TAXA, true); dados.setUint32(28, TAXA * 2, true); dados.setUint16(32, 2, true); dados.setUint16(34, 16, true)
  texto(36, 'data'); dados.setUint32(40, amostras.length * 2, true)
  for (let i = 0; i < amostras.length; i++) {
    const v = Math.max(-1, Math.min(1, amostras[i]))
    dados.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return new Blob([dados], { type: 'audio/wav' })
}
