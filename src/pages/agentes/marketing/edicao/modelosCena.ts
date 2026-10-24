// Biblioteca de cenas animadas prontas no estilo Unique (preto, dourado, branco quente). Em vez de o agente escrever
// cada animação do zero (qualidade varia e custa), ele escolhe um MODELO e manda só os textos ("dados"); o código abaixo
// desenha. Mesmo contrato das cenas escritas pelo agente: corpo de função (ctx, t, d, L, A, m), puro e sem rede.
// Ideia tirada das referências de 23/10 (moldura, capítulos, cartões de prova, recibo da oferta).
import type { Layout } from './linhaTempo'

export type ModeloCena = 'lista_check' | 'numero' | 'recibo' | 'capitulo' | 'comparacao' | 'passos'

// o que o agente precisa saber de cada modelo (vai no pedido da edição)
export const MODELOS_CENA: Record<ModeloCena, { quando: string; dados: string }> = {
  lista_check: { quando: 'o que a pessoa leva, benefícios, itens incluídos (2 a 5 itens)', dados: '{ "titulo": "O que você leva", "itens": ["2 anos de plataforma", "Presencial de 3 dias"] }' },
  numero: { quando: 'um número ou valor dito em voz alta que merece destaque', dados: '{ "acima": "turmas com", "numero": "12", "legenda": "lugares" }' },
  recibo: { quando: 'a oferta: o que está incluído e o preço falado, como um recibo', dados: '{ "titulo": "Black Friday", "linhas": [{ "rotulo": "Plataforma", "valor": "2 anos" }], "total": { "rotulo": "À vista", "valor": "R$ 4.997" } }' },
  capitulo: { quando: 'a troca de assunto em vídeo longo (um por beat), para quem assiste saber onde está', dados: '{ "numero": "02", "titulo": "O presencial" }' },
  comparacao: { quando: 'antes × depois, sem × com, curso comum × o nosso', dados: '{ "esquerda": { "titulo": "Sem orientação", "itens": ["Assiste e não aplica"] }, "direita": { "titulo": "Com a Unique", "itens": ["Aplica com segurança"] } }' },
  passos: { quando: 'passo a passo ou etapas em ordem (2 a 5)', dados: '{ "titulo": "Como funciona", "passos": ["Escolhe o curso", "Escolhe a data", "Faz o presencial"] }' },
}

// funções e medidas comuns a todos os modelos (área útil, cartão, quebra de linha, entradas escalonadas)
const BASE = `
const cart = __CARTAO__;
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }
function quebra(txt, larg) { const ps = String(txt).split(' '); const ls = []; let l = ''; for (const p of ps) { const tt = l ? l + ' ' + p : p; if (ctx.measureText(tt).width > larg && l) { ls.push(l); l = p } else l = tt } if (l) ls.push(l); return ls }
const ent = (atraso, dur) => m.suave((t - atraso) / (dur || 0.45));
const fim = Math.max(0, Math.min(1, (d - t) / 0.3));
let X, Y, W, H;
if (cart) {
  const p = m.suave(t / 0.35);
  X = L * 0.04; Y = A * 0.04; W = L * 0.92; H = A * 0.92;
  ctx.globalAlpha = fim * p; rr(X, Y + (1 - p) * A * 0.02, W, H, Math.min(L, A) * 0.035); ctx.fillStyle = m.painel; ctx.fill();
  ctx.strokeStyle = 'rgba(201,164,92,0.55)'; ctx.lineWidth = Math.max(2, L * 0.002); ctx.stroke();
  X += W * 0.07; Y += H * 0.1; W *= 0.86; H *= 0.8;
} else {
  ctx.fillStyle = m.fundo; ctx.fillRect(0, 0, L, A);
  const z = 1 + 0.04 * Math.min(1, t / d); ctx.translate(L / 2, A / 2); ctx.scale(z, z); ctx.translate(-L / 2, -A / 2);
  X = L * 0.08; Y = A * 0.1; W = L * (L > A ? 0.6 : 0.84); H = A * (L > A ? 0.8 : 0.58); // canto de baixo à direita fica livre (a pessoa)
}
ctx.globalAlpha = fim;
const f = Math.min(W / 9, H / 6);
// bloco de conteúdo centralizado na área útil (altura total conhecida)
const meio = (alto) => Y + Math.max(0, (H - alto) / 2);
ctx.textBaseline = 'top';
`

