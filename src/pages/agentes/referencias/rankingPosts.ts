// Ranking dos posts do Instagram da marca que mais deram resultado em toda a história: cada post é comparado com a
// mediana dos posts do MESMO formato publicados 2 meses antes e depois dele (o alcance da conta muda muito ao longo do
// tempo: em 2024 a mediana dos reels era ~300, em 2025 ~5 mil), pela métrica escolhida.
import { supabase } from '../../../lib/supabase'
import { mediana, milhar, n, NOME_TIPO, type PostIG } from '../instagram/dados'
import type { Ficha } from './dados'

export type Criterio = 'alcance' | 'salvos' | 'compartilhamentos' | 'comentarios'
export const CRITERIOS: { id: Criterio; nome: string }[] = [
  { id: 'alcance', nome: 'Alcance' }, { id: 'salvos', nome: 'Salvos' }, { id: 'compartilhamentos', nome: 'Compartilhamentos' }, { id: 'comentarios', nome: 'Comentários' },
]
export type PostRanking = { post: PostIG; valor: number; vezes: number; comparacao: string }

const JANELA_MS = 60 * 86400000
const MINIMO_VIZINHOS = 8

export function rankingPosts(posts: PostIG[], criterio: Criterio, tipo: string, limite = 30): PostRanking[] {
  const quando = new Map(posts.map((p) => [p.id, new Date(p.publicado_em).getTime()]))
  const medianaPerto = (p: PostIG) => {
    const t = quando.get(p.id)!
    const vizinhos = posts.filter((x) => x.tipo === p.tipo && x.id !== p.id && Math.abs(quando.get(x.id)! - t) <= JANELA_MS)
    return vizinhos.length >= MINIMO_VIZINHOS ? mediana(vizinhos.map((x) => n(x, criterio))) : 0
  }
  return posts
    .filter((p) => (tipo === 'todos' || p.tipo === tipo) && n(p, criterio) > 0)
    .map((p) => {
      const med = medianaPerto(p)
      const valor = n(p, criterio), vezes = med ? valor / med : 0
      const nomeCriterio = CRITERIOS.find((c) => c.id === criterio)!.nome.toLowerCase()
      return { post: p, valor, vezes, comparacao: `${nomeCriterio} ${milhar(valor)}, ${vezes.toFixed(1).replace('.', ',')}× a mediana dos ${(NOME_TIPO[p.tipo] ?? p.tipo).toLowerCase()} da mesma época` }
    })
    .filter((r) => r.vezes > 0)
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
