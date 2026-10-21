// Estudar um canal (21/10/2026): a equipe baixa de 3 a 10 vídeos de um canal do YouTube ou do Instagram de que gosta.
// O navegador tira quadros de cada vídeo, mede os cortes por minuto e transcreve a fala; aqui o agente estuda um vídeo
// por vez (chamada curta, sem estourar o tempo da função) e no fim escreve a ficha do PADRÃO do canal. A ficha do
// canal tem o mesmo formato das outras referências (o Agente de Marketing já usa) e um campo "edicao" para o editor.
// Regra: copiar a forma, nunca as frases, os dados, a marca ou os bordões de quem fez.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

export type Ia = (sistema: string, conteudo: unknown[], ferramenta: Record<string, unknown>, tipo: string, resumo: (e: Record<string, unknown>) => string) => Promise<Record<string, unknown> | undefined>
type Video = { nome: string; duracao: number; quadros: string[]; cortes_por_min?: number; palavras_por_min?: number; fala?: string; ficha?: Record<string, unknown>; erro?: string }
type Canal = { id: string; nome: string | null; autor: string | null; canal: string | null; formato: string; por_que: string | null; videos: Video[] }

const MAX_QUADROS = 16
const texto = (descricao: string) => ({ type: 'string', description: descricao })
const CAMPOS = {
  resumo: texto('Uma frase: que tipo de vídeo é e qual é a ideia de formato'),
  gancho: texto('Como prende nos primeiros 3 segundos: tipo de frase, imagem, movimento, texto na tela'),
  estrutura: { type: 'array', items: { type: 'string' }, description: 'A sequência, bloco por bloco, do começo ao fim' },
  visual: texto('Enquadramento, cenário, luz, tela dividida, imagens por cima da fala, cores, elementos gráficos'),
  texto_na_tela: texto('Legenda (quantas palavras por vez, destaque de palavra, cor, posição), títulos, palavras-chave em caixa'),
  ritmo: texto('Cortes (use os cortes por minuto medidos), duração das cenas, zoom, transições, efeitos sonoros e música, se der para saber'),
  linguagem: texto('Como a pessoa fala: tom, tamanho das frases, eu/você, perguntas, velocidade (use as palavras por minuto medidas)'),
}
const FERRAMENTA_VIDEO = { name: 'entregar_video', description: 'Entrega a análise de UM vídeo do canal.', input_schema: { type: 'object', properties: CAMPOS, required: ['resumo', 'gancho', 'estrutura', 'ritmo'] } }
const FERRAMENTA_CANAL = {
  name: 'entregar_canal', description: 'Entrega a ficha do padrão do canal.',
  input_schema: { type: 'object', required: ['resumo', 'gancho', 'estrutura', 'como_usar', 'edicao'], properties: {
    ...CAMPOS,
    resumo: texto('Uma frase: o formato que o canal repete'),
    estrutura: { type: 'array', items: { type: 'string' }, description: 'A estrutura que se repete nos vídeos, bloco por bloco' },
    variacoes: texto('O que muda de um vídeo para outro (tipos de vídeo do canal)'),
    por_que_funciona: texto('Por que esse formato prende e gera ação'),
    edicao: texto('Instruções diretas para um editor reproduzir o estilo: legenda (palavras ou palavras-chave, quantas por vez, destaque), zoom (a cada quantos segundos), imagens por cima da fala (quanto do vídeo), tela dividida, efeitos sonoros, ritmo de corte, duração ideal'),
    como_usar: texto('Como trazer este formato para a marca da empresa, com 2 exemplos de tema dela'),
    nao_copiar: texto('O que é do autor e não pode ser usado: frases, dados, marca, bordões, personagens'),
  } },
}

const SISTEMA = [
  'Você estuda vídeos de um canal que a equipe de uma empresa brasileira admira, para aprender o FORMATO e o estilo de edição.',
  'Descreva só o que dá para ver nos quadros, na transcrição e nas medidas enviadas. Se algo não dá para saber (ex.: música e efeitos sonoros, que você não ouve), diga isso. Não invente.',
  'Os quadros estão em ordem; cada um tem o segundo em que foi tirado. Os primeiros são mais próximos para mostrar o gancho.',
  'Nunca proponha copiar frases, dados, resultados, marca ou bordões do autor: o modelo é a forma.',
  'Português do Brasil, frases curtas e concretas.',
].join('\n')

const base64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const segundo = (caminho: string) => Number(/_(\d+(?:\.\d+)?)s\.jpg$/.exec(caminho)?.[1] ?? NaN)

