// Efeitos sonoros de edição, gerados no navegador (sem arquivo e sem licença): woosh no zoom e na troca de imagem,
// hit depois de revelar algo, riser antes do importante, clique quando algo aparece, pop de interface, obturador
// nos cortes rápidos, teclado quando aparece texto digitado e ding de confirmação. A prévia e a montagem tocam os
// mesmos sons nos mesmos momentos.
export type Som = 'woosh' | 'hit' | 'riser' | 'clique' | 'pop' | 'obturador' | 'teclado' | 'ding'
export const SONS: Som[] = ['woosh', 'hit', 'riser', 'clique', 'pop', 'obturador', 'teclado', 'ding']
// o riser cresce ATÉ o momento marcado; os outros começam nele
export const DURACAO_RISER = 1.4

function ruido(ctx: BaseAudioContext, segundos: number) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * segundos), ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1
  const f = ctx.createBufferSource(); f.buffer = b
  return f
}

function envelope(ctx: BaseAudioContext, t: number, pico: number, ataque: number, queda: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(pico, t + ataque)
  g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + queda)
  return g
}

function filtro(ctx: BaseAudioContext, tipo: BiquadFilterType, freq: number, q = 1) {
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q
  return f
}

function estalo(ctx: BaseAudioContext, saida: AudioNode, t: number, freq: number, volume: number, dur = 0.025) {
  const n = ruido(ctx, dur + 0.02), g = envelope(ctx, t, volume, 0.002, dur)
  n.connect(filtro(ctx, 'bandpass', freq, 2)).connect(g).connect(saida); n.start(t); n.stop(t + dur + 0.02)
}

function tom(ctx: BaseAudioContext, saida: AudioNode, t: number, de: number, ate: number, dur: number, volume: number, forma: OscillatorType = 'sine') {
  const o = ctx.createOscillator(), g = envelope(ctx, t, volume, 0.005, dur)
  o.type = forma; o.frequency.setValueAtTime(de, t); o.frequency.exponentialRampToValueAtTime(ate, t + dur)
  o.connect(g).connect(saida); o.start(t); o.stop(t + dur + 0.05)
}

const TOCAR: Record<Som, (ctx: BaseAudioContext, saida: AudioNode, t: number) => void> = {
  woosh: (ctx, saida, t) => {
    const n = ruido(ctx, 0.6), f = filtro(ctx, 'bandpass', 400, 1.2), g = envelope(ctx, t, 0.5, 0.22, 0.35)
    f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.3); f.frequency.exponentialRampToValueAtTime(800, t + 0.55)
    n.connect(f).connect(g).connect(saida); n.start(t); n.stop(t + 0.6)
  },
  hit: (ctx, saida, t) => {
    tom(ctx, saida, t, 120, 38, 0.55, 0.9)
    const n = ruido(ctx, 0.2), g = envelope(ctx, t, 0.35, 0.003, 0.15)
    n.connect(filtro(ctx, 'lowpass', 1800)).connect(g).connect(saida); n.start(t); n.stop(t + 0.2)
  },
  riser: (ctx, saida, t) => {
    const ini = t - DURACAO_RISER
    const n = ruido(ctx, DURACAO_RISER + 0.1), f = filtro(ctx, 'bandpass', 300, 3), g = ctx.createGain()
    f.frequency.setValueAtTime(300, ini); f.frequency.exponentialRampToValueAtTime(4000, t)
    g.gain.setValueAtTime(0.0001, ini); g.gain.exponentialRampToValueAtTime(0.35, t - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.05)
    n.connect(f).connect(g).connect(saida); n.start(ini); n.stop(t + 0.1)
    const o = ctx.createOscillator(), go = ctx.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, ini); o.frequency.exponentialRampToValueAtTime(660, t)
    go.gain.setValueAtTime(0.0001, ini); go.gain.exponentialRampToValueAtTime(0.07, t - 0.05); go.gain.linearRampToValueAtTime(0.0001, t + 0.05)
    o.connect(filtro(ctx, 'lowpass', 2000)).connect(go).connect(saida); o.start(ini); o.stop(t + 0.1)
  },
  clique: (ctx, saida, t) => estalo(ctx, saida, t, 3200, 0.6, 0.015),
  pop: (ctx, saida, t) => tom(ctx, saida, t, 520, 980, 0.09, 0.35),
  obturador: (ctx, saida, t) => { estalo(ctx, saida, t, 2400, 0.7, 0.03); estalo(ctx, saida, t + 0.07, 1800, 0.55, 0.04) },
  teclado: (ctx, saida, t) => { let s = t; for (let k = 0; k < 7; k++) { estalo(ctx, saida, s, 2600 + Math.random() * 1200, 0.35, 0.012); s += 0.07 + Math.random() * 0.06 } },
  ding: (ctx, saida, t) => { tom(ctx, saida, t, 1320, 1320, 0.6, 0.25); tom(ctx, saida, t, 1980, 1980, 0.45, 0.12) },
}

// t = momento do som no vídeo bruto; gatilho = quando começar a tocar (no riser, antes de t)
export type Efeito = { t: number; som: Som; gatilho: number }

// toca os efeitos que o vídeo atravessou entre um quadro e o outro. Pulo grande (a pessoa clicou na barra) não toca
export class TocadorEfeitos {
  private anterior = -1
  private saida: GainNode
  private ctx: AudioContext
  private efeitos: Efeito[]
  // 0,35: os efeitos ficam por baixo da voz (no teste de 21/10, a 0,6 o som saiu estourado)
  constructor(ctx: AudioContext, destino: AudioNode, efeitos: Efeito[], volume = 0.35) {
    this.ctx = ctx; this.efeitos = efeitos
    this.saida = ctx.createGain(); this.saida.gain.value = volume; this.saida.connect(destino)
  }
  passo(t: number) {
    const ant = this.anterior
    this.anterior = t
    if (ant < 0 || t <= ant || t - ant > 0.75) return
    for (const e of this.efeitos) {
      if (e.gatilho > ant && e.gatilho <= t) TOCAR[e.som](this.ctx, this.saida, this.ctx.currentTime + (e.som === 'riser' ? DURACAO_RISER : 0.01))
    }
  }
  reiniciar() { this.anterior = -1 }
  // depois de pular um corte: o que estiver logo no começo do trecho novo ainda toca
  posicionar(t: number) { this.anterior = t - 0.05 }
}

// Mesa de som do vídeo final: voz, música e efeitos passam por um limitador antes da gravação, para a soma nunca
// passar do teto (sem distorção nem estouro), com o volume geral um pouco abaixo do máximo.
export function mesaDeSom(ctx: AudioContext, destino: AudioNode) {
  const limitador = ctx.createDynamicsCompressor()
  limitador.threshold.value = -6; limitador.knee.value = 3; limitador.ratio.value = 20
  limitador.attack.value = 0.002; limitador.release.value = 0.12
  const geral = ctx.createGain(); geral.gain.value = 0.9
  geral.connect(limitador).connect(destino)
  return geral
}
