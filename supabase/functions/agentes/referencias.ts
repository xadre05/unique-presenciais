// Referências para modelar (19/10/2026): posts, reels, carrosséis e textos de terceiros que a equipe guarda como
// modelo de FORMATO. O agente olha os prints (e os quadros que o navegador tira do vídeo), lê o texto colado e o
// "por que gosto", e escreve uma ficha: gancho, estrutura, visual, texto na tela, ritmo, linguagem e como trazer
// para a marca. As fichas entram na reunião de pauta e na escrita das peças do mesmo formato.
// Regra: copiar a forma, nunca o conteúdo, as frases, os dados ou a marca de terceiros.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { Dependencias } from './reuniao.ts'

type Referencia = {
  id: string; empresa_id: string; nome: string | null; canal: string | null; categoria: string; autor: string | null; link: string | null; formato: string
  por_que: string | null; texto: string | null; arquivos: { caminho: string; nome?: string; quadro?: boolean }[]; ficha: Ficha | null
}
type Ficha = {
  resumo: string; gancho?: string; estrutura?: string[]; visual?: string; texto_na_tela?: string; ritmo?: string
  linguagem?: string; por_que_funciona?: string; como_usar?: string; nao_copiar?: string
}

const CATEGORIA: Record<string, string> = { concorrente: 'concorrente', outro_nicho: 'outro nicho', admiro: 'quem admiramos', material: 'material comprado', outro: 'outra' }
const MAX_IMAGENS = 12

const FERRAMENTA_FICHA = {
  name: 'entregar_ficha',
  description: 'Entrega a ficha de modelo da referência.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Uma frase: que tipo de peça é e qual é a ideia de formato (ex.: "Reels com tela dividida: pergunta do paciente em cima, resposta da especialista embaixo")' },
      gancho: { type: 'string', description: 'Como prende nos primeiros 2 segundos ou na capa: o tipo de frase, a imagem, o movimento' },
      estrutura: { type: 'array', items: { type: 'string' }, description: 'A sequência, passo a passo (lâmina por lâmina, cena por cena ou bloco por bloco)' },
      visual: { type: 'string', description: 'Layout, enquadramento, divisão de tela, cores, tipografia, elementos gráficos' },
      texto_na_tela: { type: 'string', description: 'Como o texto aparece: legenda automática, palavra destacada, caixa, animação, posição, tamanho' },
      ritmo: { type: 'string', description: 'Ritmo de edição: cortes, duração das cenas, transições, música ou silêncio' },
      linguagem: { type: 'string', description: 'Como a pessoa fala ou escreve: tom, tamanho das frases, pessoa (eu/você), gírias, perguntas' },
      por_que_funciona: { type: 'string', description: 'Por que este formato prende e gera ação' },
      como_usar: { type: 'string', description: 'Como trazer este FORMATO para a marca da empresa, com 1 ou 2 exemplos de tema dela' },
      nao_copiar: { type: 'string', description: 'O que é do autor e NÃO pode ser usado: frases, dados, marca, bordões, personagens' },
    },
    required: ['resumo', 'gancho', 'estrutura', 'como_usar'],
  },
}

const SISTEMA = [
  'Você é o Agente de Marketing de uma empresa brasileira e estuda referências de conteúdo que a equipe guardou como modelo.',
  'Seu trabalho é decompor o FORMATO da peça para que a empresa possa usar o mesmo formato com o conteúdo dela.',
  'Descreva só o que dá para ver nos arquivos e no texto enviados; se algo não aparece (por exemplo, o áudio de um vídeo), diga que não dá para saber. Não invente.',
  'As imagens de um vídeo são quadros tirados em sequência, do começo ao fim.',
  'Nunca proponha copiar frases, dados, resultados, marca ou bordões do autor: o modelo é a forma, não o conteúdo.',
  'Escreva em português do Brasil, frases curtas e concretas. Responda chamando a ferramenta entregar_ficha.',
].join('\n')

function base64(bytes: Uint8Array) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

async function imagensDa(db: SupabaseClient, ref: Referencia) {
  const lista = ref.arquivos.filter((a) => /\.(jpe?g|png|webp)$/i.test(a.caminho)).slice(0, MAX_IMAGENS)
  const blocos = await Promise.all(lista.map(async (a) => {
    const { data } = await db.storage.from('arquivos').download(a.caminho)
    if (!data) return null
    const tipo = /\.png$/i.test(a.caminho) ? 'image/png' : /\.webp$/i.test(a.caminho) ? 'image/webp' : 'image/jpeg'
    return { type: 'image', source: { type: 'base64', media_type: tipo, data: base64(new Uint8Array(await data.arrayBuffer())) } }
  }))
  return { blocos: blocos.filter(Boolean), quadros: lista.some((a) => a.quadro) }
}

