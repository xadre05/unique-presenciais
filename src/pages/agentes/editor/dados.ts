// Dados do Agente Editor de Vídeo fora da peça: o "estilo da casa" (como a empresa quer os vídeos editados, sem
// precisar pedir em cada um) e a criação de um vídeo novo para editar direto do editor.
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { EMPRESA } from '../marketing/useMarketing'

export type Estilo = {
  legenda: 'palavras' | 'chave'; efeitos: 'muitos' | 'poucos' | 'nenhum'; imagens: 'muitas' | 'algumas' | 'poucas'
  tela_dividida: boolean; zoom: boolean; observacoes?: string
}
// padrão de criativo que vende: legenda falada, efeitos, bastante imagem, tela dividida e zoom
export const ESTILO_PADRAO: Estilo = { legenda: 'palavras', efeitos: 'muitos', imagens: 'muitas', tela_dividida: true, zoom: true }

export function usePerfilEditor() {
  return useConsulta<{ perfil: Record<string, unknown> } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA).eq('agente_id', 'editor').maybeSingle())
}
export const estiloDe = (perfil?: Record<string, unknown>) => ({ ...ESTILO_PADRAO, ...((perfil?.estilo ?? {}) as Partial<Estilo>) })

// lê o perfil de novo antes de gravar, para não apagar a memória que o agente guardou nesse meio-tempo
export async function guardarEstilo(estilo: Estilo) {
  const { data } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA).eq('agente_id', 'editor').maybeSingle()
  const { error } = await supabase.from('agentes_empresa').update({ perfil: { ...((data?.perfil ?? {}) as Record<string, unknown>), estilo } }).eq('empresa_id', EMPRESA).eq('agente_id', 'editor')
  return error?.message ?? null
}

export type NovoVideo = { titulo: string; finalidade: 'anuncio' | 'organico'; campanha?: string; roteiro: string }

// cria a peça de reels (o roteiro colado vira as cenas, separadas por linha em branco) e devolve o id para abrir a edição
// extra = mais campos do conteúdo (ex.: o corte de um vídeo longo, com a fala já transcrita)
export async function criarVideo(v: NovoVideo, extra: Record<string, unknown> = {}): Promise<{ id?: string; erro?: string }> {
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
  const { data: t, error: e1 } = await supabase.from('agentes_trabalhos').insert({
    empresa_id: EMPRESA, agente_id: 'editor', tipo: 'video_novo', status: 'pronto', pedido: { titulo: v.titulo }, resumo: `Vídeo novo para editar: ${v.titulo}`, custo_usd: 0, terminado_em: new Date().toISOString(),
  }).select('id').single()
  if (e1 || !t) return { erro: e1?.message ?? 'Não consegui criar o vídeo.' }
  const roteiro = v.roteiro.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
  const { data: p, error: e2 } = await supabase.from('agentes_pecas').insert({
    trabalho_id: t.id, empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'reels', dia: hoje, titulo: v.titulo.trim(), status: 'rascunho',
    conteudo: { rede: 'instagram', campanha: v.campanha || undefined, briefing: { finalidade: v.finalidade }, roteiro: roteiro.length ? roteiro : undefined, origem: 'editor', ...extra },
  }).select('id').single()
  if (e2 || !p) return { erro: e2?.message ?? 'Não consegui criar o vídeo.' }
  return { id: p.id }
}
