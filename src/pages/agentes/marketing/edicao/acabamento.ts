// Visual do vídeo além da edição em si (escolhido na etapa Estilo, igual na prévia e no arquivo final):
//  - enquadramento "cartao": a pessoa num cartão arredondado sobre um fundo da marca (cara de vídeo produzido);
//  - pip: quando uma cena animada ou mídia ocupa a tela, a pessoa continua num círculo no canto de baixo;
//  - acabamento: limpo, cinema (grão leve e vinheta), papel (fundo de papel e grão) ou arquivo (preto e branco com grão).
export type Visual = { enquadramento: 'cheio' | 'cartao'; acabamento: 'limpo' | 'cinema' | 'papel' | 'arquivo'; pip: boolean }
export const VISUAL_PADRAO: Visual = { enquadramento: 'cheio', acabamento: 'limpo', pip: true }

type Area = { x: number; y: number; w: number; h: number }
const suave = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3)

// ===== grão: três quadros de ruído prontos, trocados a 24 por segundo =====
let ruidos: HTMLCanvasElement[] | null = null
function quadrosDeRuido() {
  if (ruidos) return ruidos
  ruidos = [0, 1, 2].map((s) => {
    const c = document.createElement('canvas'); c.width = c.height = 256
    const g = c.getContext('2d')!, img = g.createImageData(256, 256)
    let x = 1234567 + s * 99991
    for (let i = 0; i < img.data.length; i += 4) {
      x = (x * 1103515245 + 12345) & 0x7fffffff
      const v = 128 + ((x >> 8) % 120) - 60
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255
    }
    g.putImageData(img, 0, 0)
    return c
  })
  return ruidos
}
function grao(ctx: CanvasRenderingContext2D, t: number, forca: number) {
  const r = quadrosDeRuido()[Math.floor(t * 24) % 3]
  const p = ctx.createPattern(r, 'repeat')
  if (!p) return
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = forca; ctx.fillStyle = p
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore()
}
function vinheta(ctx: CanvasRenderingContext2D, forca: number) {
  const { width: L, height: A } = ctx.canvas
  const g = ctx.createRadialGradient(L / 2, A / 2, Math.min(L, A) * 0.35, L / 2, A / 2, Math.hypot(L, A) * 0.62)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${forca})`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, L, A)
}

// filtro da imagem da pessoa (somado à correção de HDR)
export const filtroPessoa = (v: Visual, cor?: string) => [cor, v.acabamento === 'arquivo' ? 'grayscale(1) contrast(1.08)' : v.acabamento === 'cinema' ? 'saturate(0.92) contrast(1.05)' : ''].filter(Boolean).join(' ') || undefined

// fundo atrás do cartão da pessoa
export function fundoCartao(ctx: CanvasRenderingContext2D, v: Visual, t: number) {
  const { width: L, height: A } = ctx.canvas
  if (v.acabamento === 'papel') {
    ctx.fillStyle = '#EFE8DC'; ctx.fillRect(0, 0, L, A)
    ctx.strokeStyle = 'rgba(120,100,70,0.07)'; ctx.lineWidth = L * 0.002
    for (let k = 0; k < 14; k++) { const y = (A / 14) * k + Math.sin(k * 3.1) * A * 0.01; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(L * 0.3, y + A * 0.01, L * 0.7, y - A * 0.01, L, y + A * 0.004); ctx.stroke() }
    return
  }
  const escuro = v.acabamento === 'arquivo' ? '#151515' : '#0A0A0B'
  ctx.fillStyle = escuro; ctx.fillRect(0, 0, L, A)
  const gx = L * (0.5 + 0.3 * Math.sin(t * 0.25)), gy = A * (0.2 + 0.05 * Math.cos(t * 0.2))
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, L * 1.1)
  g.addColorStop(0, v.acabamento === 'arquivo' ? 'rgba(255,255,255,0.08)' : 'rgba(201,164,92,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, L, A)
}

// área do cartão da pessoa (vertical: deixa espaço embaixo para a legenda)
export function areaCartao(L: number, A: number): Area {
  return L < A ? { x: L * 0.06, y: A * 0.06, w: L * 0.88, h: A * 0.68 } : { x: L * 0.08, y: A * 0.08, w: L * 0.84, h: A * 0.72 }
}
export function molduraCartao(ctx: CanvasRenderingContext2D, a: Area, desenhar: () => void) {
  const raio = Math.min(a.w, a.h) * 0.06
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = a.w * 0.05; ctx.shadowOffsetY = a.w * 0.015
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.roundRect(a.x, a.y, a.w, a.h, raio); ctx.fill()
  ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.roundRect(a.x, a.y, a.w, a.h, raio); ctx.clip(); desenhar(); ctx.restore()
}

// a pessoa num círculo no canto de baixo, por cima da cena ou da mídia em tela cheia
export function pip(ctx: CanvasRenderingContext2D, desenharPessoa: (a: Area) => void, desde: number) {
  const { width: L, height: A } = ctx.canvas
  const e = suave(desde / 0.35)
  const d = Math.min(L, A) * 0.3 * (0.7 + 0.3 * e)
  const cx = L - Math.min(L, A) * 0.06 - d / 2, cy = A - Math.min(L, A) * 0.06 - d / 2 - (L < A ? A * 0.03 : 0)
  ctx.save()
  ctx.globalAlpha = e
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = d * 0.15
  ctx.fillStyle = '#C9A45C'; ctx.beginPath(); ctx.arc(cx, cy, d / 2 + d * 0.025, 0, Math.PI * 2); ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.clip()
  desenharPessoa({ x: cx - d / 2, y: cy - d / 2, w: d, h: d })
  ctx.restore()
}

// toque final por cima de tudo
export function finalizar(ctx: CanvasRenderingContext2D, v: Visual, t: number) {
  if (v.acabamento === 'cinema') { vinheta(ctx, 0.42); grao(ctx, t, 0.07) }
  else if (v.acabamento === 'arquivo') { vinheta(ctx, 0.55); grao(ctx, t, 0.14) }
  else if (v.acabamento === 'papel') grao(ctx, t, 0.06)
}