async function quadrosDo(db: SupabaseClient, video: Video) {
  const blocos = await Promise.all(video.quadros.slice(0, MAX_QUADROS).map(async (caminho) => {
    const { data } = await db.storage.from('arquivos').download(caminho)
    if (!data) return []
    const s = segundo(caminho)
    return [{ type: 'text', text: Number.isFinite(s) ? `Quadro em ${s.toFixed(1)} s:` : 'Quadro:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64(new Uint8Array(await data.arrayBuffer())) } }]
  }))
  return blocos.flat()
}

async function lerCanal(db: SupabaseClient, empresa: string, id: string) {
  const { data } = await db.from('marca_referencias').select('id,nome,autor,canal,formato,por_que,videos').eq('id', id).eq('empresa_id', empresa).eq('tipo', 'canal').maybeSingle()
  if (!data) throw new Error('Canal não encontrado.')
  return data as Canal
}
const cabecalho = (c: Canal) => `CANAL: ${c.nome ?? 'sem nome'}${c.autor ? ` (${c.autor})` : ''}${c.canal ? ` · ${c.canal}` : ''} · ${c.formato === 'video' ? 'vídeos longos' : 'reels'}`

// um vídeo do canal: devolve a análise e guarda dentro da lista de vídeos
export async function estudarVideo(db: SupabaseClient, ia: Ia, empresa: string, id: string, n: number) {
  const c = await lerCanal(db, empresa, id)
  const v = c.videos[n]
  if (!v) throw new Error('Vídeo não encontrado no canal.')
  const medidas = [`duração ${Math.round(v.duracao)} s`, v.cortes_por_min != null && `${v.cortes_por_min.toFixed(1)} trocas bruscas de imagem por minuto nos 2 primeiros minutos (corte de cena, zoom, imagem por cima; corte seco com o mesmo enquadramento pode não contar — veja também as pausas na transcrição)`, v.palavras_por_min != null && `${Math.round(v.palavras_por_min)} palavras por minuto`].filter(Boolean).join(' · ')
  const usuario = [
    cabecalho(c), `VÍDEO ${n + 1}: ${v.nome}`, `MEDIDAS: ${medidas}`,
    v.fala ? `TRANSCRIÇÃO DA FALA (com o segundo):\n${v.fala}` : 'Sem transcrição da fala (não deu para tirar o áudio).',
    'Analise este vídeo chamando a ferramenta entregar_video.',
  ].join('\n\n')
  const ficha = await ia(SISTEMA, [...await quadrosDo(db, v), { type: 'text', text: usuario }], FERRAMENTA_VIDEO, 'canal_video', (e) => `Canal ${c.nome ?? ''}, vídeo ${n + 1}: ${String(e.resumo ?? '')}`)
  if (!ficha?.resumo) throw new Error('O agente não devolveu a análise do vídeo. Tente de novo.')
  const atual = await lerCanal(db, empresa, id) // outro vídeo pode ter sido salvo enquanto este era estudado
  const videos = atual.videos.map((x, k) => (k === n ? { ...x, ficha, erro: undefined } : x))
  await db.from('marca_referencias').update({ videos, atualizado_em: new Date().toISOString() }).eq('id', id)
  return { ficha }
}

// o padrão do canal, a partir das análises de cada vídeo (só texto: barato)
export async function fecharCanal(db: SupabaseClient, ia: Ia, empresa: string, id: string, empresaDescricao: string) {
  const c = await lerCanal(db, empresa, id)
  const estudados = c.videos.filter((v) => v.ficha)
  if (!estudados.length) throw new Error('Nenhum vídeo do canal foi estudado ainda.')
  const usuario = [
    cabecalho(c),
    c.por_que ? `O QUE A EQUIPE GOSTA NESTE CANAL (dê peso a isto): ${c.por_que}` : '',
    ...estudados.map((v, k) => `VÍDEO ${k + 1} (${Math.round(v.duracao)} s${v.cortes_por_min != null ? `, ${v.cortes_por_min.toFixed(1)} cortes/min` : ''}${v.palavras_por_min != null ? `, ${Math.round(v.palavras_por_min)} palavras/min` : ''}):\n${JSON.stringify(v.ficha)}`),
    `A EMPRESA QUE VAI USAR O MODELO: ${empresaDescricao}`,
    'Encontre o que se REPETE entre os vídeos (é isso que a equipe gosta) e escreva a ficha do canal chamando a ferramenta entregar_canal.',
  ].filter(Boolean).join('\n\n')
  await db.from('marca_referencias').update({ status: 'analisando', erro: null }).eq('id', id)
  try {
    const ficha = await ia(SISTEMA, [{ type: 'text', text: usuario }], FERRAMENTA_CANAL, 'canal', (e) => `Canal ${c.nome ?? ''}: ${String(e.resumo ?? '')}`)
    if (!ficha?.resumo) throw new Error('O agente não devolveu a ficha do canal. Tente de novo.')
    await db.from('marca_referencias').update({ ficha, status: 'pronta', atualizado_em: new Date().toISOString() }).eq('id', id)
    return { ficha }
  } catch (e) {
    await db.from('marca_referencias').update({ status: 'erro', erro: (e as Error).message, atualizado_em: new Date().toISOString() }).eq('id', id)
    throw e
  }
}
