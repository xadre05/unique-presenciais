// Criativos NOSSOS que venderam (21/10/2026): o ranking sai das vendas da Hotmart (o código de rastreio guarda qual
// anúncio do Facebook vendeu). A equipe sobe o vídeo do anúncio campeão (ou cola o texto); o navegador transcreve e tira
// quadros, e aqui o agente decompõe o ROTEIRO: gancho, argumento, prova, oferta, chamada e por que vendeu. Por ser
// da própria empresa, as frases podem ser reaproveitadas nos próximos roteiros (diferente das referências de terceiros).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { blocosDeQuadros, type Ia } from './canal.ts'

const texto = (descricao: string) => ({ type: 'string', description: descricao })
const FERRAMENTA = {
  name: 'entregar_roteiro', description: 'Entrega a decomposição do roteiro do criativo que vendeu.',
  input_schema: { type: 'object', required: ['resumo', 'gancho', 'estrutura', 'por_que_funciona', 'como_usar'], properties: {
    resumo: texto('Uma frase: que tipo de criativo é e qual é a ideia central que vendeu'),
    gancho: texto('A frase (ou imagem) de abertura, como foi dita, e por que prende'),
    estrutura: { type: 'array', items: { type: 'string' }, description: 'O roteiro cena por cena, com a fala resumida de cada uma (pode citar as frases fortes como foram ditas)' },
    argumento: texto('O argumento central: qual dor, desejo ou crença o vídeo usa para convencer'),
    prova: texto('O que dá credibilidade: números, resultados de alunos, autoridade, demonstração'),
    oferta: texto('Como a oferta é apresentada: o que leva, preço, condição, urgência (lote, vagas, prazo)'),
    texto_na_tela: texto('Textos e legendas que aparecem, se der para ver'),
    linguagem: texto('Tom e jeito de falar: frases curtas, perguntas, eu/você'),
    por_que_funciona: texto('Por que este roteiro vendeu, cruzando com os números de venda enviados'),
    como_usar: texto('Como reaproveitar na próxima campanha: 2 ou 3 variações de gancho e o que manter igual'),
  } },
}
const SISTEMA = [
  'Você é o Agente de Marketing de uma escola de harmonização orofacial e estuda os criativos DA PRÓPRIA EMPRESA que deram mais resultado (anúncios que venderam ou posts do Instagram que performaram acima da média).',
  'O foco é o ROTEIRO (o que é dito e em que ordem), não a edição. Use a transcrição como fonte principal e os quadros só para o que aparece na tela.',
  'Não invente fala que não está na transcrição. Se faltar transcrição, diga.',
  'As frases são da própria empresa: pode citá-las como foram ditas.',
  'Português do Brasil, frases curtas e concretas. Responda chamando a ferramenta entregar_roteiro.',
].join('\n')

// o Agente de Marketing aprende o campeão: uma linha na memória dele (entra em toda escrita e na reunião de pauta).
// Se o mesmo criativo for estudado de novo, a linha antiga é trocada.
const curto = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
async function ensinarMarketing(db: SupabaseClient, empresa: string, nome: string, resultado: string, f: Record<string, unknown>, rotulo = 'Roteiro que vendeu') {
  const marca = `${rotulo} "${nome}"`
  const texto = `${marca} (${resultado}): gancho — ${curto(f.gancho, 180)}; argumento — ${curto(f.argumento, 160)}; oferta — ${curto(f.oferta, 140)}; por que ${rotulo === 'Roteiro que vendeu' ? 'vendeu' : 'funcionou'} — ${curto(f.por_que_funciona, 160)}. ${rotulo === 'Roteiro que vendeu' ? 'Em roteiro de venda e anúncio, parta deste modelo' : 'Em conteúdo do mesmo formato, use este gancho e esta estrutura como modelo'} (as frases são nossas, pode reaproveitar; varie o gancho).`
  const { data } = await db.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle()
  if (!data) return
  const perfil = (data.perfil ?? {}) as Record<string, unknown>
  const memoria = ((Array.isArray(perfil.memoria) ? perfil.memoria : []) as { texto: string }[]).filter((m) => !m.texto.startsWith(marca))
  const nova = [...memoria, { texto, em: new Date().toISOString(), origem: 'resultado', fonte: 'criativo' }].slice(-40)
  await db.from('agentes_empresa').update({ perfil: { ...perfil, memoria: nova } }).eq('empresa_id', empresa).eq('agente_id', 'marketing')
}

type Criativo = { id: string; nome: string | null; texto: string | null; por_que: string | null; arquivos: { caminho: string; quadro?: boolean }[]; resultado: Record<string, unknown> | null }

