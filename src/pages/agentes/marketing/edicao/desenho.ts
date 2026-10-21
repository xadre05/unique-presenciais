// Desenho de um quadro do vídeo editado num canvas. A prévia e a montagem usam exatamente esta função, então o que
// aparece na prévia é o que sai no arquivo: vídeo da pessoa (com zoom), mídia de apoio (tela cheia ou dividida, com
// movimento), texto grande na tela e a legenda (palavra por palavra ou palavra-chave em caixa).
import { ativo, type Cobertura, type GrupoLegenda, type LinhaTempo } from './linhaTempo'
import type { MidiaPronta } from './midias'

const DOURADO = '#D4AF37'
type Area = { x: number; y: number; w: number; h: number }

// encaixa a imagem cobrindo a área (corta as sobras); foco um pouco acima do centro, onde fica o rosto
function cobrir(ctx: CanvasRenderingContext2D, fonte: CanvasImageSource, fw: number, fh: number, a: Area, escala: number, deslocX = 0, focoY = 0.5) {
  if (!fw || !fh) return
  const base = Math.max(a.w / fw, a.h / fh) * escala
  const w = fw * base, h = fh * base
  ctx.save()
  ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); ctx.clip()
  ctx.drawImage(fonte, a.x + (a.w - w) / 2 + deslocX * a.w, a.y + (a.h - h) * focoY, w, h)
  ctx.restore()
}

function desenharMidia(ctx: CanvasRenderingContext2D, m: MidiaPronta, c: Cobertura, t: number, a: Area) {
  const p = Math.min(1, Math.max(0, (t - c.ini) / Math.max(0.1, c.fim - c.ini)))
  const escala = c.movimento === 'aproximar' ? 1 + 0.12 * p : c.movimento === 'afastar' ? 1.12 - 0.12 * p : c.movimento === 'deslizar' ? 1.12 : 1
  const desloc = c.movimento === 'deslizar' ? (0.5 - p) * 0.08 : 0
  cobrir(ctx, m.el, m.largura, m.altura, a, escala, desloc)
}

function caixaArredondada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
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

// palavra-chave em caixa escura, letra de máquina de escrever (estilo documentário), centralizada na altura y
function desenharChave(ctx: CanvasRenderingContext2D, texto: string, y: number) {
  const { width: L } = ctx.canvas
  ctx.font = `700 ${Math.round(L * 0.05)}px ui-monospace, "Courier New", monospace`
  const linhas = quebrar(ctx, texto.toUpperCase(), L * 0.82)
  const alt = L * 0.064, pad = L * 0.025
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + pad * 2
  const h = alt * linhas.length + pad
  ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect((L - larg) / 2, y - h / 2, larg, h)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  linhas.forEach((l, k) => ctx.fillText(l, L / 2, y - h / 2 + pad / 2 + alt * (k + 0.5)))
}

function desenharLegenda(ctx: CanvasRenderingContext2D, g: GrupoLegenda, t: number, caixaAlta: boolean, base: number) {
  const { width: L } = ctx.canvas
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
  const alt = L * 0.085
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

export function desenharQuadro(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, linha: LinhaTempo, midias: (MidiaPronta | undefined)[]) {
  const t = v.currentTime
  const { width: L, height: A } = ctx.canvas
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, L, A)
  const zoom = ativo(linha.zooms, t)?.escala ?? 1
  const cob = ativo(linha.coberturas, t)
  const m = cob ? midias[cob.midia] : undefined
  const tela = { x: 0, y: 0, w: L, h: A }
  // tela dividida: mídia em cima, a pessoa embaixo; a legenda fica na emenda
  const dividida = !!(m && cob && cob.layout === 'dividida')
  if (m && cob && !dividida) desenharMidia(ctx, m, cob, t, tela)
  else if (m && cob) {
    desenharMidia(ctx, m, cob, t, { x: 0, y: 0, w: L, h: A / 2 })
    cobrir(ctx, v, v.videoWidth, v.videoHeight, { x: 0, y: A / 2, w: L, h: A / 2 }, zoom, 0, 0.3)
  } else cobrir(ctx, v, v.videoWidth, v.videoHeight, tela, zoom)
  const texto = ativo(linha.textos, t)
  if (texto) desenharTexto(ctx, texto.texto, texto.posicao)
  const baseLegenda = dividida ? A * 0.5 : linha.posicaoLegenda === 'meio' ? A * 0.58 : A * 0.8
  if (linha.estiloLegenda === 'chave') {
    const chave = ativo(linha.chaves, t)
    if (chave) desenharChave(ctx, chave.texto, dividida ? A * 0.5 : A * 0.72)
  } else if (linha.estiloLegenda === 'palavras') {
    const grupo = ativo(linha.legendas, t)
    if (grupo) desenharLegenda(ctx, grupo, t, linha.caixaAlta, dividida ? baseLegenda + L * 0.03 : baseLegenda)
  }
}