const CORPO: Record<ModeloCena, string> = {
  lista_check: `
const itens = (D.itens || []).slice(0, 5);
const passo = Math.min(f * 1.5, (H - (D.titulo ? f * 1.25 : 0)) / Math.max(1, itens.length));
let y = meio((D.titulo ? f * 1.25 : 0) + itens.length * passo);
if (D.titulo) { const p = ent(0.05); ctx.globalAlpha = fim * p; ctx.fillStyle = m.ouro; ctx.font = m.fonte(f * 0.62, 800); ctx.fillText(String(D.titulo).toUpperCase(), X, y + (1 - p) * f * 0.4); y += f * 1.25 }
itens.forEach((it, k) => {
  const p = ent(0.35 + k * 0.32); if (p <= 0) return;
  ctx.globalAlpha = fim * p;
  const cx = X + f * 0.42 + (1 - p) * -f * 0.6, cy = y + k * passo + f * 0.45;
  ctx.beginPath(); ctx.arc(cx, cy, f * 0.36, 0, Math.PI * 2); ctx.fillStyle = m.ouro; ctx.fill();
  const q = m.suave((t - 0.5 - k * 0.32) / 0.3);
  ctx.strokeStyle = m.fundo; ctx.lineWidth = f * 0.09; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(cx - f * 0.16, cy); ctx.lineTo(cx - f * 0.16 + f * 0.11 * Math.min(1, q * 2), cy + f * 0.12 * Math.min(1, q * 2));
  if (q > 0.5) ctx.lineTo(cx - f * 0.05 + f * 0.24 * (q - 0.5) * 2, cy + f * 0.12 - f * 0.26 * (q - 0.5) * 2);
  ctx.stroke();
  ctx.fillStyle = m.texto; ctx.font = m.fonte(f * 0.72, 700);
  const longo = ctx.measureText(it).width > W - f * 1.3;
  ctx.font = m.fonte(f * (longo ? 0.52 : 0.72), 700);
  const linhas = quebra(it, W - f * 1.3), x = X + f * 1.05 + (1 - p) * f * 0.5;
  if (linhas.length > 1) { ctx.fillText(linhas[0], x, y + k * passo - f * 0.12); ctx.fillText(linhas[1] + (linhas.length > 2 ? '…' : ''), x, y + k * passo + f * 0.5) }
  else ctx.fillText(linhas[0], x, y + k * passo + f * 0.08);
});`,

  numero: `
const cx = X + W / 2, cy = Y + H / 2;
const fn = Math.min(f * 3.2, H * 0.42);
ctx.textAlign = 'center';
if (D.acima) { const p = ent(0.05); ctx.globalAlpha = fim * p; ctx.fillStyle = m.cinza; ctx.font = m.fonte(f * 0.7, 700); ctx.fillText(String(D.acima), cx, cy - fn * 0.62 - f * 0.9) }
const p = m.mola(Math.max(0, (t - 0.2) / 0.9));
ctx.globalAlpha = fim * ent(0.2, 0.15);
ctx.save(); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
ctx.font = m.fonte(fn, 900); ctx.textBaseline = 'middle';
const g = ctx.createLinearGradient(0, -f * 1.6, 0, f * 1.6); g.addColorStop(0, m.ouroClaro); g.addColorStop(1, m.ouro); ctx.fillStyle = g;
ctx.fillText(String(D.numero || ''), 0, 0); ctx.restore();
ctx.textBaseline = 'top';
if (D.legenda) { const q = ent(0.8); ctx.globalAlpha = fim * q; ctx.fillStyle = m.texto; ctx.font = m.fonte(f * 0.85, 800); ctx.fillText(String(D.legenda), cx, cy + fn * 0.55 + (1 - q) * f * 0.4) }
const r = ent(1.0, 0.6); ctx.globalAlpha = fim; ctx.fillStyle = m.ouro; ctx.fillRect(cx - W * 0.15 * r, cy + fn * 0.55 + f * 1.2, W * 0.3 * r, Math.max(2, f * 0.06));`,

  recibo: `
const pw = Math.min(W, f * 9.5), px = X + (W - pw) / 2;
const fr = f * 1.15; // letra do recibo
const linhas = (D.linhas || []).slice(0, 6);
const alto = f * (1.6 + linhas.length * 0.95 + 1.9);
Y = meio(alto);
const abre = ent(0.1, 0.7);
ctx.save(); ctx.beginPath(); ctx.rect(px - 4, Y, pw + 8, alto * abre + 2); ctx.clip();
ctx.fillStyle = '#F4F1EA'; rr(px, Y, pw, alto, f * 0.18); ctx.fill();
ctx.fillStyle = '#1A1A1C'; ctx.font = m.fonte(fr * 0.55, 800); ctx.textAlign = 'center';
ctx.fillText(String(D.titulo || 'Resumo').toUpperCase(), px + pw / 2, Y + f * 0.5);
ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.setLineDash([f * 0.12, f * 0.12]); ctx.lineWidth = 2;
ctx.beginPath(); ctx.moveTo(px + f * 0.5, Y + f * 1.3); ctx.lineTo(px + pw - f * 0.5, Y + f * 1.3); ctx.stroke(); ctx.setLineDash([]);
linhas.forEach((l, k) => {
  const p = ent(0.6 + k * 0.28, 0.3); if (p <= 0) return; ctx.globalAlpha = fim * p;
  const y = Y + f * (1.6 + k * 0.95);
  ctx.textAlign = 'left'; ctx.fillStyle = '#1A1A1C'; ctx.font = m.fonte(fr * 0.5, 600); ctx.fillText(String(l.rotulo || ''), px + f * 0.5, y);
  ctx.textAlign = 'right'; ctx.font = m.fonte(fr * 0.5, 800); ctx.fillText(String(l.valor || ''), px + pw - f * 0.5, y);
});
const tp = ent(0.8 + linhas.length * 0.28, 0.4);
if (D.total && tp > 0) {
  ctx.globalAlpha = fim * tp; const y = Y + alto - f * 1.5;
  ctx.fillStyle = '#0A0A0B'; rr(px + f * 0.3, y - f * 0.15, pw - f * 0.6, f * 1.2, f * 0.15); ctx.fill();
  ctx.textAlign = 'left'; ctx.fillStyle = m.cinza; ctx.font = m.fonte(f * 0.48, 700); ctx.fillText(String(D.total.rotulo || 'Total'), px + f * 0.6, y + f * 0.25);
  ctx.textAlign = 'right'; ctx.fillStyle = m.ouro; ctx.font = m.fonte(f * 0.75, 900); ctx.fillText(String(D.total.valor || ''), px + pw - f * 0.6, y + f * 0.08);
}
ctx.restore();`,

  capitulo: `
const p = ent(0.05, 0.5), q = ent(0.3, 0.5);
Y = meio(f * 5.8) - H * 0.18;
ctx.globalAlpha = fim * p;
ctx.font = m.fonte(f * 2.6, 900); ctx.lineWidth = Math.max(2, f * 0.05); ctx.strokeStyle = m.ouro;
ctx.strokeText(String(D.numero || ''), X + (1 - p) * -f, Y + H * 0.18);
ctx.fillStyle = m.ouro; ctx.fillRect(X, Y + H * 0.18 + f * 2.9, W * 0.35 * q, Math.max(2, f * 0.07));
ctx.globalAlpha = fim * q; ctx.fillStyle = m.texto; ctx.font = m.fonte(f * 1.05, 800);
quebra(D.titulo || '', W).slice(0, 2).forEach((l, k) => ctx.fillText(l, X, Y + H * 0.18 + f * 3.3 + k * f * 1.2 + (1 - q) * f * 0.4));`,

  comparacao: `
const empilha = W < H * 1.1, gap = f * 0.5;
const nItens = (o) => Math.min(4, ((o && o.itens) || []).length);
const altoDe = (o) => f * (1.5 + nItens(o) * 1.15);
const col = empilha ? W : (W - gap) / 2;
const altoTotal = empilha ? altoDe(D.esquerda) + altoDe(D.direita) + gap : Math.max(altoDe(D.esquerda), altoDe(D.direita));
const topo = meio(altoTotal);
const lado = (o, x, bom, atraso, yb) => {
  if (!o) return;
  const Y = yb, hc = empilha ? altoDe(o) : altoTotal;
  const p = ent(atraso); ctx.globalAlpha = fim * p;
  ctx.fillStyle = bom ? 'rgba(201,164,92,0.12)' : 'rgba(255,255,255,0.04)'; rr(x, Y, col, hc, f * 0.25); ctx.fill();
  ctx.strokeStyle = bom ? m.ouro : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = bom ? m.ouro : m.cinza; let ft = f * 0.6; ctx.font = m.fonte(ft, 800);
  while (ft > f * 0.3 && ctx.measureText(String(o.titulo || '').toUpperCase()).width > col - f * 0.8) { ft *= 0.9; ctx.font = m.fonte(ft, 800) }
  ctx.fillText(String(o.titulo || '').toUpperCase(), x + f * 0.4, Y + f * 0.4);
  (o.itens || []).slice(0, 4).forEach((it, k) => {
    const q = ent(atraso + 0.3 + k * 0.25, 0.3); if (q <= 0) return; ctx.globalAlpha = fim * q;
    const y = Y + f * (1.4 + k * 1.15);
    ctx.fillStyle = bom ? '#6FBF8A' : '#E2786B'; ctx.font = m.fonte(f * 0.6, 900); ctx.fillText(bom ? '✓' : '×', x + f * 0.4, y);
    ctx.fillStyle = bom ? m.texto : m.cinza; ctx.font = m.fonte(f * 0.5, 600);
    quebra(it, col - f * 1.3).slice(0, 2).forEach((l, j) => ctx.fillText(l, x + f * 1.05, y + j * f * 0.6));
  });
};
const atrasoDir = 0.1 + 0.3 + nItens(D.esquerda) * 0.25;
lado(D.esquerda, X, false, 0.1, topo);
lado(D.direita, empilha ? X : X + col + gap, true, atrasoDir, empilha ? topo + altoDe(D.esquerda) + gap : topo);`,

  passos: `
const ps = (D.passos || []).slice(0, 5); const n = Math.max(1, ps.length);
const esp = f * 1.6;
let y0 = meio((D.titulo ? f * 1.3 : 0) + n * esp);
if (D.titulo) { const p = ent(0.05); ctx.globalAlpha = fim * p; ctx.fillStyle = m.ouro; ctx.font = m.fonte(f * 0.62, 800); ctx.fillText(String(D.titulo).toUpperCase(), X, y0); y0 += f * 1.3 }
const linha = ent(0.3, 0.4 + n * 0.3);
ctx.globalAlpha = fim; ctx.fillStyle = 'rgba(201,164,92,0.35)'; ctx.fillRect(X + f * 0.42 - 1, y0 + f * 0.45, Math.max(2, f * 0.05), (n - 1) * esp * linha);
ps.forEach((s, k) => {
  const p = ent(0.3 + k * 0.32, 0.35); if (p <= 0) return; ctx.globalAlpha = fim * p;
  const cy = y0 + k * esp + f * 0.45;
  ctx.beginPath(); ctx.arc(X + f * 0.42, cy, f * 0.42 * (0.7 + 0.3 * p), 0, Math.PI * 2); ctx.fillStyle = m.ouro; ctx.fill();
  ctx.fillStyle = m.fundo; ctx.font = m.fonte(f * 0.5, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(k + 1), X + f * 0.42, cy);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = m.texto; ctx.font = m.fonte(f * 0.68, 700);
  ctx.fillText(quebra(s, W - f * 1.4)[0], X + f * 1.1 + (1 - p) * f * 0.5, cy - f * 0.38);
});`,
}

export const ehModeloCena = (x: unknown): x is ModeloCena => typeof x === 'string' && x in CORPO

// código pronto da cena a partir do modelo e dos textos; textos vão como JSON (nunca como código)
export function codigoDoModelo(modelo: ModeloCena, dados: unknown, layout: Layout | undefined) {
  const json = JSON.stringify(dados ?? {}).replace(/</g, '\\u003c')
  return `const D = ${json};\n${BASE.replace('__CARTAO__', layout && layout !== 'cheia' ? 'true' : 'false')}\n${CORPO[modelo]}`
}
