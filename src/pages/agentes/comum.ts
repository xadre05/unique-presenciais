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

// Catálogo dos agentes (nome, função, escopo e visual). Os retratos foram criados no GPT pelo Alexandre.
// O banco guarda o que muda (ligado, trabalhos, custo); o que é fixo de cada agente fica aqui.
export type Escopo = 'academy' | 'clinical' | 'ambos'
export type AgenteCatalogo = { id: string; nome: string; papel: string; descricao: string; escopo: Escopo; cor: string; foto: string; icone: string; trabalhando: string }
export const CATALOGO: AgenteCatalogo[] = [
  { id: 'marketing', nome: 'Marketing', papel: 'Conteúdo e campanhas', escopo: 'ambos', cor: '#a46ee6', foto: '/agentes/marketing.webp', icone: 'grafico', trabalhando: 'montando a semana de conteúdo',
    descricao: 'Monta a semana de conteúdo do Instagram (posts, reels, stories e legendas) com o que a empresa vende agora. Nada é publicado sozinho: você aprova, copia e posta.' },
  { id: 'atendimento', nome: 'Atendimento', papel: 'Conversas e relacionamento', escopo: 'ambos', cor: '#2fb3a0', foto: '/agentes/atendimento.webp', icone: 'whats', trabalhando: 'respondendo leads',
    descricao: 'Responde o lead novo nas Conversas do Atendimento, tira dúvidas com o material da empresa e passa para a vendedora quando a pessoa quer comprar ou pede para falar com alguém. Entra quando o WhatsApp estiver ligado.' },
  { id: 'vendas', nome: 'Vendas', papel: 'Ofertas e acompanhamento', escopo: 'ambos', cor: '#d9a24b', foto: '/agentes/vendas.webp', icone: 'dinheiro', trabalhando: 'separando quem chamar',
    descricao: 'Escolhe todo dia quem da base tem mais chance de comprar agora, escreve a mensagem de cada um e acompanha o retorno. A vendedora manda do celular dela; com o WhatsApp ligado, ele envia sozinho no ritmo seguro.' },
  { id: 'trafego', nome: 'Tráfego', papel: 'Anúncios e performance', escopo: 'ambos', cor: '#3f7df0', foto: '/agentes/trafego.webp', icone: 'busca', trabalhando: 'lendo os anúncios',
    descricao: 'Lê os resultados dos anúncios e sugere o que pausar, o que aumentar e quais criativos testar. Nunca mexe no orçamento sem aprovação.' },
  { id: 'cobranca', nome: 'Cobrança', papel: 'Parcelas e lembretes', escopo: 'ambos', cor: '#e5534b', foto: '/agentes/cobranca.webp', icone: 'moedas', trabalhando: 'conferindo parcelas',
    descricao: 'Avisa a parcela que vai vencer e a que atrasou, com o link certo de pagamento, no tom da empresa. Para quando a pessoa paga.' },
  { id: 'analista', nome: 'Analista', papel: 'Indicadores e decisões', escopo: 'ambos', cor: '#c9ccd4', foto: '/agentes/analista.webp', icone: 'grafico', trabalhando: 'lendo os números',
    descricao: 'Toda semana lê vendas, base, turmas e anúncios e entrega um resumo curto: o que melhorou, o que piorou e as 3 ações da semana.' },
  { id: 'sucesso', nome: 'Sucesso do aluno', papel: 'Jornada e engajamento', escopo: 'academy', cor: '#e46aa0', foto: '/agentes/sucesso.webp', icone: 'formatura', trabalhando: 'acompanhando alunos',
    descricao: 'Acompanha o aluno do pagamento ao presencial: lembra a turma, a data e o que levar, pergunta como foi e chama de volta quem sumiu da plataforma.' },
  { id: 'recepcao', nome: 'Recepção', papel: 'Agenda e retornos', escopo: 'clinical', cor: '#4fc3d9', foto: '/agentes/recepcao.webp', icone: 'agenda', trabalhando: 'confirmando consultas',
    descricao: 'Confirma consulta, remarca e chama o paciente na hora do retorno pelo WhatsApp da clínica.' },
]
export const visualDe = (id: string) => CATALOGO.find((a) => a.id === id) ?? { id, nome: id, papel: '', descricao: '', escopo: 'ambos' as Escopo, cor: '#c9a45c', foto: '', icone: 'info', trabalhando: 'trabalhando' }
export const VISUAL = Object.fromEntries(CATALOGO.map((a) => [a.id, a]))

export const TIPO_PECA: Record<string, string> = { post: 'Post', carrossel: 'Carrossel', reels: 'Reels', stories: 'Stories' }
export const usd = (v: number | null | undefined) => {
  const n = Number(v ?? 0)
  return `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 0.1 ? 3 : 2 })}`
}

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
