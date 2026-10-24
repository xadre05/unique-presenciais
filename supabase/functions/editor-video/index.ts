// Agente Editor de Vídeo (21/10/2026), contratado à parte: o custo e a memória dele ficam no agente 'editor'.
// O vídeo bruto NÃO passa por aqui: fica no computador de quem edita. O navegador tira só o áudio (leve) e manda para transcrever; depois manda as palavras com o tempo de cada uma,
// e o agente devolve a "receita" da edição (trechos que ficam, legenda, texto na tela, zoom). A receita é um JSON
// pequeno guardado na peça; o vídeo final é montado no navegador.
//   POST multipart { acao: 'transcrever', empresa, peca, audio (wav) } → { palavras, duracao, idioma }
//   POST json { acao: 'editar', empresa, peca, palavras, duracao, midias?, pedido?, modelo_ref? } → { plano }
//   midias = imagens e clipes de apoio que a equipe escolheu (número, tipo, o que é e uma miniatura pequena)
//   POST json { acao: 'canal_video', empresa, canal, n } e { acao: 'canal', empresa, canal } → estudar um canal (canal.ts)
//   POST json { acao: 'criativo', empresa, id } → roteiro de um criativo nosso que vendeu (criativo.ts)
//   POST json { acao: 'post_instagram', empresa, post, comparacao } → roteiro de um post nosso que performou (criativo.ts)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { estudarVideo, fecharCanal, type Ia } from './canal.ts'
import { estudarCriativo, estudarPost } from './criativo.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// preços (US$): Whisper por minuto de áudio; Claude por milhão de tokens
const WHISPER_POR_MIN = 0.006
const PRECO: Record<string, { entrada: number; saida: number }> = { 'claude-sonnet-5-5': { entrada: 2, saida: 10 }, 'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 } }
const arred = (n: number) => Math.round(n * 10000) / 10000
// palavras da área que a transcrição costuma errar
const VOCABULARIO = 'Harmonização orofacial, HOF, toxina botulínica, preenchimento, ácido hialurônico, bioestimulador, Unique HOF Academy, Unique Codes, Mini Residência, Black Friday Limited Edition, intercorrência, Brasília.'

type Palavra = { p: string; i: number; f: number }

async function registrar(db: SupabaseClient, empresa: string, tipo: string, peca: string, resumo: string, custo: number, modelo: string, ent = 0, sai = 0) {
  await db.from('agentes_trabalhos').insert({
    empresa_id: empresa, agente_id: 'editor', tipo, status: 'pronto', pedido: { peca }, resumo: resumo.slice(0, 200),
    modelo, tokens_entrada: ent, tokens_saida: sai, custo_usd: arred(custo), terminado_em: new Date().toISOString(),
  })
}

async function transcrever(db: SupabaseClient, form: FormData) {
  const empresa = String(form.get('empresa') ?? ''), peca = String(form.get('peca') ?? '')
  const { data: ag } = await db.from('agentes_empresa').select('ativo').eq('empresa_id', empresa).eq('agente_id', 'editor').maybeSingle()
  if (!ag?.ativo) throw new Error('A empresa não tem o Agente Editor de Vídeo ligado.')
  const audio = form.get('audio')
  if (!(audio instanceof File)) throw new Error('Faltou o áudio do vídeo.')
  if (audio.size > 25 * 1024 * 1024) throw new Error('O áudio passou de 25 MB (vídeo de mais de ~13 minutos). Divida o vídeo em partes.')
  const { data: chave } = await db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: 'openai' })
  if (!chave) throw new Error('Falta cadastrar a chave da OpenAI em Agentes → Configurações (ela faz a transcrição).')
  const f = new FormData()
  f.append('file', audio, 'audio.wav')
  f.append('model', 'whisper-1')
  f.append('language', 'pt')
  f.append('response_format', 'verbose_json')
  f.append('timestamp_granularities[]', 'word')
  f.append('prompt', VOCABULARIO)
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: f })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = String(corpo?.error?.message ?? `erro ${r.status}`)
    if (/billing|quota|credit/i.test(msg)) throw new Error('A conta da OpenAI está sem crédito. Coloque crédito em platform.openai.com → Settings → Billing.')
    throw new Error(`A transcrição falhou: ${msg}`)
  }
  const palavras: Palavra[] = (corpo.words ?? []).map((w: { word: string; start: number; end: number }) => ({ p: String(w.word).trim(), i: Number(w.start), f: Number(w.end) }))
  const duracao = Number(corpo.duration ?? 0)
  await registrar(db, empresa, 'transcricao', peca, `Transcrição de ${Math.round(duracao)} s de vídeo`, (duracao / 60) * WHISPER_POR_MIN, 'whisper-1')
  return { palavras, duracao, texto: String(corpo.text ?? '') }
}

