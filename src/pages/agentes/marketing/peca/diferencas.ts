// O que mudou entre duas versões da peça, campo a campo, com o nome que o campo tem naquele formato
// ("Capa · Título da lâmina", "Chamada para ação", "Orientação para a arte"…). Serve para comparar
// versões e para escrever a nota da versão ("Título da capa e chamada ajustados").
import { configDe, nomesItem, type Campo, type CampoTexto } from './editor'
import { rascunhoDe, type Foto, type Rascunho } from './modelo'

export type Grupo = 'geral' | 'itens' | 'principal' | 'legenda' | 'visual' | 'arquivos'
export type Diferenca = { grupo: Grupo; rotulo: string; antes: string; depois: string }

const valor = (r: Rascunho, c: CampoTexto) => (c === 'titulo' ? r.titulo : r[c])
const paleta = (r: Rascunho) => r.visual.paleta.map((c) => `${c.nome} ${c.hex}`).join(', ')

function porCampos(a: Rascunho, b: Rascunho, campos: Campo[], grupo: Grupo, ja: Set<string>, saida: Diferenca[]) {
  for (const c of campos) {
    ja.add(c.campo)
    const antes = valor(a, c.campo), depois = valor(b, c.campo)
    if (antes.trim() !== depois.trim()) saida.push({ grupo, rotulo: c.rotulo, antes, depois })
  }
}

function porItens(a: Rascunho, b: Rascunho, tipo: string, saida: Diferenca[]) {
  const cfg = configDe(tipo).item
  const { singular } = nomesItem(tipo)
  for (let i = 0; i < Math.max(a.itens.length, b.itens.length); i++) {
    const x = a.itens[i], y = b.itens[i]
    const nome = cfg.capa && i === 0 ? 'Capa' : `${singular} ${i + 1}`
    if (!x || !y) { saida.push({ grupo: 'itens', rotulo: `${nome} ${x ? 'removida' : 'incluída'}`, antes: x ? [x.titulo, x.texto].filter(Boolean).join('\n') : '', depois: y ? [y.titulo, y.texto].filter(Boolean).join('\n') : '' }); continue }
    if (cfg.titulo && x.titulo.trim() !== y.titulo.trim()) saida.push({ grupo: 'itens', rotulo: `${nome} · ${cfg.titulo}`, antes: x.titulo, depois: y.titulo })
    if (cfg.texto && x.texto.trim() !== y.texto.trim()) saida.push({ grupo: 'itens', rotulo: `${nome} · ${cfg.texto}`, antes: x.texto, depois: y.texto })
    if (x.orientacao.trim() !== y.orientacao.trim()) saida.push({ grupo: 'itens', rotulo: `${nome} · Orientação`, antes: x.orientacao, depois: y.orientacao })
  }
}

function porVisual(a: Rascunho, b: Rascunho, tipo: string, saida: Diferenca[]) {
  const va = a.visual, vb = b.visual
  if (va.estilo !== vb.estilo) saida.push({ grupo: 'visual', rotulo: 'Estilo', antes: va.estilo, depois: vb.estilo })
  if (va.proporcao !== vb.proporcao) saida.push({ grupo: 'visual', rotulo: 'Proporção', antes: va.proporcao, depois: vb.proporcao })
  if (paleta(a) !== paleta(b)) saida.push({ grupo: 'visual', rotulo: 'Paleta de cores', antes: paleta(a), depois: paleta(b) })
  const refs = (r: Rascunho) => r.visual.referencias.map((x) => x.nome).join(', ')
  if (refs(a) !== refs(b)) saida.push({ grupo: 'visual', rotulo: 'Referências visuais', antes: refs(a), depois: refs(b) })
  const { singular } = nomesItem(tipo)
  for (let i = 0; i < Math.max(a.artes.length, b.artes.length); i++) {
    const x = a.artes[i] ?? {}, y = b.artes[i] ?? {}
    const nome = configDe(tipo).artes === 'por_item' ? `${singular} ${i + 1}` : configDe(tipo).rotuloArte
    if ((x.arquivo ?? '') !== (y.arquivo ?? '')) saida.push({ grupo: 'arquivos', rotulo: `Arquivo · ${nome}`, antes: x.nome ?? '', depois: y.nome ?? '' })
    if ((x.orientacao ?? '').trim() !== (y.orientacao ?? '').trim()) saida.push({ grupo: 'visual', rotulo: `Orientação da arte · ${nome}`, antes: x.orientacao ?? '', depois: y.orientacao ?? '' })
  }
}

export function diferencas(fa: Foto, fb: Foto): Diferenca[] {
  const tipo = fb.tipo
  const cfg = configDe(tipo)
  const a = rascunhoDe(fa.titulo, tipo, fa as never), b = rascunhoDe(fb.titulo, tipo, fb as never)
  const saida: Diferenca[] = [], ja = new Set<string>()
  if (fa.tipo !== fb.tipo) saida.push({ grupo: 'geral', rotulo: 'Formato', antes: fa.tipo, depois: fb.tipo })
  porCampos(a, b, cfg.principal, 'principal', ja, saida)
  porItens(a, b, tipo, saida)
  porCampos(a, b, cfg.legenda, 'legenda', ja, saida)
  porCampos(a, b, cfg.visual, 'visual', ja, saida)
  if (!ja.has('titulo') && a.titulo.trim() !== b.titulo.trim()) saida.unshift({ grupo: 'geral', rotulo: 'Título da peça', antes: a.titulo, depois: b.titulo })
  if (a.objetivo.trim() !== b.objetivo.trim()) saida.push({ grupo: 'geral', rotulo: 'Objetivo', antes: a.objetivo, depois: b.objetivo })
  porVisual(a, b, tipo, saida)
  return saida
}

// nota curta da versão: "Capa · Título da lâmina e Chamada para ação ajustados" ou "5 campos alterados em Lâminas e Legenda"
export function notaDe(antes: Foto | undefined, depois: Foto) {
  if (!antes) return 'Primeira versão escrita pela equipe'
  const d = diferencas(antes, depois)
  if (!d.length) return 'Sem mudança no conteúdo'
  if (d.length <= 2) return `${d.map((x) => x.rotulo).join(' e ')} ${d.length === 1 ? 'ajustado' : 'ajustados'}`
  const abas = configDe(depois.tipo).abas
  const nomes = [...new Set(d.map((x) => abas.find((a) => a.id === x.grupo)?.nome ?? (x.grupo === 'arquivos' ? 'Arquivos' : 'Detalhes')))]
  return `${d.length} campos alterados em ${nomes.join(', ').replace(/, ([^,]*)$/, ' e $1')}`
}
