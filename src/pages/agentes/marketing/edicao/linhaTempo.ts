import { DURACAO_RISER, SONS, type Efeito, type Som } from './efeitos'

// Receita da edição → linha do tempo. A receita do agente aponta palavras (pelo número); aqui elas viram tempos do
// vídeo bruto: trechos que ficam, legenda em grupos, textos na tela e zooms. A prévia e a montagem usam o mesmo cálculo.
export type Palavra = { p: string; i: number; f: number }
export type Plano = {
  resumo?: string; faltou?: string; checagem?: string; roteiro_identificado?: string
  trechos: { de: number; ate: number }[]
  correcoes?: { palavra: number; texto: string }[]
  destaques?: number[]
  textos?: { de: number; ate: number; texto: string; posicao?: 'topo' | 'meio'; animacao?: Animacao }[]
  zooms?: { de: number; ate: number; intensidade?: number }[]
  legenda?: { palavras_por_vez?: number; caixa_alta?: boolean; posicao?: 'baixo' | 'meio'; estilo?: EstiloLegenda }
  // imagens/clipes de apoio por cima da fala (número da mídia na lista que a equipe subiu)
  coberturas?: { de: number; ate: number; midia: number; layout?: Layout; movimento?: Movimento }[]
  // legenda de palavra-chave: frases curtas escolhidas pelo agente (estilo "chave")
  chaves?: { de: number; ate: number; texto: string }[]
  // efeitos sonoros marcados pelo agente (hit, riser, ding…) na palavra; os automáticos (woosh no zoom, clique no
  // texto, pop/woosh na imagem) entram sozinhos, a não ser que efeitos_automaticos seja false
  efeitos?: { palavra: number; som: Som }[]
  efeitos_automaticos?: boolean
  // onde está o rosto da pessoa no vídeo bruto (0 a 1, da esquerda e do topo): o zoom e a tela dividida centram nele
  enquadramento?: { x?: number; y?: number }
  // cenas animadas (motion graphics) por cima da fala: o agente descreve, depois escreve o código de cada uma (cenas.ts)
  cenas?: CenaPlano[]
  // a fala dividida em blocos de intenção (gancho, virada, prova, oferta, chamada), planejada antes do resto
  beats?: Beat[]
  // vídeo com trechos regravados: a lista de trechos é a ordem do vídeo final (um trecho regravado, gravado depois, entra
  // no lugar do original); sem isto os trechos seguem a ordem do bruto
  ordem_livre?: boolean
}
export type Beat = { de: number; ate: number; nome: string; tratamento?: string }
export type CenaPlano = { de: number; ate: number; layout?: Layout; descricao: string; codigo?: string; erro?: string; nota?: number; modelo?: string; dados?: unknown }
// como o texto grande entra na tela
export type Animacao = 'pop' | 'deslizar' | 'digitar'
export type EstiloLegenda = 'palavras' | 'chave' | 'nenhuma'
// cheia = mídia ocupa a tela; dividida = mídia em cima e a pessoa embaixo; cartao = print/imagem como cartão por cima da pessoa
export type Layout = 'cheia' | 'dividida' | 'cartao'
export type Movimento = 'aproximar' | 'afastar' | 'deslizar' | 'parado'
export type Intervalo = { ini: number; fim: number }
export type GrupoLegenda = Intervalo & { palavras: { texto: string; ini: number; fim: number; destaque: boolean }[] }
export type Sobreposicao = Intervalo & { texto: string; posicao: 'topo' | 'meio'; animacao: Animacao }
export type Rosto = { x: number; y: number }
export type Zoom = Intervalo & { escala: number }
export type Cobertura = Intervalo & { midia: number; layout: Layout; movimento: Movimento }
export type CenaLinha = Intervalo & { n: number; layout: Layout }
export type Chave = Intervalo & { texto: string }
export type LinhaTempo = {
  trechos: Intervalo[]; duracao: number; legendas: GrupoLegenda[]; textos: Sobreposicao[]; zooms: Zoom[]; caixaAlta: boolean; posicaoLegenda: 'baixo' | 'meio'
  estiloLegenda: EstiloLegenda; chaves: Chave[]; coberturas: Cobertura[]; efeitos: Efeito[]; rosto: Rosto; cenas: CenaLinha[]; beats: (Intervalo & { nome: string; tratamento?: string })[]
}