export async function estudarCriativo(db: SupabaseClient, ia: Ia, empresa: string, id: string) {
  const { data } = await db.from('marca_referencias').select('id,nome,texto,por_que,arquivos,resultado').eq('id', id).eq('empresa_id', empresa).eq('categoria', 'nosso').maybeSingle()
  const c = data as Criativo | null
  if (!c) throw new Error('Criativo não encontrado.')
  if (!c.texto?.trim() && !c.arquivos?.length) throw new Error('Suba o vídeo do anúncio ou cole o texto dele.')
  await db.from('marca_referencias').update({ status: 'analisando', erro: null }).eq('id', id)
  try {
    const r = c.resultado ?? {}
    const usuario = [
      `CRIATIVO: ${c.nome ?? 'sem nome'}`,
      `RESULTADO: ${r.vendas ?? '?'} vendas, R$ ${r.receita ?? '?'} líquidos${r.campanha ? `, campanha "${r.campanha}"` : ''}${r.de ? `, de ${r.de} a ${r.ate}` : ''}${r.produtos ? `. Produto: ${r.produtos}` : ''}.`,
      c.por_que ? `O QUE A EQUIPE ACHA QUE FEZ VENDER: ${c.por_que}` : '',
      c.texto?.trim() ? `TRANSCRIÇÃO / TEXTO DO ANÚNCIO:\n${c.texto.trim().slice(0, 8000)}` : 'Sem transcrição.',
      'Decomponha o roteiro chamando a ferramenta entregar_roteiro.',
    ].filter(Boolean).join('\n\n')
    const quadros = await blocosDeQuadros(db, (c.arquivos ?? []).filter((a) => a.quadro).map((a) => a.caminho))
    const ficha = await ia(SISTEMA, [...quadros, { type: 'text', text: usuario }], FERRAMENTA, 'criativo', (e) => `Criativo ${c.nome ?? ''}: ${String(e.resumo ?? '')}`)
    if (!ficha?.resumo) throw new Error('O agente não devolveu a análise do roteiro. Tente de novo.')
    await db.from('marca_referencias').update({ ficha, status: 'pronta', atualizado_em: new Date().toISOString() }).eq('id', id)
    await ensinarMarketing(db, empresa, c.nome ?? 'criativo', `${r.vendas ?? '?'} compradores`, ficha)
    return { ficha }
  } catch (e) {
    await db.from('marca_referencias').update({ status: 'erro', erro: (e as Error).message, atualizado_em: new Date().toISOString() }).eq('id', id)
    throw e
  }
}

// ===== posts do Instagram que performaram (orgânico): o próprio sistema busca a mídia no Instagram, transcreve a fala
// do reels e estuda o roteiro; nada para a equipe baixar. A referência fica na categoria "nosso", ligada ao post.
const GRAPH = 'https://graph.instagram.com/v25.0'
type PostBanco = { id: string; externo_id: string; tipo: string; legenda: string | null; link: string | null; publicado_em: string; metricas: Record<string, number> }

async function imagemBloco(url: string) {
  const r = await fetch(url).catch(() => null)
  if (!r?.ok) return null
  const tipo = r.headers.get('content-type') ?? 'image/jpeg'
  if (!/image\/(jpeg|png|webp)/.test(tipo)) return null
  const bytes = new Uint8Array(await r.arrayBuffer())
  if (bytes.length > 4_500_000) return null
  let b = ''
  for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { type: 'image', source: { type: 'base64', media_type: tipo.split(';')[0], data: btoa(b) } }
}