const FERRAMENTA = {
  name: 'entregar_edicao',
  description: 'Entrega a receita de edição do vídeo.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Em 2 ou 3 frases: o que você cortou e por quê, e como ficou a abertura' },
      trechos: { type: 'array', description: 'Trechos que FICAM no vídeo, em ordem, pelos números das palavras (inclusive). Tudo o que não estiver aqui sai: tomadas erradas, frases repetidas (fica a melhor, normalmente a última), "é…", "né", começo e fim mortos.',
        items: { type: 'object', properties: { de: { type: 'integer' }, ate: { type: 'integer' } }, required: ['de', 'ate'] } },
      correcoes: { type: 'array', description: 'Palavras que a transcrição errou (nome de produto, termo técnico): número da palavra e como escrever na legenda',
        items: { type: 'object', properties: { palavra: { type: 'integer' }, texto: { type: 'string' } }, required: ['palavra', 'texto'] } },
      destaques: { type: 'array', items: { type: 'integer' }, description: 'Números das palavras-chave da legenda: a palavra mais forte de cada frase (1 a cada 4 a 6 palavras). Aparecem maiores, sozinhas na linha, numa tarja dourada.' },
      textos: { type: 'array', description: 'Texto grande na tela em momentos-chave (gancho, número, oferta, chamada), como no roteiro. Até 6 palavras cada.',
        items: { type: 'object', properties: { de: { type: 'integer', description: 'palavra em que aparece' }, ate: { type: 'integer', description: 'palavra em que some' }, texto: { type: 'string' }, posicao: { type: 'string', enum: ['topo', 'meio'] },
          animacao: { type: 'string', enum: ['pop', 'deslizar', 'digitar'], description: 'pop = cresce e assenta (padrão, gancho e oferta); digitar = letra por letra (pergunta, número, frase de efeito); deslizar = entra de lado (itens de lista)' } }, required: ['de', 'ate', 'texto'] } },
      zooms: { type: 'array', description: 'Aproximação da câmera para dar ritmo: no gancho e nas frases fortes, nunca seguidos. intensidade de 1.08 a 1.25.',
        items: { type: 'object', properties: { de: { type: 'integer' }, ate: { type: 'integer' }, intensidade: { type: 'number' } }, required: ['de', 'ate'] } },
      legenda: { type: 'object', properties: { palavras_por_vez: { type: 'integer', description: '1 a 4' }, caixa_alta: { type: 'boolean' }, posicao: { type: 'string', enum: ['baixo', 'meio'] },
        estilo: { type: 'string', enum: ['palavras', 'chave', 'nenhuma'], description: 'palavras = legenda falada palavra por palavra (padrão); chave = só palavras-chave em caixa, estilo documentário (preencha "chaves"); nenhuma = sem legenda' } } },
      chaves: { type: 'array', description: 'Só no estilo de legenda "chave": as palavras-chave que aparecem em caixa enquanto a pessoa fala, 2 a 4 palavras cada, cobrindo o vídeo todo sem buracos longos',
        items: { type: 'object', properties: { de: { type: 'integer' }, ate: { type: 'integer' }, texto: { type: 'string' } }, required: ['de', 'ate', 'texto'] } },
      coberturas: { type: 'array', description: 'Momentos em que uma MÍDIA DE APOIO enviada pela equipe aparece por cima da fala (a voz continua). Use o número da mídia.',
        items: { type: 'object', properties: {
          de: { type: 'integer', description: 'palavra em que a mídia entra' }, ate: { type: 'integer', description: 'palavra em que a mídia sai' },
          midia: { type: 'integer', description: 'número da mídia de apoio' },
          layout: { type: 'string', enum: ['cheia', 'dividida', 'cartao'], description: 'cheia = a mídia ocupa a tela; dividida = mídia em cima e a pessoa embaixo; cartao = a mídia entra como cartão branco por cima da pessoa (ideal para print de página, notícia, depoimento, tela da plataforma)' },
          movimento: { type: 'string', enum: ['aproximar', 'afastar', 'deslizar', 'parado'], description: 'movimento lento da imagem enquanto aparece' },
        }, required: ['de', 'ate', 'midia'] } },
      efeitos: { type: 'array', description: 'Efeitos sonoros pontuais, na palavra. hit = impacto logo DEPOIS de revelar algo (preço, resultado, número, frase de efeito); riser = tensão crescendo ATÉ a palavra marcada (antes de uma revelação); ding = confirmação (oferta, bônus, "é isso"); obturador = sequência de cortes rápidos; teclado = quando um texto aparece como se fosse digitado; woosh/clique/pop também podem ser marcados. Poucos e certeiros: 3 a 8 num reels.',
        items: { type: 'object', properties: { palavra: { type: 'integer' }, som: { type: 'string', enum: ['woosh', 'hit', 'riser', 'clique', 'pop', 'obturador', 'teclado', 'ding'] } }, required: ['palavra', 'som'] } },
      efeitos_automaticos: { type: 'boolean', description: 'true (padrão): woosh em cada zoom e imagem em tela cheia, clique em cada texto na tela, pop na tela dividida. false só se a equipe pedir vídeo sem efeitos.' },
      enquadramento: { type: 'object', description: 'Olhando os quadros do vídeo bruto: onde fica o centro do rosto da pessoa, de 0 a 1 (x da esquerda, y do topo). O zoom e a tela dividida centram nele.',
        properties: { x: { type: 'number' }, y: { type: 'number' } } },
      cenas: { type: 'array', description: 'Cenas animadas (motion graphics) por cima da fala, de 1 a 3 num reels: nos momentos em que um gráfico explica melhor que o rosto (lista de itens, número ou resultado dito, passo a passo, comparação, data de turma, oferta com o preço falado). Cada uma de 2 a 6 segundos. Um designer escreve a animação a partir da sua descrição.',
        items: { type: 'object', properties: { de: { type: 'integer', description: 'palavra em que a cena entra' }, ate: { type: 'integer', description: 'palavra em que sai' }, layout: { type: 'string', enum: ['cheia', 'dividida', 'cartao'] },
          descricao: { type: 'string', description: 'O que a cena mostra e como anima, com os TEXTOS EXATOS (só o que a pessoa falou). Ex.: "Lista de 3 itens entrando um a um: 1. Anatomia aplicada 2. Prática em paciente real 3. Mentoria pós-curso; título no topo: O que você leva"' } }, required: ['de', 'ate', 'descricao'] } },
      beats: { type: 'array', description: 'PLANEJE ISTO PRIMEIRO: a fala dividida em blocos de intenção (beats), em ordem, cobrindo o vídeo todo. Cada beat pede um tratamento visual diferente; cortes, cenas, textos, zooms e efeitos acompanham a troca de beat.',
        items: { type: 'object', properties: { de: { type: 'integer', description: 'palavra em que o beat começa' }, ate: { type: 'integer', description: 'palavra em que termina' },
          nome: { type: 'string', enum: ['gancho', 'contexto', 'desenvolvimento', 'virada', 'prova', 'oferta', 'chamada'] },
          tratamento: { type: 'string', description: 'Em uma frase: ritmo e o que entra na tela neste beat (ex.: "rápido: texto pop + zoom + hit"; "calmo: rosto em cartão, legenda palavra-chave")' } }, required: ['de', 'ate', 'nome', 'tratamento'] } },
      roteiro_identificado: { type: 'string', description: 'Só quando vieram os roteiros da campanha: o título ou a primeira frase do roteiro que foi gravado, ou "nenhum".' },
      faltou: { type: 'string', description: 'Se alguma cena do roteiro não foi gravada ou ficou ruim, diga qual. Senão, vazio.' },
      checagem: { type: 'string', description: 'Conferência do padrão de qualidade, item por item, em uma linha cada: gancho, legenda com destaques, textos na tela, quanto do vídeo tem imagem por cima (%), zoom, variedade (cheia/dividida/cartão), efeitos, chamada final. Diga o que não deu para cumprir e por quê (ex.: faltam imagens da plataforma).' },
    },
    required: ['resumo', 'trechos'],
  },
}