// folga antes e depois da fala, e a pausa que vira corte dentro de um trecho
const FOLGA_ANTES = 0.08, FOLGA_DEPOIS = 0.15, PAUSA_MAXIMA = 0.6

function trechosEmTempo(palavras: Palavra[], plano: Plano, duracaoBruto: number) {
  const brutos: Intervalo[] = []
  for (const t of plano.ordem_livre ? plano.trechos : [...plano.trechos].sort((a, b) => a.de - b.de)) {
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
    // só emenda o que continua o trecho anterior no bruto (com ordem livre, o próximo pode ser de antes)
    if (ult && b.ini >= ult.ini && b.ini <= ult.fim + 0.05) ult.fim = Math.max(ult.fim, b.fim)
    else juntos.push({ ...b })
  }
  return juntos
}

const dentro = (t: number, lista: Intervalo[]) => lista.some((x) => t >= x.ini && t < x.fim)

// efeitos que caem dentro do que fica no vídeo, sem dois sons colados (o marcado pelo agente ganha do automático)
function montarEfeitos(palavras: Palavra[], plano: Plano, trechos: Intervalo[], l: Pick<LinhaTempo, 'zooms' | 'textos' | 'coberturas'>): Efeito[] {
  const marcados = (plano.efeitos ?? []).filter((e) => SONS.includes(e.som) && palavras[e.palavra])
    .map((e) => ({ t: e.som === 'hit' || e.som === 'ding' ? palavras[e.palavra].f : palavras[e.palavra].i, som: e.som }))
  const automaticos = plano.efeitos_automaticos === false ? [] : [
    ...l.zooms.map((z) => ({ t: z.ini, som: 'woosh' as Som })),
    ...l.textos.map((x) => ({ t: x.ini, som: 'clique' as Som })),
    ...l.coberturas.map((c) => ({ t: c.ini, som: (c.layout === 'dividida' ? 'pop' : 'woosh') as Som })),
  ]
  const lista: { t: number; som: Som }[] = []
  for (const e of [...marcados, ...automaticos]) {
    if (!dentro(e.t, trechos) && !dentro(e.t + 0.05, trechos)) continue
    if (lista.some((x) => Math.abs(x.t - e.t) < 0.3)) continue
    lista.push(e)
  }
  // o riser começa 1,4 s antes no vídeo FINAL (pode atravessar um corte)
  return lista.sort((a, b) => a.t - b.t).map((e) => ({ ...e, gatilho: e.som === 'riser' ? tempoBruto(Math.max(0, tempoFinal(e.t, trechos) - DURACAO_RISER), trechos) : e.t }))
}

