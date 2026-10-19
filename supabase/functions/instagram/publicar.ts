// Publicação no Instagram (19/10/2026): cada linha de marca_publicacoes vira um post na hora marcada. O fluxo do
// Instagram é em duas etapas: cria o "contêiner" com a mídia (o Instagram baixa a imagem ou o vídeo por um link
// temporário do nosso armazenamento) e, quando ele fica pronto, publica. Vídeo pode levar minutos: o contêiner fica
// guardado e o cron (a cada 5 minutos) tenta de novo. Publicado, o post entra em marca_posts já como "feito pelo agente".
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const GRAPH = 'https://graph.instagram.com/v25.0'
const LIMITE_LEGENDA = 2200
type Midia = { bucket: string; caminho: string; tipo: 'imagem' | 'video' }
type Publicacao = {
  id: string; empresa_id: string; peca_id: string | null; formato: 'imagem' | 'carrossel' | 'reels' | 'stories'; midias: Midia[]
  legenda: string | null; status: string; tentativas: number; container_id: string | null; criado_em: string
}
export type Credenciais = (empresa: string) => Promise<{ token: string; conta: string }>
const TIPO_POST: Record<Publicacao['formato'], string> = { imagem: 'imagem', carrossel: 'carrossel', reels: 'reels', stories: 'stories' }

async function chamar(caminho: string, params: Record<string, string>, token: string, metodo: 'GET' | 'POST' = 'POST') {
  const r = await fetch(`${GRAPH}/${caminho}?${new URLSearchParams({ ...params, access_token: token })}`, { method: metodo })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d?.error) throw new Error(`O Instagram recusou: ${d?.error?.error_user_msg ?? d?.error?.message ?? `erro ${r.status}`}`)
  return d as Record<string, string>
}
const statusDo = async (container: string, token: string) => (await chamar(container, { fields: 'status_code' }, token, 'GET')).status_code

async function linkTemporario(db: SupabaseClient, m: Midia) {
  const { data, error } = await db.storage.from(m.bucket).createSignedUrl(m.caminho, 7200)
  if (error || !data?.signedUrl) throw new Error(`Não achei o arquivo ${m.caminho.split('/').pop()} no armazenamento.`)
  return data.signedUrl
}

// vídeo dentro do carrossel precisa estar pronto antes de montar o carrossel (espera até ~1 minuto)
async function esperarPronto(container: string, token: string) {
  for (let i = 0; i < 12; i++) {
    const s = await statusDo(container, token)
    if (s === 'FINISHED') return
    if (s === 'ERROR' || s === 'EXPIRED') throw new Error('O Instagram não aceitou um dos vídeos do carrossel. Confira formato e duração.')
    await new Promise((ok) => setTimeout(ok, 5000))
  }
  throw new Error('Um vídeo do carrossel demorou demais para processar. Tente de novo.')
}

async function criarContainer(db: SupabaseClient, p: Publicacao, token: string, conta: string) {
  const legenda = (p.legenda ?? '').slice(0, LIMITE_LEGENDA)
  const urls = await Promise.all(p.midias.map((m) => linkTemporario(db, m)))
  const video = p.midias.findIndex((m) => m.tipo === 'video'), imagem = p.midias.findIndex((m) => m.tipo === 'imagem')
  if (p.formato === 'imagem') {
    if (imagem < 0) throw new Error('Falta a imagem do post.')
    return (await chamar(`${conta}/media`, { image_url: urls[imagem], caption: legenda }, token)).id
  }
  if (p.formato === 'stories') {
    const i = video >= 0 ? video : imagem
    if (i < 0) throw new Error('Falta a imagem ou o vídeo do story.')
    return (await chamar(`${conta}/media`, { media_type: 'STORIES', ...(video >= 0 ? { video_url: urls[i] } : { image_url: urls[i] }) }, token)).id
  }
  if (p.formato === 'reels') {
    if (video < 0) throw new Error('Falta o vídeo do Reels.')
    return (await chamar(`${conta}/media`, { media_type: 'REELS', video_url: urls[video], caption: legenda, share_to_feed: 'true', ...(imagem >= 0 ? { cover_url: urls[imagem] } : {}) }, token)).id
  }
  if (p.midias.length < 2) throw new Error('O carrossel precisa de pelo menos 2 lâminas.')
  const filhos: string[] = []
  for (const [i, m] of p.midias.entries()) {
    const filho = (await chamar(`${conta}/media`, m.tipo === 'video' ? { media_type: 'VIDEO', video_url: urls[i], is_carousel_item: 'true' } : { image_url: urls[i], is_carousel_item: 'true' }, token)).id
    if (m.tipo === 'video') await esperarPronto(filho, token)
    filhos.push(filho)
  }
  return (await chamar(`${conta}/media`, { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda }, token)).id
}