// ordem em que o agente escreve: o que faz o vídeo ter vida (imagens, textos, zoom) vem antes da lista longa de destaques,
// para não ficar de fora se a resposta chegar no limite de tamanho
const ORDEM_CAMPOS = ['beats', 'resumo', 'trechos', 'coberturas', 'textos', 'zooms', 'enquadramento', 'cenas', 'efeitos', 'efeitos_automaticos', 'legenda', 'chaves', 'destaques', 'correcoes', 'roteiro_identificado', 'faltou', 'checagem']
{
  const props = FERRAMENTA.input_schema.properties as Record<string, unknown>
  FERRAMENTA.input_schema.properties = Object.fromEntries([...ORDEM_CAMPOS.filter((k) => k in props), ...Object.keys(props).filter((k) => !ORDEM_CAMPOS.includes(k))].map((k) => [k, props[k]])) as typeof FERRAMENTA.input_schema.properties
}

// padrão mínimo de um reels editado (docs: "Agente Editor de Vídeo — como deveria ser"). Vídeo só de rosto com legenda não é edição.
const QUALIDADE = [
  'PADRÃO MÍNIMO (confira tudo antes de entregar e preencha "checagem"):',
  '- gancho: os 2 primeiros segundos com a frase mais forte, texto grande na tela ("textos", animação pop) e zoom',
  '- legenda com hierarquia: marque como destaque a palavra-chave de CADA frase (1 a cada 4 a 6 palavras): elas aparecem maiores e em cor',
  '- textos na tela: no mínimo 3 num reels de 30 a 60 s (gancho, número ou prova, oferta ou chamada), variando a animação',
  '- com mídias de apoio enviadas: cubra no mínimo 30% do vídeo, alternando cheia, dividida e cartao; nunca a mesma mídia duas vezes seguidas',
  '- movimento: um zoom a cada 4 a 6 segundos nos trechos de rosto, intensidade 1.08 a 1.18',
  '- cenas animadas: 1 a 3 num reels (2 a 6 s cada), onde um gráfico explica melhor que o rosto; não use em vídeo só de relacionamento curto se não houver lista, número ou passo a passo falado',
  '- beats: antes de tudo, divida a fala em gancho, contexto/desenvolvimento, virada ou prova, oferta e chamada (preencha "beats"); cada troca de beat muda o tratamento (ritmo, enquadramento, cena, efeito) para o vídeo não ficar igual do começo ao fim',
  '- visual limpo, estilo premium: pouca coisa na tela ao mesmo tempo, nada de poluição; elementos entram alternando pelos lados (esquerda e direita) para preencher a tela sem pesar',
  '- fim: a chamada para ação com texto na tela',
].join('\n')

