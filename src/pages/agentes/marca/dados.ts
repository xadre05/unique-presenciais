// Base da marca → A marca: os textos que vão em todo pedido aos agentes (quem é, o que vende, para quem, diferenciais,
// a voz, os limites, as condições fixas) e os produtos com preço e condições. Ficam em agentes_empresa.perfil; a página
// edita tudo junto e salva de uma vez, guardando no histórico quem mudou o quê e quando.
import { atualizarPerfil } from '../memoria'

export const CAMPOS_TEXTO = ['empresa', 'o_que_vende', 'publico', 'diferenciais', 'tom', 'voz', 'evitar', 'conselho', 'materiais'] as const
export type CampoTexto = (typeof CAMPOS_TEXTO)[number]
export type PerfilMarketing = Partial<Record<CampoTexto | 'instagram', string>>
export type Textos = Record<CampoTexto, string>

export type TipoProduto = 'online' | 'presencial' | 'servico' | 'outro'
export const NOME_TIPO: Record<TipoProduto, string> = { online: 'Curso ou plataforma online', presencial: 'Curso presencial', servico: 'Serviço ou procedimento', outro: 'Outro' }
export type Produto = {
  id: string; nome: string; tipo: TipoProduto; entrega: string; para_quem?: string; acesso?: string
  preco_vista?: number; parcelas?: number; valor_parcela?: number; pagamento?: string; link?: string; regras?: string; ativo: boolean
}
export type Alteracao = { em: string; por: string; partes: string[] }
export type Rascunho = { textos: Textos; produtos: Produto[] }

export const textosDe = (perfil: Record<string, unknown>): Textos =>
  Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, typeof perfil[k] === 'string' ? (perfil[k] as string) : ''])) as Textos
export const produtosDe = (perfil: Record<string, unknown>) => (Array.isArray(perfil.produtos) ? perfil.produtos : []) as Produto[]
export const historicoDe = (perfil: Record<string, unknown>) => (Array.isArray(perfil.historico_base) ? perfil.historico_base : []) as Alteracao[]
export const rascunhoDe = (perfil: Record<string, unknown>): Rascunho => ({ textos: textosDe(perfil), produtos: produtosDe(perfil) })
export const novoProduto = (): Produto => ({ id: crypto.randomUUID(), nome: '', tipo: 'online', entrega: '', ativo: true })

// em que parte da página está cada campo (o histórico mostra as partes que mudaram)
const PARTE: Record<CampoTexto, string> = {
  empresa: 'Sobre a marca', o_que_vende: 'Sobre a marca', publico: 'Sobre a marca', diferenciais: 'Sobre a marca',
  tom: 'Voz da marca', voz: 'Voz da marca', evitar: 'Limites', conselho: 'Limites', materiais: 'Produtos e condições',
}
export function partesMudadas(a: Rascunho, b: Rascunho) {
  const p = new Set(CAMPOS_TEXTO.filter((k) => a.textos[k].trim() !== b.textos[k].trim()).map((k) => PARTE[k]))
  if (JSON.stringify(a.produtos) !== JSON.stringify(b.produtos)) p.add('Produtos e condições')
  return [...p]
}
export const iguais = (a: Rascunho, b: Rascunho) => partesMudadas(a, b).length === 0

const limparProduto = (p: Produto): Produto => ({ ...p, nome: p.nome.trim(), entrega: p.entrega.trim() })

// grava só o que é desta página; o resto do perfil (campanhas, logos, memória, configuração) fica como está
export function salvarRascunho(empresa: string, r: Rascunho, antes: Rascunho, quem: string) {
  return atualizarPerfil(empresa, 'marketing', (p) => {
    const novo: Record<string, unknown> = { ...p }
    for (const k of CAMPOS_TEXTO) {
      const v = r.textos[k].trim()
      if (v) novo[k] = v; else delete novo[k]
    }
    novo.produtos = r.produtos.filter((x) => x.nome.trim()).map(limparProduto)
    const alteracao: Alteracao = { em: new Date().toISOString(), por: quem, partes: partesMudadas(r, antes) }
    novo.historico_base = [alteracao, ...historicoDe(p)].slice(0, 30)
    return novo
  })
}

// a primeira frase, curta, para os resumos
export const primeiraFrase = (s: string, max = 90) => {
  const f = s.trim().split(/(?<=[.!?])\s/)[0] ?? ''
  return f.length > max ? `${f.slice(0, max - 1)}…` : f
}

export type Selo = { texto: string; tom: 'ok' | 'alerta' | 'info' }
export const seloDe = (preenchido: boolean): Selo => (preenchido ? { texto: 'Preenchido', tom: 'ok' } : { texto: 'Falta preencher', tom: 'alerta' })

export const reais = (v?: number) => (v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
export const precoDe = (p: Produto) => [p.preco_vista != null && `${reais(p.preco_vista)} à vista`, p.parcelas && p.valor_parcela != null && `${p.parcelas}x de ${reais(p.valor_parcela)}`].filter(Boolean).join(' ou ')
