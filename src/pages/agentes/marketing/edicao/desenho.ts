// Desenho de um quadro do vídeo editado num canvas. A prévia e a montagem usam exatamente esta função, então o que
// aparece na prévia é o que sai no arquivo: a pessoa (com zoom centrado no rosto), a mídia de apoio (tela cheia, tela
// dividida ou cartão por cima da pessoa, com entrada animada), o texto grande e a legenda (legenda.ts).
import { ativo, type Cobertura, type LinhaTempo, type Rosto } from './linhaTempo'
import type { MidiaPronta } from './midias'
import { caixaArredondada, desenharChave, desenharLegenda, desenharTexto } from './legenda'

type Area = { x: number; y: number; w: number; h: number }
const ENTRADA = 0.3
const suave = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3)
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// encaixa a imagem cobrindo a área (corta as sobras) e põe o ponto "foco" (0 a 1 da imagem) no "alvo" (0 a 1 da área)
function cobrir(ctx: CanvasRenderingContext2D, fonte: CanvasImageSource, fw: number, fh: number, a: Area, escala: number, foco = { x: 0.5, y: 0.5 }, alvo = { x: 0.5, y: 0.5 }) {
  if (!fw || !fh) return
  const base = Math.max(a.w / fw, a.h / fh) * escala
  const w = fw * base, h = fh * base
  const x = limitar(a.x + alvo.x * a.w - foco.x * w, a.x + a.w - w, a.x)
  const y = limitar(a.y + alvo.y * a.h - foco.y * h, a.y + a.h - h, a.y)
  ctx.save()
  ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); ctx.clip()
  ctx.drawImage(fonte, x, y, w, h)
  ctx.restore()
}

// a pessoa: o rosto fica um pouco acima do meio da área (ou no terço de cima, na metade de baixo da tela dividida)
const pessoa = (ctx: CanvasRenderingContext2D, v: HTMLVideoElement, a: Area, zoom: number, rosto: Rosto, alvoY = 0.4) =>
  cobrir(ctx, v, v.videoWidth, v.videoHeight, a, zoom, rosto, { x: 0.5, y: alvoY })

function movimento(c: Cobertura, t: number) {
  const p = Math.min(1, Math.max(0, (t - c.ini) / Math.max(0.1, c.fim - c.ini)))
  const escala = c.movimento === 'aproximar' ? 1 + 0.12 * p : c.movimento === 'afastar' ? 1.12 - 0.12 * p : c.movimento === 'deslizar' ? 1.12 : 1
  return { escala, desloc: c.movimento === 'deslizar' ? (0.5 - p) * 0.08 : 0 }
}

function desenharMidia(ctx: CanvasRenderingContext2D, m: MidiaPronta, c: Cobertura, t: number, a: Area) {
  const { escala, desloc } = movimento(c, t)
  const e = suave((t - c.ini) / ENTRADA)
  ctx.save()
  ctx.globalAlpha = e
  cobrir(ctx, m.el, m.largura, m.altura, a, escala * (1.06 - 0.06 * e), { x: 0.5 - desloc, y: 0.5 })
  ctx.restore()
}

// print ou imagem como cartão branco por cima da pessoa (escurecida), entrando de baixo com leve giro
function desenharCartao(ctx: CanvasRenderingContext2D, m: MidiaPronta, c: Cobertura, t: number) {
  const { width: L, height: A } = ctx.canvas
  const e = suave((t - c.ini) / 0.35)
  ctx.fillStyle = `rgba(0,0,0,${0.45 * e})`; ctx.fillRect(0, 0, L, A)
  const maxW = L * 0.84, maxH = A * 0.56
  const r = Math.min(maxW / m.largura, maxH / m.altura)
  const w = m.largura * r, h = m.altura * r, borda = L * 0.014
  ctx.save()
  ctx.translate(L / 2, A * 0.42 + (1 - e) * A * 0.35)
  ctx.rotate((-3 + 2 * e) * Math.PI / 180)
  ctx.globalAlpha = Math.min(1, e * 1.4)
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12
  ctx.fillStyle = '#fff'; caixaArredondada(ctx, -w / 2 - borda, -h / 2 - borda, w + borda * 2, h + borda * 2, 18)
  ctx.shadowColor = 'transparent'
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.clip()
  ctx.drawImage(m.el, -w / 2, -h / 2, w, h)
  ctx.restore()
  ctx.restore()
}

export function desenharQuadro(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, linha: LinhaTempo, midias: (MidiaPronta | undefined)[]) {
  const t = v.currentTime
  const { width: L, height: A } = ctx.canvas
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, L, A)
  const zoom = ativo(linha.zooms, t)?.escala ?? 1
  const cob = ativo(linha.coberturas, t)
  const m = cob ? midias[cob.midia] : undefined
  const tela = { x: 0, y: 0, w: L, h: A }
  const layout = m && cob ? cob.layout : null
  if (layout === 'cheia') desenharMidia(ctx, m!, cob!, t, tela)
  else if (layout === 'dividida') {
    desenharMidia(ctx, m!, cob!, t, { x: 0, y: 0, w: L, h: A / 2 })
    pessoa(ctx, v, { x: 0, y: A / 2, w: L, h: A / 2 }, zoom, linha.rosto, 0.38)
  } else {
    pessoa(ctx, v, tela, zoom, linha.rosto)
    if (layout === 'cartao') desenharCartao(ctx, m!, cob!, t)
  }
  const texto = ativo(linha.textos, t)
  if (texto) desenharTexto(ctx, texto.texto, texto.posicao, texto.animacao, t - texto.ini)
  const dividida = layout === 'dividida'
  const baseLegenda = dividida ? A * 0.5 + L * 0.03 : layout === 'cartao' ? A * 0.86 : linha.posicaoLegenda === 'meio' ? A * 0.58 : A * 0.8
  if (linha.estiloLegenda === 'chave') {
    const chave = ativo(linha.chaves, t)
    if (chave) desenharChave(ctx, chave.texto, dividida ? A * 0.5 : layout === 'cartao' ? A * 0.84 : A * 0.72)
  } else if (linha.estiloLegenda === 'palavras') {
    const grupo = ativo(linha.legendas, t)
    if (grupo) desenharLegenda(ctx, grupo, t, linha.caixaAlta, baseLegenda)
  }
}