const atualizar = (db: SupabaseClient, id: string, campos: Record<string, unknown>) => db.from('marca_publicacoes').update(campos).eq('id', id)

// devolve o que aconteceu: publicada, processando (vídeo ainda no Instagram) ou o erro
export async function processar(db: SupabaseClient, p: Publicacao, credenciais: Credenciais): Promise<string> {
  if (p.status === 'agendada') {
    const { data } = await db.from('marca_publicacoes').update({ status: 'publicando', tentativas: p.tentativas + 1, erro: null }).eq('id', p.id).eq('status', 'agendada').select('id')
    if (!data?.length) return 'já estava sendo publicada'
  }
  try {
    const { token, conta } = await credenciais(p.empresa_id)
    let container = p.container_id
    if (!container) { container = await criarContainer(db, p, token, conta); await atualizar(db, p.id, { container_id: container }) }
    const status = await statusDo(container, token)
    if (status === 'IN_PROGRESS') return 'processando'
    if (status !== 'FINISHED') throw new Error(status === 'EXPIRED' ? 'O Instagram descartou a mídia (passou de 24 horas). Agende de novo.' : 'O Instagram não aceitou a mídia. Confira formato, proporção e tamanho.')
    const publicado = await chamar(`${conta}/media_publish`, { creation_id: container }, token)
    const info = await chamar(publicado.id, { fields: 'permalink,timestamp' }, token, 'GET').catch(() => ({} as Record<string, string>))
    const agora = new Date().toISOString()
    await atualizar(db, p.id, { status: 'publicada', media_id: publicado.id, link: info.permalink ?? null, publicado_em: agora, erro: null })
    if (p.peca_id) await db.from('agentes_pecas').update({ status: 'postada' }).eq('id', p.peca_id)
    await db.from('marca_posts').upsert({
      empresa_id: p.empresa_id, rede: 'instagram', externo_id: publicado.id, tipo: TIPO_POST[p.formato], legenda: p.legenda, link: info.permalink ?? null,
      publicado_em: info.timestamp ?? agora, metricas: {}, peca_id: p.peca_id, origem: 'agente', atualizado_em: agora,
    }, { onConflict: 'empresa_id,rede,externo_id' })
    return 'publicada'
  } catch (e) {
    const msg = (e as Error).message
    await atualizar(db, p.id, { status: 'erro', erro: msg })
    return msg
  }
}

const COLUNAS = 'id,empresa_id,peca_id,formato,midias,legenda,status,tentativas,container_id,criado_em'

export async function publicarPendentes(db: SupabaseClient, credenciais: Credenciais) {
  // "publicando" sem contêiner há mais de 15 minutos: a tentativa caiu no meio; vira erro para a equipe tentar de novo
  await db.from('marca_publicacoes').update({ status: 'erro', erro: 'A publicação foi interrompida no meio. Clique em Tentar de novo.' })
    .eq('status', 'publicando').is('container_id', null).lt('criado_em', new Date(Date.now() - 15 * 60000).toISOString())
  const [{ data: devidas }, { data: emVideo }] = await Promise.all([
    db.from('marca_publicacoes').select(COLUNAS).eq('status', 'agendada').lte('quando', new Date().toISOString()).order('quando').limit(10),
    db.from('marca_publicacoes').select(COLUNAS).eq('status', 'publicando').not('container_id', 'is', null).limit(10),
  ])
  const feitas: Record<string, string> = {}
  for (const p of [...(emVideo ?? []), ...(devidas ?? [])] as Publicacao[]) feitas[p.id] = await processar(db, p, credenciais)
  return feitas
}

export async function publicarAgora(db: SupabaseClient, empresa: string, id: string, credenciais: Credenciais) {
  const { data } = await db.from('marca_publicacoes').select(COLUNAS).eq('id', id).eq('empresa_id', empresa).maybeSingle()
  if (!data) throw new Error('Agendamento não encontrado.')
  const p = data as Publicacao
  if (p.status === 'publicada' || p.status === 'cancelada') throw new Error('Este agendamento já foi publicado ou cancelado.')
  // "tentar de novo" depois de erro: volta para a fila, começando do zero
  if (p.status === 'erro') { await atualizar(db, p.id, { status: 'agendada', container_id: null, erro: null }); p.status = 'agendada'; p.container_id = null }
  return { resultado: await processar(db, p, credenciais) }
}