export function montarLinhaTempo(palavras: Palavra[], plano: Plano, duracaoBruto: number, totalMidias = 0): LinhaTempo {
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
  const linha: Omit<LinhaTempo, 'efeitos' | 'rosto' | 'cenas' | 'beats'> = {
    trechos,
    duracao: trechos.reduce((s, t) => s + t.fim - t.ini, 0),
    legendas,
    textos: (plano.textos ?? []).map((x) => ({ ...tempo(x.de, x.ate), texto: x.texto, posicao: x.posicao ?? 'topo', animacao: x.animacao ?? 'pop' })),
    zooms: (plano.zooms ?? []).map((z) => ({ ...tempo(z.de, z.ate), escala: Math.min(1.3, Math.max(1, z.intensidade ?? 1.12)) })),
    caixaAlta: plano.legenda?.caixa_alta ?? true,
    posicaoLegenda: plano.legenda?.posicao ?? 'baixo',
    estiloLegenda: plano.legenda?.estilo ?? 'palavras',
    chaves: (plano.chaves ?? []).map((x) => ({ ...tempo(x.de, x.ate), texto: x.texto })),
    // cobertura de mídia que não existe (a equipe tirou da lista) é ignorada; no mínimo 1 s na tela
    coberturas: (plano.coberturas ?? []).filter((x) => x.midia >= 0 && x.midia < totalMidias)
      .map((x) => { const t = tempo(x.de, x.ate); return { ini: t.ini, fim: Math.max(t.fim, t.ini + 1), midia: x.midia, layout: x.layout ?? 'cheia', movimento: x.movimento ?? 'aproximar' } }),
  }
  const entre = (v: unknown, padrao: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : padrao)
  const rosto = { x: entre(plano.enquadramento?.x, 0.5), y: entre(plano.enquadramento?.y, 0.35) }
  // cena sem código (ainda escrevendo, ou deu erro) não entra; no mínimo 1,5 s na tela
  const cenas = (plano.cenas ?? []).map((c, n) => ({ c, n })).filter(({ c }) => c.codigo && !c.erro)
    .map(({ c, n }) => { const t = tempo(c.de, c.ate); return { ini: t.ini, fim: Math.max(t.fim, t.ini + 1.5), n, layout: c.layout ?? 'cheia' } })
  const comCenas = { ...linha, coberturas: [...linha.coberturas, ...cenas.map((c) => ({ ini: c.ini, fim: c.fim, midia: -1, layout: c.layout, movimento: 'parado' as Movimento }))] }
  const beats = (Array.isArray(plano.beats) ? plano.beats : []).map((b) => ({ ...tempo(b.de, b.ate), nome: String(b.nome ?? ''), tratamento: b.tratamento }))
  return { ...linha, efeitos: montarEfeitos(palavras, plano, trechos, comCenas), rosto, cenas, beats }
}

// onde o vídeo bruto deve estar: dentro de um trecho segue; fora, pula para o próximo; depois do último, acabou (null)
// Os trechos podem não estar na ordem do bruto (trecho regravado no lugar do original), então tudo se guia pela posição
// na lista: dentro de um trecho, segue; fora, o trecho que acabou de terminar é o de fim mais próximo antes de t.
const trechoDe = (t: number, trechos: Intervalo[]) => trechos.findIndex((x) => t >= x.ini && t < x.fim)
function acabouDe(t: number, trechos: Intervalo[]) {
  let k = -1
  trechos.forEach((x, i) => { if (x.fim <= t && (k < 0 || x.fim > trechos[k].fim)) k = i })
  return k
}
export function proximoTempo(t: number, trechos: Intervalo[]) {
  if (trechoDe(t, trechos) >= 0) return t
  const k = acabouDe(t, trechos)
  if (k < 0) return trechos[0]?.ini ?? null // antes de tudo: vai para o primeiro trecho
  return trechos[k + 1]?.ini ?? null
}

// tempo no vídeo final ↔ tempo no bruto (para a barra da prévia)
export function tempoFinal(t: number, trechos: Intervalo[]) {
  const dentroDe = trechoDe(t, trechos), k = dentroDe >= 0 ? dentroDe : acabouDe(t, trechos)
  if (k < 0) return 0
  let s = 0
  for (let i = 0; i < k; i++) s += trechos[i].fim - trechos[i].ini
  return s + Math.min(t, trechos[k].fim) - trechos[k].ini
}
export function tempoBruto(alvo: number, trechos: Intervalo[]) {
  let s = 0
  for (const x of trechos) { const d = x.fim - x.ini; if (alvo <= s + d) return x.ini + (alvo - s); s += d }
  return trechos.at(-1)?.fim ?? 0
}

export const ativo = <T extends Intervalo>(lista: T[], t: number) => lista.find((x) => t >= x.ini && t < x.fim)
