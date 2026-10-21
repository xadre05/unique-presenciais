// Editor de vídeo do Agente de Marketing (21/10/2026). O vídeo bruto NÃO passa por aqui: fica no computador de quem
// edita. O navegador tira só o áudio (leve) e manda para transcrever; depois manda as palavras com o tempo de cada uma,
// e o agente devolve a "receita" da edição (trechos que ficam, legenda, texto na tela, zoom). A receita é um JSON
// pequeno guardado na peça; o vídeo final é montado no navegador.
//   POST multipart { acao: 'transcrever', empresa, peca, audio (wav) } → { palavras, duracao, idioma }
//   POST json { acao: 'editar', empresa, peca, palavras, duracao, pedido?, modelo_ref? } → { plano }
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

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
    empresa_id: empresa, agente_id: 'marketing', tipo, status: 'pronto', pedido: { peca }, resumo: resumo.slice(0, 200),
    modelo, tokens_entrada: ent, tokens_saida: sai, custo_usd: arred(custo), terminado_em: new Date().toISOString(),
  })
}

async function transcrever(db: SupabaseClient, form: FormData) {
  const empresa = String(form.get('empresa') ?? ''), peca = String(form.get('peca') ?? '')
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
      destaques: { type: 'array', items: { type: 'integer' }, description: 'Números das palavras-chave que aparecem destacadas (cor da marca) na legenda. Poucas: 1 a cada 8 ou 10 palavras.' },
      textos: { type: 'array', description: 'Texto grande na tela em momentos-chave (gancho, número, oferta, chamada), como no roteiro. Até 6 palavras cada.',
        items: { type: 'object', properties: { de: { type: 'integer', description: 'palavra em que aparece' }, ate: { type: 'integer', description: 'palavra em que some' }, texto: { type: 'string' }, posicao: { type: 'string', enum: ['topo', 'meio'] } }, required: ['de', 'ate', 'texto'] } },
      zooms: { type: 'array', description: 'Aproximação da câmera para dar ritmo: no gancho e nas frases fortes, nunca seguidos. intensidade de 1.08 a 1.25.',
        items: { type: 'object', properties: { de: { type: 'integer' }, ate: { type: 'integer' }, intensidade: { type: 'number' } }, required: ['de', 'ate'] } },
      legenda: { type: 'object', properties: { palavras_por_vez: { type: 'integer', description: '1 a 4' }, caixa_alta: { type: 'boolean' }, posicao: { type: 'string', enum: ['baixo', 'meio'] } } },
      faltou: { type: 'string', description: 'Se alguma cena do roteiro não foi gravada ou ficou ruim, diga qual. Senão, vazio.' },
    },
    required: ['resumo', 'trechos'],
  },
}

