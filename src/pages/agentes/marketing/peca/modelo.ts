// O rascunho que a tela edita e como ele vira o conteúdo guardado da peça (jsonb, sem migration).
// Itens (lâminas, cenas, telas…) ficam em `roteiro` como texto: a primeira linha é o título do item e o resto
// é o texto de apoio. A orientação de cada item fica em `orientacoes`, na mesma ordem.
// Versões: cada escrita (do agente ou da equipe) guarda uma foto do conteúdo em `versoes`.
import type { Peca } from '../../comum'
import { configDe, type ConfigItem } from './editor'

export type Item = { titulo: string; texto: string; orientacao: string }
export type Arte = { arquivo?: string; nome?: string; orientacao?: string }
export type Cor = { nome: string; hex: string }
export type Referencia = { caminho: string; nome: string }
// antes e depois: só fotos reais, com a autorização do paciente confirmada por quem enviou
export type Visual = { estilo: string; proporcao: string; paleta: Cor[]; referencias: Referencia[]; antesDepois?: Referencia[]; autorizado?: boolean }
export type Rascunho = {
  titulo: string; objetivo: string; itens: Item[]; legenda: string; cta: string; hashtags: string
  texto_arte: string; apoio: string; prompt_imagem: string; observacao: string; visual: Visual; artes: Arte[]
}
export type Foto = {
  titulo: string; tipo: string; objetivo?: string; legenda?: string; roteiro?: string[]; orientacoes?: string[]; cta?: string; hashtags?: string[]
  texto_arte?: string; prompt_imagem?: string; observacao?: string; visual?: Visual; artes?: Arte[]
}
export type Origem = 'ia' | 'ajuste_ia' | 'manual' | 'restaurada' | 'atual'
export type Versao = { n: number; em: string | null; por: string; origem: Origem; nota: string; aprovada?: boolean; dados: Foto }
export type Aprovacao = { em: string; por: string }
type Conteudo = Peca['conteudo'] & { orientacoes?: string[]; visual?: Visual; artes?: Arte[]; versoes?: Versao[]; aprovado_texto?: Aprovacao; producao_ok?: Aprovacao }

export const conteudoDe = (p: Peca) => p.conteudo as Conteudo
export const PALETA_PADRAO: Cor[] = [{ nome: 'Grafite', hex: '#1A1A1A' }, { nome: 'Dourado', hex: '#D4AF37' }, { nome: 'Marfim', hex: '#F5EFE6' }]
const CAMPOS_FOTO = ['objetivo', 'legenda', 'roteiro', 'orientacoes', 'cta', 'hashtags', 'texto_arte', 'prompt_imagem', 'observacao', 'visual', 'artes'] as const

// "Título\ntexto" → item. Texto antigo sem quebra: curto vira título, longo vira texto.
export function separarItem(s: string, cfg: ConfigItem, orientacao = ''): Item {
  if (!cfg.titulo) return { titulo: '', texto: s, orientacao }
  if (!cfg.texto) return { titulo: s, texto: '', orientacao }
  const quebra = s.indexOf('\n')
  if (quebra >= 0) return { titulo: s.slice(0, quebra).trim(), texto: s.slice(quebra + 1).trim(), orientacao }
  // texto antigo numa linha só: tira o "Lâmina 1 (capa):" do começo e usa a primeira frase como título
  const prefixo = s.match(PREFIXO_ITEM)
  const limpo = s.replace(PREFIXO_ITEM, '').trim()
  // cena e bloco de vídeo: o tempo entre parênteses vira o título ("0–3s")
  if (prefixo?.[2] && /\d\s*(s|seg|min|:)/i.test(prefixo[2])) return { titulo: prefixo[2].slice(1, -1).trim(), texto: limpo, orientacao }
  const max = cfg.maxTitulo ?? 90
  const fim = limpo.search(/(?<!\b(?:Dra?|Sra?|Prof|Profa|etc|ex))[.!?:]\s/)
  if (limpo.length <= max && fim < 0) return { titulo: limpo.replace(/[.;]$/, ''), texto: '', orientacao }
  if (fim > 0 && fim < max) return { titulo: limpo.slice(0, limpo[fim] === '.' || limpo[fim] === ':' ? fim : fim + 1).trim(), texto: limpo.slice(fim + 1).trim(), orientacao }
  return { titulo: '', texto: limpo, orientacao }
}
const PREFIXO_ITEM = /^(l[âa]mina|tela|cena|p[áa]gina|bloco|se[çc][ãa]o)\s*\d+\s*(\([^)]*\))?\s*[:,\-–—.]\s*/i
export function juntarItem(i: Item, cfg: ConfigItem) {
  if (!cfg.titulo) return i.texto
  if (!cfg.texto) return i.titulo
  return i.texto ? `${i.titulo}\n${i.texto}` : i.titulo
}