// texto dos materiais de papel "roteiro" da campanha da peça (ou de todas, se a peça não tem campanha), até ~40 mil caracteres
async function roteirosDaCampanha(db: SupabaseClient, empresa: string, campanha?: string) {
  let q = db.from('marca_fontes').select('id,titulo').eq('empresa_id', empresa).eq('ativo', true).eq('status', 'pronta').eq('papel', 'roteiro')
  if (campanha) q = q.eq('campanha_id', campanha)
  const { data: fontes } = await q.order('criado_em', { ascending: false }).limit(6)
  if (!fontes?.length) return ''
  const { data: trechos } = await db.from('marca_trechos').select('fonte_id,conteudo,ordem').in('fonte_id', fontes.map((f) => f.id)).order('ordem').limit(2000)
  // os de criativo/reels primeiro (roteiro de YouTube longo vai por último); cada material com no máximo 25 mil caracteres
  const curto = (t: string) => (/criativ|reels|an[uú]ncio/i.test(t) ? 0 : /youtube|live|aula/i.test(t) ? 2 : 1)
  const texto = [...fontes].sort((a, b) => curto(a.titulo ?? '') - curto(b.titulo ?? ''))
    .map((f) => `[${f.titulo}]\n${(trechos ?? []).filter((t) => t.fonte_id === f.id).map((t) => t.conteudo).join('\n').slice(0, 25000)}`).join('\n---\n')
  return texto.slice(0, 40000)
}

// chamada simples ao Claude com uma ferramenta, já registrando o custo no agente 'editor' (usada pelo estudo de canal)
async function prepararIa(db: SupabaseClient, empresa: string) {
  const [{ data: chave }, { data: cfg }, { data: ag }] = await Promise.all([
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_config').select('modelo').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', empresa).eq('agente_id', 'editor').maybeSingle(),
  ])
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  if (!ag?.ativo) throw new Error('A empresa não tem o Agente Editor de Vídeo ligado.')
  const pa = (ag.perfil ?? {}) as Record<string, unknown>
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? (cfg?.modelo && PRECO[cfg.modelo] ? cfg.modelo : 'claude-sonnet-5-5')
  const ia: Ia = async (sistema, conteudo, ferramenta, tipo, resumo) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: 4000, system: sistema, messages: [{ role: 'user', content: conteudo }], tools: [ferramenta], tool_choice: { type: 'auto' } }), // os modelos 5.5 não aceitam forçar a ferramenta
    })
    const resp = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = String(resp?.error?.message ?? `erro ${r.status}`)
      if (/credit|balance/i.test(msg)) throw new Error('A conta da Anthropic está sem crédito.')
      throw new Error(`O agente respondeu ${r.status}: ${msg}`)
    }
    const entrega = (resp.content ?? []).find((b: { type: string }) => b.type === 'tool_use')?.input as Record<string, unknown> | undefined
    // às vezes uma lista vem como texto JSON dentro da ferramenta: converte de volta
    if (entrega) for (const [k, v] of Object.entries(entrega)) { if (typeof v === 'string' && /^\s*[[{]/.test(v)) { try { entrega[k] = JSON.parse(v) } catch { /* fica o texto */ } } }
    const ent = Number(resp.usage?.input_tokens ?? 0), sai = Number(resp.usage?.output_tokens ?? 0)
    await registrar(db, empresa, tipo, '', entrega ? resumo(entrega) : 'Sem resposta', (ent * PRECO[modelo].entrada + sai * PRECO[modelo].saida) / 1_000_000, modelo, ent, sai)
    return entrega
  }
  return ia
}