async function editar(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? ''), pecaId = String(corpo.peca ?? '')
  const palavras = (Array.isArray(corpo.palavras) ? corpo.palavras : []) as Palavra[]
  if (!palavras.length) throw new Error('Transcreva o vídeo antes de editar.')
  const [{ data: peca }, { data: chave }, { data: cfg }, { data: ag }, { data: refs }] = await Promise.all([
    db.from('agentes_pecas').select('titulo,tipo,conteudo').eq('id', pecaId).eq('empresa_id', empresa).maybeSingle(),
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_config').select('modelo').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle(),
    db.from('marca_referencias').select('nome,autor,ficha').eq('empresa_id', empresa).eq('ativo', true).eq('status', 'pronta').in('formato', ['reels', 'video']).order('atualizado_em', { ascending: false }).limit(6),
  ])
  if (!peca) throw new Error('Peça não encontrada.')
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  const pa = (ag?.perfil ?? {}) as Record<string, unknown>
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? (cfg?.modelo && PRECO[cfg.modelo] ? cfg.modelo : 'claude-sonnet-5-5')
  const c = (peca.conteudo ?? {}) as { roteiro?: string[]; texto_arte?: string; edicao?: { gostos?: string[] } }
  const escolhida = (refs ?? []).find((r) => r.nome && r.nome === corpo.modelo_ref)
  const modelos = (escolhida ? [escolhida] : (refs ?? []).slice(0, 3)).map((r) => {
    const f = (r.ficha ?? {}) as Record<string, string | string[]>
    return `- ${r.nome ?? 'modelo'}${r.autor ? ` (${r.autor})` : ''}: ${f.resumo ?? ''}${f.ritmo ? ` · ritmo: ${f.ritmo}` : ''}${f.texto_na_tela ? ` · texto na tela: ${f.texto_na_tela}` : ''}`
  })
  const memoria = ((Array.isArray(pa.memoria) ? pa.memoria : []) as { texto: string }[]).filter((m) => m.texto.startsWith('Edição:')).map((m) => `- ${m.texto}`)
  const sistema = [
    'Você é o editor de vídeo do Agente de Marketing de uma escola de harmonização orofacial. Edita vídeos verticais de fala para a câmera (reels).',
    'Você recebe a transcrição palavra por palavra (número | início | fim em segundos | palavra) e o roteiro que a pessoa usou para gravar.',
    'Seu trabalho: escolher os trechos que ficam (corte seco, ritmo de reels), corrigir a legenda, escolher destaques, textos na tela e zooms.',
    'Regras: o vídeo começa direto no gancho (nada de "oi, gente" se houver gancho melhor); quando a pessoa repete uma frase, fica a melhor tomada (quase sempre a última, mais fluente); tire hesitações e pausas longas; não mude a ordem das ideias a não ser que o roteiro peça; não corte no meio de uma ideia.',
    'Nunca escreva na tela promessa de resultado, preço ou dado que a pessoa não falou.',
    modelos.length ? `MODELOS DE EDIÇÃO QUE A EQUIPE GOSTA (siga o ritmo e o estilo de texto na tela):\n${modelos.join('\n')}` : '',
    memoria.length ? `O QUE A EQUIPE JÁ PEDIU EM EDIÇÕES ANTERIORES (siga):\n${memoria.join('\n')}` : '',
  ].filter(Boolean).join('\n\n')
  const usuario = [
    `PEÇA: ${peca.titulo} (${peca.tipo})`,
    c.roteiro?.length ? `ROTEIRO USADO NA GRAVAÇÃO:\n${c.roteiro.map((x, i) => `${i + 1}. ${x.replace(/\n/g, ' — ')}`).join('\n')}` : 'Sem roteiro: edite pelo que foi falado.',
    corpo.anterior ? `EDIÇÃO ANTERIOR (a equipe viu e pediu ajuste: parta dela e mude só o que foi pedido):\n${JSON.stringify(corpo.anterior)}` : '',
    corpo.pedido ? `PEDIDO DA EQUIPE PARA ESTA EDIÇÃO: ${String(corpo.pedido)}` : '',
    `DURAÇÃO DO BRUTO: ${Number(corpo.duracao ?? 0).toFixed(1)} s`,
    `TRANSCRIÇÃO:\n${palavras.map((w, n) => `${n}|${w.i.toFixed(2)}|${w.f.toFixed(2)}|${w.p}`).join('\n')}`,
    'Entregue chamando OBRIGATORIAMENTE a ferramenta entregar_edicao.',
  ].filter(Boolean).join('\n\n')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: 16000, system: sistema, messages: [{ role: 'user', content: usuario }], tools: [FERRAMENTA], tool_choice: { type: 'auto' } }),
  })
  const resp = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = String(resp?.error?.message ?? `erro ${r.status}`)
    if (/credit|balance/i.test(msg)) throw new Error('A conta da Anthropic está sem crédito.')
    throw new Error(`O agente respondeu ${r.status}: ${msg}`)
  }
  const plano = (resp.content ?? []).find((b: { type: string }) => b.type === 'tool_use')?.input
  if (!plano?.trechos?.length) throw new Error('O agente não devolveu a edição. Tente de novo.')
  const ent = Number(resp.usage?.input_tokens ?? 0), sai = Number(resp.usage?.output_tokens ?? 0)
  const p = PRECO[modelo]
  await registrar(db, empresa, 'edicao_video', pecaId, `Edição: ${String(plano.resumo ?? '')}`, (ent * p.entrada + sai * p.saida) / 1_000_000, modelo, ent, sai)
  // gosto marcado para as próximas edições vira memória do agente
  const gosto = String(corpo.lembrar ?? '').trim()
  if (gosto) {
    const memoriaToda = (Array.isArray(pa.memoria) ? pa.memoria : []) as { texto: string; em: string; origem: string }[]
    const texto = `Edição: ${gosto}`
    if (!memoriaToda.some((m) => m.texto === texto)) await db.from('agentes_empresa').update({ perfil: { ...pa, memoria: [...memoriaToda, { texto, em: new Date().toISOString(), origem: 'edicao' }].slice(-40) } }).eq('empresa_id', empresa).eq('agente_id', 'marketing')
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
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: (e as Error).message })
  }
})
