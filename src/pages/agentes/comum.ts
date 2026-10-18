// Tipos e utilidades da área Agentes (núcleo: tudo por empresa).
export type AgenteSala = {
  agente_id: string; nome: string; papel: string; descricao: string; disponivel: boolean; ativo: boolean
  status_agora: 'na_fila' | 'trabalhando' | 'pronto' | 'erro' | null; trabalho_desde: string | null
  aguardando: number; aprovadas_mes: number; trabalhos_mes: number; custo_mes_usd: number
}
export type Trabalho = {
  id: string; agente_id: string; tipo: string; status: 'na_fila' | 'trabalhando' | 'pronto' | 'erro'; pedido: Record<string, unknown>
  resumo: string | null; modelo: string | null; tokens_entrada: number | null; tokens_saida: number | null; custo_usd: number | null
  erro: string | null; criado_em: string; terminado_em: string | null
}
export type Peca = {
  id: string; trabalho_id: string; tipo: string; dia: string | null; titulo: string; status: 'rascunho' | 'aprovada' | 'descartada' | 'postada'; ordem: number
  conteudo: { objetivo?: string; legenda?: string; roteiro?: string[]; texto_arte?: string; cta?: string; hashtags?: string[]; observacao?: string }
}
export type Config = { empresa_id: string; modelo: string; limite_mes_usd: number | null; chave_em: string | null }

export const MODELOS: Record<string, { nome: string; dica: string }> = {
  'claude-sonnet-5-5': { nome: 'Claude Sonnet 5.5 (recomendado)', dica: 'Melhor texto. Uma semana de conteúdo custa alguns centavos de dólar.' },
  'claude-haiku-5-5': { nome: 'Claude Haiku 5.5 (econômico)', dica: 'Cerca de 20 vezes mais barato; texto um pouco mais simples.' },
}

// visual de cada agente: retrato (feito no GPT pelo Alexandre), cor, ícone e o que diz quando trabalha
export const VISUAL: Record<string, { cor: string; foto?: string; icone: string; trabalhando: string }> = {
  marketing: { cor: '#a46ee6', foto: '/agentes/marketing.webp', icone: 'grafico', trabalhando: 'montando a semana de conteúdo' },
  atendimento: { cor: '#2fb3a0', foto: '/agentes/atendimento.webp', icone: 'whats', trabalhando: 'respondendo leads' },
  vendas: { cor: '#d9a24b', foto: '/agentes/vendas.webp', icone: 'dinheiro', trabalhando: 'separando quem chamar' },
  trafego: { cor: '#3f7df0', foto: '/agentes/trafego.webp', icone: 'busca', trabalhando: 'lendo os anúncios' },
}
export const visualDe = (id: string) => VISUAL[id] ?? { cor: '#c9a45c', icone: 'info', trabalhando: 'trabalhando' }

export const TIPO_PECA: Record<string, string> = { post: 'Post', carrossel: 'Carrossel', reels: 'Reels', stories: 'Stories' }
export const usd = (v: number | null | undefined) => `US$ ${(Number(v ?? 0)).toFixed(Number(v ?? 0) < 1 ? 3 : 2)}`

// texto pronto para copiar de uma peça
export function textoDaPeca(p: Peca) {
  const c = p.conteudo
  return [
    c.texto_arte && `TEXTO DA ARTE: ${c.texto_arte}`,
    c.roteiro?.length && `${p.tipo === 'reels' ? 'ROTEIRO' : p.tipo === 'carrossel' ? 'LÂMINAS' : 'TELAS'}:\n${c.roteiro.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
    c.legenda && `LEGENDA:\n${c.legenda}`,
    c.hashtags?.length && c.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '),
  ].filter(Boolean).join('\n\n')
}

export function proximaSegunda() {
  const d = new Date(); const dia = d.getDay()
  d.setDate(d.getDate() + ((8 - dia) % 7 || 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
