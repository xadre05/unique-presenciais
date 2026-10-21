// Textos desenhados por cima do vídeo: legenda falada (a palavra da vez cresce um pouco e as palavras-chave ganham uma
// tarja dourada), palavra-chave em caixa (estilo documentário) e o texto grande com animação de entrada.
import type { Animacao, GrupoLegenda } from './linhaTempo'

const DOURADO = '#D4AF37'
const ENTRADA = 0.3 // segundos da animação de entrada
const suave = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3)

export function caixaArredondada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
}

export function quebrar(ctx: CanvasRenderingContext2D, texto: string, max: number) {
  const linhas: string[] = []
  let atual = ''
  for (const p of texto.split(/\s+/)) {
    const tenta = atual ? `${atual} ${p}` : p
    if (ctx.measureText(tenta).width > max && atual) { linhas.push(atual); atual = p } else atual = tenta
  }
  if (atual) linhas.push(atual)
  return linhas
}

// texto grande: pop (cresce e assenta), deslizar (entra da esquerda) ou digitar (letra por letra)
export function desenharTexto(ctx: CanvasRenderingContext2D, texto: string, posicao: 'topo' | 'meio', animacao: Animacao, desde: number) {
  const { width: L, height: A } = ctx.canvas
  const p = suave(desde / ENTRADA)
  const completo = texto.toUpperCase()
  const mostrado = animacao === 'digitar' ? completo.slice(0, Math.ceil(completo.length * Math.min(1, desde / Math.max(0.4, completo.length * 0.035)))) : completo
  ctx.font = `800 ${Math.round(L * 0.06)}px system-ui, sans-serif`
  const linhas = quebrar(ctx, completo, L * 0.8)
  const visiveis = quebrar(ctx, mostrado, L * 0.8)
  const alt = L * 0.075, y0 = posicao === 'topo' ? A * 0.12 : A * 0.4
  const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + L * 0.06
  const h = alt * linhas.length + L * 0.03
  ctx.save()
  ctx.translate(L / 2, y0 + h / 2)
  if (animacao === 'pop') { const e = p < 1 ? 0.6 + 0.5 * p - 0.1 * Math.sin(p * Math.PI) : 1; ctx.scale(e, e) }
  if (animacao === 'deslizar') ctx.translate(-(1 - p) * L, 0)
  ctx.globalAlpha = animacao === 'digitar' ? 1 : Math.min(1, p * 1.5)
  ctx.fillStyle = 'rgba(0,0,0,.62)'; caixaArredondada(ctx, -larg / 2, -h / 2, larg, h, 16)
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  visiveis.forEach((l, k) => ctx.fillText(l, 0, -h / 2 + L * 0.015 + k * alt))
  ctx.restore()
}

// palavra-chave em caixa escura, letra de máquina de escrever (estilo documentário), centralizada na altura y
export function desenharChave(ctx: CanvasRenderingContext2D, texto: string, y: number) {
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

// legenda falada: a palavra que está sendo dita cresce um pouco; palavra-chave ganha tarja dourada com letra escura
// Legenda com hierarquia: as palavras comuns menores; a palavra-chave (destaque) maior, sozinha na linha dela, numa
// tarja dourada, entrando com um "pop" quando é dita. Assim a frase tem um ponto forte, não fica tudo do mesmo tamanho.
const ESCALA_DESTAQUE = 1.5
export function desenharLegenda(ctx: CanvasRenderingContext2D, g: GrupoLegenda, t: number, caixaAlta: boolean, base: number) {
  const { width: L } = ctx.canvas
  const tam = L * 0.06
  ctx.font = `800 ${Math.round(tam)}px system-ui, sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  const palavras = g.palavras.map((w) => ({ ...w, texto: caixaAlta ? w.texto.toUpperCase() : w.texto }))
  const espaco = ctx.measureText(' ').width * 1.2
  const escala = (w: { destaque: boolean }) => (w.destaque ? ESCALA_DESTAQUE : 1)
  // largura ocupada: a palavra no tamanho dela, com folga para crescer ao ser dita e para a tarja
  const largura = (w: { texto: string; destaque: boolean }) => ctx.measureText(w.texto).width * escala(w) * 1.08 + (w.destaque ? tam * 0.6 : 0)
  // quebra: a palavra-chave fica sozinha na linha; as outras quebram pela largura
  const linhas: (typeof palavras)[] = [[]]
  let larg = 0
  for (const w of palavras) {
    const lw = largura(w)
    const atual = linhas.at(-1)!
    if (atual.length && (w.destaque || atual.some((x) => x.destaque) || larg + lw > L * 0.86)) { linhas.push([]); larg = 0 }
    linhas.at(-1)!.push(w); larg += lw + espaco
  }
  let y = base
  linhas.forEach((linha) => {
    const grande = linha.some((w) => w.destaque)
    if (grande) y += tam * 0.25
    const total = linha.reduce((s, w) => s + largura(w) + espaco, -espaco)
    let x = (L - total) / 2
    for (const w of linha) {
      const lw = ctx.measureText(w.texto).width
      const falando = t >= w.ini && t < w.fim + 0.05
      const dita = t >= w.ini
      // pop da palavra-chave: entra 25% maior e assenta em 0,15 s
      const pop = w.destaque && dita ? 1 + 0.25 * Math.max(0, 1 - (t - w.ini) / 0.15) : 1
      const e = escala(w) * pop * (falando && !w.destaque ? 1.1 : 1)
      ctx.save()
      ctx.translate(x + largura(w) / 2, y - tam * 0.35)
      ctx.scale(e, e)
      if (w.destaque && dita) { ctx.fillStyle = DOURADO; caixaArredondada(ctx, -lw / 2 - tam * 0.2, -tam * 0.64, lw + tam * 0.4, tam * 1.22, tam * 0.24) }
      ctx.shadowColor = w.destaque && dita ? 'transparent' : 'rgba(0,0,0,.85)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3
      ctx.fillStyle = w.destaque && dita ? '#111' : dita ? '#fff' : 'rgba(255,255,255,.55)'
      if (w.destaque && !dita) ctx.globalAlpha = 0 // a palavra-chave só aparece quando é dita
      ctx.fillText(w.texto, -lw / 2, tam * 0.35)
      ctx.restore()
      x += largura(w) + espaco
    }
    y += grande ? tam * 1.75 : tam * 1.3
  })
}
