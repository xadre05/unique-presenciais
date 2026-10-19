// Base da marca no servidor (19/10/2026): os produtos cadastrados viram texto para todo pedido ao agente, e o
// "Testar voz da marca" escreve um exemplo curto com a base como está na tela (mesmo sem salvar).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { Dependencias } from './reuniao.ts'

type Produto = {
  nome: string; tipo?: string; entrega?: string; para_quem?: string; acesso?: string
  preco_vista?: number; parcelas?: number; valor_parcela?: number; pagamento?: string; link?: string; regras?: string; ativo?: boolean
  venda_inicio?: string; venda_fim?: string
}
const TIPO: Record<string, string> = { online: 'online', presencial: 'presencial', servico: 'serviço', outro: '' }
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
// hoje no horário de Brasília (o produto sai da lista no dia seguinte ao fim da venda)
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

function linhaProduto(p: Produto) {
  const preco = [p.preco_vista != null && `${reais(p.preco_vista)} à vista`, p.parcelas && p.valor_parcela != null && `${p.parcelas}x de ${reais(p.valor_parcela)}`].filter(Boolean).join(' ou ')
  return [`- ${p.nome}${TIPO[p.tipo ?? ''] ? ` (${TIPO[p.tipo ?? '']})` : ''}${p.entrega ? `: ${p.entrega}` : ''}`,
    p.para_quem && `  para quem: ${p.para_quem}`, p.acesso && `  acesso/duração: ${p.acesso}`, preco && `  preço: ${preco}`,
    p.pagamento && `  pagamento: ${p.pagamento}`, p.link && `  link de compra: ${p.link}`, p.regras && `  regras: ${p.regras}`, p.venda_fim && `  à venda só até ${dm(p.venda_fim)} (não prometa depois dessa data)`].filter(Boolean).join('\n')
}

// produtos que a marca vende sempre: fonte da verdade de preço fora das campanhas
export function blocoProdutos(perfil: Record<string, unknown>) {
  const lista = (Array.isArray(perfil.produtos) ? perfil.produtos : []) as Produto[]
  const hoje = hojeBR()
  // fora de venda, ainda não começou ou já passou da data: o agente não oferece
  const venda = lista.filter((p) => p.ativo !== false && p.nome?.trim() && (!p.venda_inicio || p.venda_inicio <= hoje) && (!p.venda_fim || p.venda_fim >= hoje))
  if (!venda.length) return ''
  return `\nPRODUTOS QUE A MARCA VENDE SEMPRE (fonte da verdade de preço e condições; uma campanha ativa pode mudar enquanto durar). Não ofereça produto fora desta lista:\n${venda.map(linhaProduto).join('\n')}`
}

const FERRAMENTA_TESTE = {
  name: 'entregar_teste',
  description: 'Entrega o exemplo curto para a equipe conferir a voz da marca.',
  input_schema: {
    type: 'object',
    properties: {
      legenda: { type: 'string', description: 'Legenda de um post de Instagram sobre um tema típico da marca, até 600 caracteres, pronta para colar' },
      whatsapp: { type: 'string', description: 'Mensagem curta de WhatsApp para uma pessoa interessada, até 400 caracteres' },
      leitura: { type: 'string', description: 'Em 2 ou 3 frases: o que da base você seguiu e o que faltou na base para escrever melhor' },
    },
    required: ['legenda', 'whatsapp', 'leitura'],
  },
}

type Rascunho = { textos?: Record<string, string>; produtos?: Produto[] }

export async function testarVoz(d: Dependencias, db: SupabaseClient, empresa: string, r: Rascunho) {
  const { chave, pa, modelo } = await d.prepararAgente(db, empresa, 'marketing')
  const textos = Object.fromEntries(Object.entries(r.textos ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.trim()]))
  const perfil = { ...pa, ...textos, produtos: Array.isArray(r.produtos) ? r.produtos : pa.produtos }
  const sistema = ['Você é o Agente de Marketing de uma empresa brasileira. Agora você escreve um EXEMPLO curto para a equipe conferir se entendeu a voz da marca.', ...d.blocoEmpresa(perfil as Record<string, string>, [])].join('\n')
  const usuario = 'Escreva: 1) a legenda de um post de Instagram sobre um tema típico desta marca; 2) uma mensagem curta de WhatsApp para uma pessoa interessada. Siga a voz, os limites e os produtos da base; não invente preço nem condição. Depois diga o que seguiu e o que faltou na base. Responda chamando a ferramenta entregar_teste.'
  const { entrega, entrada, saida } = await d.chamarClaude(chave, modelo, sistema, usuario, FERRAMENTA_TESTE)
  const t = entrega as { legenda?: string; whatsapp?: string; leitura?: string }
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'marketing', tipo: 'teste_voz', status: 'pronto', pedido: { teste: true }, resumo: 'Teste da voz da marca', modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: d.custo(modelo, entrada, saida), terminado_em: new Date().toISOString() })
  return { legenda: t.legenda ?? '', whatsapp: t.whatsapp ?? '', leitura: t.leitura ?? '' }
}