export function visualDe(c: Conteudo, tipo: string): Visual {
  const v = c.visual
  return { estilo: v?.estilo ?? 'Editorial premium', proporcao: v?.proporcao ?? configDe(tipo).proporcao, paleta: v?.paleta?.length ? v.paleta : PALETA_PADRAO, referencias: v?.referencias ?? [], antesDepois: v?.antesDepois ?? [], autorizado: v?.autorizado ?? false }
}

export function rascunhoDe(titulo: string, tipo: string, c: Conteudo): Rascunho {
  const cfg = configDe(tipo).item
  const roteiro = c.roteiro ?? []
  return {
    titulo, objetivo: c.objetivo ?? '', legenda: c.legenda ?? '', cta: c.cta ?? '', hashtags: (c.hashtags ?? []).join(' '),
    texto_arte: c.texto_arte ?? '', prompt_imagem: c.prompt_imagem ?? '', observacao: c.observacao ?? '',
    itens: tipo === 'post' ? [] : roteiro.map((s, i) => separarItem(s, cfg, c.orientacoes?.[i] ?? '')),
    apoio: tipo === 'post' ? roteiro.join('\n') : '', visual: visualDe(c, tipo), artes: c.artes ?? [],
  }
}
export const rascunhoDaPeca = (p: Peca) => rascunhoDe(p.titulo, p.tipo, conteudoDe(p))

// campos do conteúdo que o rascunho preenche (o resto da peça — canal, campanha, datas, objetivo — fica nos detalhes)
export function camposDo(r: Rascunho, tipo: string) {
  const cfg = configDe(tipo).item
  const orientacoes = r.itens.map((i) => i.orientacao)
  return {
    legenda: r.legenda || undefined, cta: r.cta || undefined, texto_arte: r.texto_arte || undefined,
    prompt_imagem: r.prompt_imagem || undefined, observacao: r.observacao || undefined,
    hashtags: r.hashtags.split(/\s+/).filter(Boolean),
    roteiro: tipo === 'post' ? r.apoio.split('\n') : r.itens.map((i) => juntarItem(i, cfg)),
    orientacoes: orientacoes.some((o) => o.trim()) ? orientacoes : undefined,
    visual: r.visual, artes: r.artes.some((a) => a.arquivo || a.orientacao) ? r.artes : undefined,
  }
}

// foto de um momento da peça, só com o que é conteúdo; vazio sai para comparar sem ruído
export function fotoDe(titulo: string, tipo: string, c: Record<string, unknown>): Foto {
  const f: Record<string, unknown> = { titulo, tipo }
  for (const k of CAMPOS_FOTO) {
    const v = c[k]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    f[k] = v
  }
  return f as Foto
}
const ordenado = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenado) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado((v as Record<string, unknown>)[k])])) : v
export const iguais = (a: unknown, b: unknown) => JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b))

// histórico de versões. Peça antiga, sem histórico: a versão de antes do último ajuste (se houver) e a atual.
export function versoesDe(p: { titulo: string; tipo: string; conteudo: Record<string, unknown> }): Versao[] {
  const c = p.conteudo as Conteudo
  if (Array.isArray(c.versoes) && c.versoes.length) return c.versoes
  if (c.etapa === 'ideia') return []
  const lista: Versao[] = []
  const a = c.anterior as Record<string, unknown> | undefined
  if (a) lista.push({ n: 1, em: null, por: 'Agente de Marketing', origem: 'ia', nota: 'Versão antes do último ajuste', dados: fotoDe(p.titulo, p.tipo, a) })
  const atual = fotoDe(p.titulo, p.tipo, c)
  if (atual.legenda || atual.roteiro?.length || atual.texto_arte) lista.push({ n: lista.length + 1, em: null, por: 'Agente de Marketing', origem: 'atual', nota: 'Rascunho do agente', dados: atual })
  return lista
}

// a foto vira campos de conteúdo de novo (para restaurar)
export function camposDaFoto(f: Foto) {
  const campos: Record<string, unknown> = {}
  for (const k of CAMPOS_FOTO) campos[k] = f[k]
  return campos
}