// fala do reels: o vídeo vem do Instagram e vai direto para a transcrição (até 25 MB)
async function falaDoVideo(url: string, chaveOpenai: string) {
  const r = await fetch(url).catch(() => null)
  if (!r?.ok) return { fala: '', minutos: 0 }
  const video = await r.blob()
  if (video.size > 25 * 1024 * 1024) return { fala: '', minutos: 0 }
  const f = new FormData()
  f.append('file', video, 'reels.mp4'); f.append('model', 'whisper-1'); f.append('language', 'pt'); f.append('response_format', 'verbose_json')
  const t = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${chaveOpenai}` }, body: f })
  const corpo = await t.json().catch(() => ({}))
  return t.ok ? { fala: String(corpo.text ?? ''), minutos: Number(corpo.duration ?? 0) / 60 } : { fala: '', minutos: 0 }
}

export type Registro = (tipo: string, resumo: string, custo: number, modelo: string) => Promise<void>

export async function estudarPost(db: SupabaseClient, ia: Ia, registrar: Registro, empresa: string, postId: string, comparacao: string) {
  const { data } = await db.from('marca_posts').select('id,externo_id,tipo,legenda,link,publicado_em,metricas').eq('id', postId).eq('empresa_id', empresa).maybeSingle()
  const p = data as PostBanco | null
  if (!p) throw new Error('Post não encontrado.')
  const [{ data: token }, { data: chaveOpenai }] = await Promise.all([
    db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: 'instagram_token' }),
    db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: 'openai' }),
  ])
  if (!token) throw new Error('O Instagram não está conectado.')
  const m = await (await fetch(`${GRAPH}/${p.externo_id}?fields=media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}&access_token=${token}`)).json().catch(() => ({}))
  if (m?.error) throw new Error('O Instagram não devolveu a mídia deste post (pode ter sido apagado).')
  const capas = [m.thumbnail_url ?? (m.media_type !== 'VIDEO' ? m.media_url : null), ...((m.children?.data ?? []) as { media_type: string; media_url?: string; thumbnail_url?: string }[]).map((c) => c.thumbnail_url ?? (c.media_type !== 'VIDEO' ? c.media_url : null))].filter(Boolean).slice(0, 10) as string[]
  const imagens = (await Promise.all(capas.map(imagemBloco))).filter(Boolean)
  const video = m.media_type === 'VIDEO' && m.media_url && chaveOpenai ? await falaDoVideo(String(m.media_url), String(chaveOpenai)) : { fala: '', minutos: 0 }
  if (video.minutos) await registrar('transcricao', `Fala do post de ${p.publicado_em.slice(0, 10)}`, video.minutos * 0.006, 'whisper-1')
  const dia = new Date(p.publicado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const nome = `Instagram ${dia} · ${String(p.legenda ?? p.tipo).replace(/\s+/g, ' ').slice(0, 50)}`
  const mt = p.metricas ?? {}
  const resultado = { alcance: mt.alcance, salvos: mt.salvos, compartilhamentos: mt.compartilhamentos, comentarios: mt.comentarios, curtidas: mt.curtidas, comparacao, publicado_em: p.publicado_em }
  const texto = [p.legenda && `LEGENDA:\n${p.legenda}`, video.fala && `FALA DO VÍDEO:\n${video.fala}`].filter(Boolean).join('\n\n')
  // um post estudado de novo atualiza a mesma referência
  const { data: antiga } = await db.from('marca_referencias').select('id').eq('empresa_id', empresa).eq('categoria', 'nosso').eq('link', p.link ?? '-').maybeSingle()
  const id = antiga?.id ?? crypto.randomUUID()
  const linhaRef = { empresa_id: empresa, categoria: 'nosso', canal: 'instagram', formato: p.tipo === 'imagem' ? 'post' : p.tipo, nome, link: p.link, texto: texto || null, resultado, status: 'analisando', erro: null, arquivos: [] }
  const { error } = antiga ? await db.from('marca_referencias').update(linhaRef).eq('id', id) : await db.from('marca_referencias').insert({ id, ...linhaRef })
  if (error) throw new Error(error.message)
  try {
    const usuario = [
      `POST DO INSTAGRAM (${p.tipo}) de ${dia}: ${p.link ?? ''}`,
      `RESULTADO: ${Object.entries(mt).map(([k, v]) => `${k} ${v}`).join(' · ')}. ${comparacao}`,
      texto ? `TEXTO DO POST:\n${texto.slice(0, 8000)}` : 'Sem legenda nem fala.',
      imagens.length ? (p.tipo === 'reels' ? 'A imagem acima é a capa do reels.' : 'As imagens acima são as lâminas do post, em ordem.') : '',
      'É conteúdo ORGÂNICO (não é anúncio): em "oferta", diga se havia chamada para venda ou só relacionamento. Decomponha o roteiro chamando a ferramenta entregar_roteiro.',
    ].filter(Boolean).join('\n\n')
    const ficha = await ia(SISTEMA, [...imagens, { type: 'text', text: usuario }], FERRAMENTA, 'criativo', (e) => `Post ${dia}: ${String(e.resumo ?? '')}`)
    if (!ficha?.resumo) throw new Error('O agente não devolveu a análise do post. Tente de novo.')
    await db.from('marca_referencias').update({ ficha, status: 'pronta', atualizado_em: new Date().toISOString() }).eq('id', id)
    await ensinarMarketing(db, empresa, `${p.tipo} de ${dia}`, comparacao || `alcance ${mt.alcance ?? '?'}`, ficha, 'Post que performou')
    return { ficha, id }
  } catch (e) {
    await db.from('marca_referencias').update({ status: 'erro', erro: (e as Error).message, atualizado_em: new Date().toISOString() }).eq('id', id)
    throw e
  }
}