export async function analisarReferencia(d: Dependencias, db: SupabaseClient, empresa: string, id: string) {
  const { data } = await db.from('marca_referencias').select('*').eq('id', id).eq('empresa_id', empresa).eq('ativo', true).maybeSingle()
  const ref = data as Referencia | null
  if (!ref) throw new Error('Referência não encontrada.')
  await db.from('marca_referencias').update({ status: 'analisando', erro: null, atualizado_em: new Date().toISOString() }).eq('id', id)
  try {
    const { chave, pa, modelo } = await d.prepararAgente(db, empresa, 'marketing')
    const { blocos, quadros } = await imagensDa(db, ref)
    if (!blocos.length && !ref.texto?.trim()) throw new Error('Envie pelo menos um print, um vídeo ou o texto da peça.')
    const usuario = [
      `REFERÊNCIA${ref.nome ? ` "${ref.nome}"` : ''} (${CATEGORIA[ref.categoria] ?? ref.categoria}) · formato: ${ref.formato}${ref.canal ? ` · canal: ${ref.canal}` : ''}${ref.autor ? ` · de: ${ref.autor}` : ''}${ref.link ? ` · ${ref.link}` : ''}`,
      quadros ? 'As imagens acima são quadros do vídeo, em ordem.' : blocos.length ? 'As imagens acima são prints da peça, em ordem.' : '',
      ref.texto?.trim() ? `TEXTO DA PEÇA (legenda, texto das lâminas ou transcrição da fala):\n${ref.texto.trim().slice(0, 6000)}` : '',
      ref.por_que?.trim() ? `POR QUE A EQUIPE GOSTOU (dê peso a isto): ${ref.por_que.trim()}` : '',
      `A EMPRESA QUE VAI USAR O MODELO: ${String(pa.empresa ?? '')}. Vende: ${String(pa.o_que_vende ?? '').slice(0, 400)}. Para quem: ${String(pa.publico ?? '').slice(0, 300)}.`,
      'Escreva a ficha de modelo chamando a ferramenta entregar_ficha.',
    ].filter(Boolean).join('\n\n')
    const { entrega, entrada, saida } = await d.chamarClaude(chave, modelo, SISTEMA, [...blocos, { type: 'text', text: usuario }], FERRAMENTA_FICHA)
    const ficha = entrega as Ficha
    if (!ficha?.resumo) throw new Error('O agente não devolveu a ficha. Tente de novo.')
    const gasto = d.custo(modelo, entrada, saida)
    await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'marketing', tipo: 'referencia', status: 'pronto', pedido: { referencia: id }, resumo: ficha.resumo.slice(0, 200), modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: gasto, terminado_em: new Date().toISOString() })
    await db.from('marca_referencias').update({ ficha, status: 'pronta', atualizado_em: new Date().toISOString() }).eq('id', id)
    return { ficha }
  } catch (e) {
    await db.from('marca_referencias').update({ status: 'erro', erro: (e as Error).message, atualizado_em: new Date().toISOString() }).eq('id', id)
    throw e
  }
}

// formatos que servem de modelo para cada tipo de peça (reels e vídeo se ajudam)
const PARENTES: Record<string, string[]> = { reels: ['reels', 'video'], video: ['video', 'reels'], post: ['post', 'carrossel'], carrossel: ['carrossel', 'post'], stories: ['stories', 'reels'], texto: ['texto'], artigo: ['texto'], email: ['texto'], mensagem: ['texto'], pdf: ['carrossel'] }

async function fichasPara(db: SupabaseClient, empresa: string, tipos: string[], limite: number) {
  const formatos = [...new Set(tipos.flatMap((t) => PARENTES[t] ?? [t]))]
  if (!formatos.length) return []
  const { data } = await db.from('marca_referencias').select('nome,categoria,autor,formato,por_que,ficha').eq('empresa_id', empresa).eq('ativo', true).eq('status', 'pronta')
    .in('formato', formatos).order('atualizado_em', { ascending: false }).limit(limite)
  return (data ?? []) as Pick<Referencia, 'nome' | 'categoria' | 'autor' | 'formato' | 'por_que' | 'ficha'>[]
}

const nomeModelo = (r: { nome?: string | null; autor: string | null; formato: string; categoria: string }) => `${r.nome ? `"${r.nome}" · ` : ''}${r.formato}${r.autor ? ` de ${r.autor}` : ''} (${CATEGORIA[r.categoria] ?? r.categoria})`

// bloco para a escrita das peças: as fichas dos formatos pedidos
export async function blocoModelos(db: SupabaseClient, empresa: string, tipos: string[], limite = 4) {
  const refs = await fichasPara(db, empresa, tipos, limite)
  if (!refs.length) return ''
  const linhas = refs.map((r) => {
    const f = r.ficha!
    return [`- MODELO ${nomeModelo(r)}: ${f.resumo}`, f.gancho && `  gancho: ${f.gancho}`, f.estrutura?.length && `  estrutura: ${f.estrutura.join(' → ')}`,
      f.visual && `  visual: ${f.visual}`, f.texto_na_tela && `  texto na tela: ${f.texto_na_tela}`, f.ritmo && `  ritmo: ${f.ritmo}`,
      f.linguagem && `  linguagem: ${f.linguagem}`, f.como_usar && `  como usar na marca: ${f.como_usar}`, r.por_que && `  a equipe gosta porque: ${r.por_que}`].filter(Boolean).join('\n')
  })
  return [
    'MODELOS DE FORMATO que a equipe guardou (referências de terceiros). Quando o formato da peça combinar, siga a FORMA do modelo (gancho, estrutura, visual, texto na tela, ritmo) com o conteúdo da marca, e diga em "observacao" qual modelo seguiu. Nunca copie frases, dados, marca ou bordões do autor.',
    ...linhas,
  ].join('\n')
}

// lista curta para a pauta da reunião: o agente pode sugerir "um carrossel no modelo X"
export async function pautaModelos(db: SupabaseClient, empresa: string) {
  const { data } = await db.from('marca_referencias').select('nome,categoria,autor,formato,ficha').eq('empresa_id', empresa).eq('ativo', true).eq('status', 'pronta').order('atualizado_em', { ascending: false }).limit(12)
  const refs = (data ?? []) as Pick<Referencia, 'nome' | 'categoria' | 'autor' | 'formato' | 'ficha'>[]
  if (!refs.length) return '- Modelos de formato guardados: nenhum ainda.'
  return `- Modelos de formato guardados (pode sugerir usar um deles, pelo nome):\n${refs.map((r) => `  · ${nomeModelo(r)}: ${r.ficha?.resumo ?? ''}`).join('\n')}`
}
