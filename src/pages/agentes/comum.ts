// Tipos e utilidades da área Agentes (núcleo: tudo por empresa).
import { FORMATO } from './marketing/formatos'
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
  id: string; trabalho_id: string; tipo: string; dia: string | null; titulo: string; status: 'rascunho' | 'aprovada' | 'descartada' | 'postada'; ordem: number; atualizado_em: string
  conteudo: {
    objetivo?: string; legenda?: string; roteiro?: string[]; texto_arte?: string; cta?: string; hashtags?: string[]; observacao?: string; prompt_imagem?: string
    horario?: string; pendencia?: string; etapa?: 'ideia' | 'producao'; campanha?: string; rede?: string; plano?: string; reuniao?: string; livre?: boolean; proposta?: boolean; briefing?: Record<string, unknown>; anterior?: Record<string, unknown>; fontes?: string[]
    orientacoes?: string[]; visual?: unknown; artes?: unknown[]; versoes?: unknown[]; aprovado_texto?: unknown; producao_ok?: unknown
  }
}
export type Config = { empresa_id: string; modelo: string; limite_mes_creditos: number | null; chave_em: string | null; ias?: Record<string, unknown> }

export const MODELOS: Record<string, { nome: string; dica: string }> = {
  'claude-sonnet-5-5': { nome: 'Claude Sonnet 5.5 (recomendado)', dica: 'Melhor texto. Uma semana de conteúdo usa cerca de 14 créditos.' },
  'claude-haiku-5-5': { nome: 'Claude Haiku 5.5 (econômico)', dica: 'Gasta cerca de 20 vezes menos créditos; texto um pouco mais simples.' },
}

// Catálogo dos agentes (nome, função, escopo e visual). Os retratos foram criados no GPT pelo Alexandre.
// O banco guarda o que muda (ligado, trabalhos, custo); o que é fixo de cada agente fica aqui.
export type Escopo = 'academy' | 'clinical' | 'ambos'
export type AgenteCatalogo = { id: string; nome: string; papel: string; descricao: string; escopo: Escopo; cor: string; foto: string; avatar?: string; icone: string; trabalhando: string }
export const CATALOGO: AgenteCatalogo[] = [
  { id: 'marketing', nome: 'Marketing', papel: 'Conteúdo e campanhas', escopo: 'ambos', cor: '#a46ee6', foto: '/agentes/marketing.webp?v=4', avatar: '/agentes/marketing-avatar.webp?v=1', icone: 'grafico', trabalhando: 'montando a semana de conteúdo',
    descricao: 'Monta a semana de conteúdo do Instagram (posts, reels, stories e legendas) com o que a empresa vende agora. Nada é publicado sozinho: você aprova, copia e posta.' },
  { id: 'atendimento', nome: 'Atendimento', papel: 'Conversas e relacionamento', escopo: 'ambos', cor: '#3f7df0', foto: '/agentes/atendimento.webp?v=4', avatar: '/agentes/atendimento-avatar.webp?v=1', icone: 'whats', trabalhando: 'respondendo leads',
    descricao: 'Responde o lead novo nas Conversas do Atendimento, tira dúvidas com o material da empresa e passa para a vendedora quando a pessoa quer comprar ou pede para falar com alguém. Entra quando o WhatsApp estiver ligado.' },
  { id: 'vendas', nome: 'Vendas', papel: 'Ofertas e acompanhamento', escopo: 'ambos', cor: '#d9a24b', foto: '/agentes/vendas.webp?v=4', avatar: '/agentes/vendas-avatar.webp?v=1', icone: 'dinheiro', trabalhando: 'separando quem chamar',
    descricao: 'Escolhe todo dia quem da base tem mais chance de comprar agora, escreve a mensagem de cada um e acompanha o retorno. A vendedora manda do celular dela; com o WhatsApp ligado, ele envia sozinho no ritmo seguro.' },
  { id: 'trafego', nome: 'Tráfego', papel: 'Anúncios e performance', escopo: 'ambos', cor: '#2fb38a', foto: '/agentes/trafego.webp?v=4', avatar: '/agentes/trafego-avatar.webp?v=1', icone: 'busca', trabalhando: 'lendo os anúncios',
    descricao: 'Lê os resultados dos anúncios e sugere o que pausar, o que aumentar e quais criativos testar. Nunca mexe no orçamento sem aprovação.' },
  { id: 'cobranca', nome: 'Cobrança', papel: 'Parcelas e lembretes', escopo: 'ambos', cor: '#e5534b', foto: '/agentes/cobranca.webp?v=4', avatar: '/agentes/cobranca-avatar.webp?v=1', icone: 'moedas', trabalhando: 'conferindo parcelas',
    descricao: 'Avisa a parcela que vai vencer e a que atrasou, com o link certo de pagamento, no tom da empresa. Para quando a pessoa paga.' },
  { id: 'analista', nome: 'Analista', papel: 'Indicadores e decisões', escopo: 'ambos', cor: '#3cc8d4', foto: '/agentes/analista.webp?v=4', avatar: '/agentes/analista-avatar.webp?v=1', icone: 'grafico', trabalhando: 'lendo os números',
    descricao: 'Toda semana lê vendas, base, turmas e anúncios e entrega um resumo curto: o que melhorou, o que piorou e as 3 ações da semana.' },
  { id: 'sucesso', nome: 'Sucesso do aluno', papel: 'Jornada e engajamento', escopo: 'academy', cor: '#e46aa0', foto: '/agentes/sucesso.webp?v=4', avatar: '/agentes/sucesso-avatar.webp?v=1', icone: 'formatura', trabalhando: 'acompanhando alunos',
    descricao: 'Acompanha o aluno do pagamento ao presencial: lembra a turma, a data e o que levar, pergunta como foi e chama de volta quem sumiu da plataforma.' },
  { id: 'recepcao', nome: 'Recepção', papel: 'Agenda e retornos', escopo: 'clinical', cor: '#c9ccd4', foto: '/agentes/recepcao.webp?v=4', avatar: '/agentes/recepcao-avatar.webp?v=1', icone: 'agenda', trabalhando: 'confirmando consultas',
    descricao: 'Confirma consulta, remarca e chama o paciente na hora do retorno pelo WhatsApp da clínica.' },
]
export const visualDe = (id: string) => CATALOGO.find((a) => a.id === id) ?? { id, nome: id, papel: '', descricao: '', escopo: 'ambos' as Escopo, cor: '#c9a45c', foto: '', icone: 'info', trabalhando: 'trabalhando' }
export const VISUAL = Object.fromEntries(CATALOGO.map((a) => [a.id, a]))

