// Liga cada post publicado à peça do agente que o originou (19/10/2026): mesma legenda (ou quase) e data perto
// do dia planejado. Post ligado vira "feito pelo agente" e a peça aprovada passa a "publicada". O que não casa fica
// sem origem e aparece como "feito fora"; a equipe pode corrigir na tela (a origem marcada à mão não é tocada).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const DIAS_DE_FOLGA = 3
const SEMELHANCA_MINIMA = 0.5

const palavras = (t: string) => new Set(t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4))
function semelhanca(a: Set<string>, b: Set<string>) {
  if (a.size < 5 || b.size < 5) return 0
  let comuns = 0
  for (const w of a) if (b.has(w)) comuns++
  return comuns / Math.min(a.size, b.size)
}
const distanciaDias = (a: string, b: string) => Math.abs(new Date(a + 'T12:00:00Z').getTime() - new Date(b + 'T12:00:00Z').getTime()) / 86400000
const diaBR = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 10)

type PostSolto = { id: string; legenda: string | null; publicado_em: string }
type PecaPublicavel = { id: string; dia: string; status: string; conteudo: { legenda?: string; rede?: string } }

export async function ligarPecas(db: SupabaseClient, empresa: string) {
  const desde = new Date(Date.now() - 60 * 86400000).toISOString()
  const [{ data: posts }, { data: pecas }, { data: jaLigadas }] = await Promise.all([
    db.from('marca_posts').select('id,legenda,publicado_em').eq('empresa_id', empresa).eq('rede', 'instagram').is('peca_id', null).is('origem', null).gte('publicado_em', desde),
    db.from('agentes_pecas').select('id,dia,status,conteudo').eq('empresa_id', empresa).eq('agente_id', 'marketing').in('status', ['aprovada', 'postada']).gte('dia', desde.slice(0, 10)),
    db.from('marca_posts').select('peca_id').eq('empresa_id', empresa).not('peca_id', 'is', null),
  ])
  const usadas = new Set((jaLigadas ?? []).map((x) => String(x.peca_id)))
  const livres = ((pecas ?? []) as PecaPublicavel[]).filter((p) => !usadas.has(p.id) && (p.conteudo.rede ?? 'instagram') === 'instagram' && p.conteudo.legenda)
  let ligados = 0
  for (const post of (posts ?? []) as PostSolto[]) {
    const doPost = palavras(post.legenda ?? ''), dia = diaBR(post.publicado_em)
    const melhor = livres.filter((p) => !usadas.has(p.id) && distanciaDias(p.dia, dia) <= DIAS_DE_FOLGA)
      .map((p) => ({ p, nota: semelhanca(doPost, palavras(p.conteudo.legenda ?? '')) })).sort((a, b) => b.nota - a.nota)[0]
    if (!melhor || melhor.nota < SEMELHANCA_MINIMA) continue
    usadas.add(melhor.p.id)
    await db.from('marca_posts').update({ peca_id: melhor.p.id, origem: 'agente' }).eq('id', post.id)
    if (melhor.p.status === 'aprovada') await db.from('agentes_pecas').update({ status: 'postada' }).eq('id', melhor.p.id)
    ligados++
  }
  return ligados
}
