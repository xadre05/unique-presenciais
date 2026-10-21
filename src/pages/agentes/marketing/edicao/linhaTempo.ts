// Receita da edição → linha do tempo. A receita do agente aponta palavras (pelo número); aqui elas viram tempos do
// vídeo bruto: trechos que ficam, legenda em grupos, textos na tela e zooms. A prévia e a montagem usam o mesmo cálculo.
export type Palavra = { p: string; i: number; f: number }
export type Plano = {
  resumo?: string; faltou?: string
  trechos: { de: number; ate: number }[]
  correcoes?: { palavra: number; texto: string }[]
  destaques?: number[]
  textos?: { de: number; ate: number; texto: string; posicao?: 'topo' | 'meio' }[]
  zooms?: { de: number; ate: number; intensidade?: number }[]
  legenda?: { palavras_por_vez?: number; caixa_alta?: boolean; posicao?: 'baixo' | 'meio' }
}
export type Intervalo = { ini: number; fim: number }
export type GrupoLegenda = Intervalo & { palavras: { texto: string; ini: number; fim: number; destaque: boolean }[] }
export type Sobreposicao = Intervalo & { texto: string; posicao: 'topo' | 'meio' }
export type Zoom = Intervalo & { escala: number }
export type LinhaTempo = { trechos: Intervalo[]; duracao: number; legendas: GrupoLegenda[]; textos: Sobreposicao[]; zooms: Zoom[]; caixaAlta: boolean; posicaoLegenda: 'baixo' | 'meio' }

// folga antes e depois da fala, e a pausa que vira corte dentro de um trecho
const FOLGA_ANTES = 0.08, FOLGA_DEPOIS = 0.15, PAUSA_MAXIMA = 0.6

function trechosEmTempo(palavras: Palavra[], plano: Plano, duracaoBruto: number) {
  const brutos: Intervalo[] = []
  for (const t of [...plano.trechos].sort((a, b) => a.de - b.de)) {
    const de = Math.max(0, t.de), ate = Math.min(palavras.length - 1, t.ate)
    let ini = palavras[de]?.i
    if (ini == null) continue
    // pausa longa no meio do trecho: corta (jump cut)
    for (let n = de; n < ate; n++) {
      if (palavras[n + 1].i - palavras[n].f > PAUSA_MAXIMA) { brutos.push({ ini: ini - FOLGA_ANTES, fim: palavras[n].f + FOLGA_DEPOIS }); ini = palavras[n + 1].i }
    }
    brutos.push({ ini: ini - FOLGA_ANTES, fim: palavras[ate].f + FOLGA_DEPOIS })
  }
  // junta o que se encosta e limita ao tamanho do vídeo
  const juntos: Intervalo[] = []
  for (const b of brutos.map((x) => ({ ini: Math.max(0, x.ini), fim: Math.min(duracaoBruto, x.fim) })).filter((x) => x.fim > x.ini)) {
    const ult = juntos.at(-1)
    if (ult && b.ini <= ult.fim + 0.05) ult.fim = Math.max(ult.fim, b.fim)
    else juntos.push({ ...b })
  }
  return juntos
}

const dentro = (t: number, lista: Intervalo[]) => lista.some((x) => t >= x.ini && t < x.fim)

export function montarLinhaTempo(palavras: Palavra[], plano: Plano, duracaoBruto: number): LinhaTempo {
  const trechos = trechosEmTempo(palavras, plano, duracaoBruto)
  const correcao = new Map((plano.correcoes ?? []).map((c) => [c.palavra, c.texto]))
  const destaques = new Set(plano.destaques ?? [])
  const porVez = Math.min(4, Math.max(1, plano.legenda?.palavras_por_vez ?? 3))
  const ficam = palavras.map((w, n) => ({ ...w, n })).filter((w) => dentro((w.i + w.f) / 2, trechos))
  const legendas: GrupoLegenda[] = []
  for (let k = 0; k < ficam.length; k += porVez) {
    const g = ficam.slice(k, k + porVez)
    legendas.push({ ini: g[0].i, fim: g.at(-1)!.f, palavras: g.map((w) => ({ texto: correcao.get(w.n) ?? w.p, ini: w.i, fim: w.f, destaque: destaques.has(w.n) })) })
  }
  const tempo = (de: number, ate: number) => ({ ini: palavras[Math.max(0, de)]?.i ?? 0, fim: palavras[Math.min(palavras.length - 1, ate)]?.f ?? 0 })
  return {
    trechos,
    duracao: trechos.reduce((s, t) => s + t.fim - t.ini, 0),
    legendas,
    textos: (plano.textos ?? []).map((x) => ({ ...tempo(x.de, x.ate), texto: x.texto, posicao: x.posicao ?? 'topo' })),
    zooms: (plano.zooms ?? []).map((z) => ({ ...tempo(z.de, z.ate), escala: Math.min(1.3, Math.max(1, z.intensidade ?? 1.12)) })),
    caixaAlta: plano.legenda?.caixa_alta ?? true,
    posicaoLegenda: plano.legenda?.posicao ?? 'baixo',
  }
}

// onde o vídeo bruto deve estar: dentro de um trecho segue; fora, pula para o próximo; depois do último, acabou (null)
export function proximoTempo(t: number, trechos: Intervalo[]) {
  for (const x of trechos) {
    if (t < x.ini) return x.ini
    if (t < x.fim) return t
  }
  return null
}

// tempo no vídeo final ↔ tempo no bruto (para a barra da prévia)
export function tempoFinal(t: number, trechos: Intervalo[]) {
  let s = 0
  for (const x of trechos) { if (t < x.ini) break; s += Math.min(t, x.fim) - x.ini }
  return s
}
export function tempoBruto(alvo: number, trechos: Intervalo[]) {
  let s = 0
  for (const x of trechos) { const d = x.fim - x.ini; if (alvo <= s + d) return x.ini + (alvo - s); s += d }
  return trechos.at(-1)?.fim ?? 0
}

export const ativo = <T extends Intervalo>(lista: T[], t: number) => lista.find((x) => t >= x.ini && t < x.fim)
