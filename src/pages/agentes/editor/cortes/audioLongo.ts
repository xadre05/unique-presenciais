// Transcrição de vídeo longo (aula, live, podcast de 1 a 3 horas) sem carregar o arquivo inteiro na memória: lê só a
// trilha de áudio do MP4/MOV aos pedaços (mp4box acha onde está cada amostra), decodifica no navegador (WebCodecs),
// junta em mono 16 kHz e manda para a transcrição em blocos de 10 minutos, um de cada vez. O vídeo não sobe.
import { createFile, MP4BoxBuffer, type ISOFile } from 'mp4box'
import { transcrever } from '../../marketing/edicao/dados'
import type { Palavra } from '../../marketing/edicao/linhaTempo'
import { audioDoVideo } from '../../marketing/edicao/audio'

const TAXA = 16000
const BLOCO_S = 600
const LEITURA = 8 * 1024 * 1024

type Faixa = { id: number; codec: string; taxa: number; canais: number; descricao?: Uint8Array; duracao: number }

// lê o começo/fim do arquivo até o mp4box achar o índice (moov), que pode estar no fim
async function abrirIndice(arquivo: File): Promise<{ mp4: ISOFile; faixa: Faixa }> {
  const mp4 = createFile()
  let pronto = false
  mp4.onReady = () => { pronto = true }
  let pos = 0
  while (!pronto && pos < arquivo.size) {
    const buf = MP4BoxBuffer.fromArrayBuffer(await arquivo.slice(pos, pos + LEITURA).arrayBuffer(), pos)
    const proximo = mp4.appendBuffer(buf, pos + LEITURA >= arquivo.size)
    pos = typeof proximo === 'number' && proximo > pos ? proximo : pos + LEITURA
  }
  const info = mp4.getInfo()
  const t = info?.audioTracks?.[0]
  if (!pronto || !t) throw new Error('sem trilha de áudio legível')
  const trak = mp4.getTrackById(t.id) as unknown as { mdia: { minf: { stbl: { stsd: { entries: { esds?: { esd: { findDescriptor: (n: number) => { findDescriptor: (n: number) => { data: Uint8Array } | undefined } | undefined } } }[] } } } } }
  const descricao = trak.mdia.minf.stbl.stsd.entries[0]?.esds?.esd.findDescriptor(4)?.findDescriptor(5)?.data
  return { mp4, faixa: { id: t.id, codec: t.codec, taxa: t.audio?.sample_rate ?? 48000, canais: t.audio?.channel_count ?? 2, descricao, duracao: t.duration / t.timescale } }
}

