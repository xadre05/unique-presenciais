// Recriar um post que deu resultado: vira uma peça nova do agente de marketing com o post como base (números,
// legenda e link no tema da peça). O agente mantém o que funcionou e muda o que a equipe pediu. Usado em
// Resultados (botão Recriar) e no Planejar conteúdo (partir de um post).
import { supabase } from '../../../lib/supabase'
import { msgErro } from '../../../lib/dados'
import { EMPRESA, criarTrabalho } from '../marketing/useMarketing'
import { NOME_TIPO, milhar, n, type PostIG } from './dados'

export const MANTER = ['Gancho', 'Tema', 'Estrutura', 'Formato'] as const
// formato da peça nova a partir do tipo do post no Instagram
export const FORMATO_DO_POST: Record<string, string> = { reels: 'reels', carrossel: 'carrossel', imagem: 'post', video: 'reels' }
export type PedidoRecriar = { mudar: string; manter: string[]; tipo: string; dia: string; campanha?: string; rede?: string }

export function temaRecriar(post: PostIG, med: number, p: Pick<PedidoRecriar, 'mudar' | 'manter'>) {
  const alcance = n(post, 'alcance'), acima = med && alcance ? Math.round(((alcance - med) / med) * 100) : null
  return [
    `NOVA VERSÃO de um post da própria marca que deu resultado: ${new Date(post.publicado_em).toLocaleDateString('pt-BR')} · ${NOME_TIPO[post.tipo] ?? post.tipo} · alcance ${milhar(alcance)}${acima !== null ? ` (${acima >= 0 ? '+' : ''}${acima}% contra a mediana)` : ''} · salvos ${milhar(n(post, 'salvos'))} · compartilhamentos ${milhar(n(post, 'compartilhamentos'))}.`,
    `Legenda original: "${(post.legenda ?? '').replace(/\s+/g, ' ').slice(0, 700)}"`,
    post.link ? `Post original: ${post.link}` : '',
    p.manter.length ? `Mantenha o que fez funcionar: ${p.manter.join(', ').toLowerCase()}.` : '',
    p.mudar.trim() ? `Mude: ${p.mudar.trim()}` : 'Mude o suficiente para não repetir o post: outro exemplo, outra abertura de frase, dados atualizados.',
    'Não copie a legenda inteira nem repita frases iguais.',
  ].filter(Boolean).join('\n')
}

// cria a peça (ideia) e já pede ao agente que escreva; devolve o id da peça para abrir
export async function recriarPost(post: PostIG, med: number, p: PedidoRecriar) {
  const resumo = (post.legenda ?? '').replace(/\s+/g, ' ').slice(0, 50).trim()
  const r = await criarTrabalho('ideia', { pecas: [{ tipo: p.tipo, rede: p.rede ?? 'instagram', dia: p.dia || undefined, titulo: `Nova versão: ${resumo || NOME_TIPO[post.tipo] || 'post'}`, tema: temaRecriar(post, med, p), campanha: p.campanha || undefined }] })
  if (r.erro || !r.id) throw new Error(r.erro ?? 'Não consegui criar a peça.')
  let pecaId: string | null = null
  for (let i = 0; i < 6 && !pecaId; i++) {
    const { data } = await supabase.from('agentes_pecas').select('id').eq('trabalho_id', r.id).limit(1).maybeSingle()
    pecaId = data?.id ?? null
    if (!pecaId) await new Promise((ok) => setTimeout(ok, 1000))
  }
  if (!pecaId) throw new Error('A peça foi pedida, mas ainda não apareceu. Confira na Produção em instantes.')
  // o agente escreve em segundo plano; a página da peça mostra o andamento
  const { data: t, error } = await supabase.from('agentes_trabalhos').insert({ empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'escrever', pedido: { peca_ids: [pecaId] } }).select('id').single()
  if (error) throw new Error(msgErro(error))
  void supabase.functions.invoke('agentes', { body: { trabalho: t.id } })
  return pecaId
}