export const TIPO_PECA: Record<string, string> = Object.fromEntries(Object.entries(FORMATO).map(([k, f]) => [k, f.nome]))
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

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const hojeISO = () => isoLocal(new Date())
export function somaDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return isoLocal(d)
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// nome curto do trabalho para listas: "Reels avulso · 20/10", "Semana 20/10 a 26/10", "3 dias · 20/10 a 22/10"
export function rotuloTrabalho(t: Pick<Trabalho, 'tipo' | 'pedido'>) {
  const p = t.pedido
  if (t.tipo === 'ajuste') return 'Ajuste de peça'
  if (t.tipo === 'ideia') return `Planejamento salvo · ${Array.isArray(p.pecas) ? p.pecas.length : 0} ideia(s)`
  if (t.tipo === 'conversa') return 'Conversa (nova peça)'
  if (t.tipo === 'reuniao') return 'Reunião de pauta (mensagem)'
  if (t.tipo === 'referencia') return 'Ficha de referência para modelar'
  if (t.tipo === 'teste_voz') return 'Teste da voz da marca'
  if (t.tipo === 'voz') return 'Perfil de voz'
  if (t.tipo === 'propor_plano') return `Proposta de plano${p.ajuste ? ' (ajuste)' : ''}`
  if (t.tipo === 'escrever') return `Rascunhos · ${Array.isArray(p.novas) ? p.novas.length : Array.isArray(p.peca_ids) ? p.peca_ids.length : 0} peça(s)`
  const inicio = String(p.semana_inicio ?? '')
  if (!inicio) return 'Conteúdo'
  if (p.modo === 'peca') return `${TIPO_PECA[String(p.tipo_peca)] ?? 'Peça'} avulso · ${ddmm(inicio)}`
  const dias = Number(p.dias ?? 7)
  if (dias === 1) return `Conteúdo do dia ${ddmm(inicio)}`
  return `${dias === 7 ? 'Semana' : `${dias} dias`} · ${ddmm(inicio)} a ${ddmm(somaDias(inicio, dias - 1))}`
}

// segunda-feira da semana de uma data (no domingo, já mostra a semana que vem, que é a que se planeja)
export function segundaDe(iso: string) {
  const d = new Date(iso + 'T12:00:00'); const dia = d.getDay()
  return somaDias(iso, dia === 0 ? 1 : 1 - dia)
}
export const diaCurto = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
export const dataLonga = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')