class Juntador {
  private bloco = new Int16Array(TAXA * BLOCO_S)
  private n = 0
  private acumulado = 0
  private soma = 0
  private passo: number
  private aoBlocoCheio: (amostras: Int16Array) => Promise<void>
  constructor(taxa: number, aoBlocoCheio: (amostras: Int16Array) => Promise<void>) { this.passo = taxa / TAXA; this.aoBlocoCheio = aoBlocoCheio }
  // média dos canais e redução para 16 kHz (média de cada janela)
  async adicionar(canais: Float32Array[], quadros: number) {
    for (let i = 0; i < quadros; i++) {
      let v = 0
      for (const c of canais) v += c[i]
      this.soma += v / canais.length; this.acumulado++
      if (this.acumulado >= this.passo) {
        const s = Math.max(-1, Math.min(1, this.soma / this.acumulado))
        this.bloco[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff
        this.soma = 0; this.acumulado -= this.passo
        if (this.n === this.bloco.length) { await this.aoBlocoCheio(this.bloco.slice()); this.n = 0 }
      }
    }
  }
  async fechar() { if (this.n) await this.aoBlocoCheio(this.bloco.slice(0, this.n)); this.n = 0 }
}

function paraWav(amostras: Int16Array) {
  const dados = new DataView(new ArrayBuffer(44 + amostras.length * 2))
  const texto = (p: number, s: string) => { for (let i = 0; i < s.length; i++) dados.setUint8(p + i, s.charCodeAt(i)) }
  texto(0, 'RIFF'); dados.setUint32(4, 36 + amostras.length * 2, true); texto(8, 'WAVE'); texto(12, 'fmt ')
  dados.setUint32(16, 16, true); dados.setUint16(20, 1, true); dados.setUint16(22, 1, true); dados.setUint32(24, TAXA, true)
  dados.setUint32(28, TAXA * 2, true); dados.setUint16(32, 2, true); dados.setUint16(34, 16, true); texto(36, 'data'); dados.setUint32(40, amostras.length * 2, true)
  new Int16Array(dados.buffer, 44).set(amostras)
  return new Blob([dados], { type: 'audio/wav' })
}

export type Progresso = (texto: string, fracao: number) => void

// lê o áudio inteiro aos pedaços e entrega blocos de 10 min (mono 16 kHz) em ordem; devolve a duração
export async function lerAudioLongo(arquivo: File, aoBloco: (amostras: Int16Array, total: number) => Promise<void>, aoProgresso: Progresso): Promise<number> {
  let indice: Awaited<ReturnType<typeof abrirIndice>> | null = null
  try { indice = await abrirIndice(arquivo) } catch { indice = null }
  if (!indice || typeof AudioDecoder === 'undefined') {
    // WebM ou navegador sem WebCodecs: só dá para arquivos que cabem na memória
    if (arquivo.size > 700 * 1024 * 1024) throw new Error('Este formato de vídeo longo não dá para ler aos pedaços. Exporte em MP4 (ou use o Chrome) e tente de novo.')
    aoProgresso('Lendo o áudio do vídeo…', 0.02)
    const { wav, duracao } = await audioDoVideo(arquivo)
    const pcm = new Int16Array(await wav.slice(44).arrayBuffer())
    for (let k = 0; k < pcm.length; k += TAXA * BLOCO_S) await aoBloco(pcm.slice(k, k + TAXA * BLOCO_S), duracao)
    return duracao
  }
  const { mp4, faixa } = indice
  const total = faixa.duracao
  const amostras = mp4.getTrackSamplesInfo(faixa.id)
  const juntador = new Juntador(faixa.taxa, (a) => aoBloco(a, total))
  let falha: Error | null = null
  const pendentes: AudioData[] = []
  const decoder = new AudioDecoder({ output: (d) => pendentes.push(d), error: (e) => { falha = new Error(`Não consegui decodificar o áudio: ${e.message}`) } })
  const codec = /^opus$/i.test(faixa.codec) ? 'opus' : faixa.codec
  const config = { codec, sampleRate: faixa.taxa, numberOfChannels: faixa.canais, ...(faixa.descricao && codec.startsWith('mp4a') ? { description: faixa.descricao } : {}) }
  if (!(await AudioDecoder.isConfigSupported(config)).supported) throw new Error(`O navegador não lê o áudio deste vídeo (${faixa.codec}). Use o Chrome ou exporte em MP4 com áudio AAC.`)
  decoder.configure(config)
  const esvaziar = async () => {
    while (pendentes.length) {
      const d = pendentes.shift()!
      const canais = Array.from({ length: d.numberOfChannels }, (_, c) => { const f = new Float32Array(d.numberOfFrames); d.copyTo(f, { planeIndex: c, format: 'f32-planar' }); return f })
      d.close()
      await juntador.adicionar(canais, canais[0]?.length ?? 0)
    }
  }
  // lê as amostras em grupos que ficam juntos no arquivo (uma leitura de até ~8 MB por vez)
  for (let k = 0; k < amostras.length && !falha;) {
    const ini = amostras[k].offset
    let fim = k
    while (fim + 1 < amostras.length && amostras[fim + 1].offset + amostras[fim + 1].size - ini <= LEITURA && amostras[fim + 1].offset >= amostras[fim].offset) fim++
    const bytes = new Uint8Array(await arquivo.slice(ini, amostras[fim].offset + amostras[fim].size).arrayBuffer())
    for (let j = k; j <= fim; j++) {
      const s = amostras[j]
      decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round((s.cts * 1e6) / s.timescale), duration: Math.round((s.duration * 1e6) / s.timescale), data: bytes.subarray(s.offset - ini, s.offset - ini + s.size) }))
    }
    k = fim + 1
    while (decoder.decodeQueueSize > 64) await new Promise((ok) => setTimeout(ok, 5))
    await esvaziar()
    const seg = amostras[fim].cts / amostras[fim].timescale
    aoProgresso(`Lendo o áudio… ${Math.round(seg / 60)} de ${Math.round(total / 60)} min`, Math.min(0.99, seg / total))
  }
  if (falha) throw falha
  await decoder.flush()
  await esvaziar()
  decoder.close()
  await juntador.fechar()
  return total
}

export async function transcreverLongo(arquivo: File, aoProgresso: Progresso, peca = ''): Promise<{ palavras: Palavra[]; duracao: number }> {
  const palavras: Palavra[] = []
  let inicioBloco = 0
  const duracao = await lerAudioLongo(arquivo, async (amostras, total) => {
    const ini = inicioBloco
    aoProgresso(`Transcrevendo ${Math.round(ini / 60)} a ${Math.round((ini + amostras.length / TAXA) / 60)} min de ${Math.round(total / 60)}…`, Math.min(0.99, (ini + amostras.length / TAXA) / total))
    const r = await transcrever(peca, paraWav(amostras))
    for (const w of r.palavras) palavras.push({ p: w.p, i: w.i + ini, f: w.f + ini })
    inicioBloco += amostras.length / TAXA
  }, aoProgresso)
  return { palavras, duracao }
}

// Acima disso o Chrome não carrega o arquivo inteiro na memória (vídeo .MOV do iPhone passa fácil de 2 GB):
// lê aos pedaços. Abaixo, o caminho de sempre, que serve para qualquer formato.
const GRANDE = 400 * 1024 * 1024
const semAviso: Progresso = () => {}

/** Fala de um vídeo de qualquer tamanho, com o tempo de cada palavra. */
export async function transcreverVideo(peca: string, arquivo: File, aoProgresso: Progresso = semAviso): Promise<{ palavras: Palavra[]; duracao: number }> {
  if (arquivo.size > GRANDE) return transcreverLongo(arquivo, aoProgresso, peca)
  try {
    const audio = await audioDoVideo(arquivo)
    const { palavras } = await transcrever(peca, audio.wav)
    return { palavras, duracao: audio.duracao }
  } catch (e) {
    // arquivo que o navegador não consegue carregar de uma vez: tenta aos pedaços
    if (e instanceof DOMException && e.name === 'NotReadableError') return transcreverLongo(arquivo, aoProgresso, peca)
    throw e
  }
}