async function descricaoEmpresa(db: SupabaseClient, empresa: string) {
  const { data } = await db.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle()
  const p = (data?.perfil ?? {}) as Record<string, unknown>
  return `${String(p.empresa ?? '')}. Vende: ${String(p.o_que_vende ?? '').slice(0, 400)}. Para quem: ${String(p.publico ?? '').slice(0, 300)}.`
}

async function editar(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? ''), pecaId = String(corpo.peca ?? '')
  const palavras = (Array.isArray(corpo.palavras) ? corpo.palavras : []) as Palavra[]
  if (!palavras.length) throw new Error('Transcreva o vídeo antes de editar.')
  const [{ data: peca }, { data: chave }, { data: cfg }, { data: ag }, { data: refs }] = await Promise.all([
    db.from('agentes_pecas').select('titulo,tipo,conteudo').eq('id', pecaId).eq('empresa_id', empresa).maybeSingle(),
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_config').select('modelo').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', empresa).eq('agente_id', 'editor').maybeSingle(),
    db.from('marca_referencias').select('id,nome,autor,ficha').eq('empresa_id', empresa).eq('ativo', true).eq('status', 'pronta').in('formato', ['reels', 'video']).order('atualizado_em', { ascending: false }).limit(30),
  ])
  if (!peca) throw new Error('Peça não encontrada.')
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  if (!ag?.ativo) throw new Error('A empresa não tem o Agente Editor de Vídeo ligado.')
  const pa = (ag?.perfil ?? {}) as Record<string, unknown>
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? (cfg?.modelo && PRECO[cfg.modelo] ? cfg.modelo : 'claude-sonnet-5-5')
  const c = (peca.conteudo ?? {}) as { roteiro?: string[]; texto_arte?: string; briefing?: { finalidade?: string }; campanha?: string }
  // sem roteiro na peça: os roteiros que a equipe subiu nos materiais da campanha (ex.: um PDF com todos os criativos);
  // o agente descobre pela fala qual deles foi gravado
  const roteirosCampanha = c.roteiro?.length ? '' : await roteirosDaCampanha(db, empresa, c.campanha)
  // mídias de apoio: número, tipo, o que é e a miniatura (JPEG pequeno) para o agente ver
  const midias = ((Array.isArray(corpo.midias) ? corpo.midias : []) as { n: number; tipo: string; descricao?: string; miniatura?: string }[]).slice(0, 45)
  // fotos do vídeo bruto: para ver o enquadramento (onde está o rosto) e o cenário
  const quadros = ((Array.isArray(corpo.quadros) ? corpo.quadros : []) as { t: number; miniatura: string }[]).filter((q) => q.miniatura).slice(0, 30) // 4 do vídeo + até 24 das tentativas repetidas (o agente compara)
  // referência pedida só para este vídeo: fotos de um vídeo que a equipe quer imitar + o que ela quer dele
  const ref = (corpo.referencia && typeof corpo.referencia === 'object' ? corpo.referencia : null) as { nome?: string; texto?: string; quadros?: { t: number; miniatura: string }[] } | null
  const quadrosRef = (ref?.quadros ?? []).filter((q) => q.miniatura).slice(0, 8)
  const escolhida = ref ? undefined : (refs ?? []).find((r) => r.id === corpo.modelo_ref || (r.nome && r.nome === corpo.modelo_ref))
  const modelos = (ref ? [] : escolhida ? [escolhida] : (refs ?? []).slice(0, 3)).map((r) => {
    const f = (r.ficha ?? {}) as Record<string, string | string[]>
    return `- ${r.nome ?? 'modelo'}${r.autor ? ` (${r.autor})` : ''}: ${f.resumo ?? ''}${f.gancho ? ` · gancho: ${f.gancho}` : ''}${f.ritmo ? ` · ritmo: ${f.ritmo}` : ''}${f.visual ? ` · visual: ${f.visual}` : ''}${f.texto_na_tela ? ` · texto na tela: ${f.texto_na_tela}` : ''}${f.edicao ? ` · como editar: ${f.edicao}` : ''}`
  })
  const memoria = ((Array.isArray(pa.memoria) ? pa.memoria : []) as { texto: string }[]).filter((m) => m.texto.startsWith('Edição:')).map((m) => `- ${m.texto}`)
  // estilo da casa (página do Agente Editor): vale para todo vídeo, sem a equipe pedir; padrão = criativo que vende
  const e = { legenda: 'palavras', efeitos: 'muitos', imagens: 'muitas', tela_dividida: true, zoom: true, ...((pa.estilo ?? {}) as Record<string, unknown>) } as { legenda: string; efeitos: string; imagens: string; tela_dividida: boolean; zoom: boolean; observacoes?: string }
  const estilo = [
    'ESTILO DA CASA (a empresa quer TODOS os vídeos assim; siga sem ninguém pedir, a não ser que o pedido desta edição diga outra coisa):',
    e.legenda === 'chave' ? '- legenda: estilo "chave" (palavras-chave em caixa), preenchendo "chaves" no vídeo todo' : '- legenda: estilo "palavras", com 2 a 3 palavras por vez e destaques nas palavras-chave',
    e.efeitos === 'nenhum' ? '- efeitos sonoros: nenhum (efeitos_automaticos = false e "efeitos" vazio)' : e.efeitos === 'poucos' ? '- efeitos sonoros: os automáticos e no máximo 3 pontuais nos momentos mais fortes' : '- efeitos sonoros: muitos — os automáticos e de 5 a 8 pontuais (riser antes de cada revelação, hit logo depois, ding na oferta, obturador em sequência rápida)',
    e.imagens === 'muitas' ? '- imagens de apoio: muitas — cubra de 40% a 60% do vídeo com as mídias, trocando a cada 2 a 4 segundos' : e.imagens === 'algumas' ? '- imagens de apoio: algumas — cubra de 20% a 35% do vídeo' : '- imagens de apoio: poucas — só onde a imagem prova o que é dito',
    e.tela_dividida ? '- tela dividida: use bastante em explicações, listas e quando falar da plataforma ou do curso (a pessoa continua aparecendo embaixo)' : '- tela dividida: não use; as mídias entram em tela cheia',
    e.zoom ? '- zoom: no gancho e em cada frase forte (um a cada 5 a 8 segundos, nunca seguidos)' : '- zoom: não use',
    e.observacoes ? `- orientações da equipe: ${e.observacoes}` : '',
  ].filter(Boolean).join('\n')
  const sistema = [
    'Você é o editor de vídeo do Agente de Marketing de uma escola de harmonização orofacial. Edita vídeos de fala para a câmera: reels em pé e também vídeos de venda mais longos, em pé ou deitados (o formato vem no pedido).',
    'Você recebe a transcrição palavra por palavra (número | início | fim em segundos | palavra) e o roteiro que a pessoa usou para gravar.',
    'Seu trabalho: escolher os trechos que ficam (cortes entre frases, com ritmo, sem nunca cortar dentro de uma frase), corrigir a legenda, escolher destaques, textos na tela e zooms.',
    'Regras: o vídeo começa direto no gancho (nada de "oi, gente" se houver gancho melhor); quando a pessoa repete uma frase, fica a melhor tomada (quase sempre a última, mais fluente); tire hesitações e pausas longas; não mude a ordem das ideias a não ser que o roteiro peça; não corte no meio de uma ideia.',
    'Nunca escreva na tela promessa de resultado, preço ou dado que a pessoa não falou.',
    'MÍDIAS DE APOIO (quando a equipe enviar): fotos, prints e clipes que você coloca por cima da fala em "coberturas", olhando as miniaturas. Regras: a mídia combina com o que está sendo dito naquele momento (falou da plataforma, mostra a tela da plataforma; falou do presencial, mostra a turma); cada cobertura de 1,5 a 5 segundos, terminando no fim de uma frase; o gancho (primeiros 2 a 3 segundos) fica com o rosto, a não ser que a mídia seja mais forte que a fala; em criativo de anúncio cubra de 30% a 60% do vídeo, alternando rosto e mídia para manter o ritmo; em vídeo de relacionamento, menos. "dividida" para explicações e listas (a pessoa continua aparecendo), "cheia" para impacto curto (resultado, oferta, prova). Não repita a mesma mídia seguida; varie o movimento. Mídia de antes e depois só se estiver descrita como autorizada.',
    'EFEITOS SONOROS (deixam o vídeo com cara de editado por profissional): os automáticos já entram em zoom, texto e imagem; você marca os pontuais em "efeitos": riser antes da revelação e hit logo depois dela (ex.: riser até "o preço é" e hit em "quatro mil"), ding na oferta ou no bônus. Nunca dois sons colados, nunca por cima de toda frase.',
    'ENQUADRAMENTO: os quadros do vídeo bruto mostram onde está a pessoa. Preencha "enquadramento" com o centro do rosto (0 a 1). Se a pessoa ocupa pouco espaço ou está de lado, prefira "cheia" ou "cartao" a "dividida".',
    'MOTION: textos na tela entram animados ("animacao"); use "cartao" para mostrar prints (página de vendas, notícia, depoimento, plataforma) por cima da pessoa, como em vídeo-ensaio; varie entre cheia, dividida e cartao para o vídeo não ficar repetitivo.',
    'LEGENDA: "palavras" é o padrão de reels. Use "chave" quando a equipe pedir estilo documentário ou quando o vídeo tiver muita tela dividida.',
    estilo,
    modelos.length ? `${escolhida ? 'REFERÊNCIA ESCOLHIDA PARA ESTE VÍDEO (edite NESTE estilo: ritmo, cortes, texto na tela, legenda e uso de imagens; adapte ao que o nosso editor faz):' : 'MODELOS DE EDIÇÃO QUE A EQUIPE GOSTA (siga o ritmo e o estilo de texto na tela):'}\n${modelos.join('\n')}` : '',
    memoria.length ? `O QUE A EQUIPE JÁ PEDIU EM EDIÇÕES ANTERIORES (siga):\n${memoria.join('\n')}` : '',
    ref ? `REFERÊNCIA PEDIDA PARA ESTE VÍDEO (vale mais que o estilo da casa): as fotos "Quadro da referência" são de um vídeo que a equipe quer imitar. O que ela quer dele: "${String(ref.texto ?? '').slice(0, 600)}". Reproduza a FORMA (ritmo, legenda, texto na tela, tipo de imagem por cima, enquadramento, cartões), nunca as frases, a marca ou os dados de quem fez. Diga no resumo o que você pegou da referência.` : '',
    QUALIDADE,
  ].filter(Boolean).join('\n\n')
  const usuario = [
    `PEÇA: ${peca.titulo} (${peca.tipo})`,
    c.roteiro?.length ? `ROTEIRO USADO NA GRAVAÇÃO:\n${c.roteiro.map((x, i) => `${i + 1}. ${x.replace(/\n/g, ' — ')}`).join('\n')}`
      : roteirosCampanha ? `ROTEIROS DA CAMPANHA (a pessoa gravou UM deles, talvez com pequenas mudanças). Descubra qual pela transcrição, siga esse roteiro (ordem, ganchos e textos na tela) e diga qual foi em "roteiro_identificado". Se nenhum bater, edite pelo que foi falado:\n${roteirosCampanha}`
      : 'Sem roteiro: edite pelo que foi falado.',
    corpo.anterior ? `EDIÇÃO ANTERIOR (a equipe viu e pediu ajuste: parta dela e mude só o que foi pedido; mantenha a descricao das cenas que não mudam, igual, palavra por palavra):\n${JSON.stringify(corpo.anterior, (k, v) => (k === 'codigo' || k === 'erro' ? undefined : v))}` : '',
    corpo.pedido ? `PEDIDO DA EQUIPE PARA ESTA EDIÇÃO: ${String(corpo.pedido)}` : '',
    midias.length ? `MÍDIAS DE APOIO (as imagens acima, na mesma ordem):\n${midias.map((m) => `${m.n} · ${m.tipo === 'video' ? 'clipe' : 'imagem'}${m.descricao ? ` · ${m.descricao}` : ''}`).join('\n')}` : 'Sem mídias de apoio: não use "coberturas".',
    c.briefing?.finalidade === 'anuncio' ? 'ESTA PEÇA É UM CRIATIVO DE ANÚNCIO PAGO: ritmo rápido, gancho fortíssimo, mais coberturas.' : '',
    `DURAÇÃO DO BRUTO: ${Number(corpo.duracao ?? 0).toFixed(1)} s`,
    `TRANSCRIÇÃO:\n${palavras.map((w, n) => `${n}|${w.i.toFixed(2)}|${w.f.toFixed(2)}|${w.p}`).join('\n')}`,
    'Entregue chamando OBRIGATORIAMENTE a ferramenta entregar_edicao, direto, sem escrever nada antes nem depois dela (pense em silêncio). Seja econômico nas listas longas: destaques no máximo 1 a cada 6 palavras.',
  ].filter(Boolean).join('\n\n')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: 24000, system: sistema, messages: [{ role: 'user', content: [
      ...quadros.flatMap((q) => [{ type: 'text', text: `Quadro do vídeo bruto em ${q.t} s:` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: q.miniatura } }]),
      ...quadrosRef.flatMap((q) => [{ type: 'text', text: `Quadro da referência em ${q.t} s:` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: q.miniatura } }]),
      ...midias.filter((m) => m.miniatura).flatMap((m) => [{ type: 'text', text: `Mídia ${m.n}:` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: m.miniatura } }]),
      { type: 'text', text: usuario },
    ] }], tools: [FERRAMENTA], tool_choice: { type: 'auto' } }),
  })
  const resp = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = String(resp?.error?.message ?? `erro ${r.status}`)
    if (/credit|balance/i.test(msg)) throw new Error('A conta da Anthropic está sem crédito.')
    throw new Error(`O agente respondeu ${r.status}: ${msg}`)
  }
  const plano = (resp.content ?? []).find((b: { type: string }) => b.type === 'tool_use')?.input
  // às vezes uma lista vem como texto JSON dentro da ferramenta: converte de volta
  if (plano && typeof plano === 'object') for (const [k, v] of Object.entries(plano)) { if (typeof v === 'string' && /^\s*[[{]/.test(v)) { try { plano[k] = JSON.parse(v) } catch { /* fica o texto */ } } }
  if (!plano?.trechos?.length) throw new Error('O agente não devolveu a edição. Tente de novo.')
  // resposta cortada no limite de tamanho: avisa em vez de entregar uma edição pela metade sem dizer nada
  if (resp.stop_reason === 'max_tokens') plano.resumo = `${String(plano.resumo ?? '')} (Atenção: a resposta do agente chegou no limite de tamanho e pode ter ficado incompleta; se faltar imagem ou texto na tela, peça de novo.)`
  const ent = Number(resp.usage?.input_tokens ?? 0), sai = Number(resp.usage?.output_tokens ?? 0)
  const p = PRECO[modelo]
  await registrar(db, empresa, 'edicao_video', pecaId, `Edição: ${String(plano.resumo ?? '')}`, (ent * p.entrada + sai * p.saida) / 1_000_000, modelo, ent, sai)
  // gosto marcado para as próximas edições vira memória do agente
  const gosto = String(corpo.lembrar ?? '').trim()
  if (gosto) {
    const memoriaToda = (Array.isArray(pa.memoria) ? pa.memoria : []) as { texto: string; em: string; origem: string }[]
    const texto = `Edição: ${gosto}`
    if (!memoriaToda.some((m) => m.texto === texto)) await db.from('agentes_empresa').update({ perfil: { ...pa, memoria: [...memoriaToda, { texto, em: new Date().toISOString(), origem: 'edicao' }].slice(-40) } }).eq('empresa_id', empresa).eq('agente_id', 'editor')
  }
  return { plano, modelo }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode usar o editor.' }, 403)
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) return json(await transcrever(db, await req.formData()))
    const corpo = await req.json().catch(() => ({}))
    if (corpo.acao === 'editar') return json(await editar(db, corpo))
    if (corpo.acao === 'canal_video') return json(await estudarVideo(db, await prepararIa(db, String(corpo.empresa)), String(corpo.empresa), String(corpo.canal), Number(corpo.n)))
    if (corpo.acao === 'canal') return json(await fecharCanal(db, await prepararIa(db, String(corpo.empresa)), String(corpo.empresa), String(corpo.canal), await descricaoEmpresa(db, String(corpo.empresa))))
    if (corpo.acao === 'post_instagram') {
      const empresa = String(corpo.empresa)
      return json(await estudarPost(db, await prepararIa(db, empresa), (tipo, resumo, custo, modelo) => registrar(db, empresa, tipo, '', resumo, custo, modelo), empresa, String(corpo.post), String(corpo.comparacao ?? '').slice(0, 300)))
    }
    if (corpo.acao === 'criativo') return json(await estudarCriativo(db, await prepararIa(db, String(corpo.empresa)), String(corpo.empresa), String(corpo.id)))
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: (e as Error).message })
  }
})
