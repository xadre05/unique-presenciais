// Cenas animadas (motion graphics) escritas pelo agente como código de desenho em canvas. O código roda isolado num
// iframe sem acesso ao sistema (sandbox sem mesma origem, sem rede: CSP default-src 'none'), desenha a cena num
// OffscreenCanvas no tempo pedido e devolve a imagem pronta (ImageBitmap). A prévia e a montagem pedem o quadro da
// cena a cada passo e usam o último que chegou (no máximo um quadro de atraso).
//
// Contrato do código (corpo de função): recebe (ctx, t, d, L, A, m) — ctx = contexto 2D; t = segundos desde o começo da
// cena; d = duração da cena; L × A = tamanho em pixels; m = { ouro, ouroClaro, fundo, painel, texto, cinza, fonte(tam, peso), suave(p), mola(p) }.
export type CenaCodigo = { codigo?: string }

const MARCA = `{ ouro: '#C9A45C', ouroClaro: '#E8CF9A', fundo: '#0A0A0B', painel: '#16161A', texto: '#F4F1EA', cinza: '#9A968E', fonte: (tam, peso) => (peso || 800) + ' ' + Math.round(tam) + 'px system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  suave: (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3), mola: (p) => { p = Math.min(1, Math.max(0, p)); return 1 - Math.cos(p * Math.PI * 4.5) * Math.exp(-p * 6) } }`

function documento(codigos: (string | undefined)[], L: number, A: number) {
  const lista = JSON.stringify(codigos.map((c) => c ?? '')).replace(/<\//g, '<\\/')
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'"></head><body><script>
const L = ${L}, A = ${A}, M = ${MARCA};
const fns = ${lista}.map((c) => { if (!c) return null; try { return new Function('ctx', 't', 'd', 'L', 'A', 'm', c) } catch (e) { return String(e) } });
const tela = new OffscreenCanvas(L, A), ctx = tela.getContext('2d');
addEventListener('message', (e) => {
  const { id, n, t, d } = e.data || {};
  const f = fns[n];
  if (typeof f !== 'function') { parent.postMessage({ id, n, erro: f || 'cena sem código' }, '*'); return }
  try {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, L, A);
    f(ctx, t, d, L, A, M); ctx.restore();
    const bmp = tela.transferToImageBitmap();
    parent.postMessage({ id, n, t, bmp }, '*', [bmp]);
  } catch (err) { parent.postMessage({ id, n, erro: String(err && err.message || err) }, '*') }
});
parent.postMessage({ pronto: true }, '*');
</script></body></html>`
}

export class Cenas {
  private janela: HTMLIFrameElement
  private ultimos = new Map<number, { t: number; bmp: ImageBitmap }>()
  private pendente = new Map<number, number>()
  private contador = 0
  readonly erros = new Map<number, string>()
  readonly pronto: Promise<void>
  private ouvir = (e: MessageEvent) => {
    if (e.source !== this.janela.contentWindow) return
    const r = e.data as { id?: number; n?: number; t?: number; bmp?: ImageBitmap; erro?: string; pronto?: boolean }
    if (r.pronto || r.n == null) return
    if (this.pendente.get(r.n) === r.id) this.pendente.delete(r.n)
    if (r.erro) { this.erros.set(r.n, r.erro); return }
    if (r.bmp) { this.ultimos.get(r.n)?.bmp.close(); this.ultimos.set(r.n, { t: r.t ?? 0, bmp: r.bmp }) }
  }

  constructor(codigos: (string | undefined)[], L: number, A: number) {
    this.janela = Object.assign(document.createElement('iframe'), { srcdoc: documento(codigos, L, A) })
    this.janela.setAttribute('sandbox', 'allow-scripts')
    this.janela.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;top:-10px;opacity:0;pointer-events:none'
    window.addEventListener('message', this.ouvir)
    this.pronto = new Promise((ok) => {
      const espera = (e: MessageEvent) => { if (e.source === this.janela.contentWindow && (e.data as { pronto?: boolean })?.pronto) { window.removeEventListener('message', espera); ok() } }
      window.addEventListener('message', espera)
      setTimeout(ok, 3000) // não trava a edição se o iframe não responder
    })
    document.body.appendChild(this.janela)
  }

  private pedir(n: number, t: number, d: number) {
    if (this.pendente.has(n) || this.erros.has(n)) return
    const id = ++this.contador
    this.pendente.set(n, id)
    this.janela.contentWindow?.postMessage({ id, n, t, d }, '*')
  }

  // o quadro mais recente da cena n e o pedido do próximo (t + 1/30 s)
  quadro(n: number, t: number, d: number): ImageBitmap | null {
    this.pedir(n, Math.min(d, t + 1 / 30), d)
    return this.ultimos.get(n)?.bmp ?? null
  }

  // um quadro exato (para a revisão do agente e para a capa): espera a resposta
  async quadroExato(n: number, t: number, d: number): Promise<ImageBitmap | null> {
    await this.pronto
    while (this.pendente.has(n)) await new Promise((ok) => setTimeout(ok, 10))
    this.pedir(n, t, d)
    const fim = Date.now() + 2000
    while (this.pendente.has(n) && Date.now() < fim) await new Promise((ok) => setTimeout(ok, 10))
    return this.erros.has(n) ? null : this.ultimos.get(n)?.bmp ?? null
  }

  fechar() {
    window.removeEventListener('message', this.ouvir)
    for (const u of this.ultimos.values()) u.bmp.close()
    this.janela.remove()
  }
}
