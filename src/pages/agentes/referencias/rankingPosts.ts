// Ranking dos posts do Instagram da marca que mais deram resultado em toda a história: cada post é comparado com a
// mediana do MESMO formato no MESMO ano (o alcance da conta muda muito de um ano para outro), pela métrica escolhida.
import { supabase } from '../../../lib/supabase'
import { mediana, milhar, n, NOME_TIPO, type PostIG } from '../instagram/dados'
import type { Ficha } from './dados'

export type Criterio = 'alcance' | 'salvos' | 'compartilhamentos' | 'comentarios'
export const CRITERIOS: { id: Criterio; nome: string }[] = [
  { id: 'alcance', nome: 'Alcance' }, { id: 'salvos', nome: 'Salvos' }, { id: 'compartilhamentos', nome: 'Compartilhamentos' }, { id: 'comentarios', nome: 'Comentários' },
]
export type PostRanking = { post: PostIG; valor: number; vezes: number; comparacao: string }

export function rankingPosts(posts: PostIG[], criterio: Criterio, tipo: string, limite = 30): PostRanking[] {
  const grupo = (p: PostIG) => `${p.tipo}|${p.publicado_em.slice(0, 4)}`
  const medianas = new Map<string, number>()
  for (const g of new Set(posts.map(grupo))) medianas.set(g, mediana(posts.filter((p) => grupo(p) === g).map((p) => n(p, criterio))))
  return posts
    .filter((p) => (tipo === 'todos' || p.tipo === tipo) && n(p, criterio) > 0)
    .map((p) => {
      const med = medianas.get(grupo(p)) || 1
      const valor = n(p, criterio), vezes = valor / med
      const nomeCriterio = CRITERIOS.find((c) => c.id === criterio)!.nome.toLowerCase()
      return { post: p, valor, vezes, comparacao: `${nomeCriterio} ${milhar(valor)}, ${vezes.toFixed(1).replace('.', ',')}× a mediana dos ${(NOME_TIPO[p.tipo] ?? p.tipo).toLowerCase()} de ${p.publicado_em.slice(0, 4)}` }
    })
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, limite)
}

// o agente busca a mídia no Instagram, transcreve a fala (reels) e estuda o roteiro; vira memória do Agente de Marketing
export async function estudarPost(empresa: string, r: PostRanking) {
  const { data, error } = await supabase.functions.invoke('editor-video', { body: { acao: 'post_instagram', empresa, post: r.post.id, comparacao: r.comparacao } })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as { ficha: Ficha; id: string }
}
