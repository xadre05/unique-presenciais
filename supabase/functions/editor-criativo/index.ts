// Agente Editor de Vídeo, parte criativa (21/10/2026). Duas ações, ambas com o custo no agente 'editor':
//   POST { acao: 'cena', empresa, peca, descricao, duracao, L, A, layout, codigo?, quadros?, erro? } → { codigo, nota?, critica? }
//     Escreve o código de uma cena animada (motion graphics) desenhada em canvas no navegador. Com "quadros" (fotos da
//     cena já desenhada) ou "erro", revisa: dá nota de 1 a 10 e devolve o código corrigido.
//   POST { acao: 'cortes', empresa, titulo, linhas, duracao, quantos? } → { cortes }
//     Lê a transcrição de um vídeo longo (aula, live, podcast) e escolhe os melhores trechos para virar reels.
//   POST { acao: 'broll_ideias' | 'broll_gerar' | 'broll_status' } → cenas reais geradas na Higgsfield (imagem, depois clipe)
//   POST { acao: 'vozes' | 'narrar' } → narração com voz de IA na ElevenLabs (vídeo sem gravar), com o tempo de cada palavra
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const PRECO: Record<string, { entrada: number; saida: number }> = { 'claude-sonnet-5-5': { entrada: 2, saida: 10 }, 'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 } }

async function preparar(db: SupabaseClient, empresa: string) {
  const [{ data: chave }, { data: cfg }, { data: ag }] = await Promise.all([
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_config').select('modelo').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', empresa).eq('agente_id', 'editor').maybeSingle(),
  ])
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  if (!ag?.ativo) throw new Error('A empresa não tem o Agente Editor de Vídeo ligado.')
  const pa = (ag.perfil ?? {}) as Record<string, unknown>
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? (cfg?.modelo && PRECO[cfg.modelo] ? cfg.modelo : 'claude-sonnet-5-5')
  return async (sistema: string, conteudo: unknown[], ferramenta: Record<string, unknown>, tipo: string, peca: string, resumo: (e: Record<string, unknown>) => string, maxTokens = 8000) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: 'user', content: conteudo }], tools: [ferramenta], tool_choice: { type: 'auto' } }),
    })
    const resp = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = String(resp?.error?.message ?? `erro ${r.status}`)
      if (/credit|balance/i.test(msg)) throw new Error('A conta da Anthropic está sem crédito.')
      throw new Error(`O agente respondeu ${r.status}: ${msg}`)
    }
    const entrega = (resp.content ?? []).find((b: { type: string }) => b.type === 'tool_use')?.input as Record<string, unknown> | undefined
    if (entrega) for (const [k, v] of Object.entries(entrega)) { if (k !== 'codigo' && typeof v === 'string' && /^\s*[[{]/.test(v)) { try { entrega[k] = JSON.parse(v) } catch { /* fica */ } } }
    const ent = Number(resp.usage?.input_tokens ?? 0), sai = Number(resp.usage?.output_tokens ?? 0)
    const custo = (ent * PRECO[modelo].entrada + sai * PRECO[modelo].saida) / 1_000_000
    await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'editor', tipo, status: 'pronto', pedido: { peca }, resumo: (entrega ? resumo(entrega) : 'Sem resposta').slice(0, 200),
      modelo, tokens_entrada: ent, tokens_saida: sai, custo_usd: Math.round(custo * 10000) / 10000, terminado_em: new Date().toISOString() })
    return entrega
  }
}

// ===== cena animada =====
const FERRAMENTA_CENA = {
  name: 'entregar_cena', description: 'Entrega o código da cena animada.',
  input_schema: { type: 'object', required: ['codigo'], properties: {
    codigo: { type: 'string', description: 'Corpo da função desenhar(ctx, t, d, L, A, m). Só JavaScript de canvas 2D, sem comentários longos.' },
    nota: { type: 'integer', description: 'Só na revisão: nota de 1 a 10 para a versão que você VIU nas fotos (antes da correção).' },
    critica: { type: 'string', description: 'Só na revisão: os 3 piores problemas que você viu e o que corrigiu.' },
  } },
}
const SISTEMA_CENA = [
  'Você é um motion designer sênior. Escreve cenas animadas curtas (2 a 6 s) para reels de uma escola de harmonização orofacial de alto padrão, desenhadas em canvas 2D no navegador.',
  'CONTRATO: escreva o CORPO de uma função chamada a cada quadro com (ctx, t, d, L, A, m). t = segundos desde o começo da cena (0 a d); d = duração; L × A = tamanho do quadro em pixels (vertical 9:16, ex.: 1080 × 1920; use SEMPRE medidas proporcionais a L e A, nunca pixels fixos). m = { ouro: "#C9A45C", ouroClaro: "#E8CF9A", fundo: "#0A0A0B", painel: "#16161A", texto: "#F4F1EA", cinza: "#9A968E", fonte(tamanho, peso) → string para ctx.font, suave(p) → easing 0..1 (cúbico), mola(p) → easing com leve balanço }.',
  'O quadro já vem limpo (transparente). Em layout "cheia" pinte o fundo inteiro; em "cartao" ou "dividida" desenhe só o conteúdo dentro de um retângulo arredondado que ocupe a área.',
  'Em layout "cheia", deixe livre o canto inferior direito (um quadrado de cerca de 34% da largura): a pessoa que está falando aparece ali num círculo por cima da cena.',
  'Regras técnicas: só a API de canvas 2D (fillRect, arc, roundRect, fillText, measureText, gradientes, sombras, save/restore, translate/rotate/scale, globalAlpha). Proibido: DOM, fetch, imagens externas, setTimeout, requestAnimationFrame, variáveis globais entre quadros. A função é PURA: o mesmo t desenha sempre o mesmo quadro (sem Math.random; se precisar de aleatório, use uma função de hash a partir de um número fixo). Nada pode lançar erro: confira as contas.',
  'Regras de design (fuja da "cara de IA"): paleta só da marca (preto profundo, dourado, branco quente; no máximo um acento); tipografia grande e firme (títulos de 0.08 a 0.12 de L, peso 800), alinhamento consistente e margens generosas (no mínimo 0.08 de L); hierarquia clara: UMA ideia por cena; movimento com intenção: entradas escalonadas (cada elemento 0,08 a 0,15 s depois do anterior), easing suave, nada linear, nada piscando; um elemento herói (número, palavra, ícone desenhado) com mais destaque; leve movimento contínuo de câmera (escala 1.00→1.04) para não ficar parado; nos últimos 0,3 s tudo já assentado. Sem emojis, sem neon, sem gradiente arco-íris, sem texto pequeno demais (mínimo 0.035 de L).',
  'Tipos que funcionam: número que conta até o valor; lista que entra item a item com marcador dourado; passo a passo com linha que se desenha; comparação antes × depois em duas colunas; calendário ou data em destaque; oferta com o preço falado; frase de impacto palavra por palavra; gráfico de barras que cresce.',
  'Textos: use SÓ o que está na descrição (foi o que a pessoa falou). Nunca invente número, preço, promessa de resultado ou nome.',
  'Responda chamando a ferramenta entregar_cena.',
].join('\n')

async function cena(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? ''), peca = String(corpo.peca ?? '')
  const ia = await preparar(db, empresa)
  const quadros = ((Array.isArray(corpo.quadros) ? corpo.quadros : []) as { t: number; miniatura: string }[]).slice(0, 5)
  const revisao = !!corpo.codigo && (quadros.length > 0 || !!corpo.erro)
  const pedido = [
    `CENA: ${String(corpo.descricao ?? '').slice(0, 1200)}`,
    `DURAÇÃO: ${Number(corpo.duracao ?? 3).toFixed(1)} s · TAMANHO: ${Number(corpo.L ?? 1080)} × ${Number(corpo.A ?? 1920)} · LAYOUT: ${String(corpo.layout ?? 'cheia')}`,
    revisao ? `CÓDIGO ATUAL:\n${String(corpo.codigo).slice(0, 20000)}` : '',
    corpo.erro ? `O CÓDIGO ATUAL DEU ESTE ERRO AO DESENHAR: ${String(corpo.erro).slice(0, 500)}. Corrija.` : '',
    quadros.length ? 'REVISÃO: as fotos acima são quadros da cena desenhada pelo código atual (com o segundo de cada uma). Dê uma nota de 1 a 10 como um diretor de arte exigente, liste os 3 piores problemas (legibilidade, composição, hierarquia, ritmo, algo cortado ou sobreposto, cara de IA) e devolva o código corrigido. Se a nota já for 9 ou 10, devolva o mesmo código.' : 'Escreva a cena.',
  ].filter(Boolean).join('\n\n')
  const conteudo = [...quadros.flatMap((q) => [{ type: 'text', text: `Quadro em ${q.t} s:` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: q.miniatura } }]), { type: 'text', text: pedido }]
  const r = await ia(SISTEMA_CENA, conteudo, FERRAMENTA_CENA, revisao ? 'cena_revisao' : 'cena', peca, (e) => `${revisao ? 'Revisão' : 'Cena'}: ${String(corpo.descricao ?? '').slice(0, 80)}${e.nota ? ` (nota ${e.nota})` : ''}`, 12000)
  if (typeof r?.codigo !== 'string' || !r.codigo.trim()) throw new Error('O agente não devolveu o código da cena.')
  return { codigo: r.codigo, nota: typeof r.nota === 'number' ? r.nota : undefined, critica: typeof r.critica === 'string' ? r.critica : undefined }
}

// ===== cortes de vídeo longo =====
const FERRAMENTA_CORTES = {
  name: 'entregar_cortes', description: 'Entrega os trechos escolhidos para virar reels.',
  input_schema: { type: 'object', required: ['cortes'], properties: { cortes: { type: 'array', items: { type: 'object', required: ['titulo', 'de', 'ate', 'gancho', 'por_que', 'nota'], properties: {
    titulo: { type: 'string', description: 'Título curto do corte (como um nome de reels)' },
    de: { type: 'number', description: 'Segundo em que o corte começa (no gancho, nunca no meio de uma frase)' },
    ate: { type: 'number', description: 'Segundo em que termina (no fim de uma ideia, nunca cortando a frase)' },
    gancho: { type: 'string', description: 'A primeira frase do corte, como foi dita' },
    por_que: { type: 'string', description: 'Por que este trecho prende e serve ao público (uma frase)' },
    tipo: { type: 'string', enum: ['ensino', 'historia', 'polemica', 'resultado', 'erro_comum', 'bastidor', 'oferta'] },
    nota: { type: 'integer', description: 'Potencial de prender de 1 a 10' },
  } } } } },
}
const SISTEMA_CORTES = [
  'Você é o editor de cortes de uma escola de harmonização orofacial (público: dentistas, biomédicos e médicos que fazem ou querem fazer HOF). Recebe a transcrição com o tempo de um vídeo longo (aula, live, podcast, imersão) e escolhe os trechos que viram reels fortes sozinhos.',
  'Um bom corte: começa no gancho (pergunta, afirmação forte, número, erro comum, história); tem UMA ideia completa (começo, meio e conclusão); entende-se sem o resto do vídeo; dura de 25 a 75 segundos (no máximo 90); termina numa frase de fechamento, nunca no meio de uma explicação.',
  'Prefira: dica técnica prática, erro que o profissional comete, história de paciente ou de carreira (sem nome de paciente), opinião forte, número ou resultado dito pela pessoa, bastidor do curso. Evite: trechos que dependem de imagem que não aparece, conversas de chat da live ("bom dia fulano"), avisos operacionais, promessa de resultado clínico.',
  'Os cortes não podem se sobrepor. Use exatamente os segundos da transcrição (o início da linha do gancho e o fim da última frase). Ordene do mais forte para o mais fraco.',
  'Responda chamando a ferramenta entregar_cortes.',
].join('\n')

async function cortes(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? '')
  const ia = await preparar(db, empresa)
  const linhas = String(corpo.linhas ?? '').slice(0, 300000)
  if (!linhas.trim()) throw new Error('Faltou a transcrição do vídeo.')
  const quantos = Math.min(20, Math.max(3, Number(corpo.quantos ?? 10)))
  const pedido = `VÍDEO: ${String(corpo.titulo ?? '')} · DURAÇÃO: ${Math.round(Number(corpo.duracao ?? 0) / 60)} min\nQUANTOS CORTES: até ${quantos} (só os bons; menos se não houver)\n\nTRANSCRIÇÃO (segundo de início | fala):\n${linhas}`
  const r = await ia(SISTEMA_CORTES, [{ type: 'text', text: pedido }], FERRAMENTA_CORTES, 'cortes', '', (e) => `Cortes de "${String(corpo.titulo ?? '')}": ${Array.isArray(e.cortes) ? e.cortes.length : 0} trechos`, 8000)
  const lista = (Array.isArray(r?.cortes) ? r!.cortes : []) as Record<string, unknown>[]
  if (!lista.length) throw new Error('O agente não encontrou trechos bons neste vídeo.')
  return { cortes: lista }
}

// ===== b-roll com a Higgsfield (imagem e clipe gerados) =====
// A chave fica no cofre como "KEY_ID:KEY_SECRET". Primeiro a imagem (barata) para aprovar; só depois o clipe.
const HF = 'https://api.higgsfield.ai'
const MODELO_IMAGEM = 'higgsfield-ai/soul/standard'
const MODELO_VIDEO = 'kling-video/v2.5-turbo/standard/image-to-video'
const PRECO_IMAGEM = 0.03, PRECO_VIDEO_S = 0.042

async function chaveDe(db: SupabaseClient, empresa: string, provedor: string, nome: string) {
  const { data } = await db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: provedor })
  if (!data) throw new Error(`Falta cadastrar a chave da ${nome} em Agentes → Configurações → Inteligências artificiais.`)
  return String(data)
}
async function registrarCusto(db: SupabaseClient, empresa: string, tipo: string, peca: string, resumo: string, custo: number, modelo: string) {
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'editor', tipo, status: 'pronto', pedido: { peca }, resumo: resumo.slice(0, 200), modelo, custo_usd: Math.round(custo * 10000) / 10000, terminado_em: new Date().toISOString() })
}

async function brollGerar(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? '')
  const chave = await chaveDe(db, empresa, 'higgsfield', 'Higgsfield')
  const tipo = corpo.tipo === 'video' ? 'video' : 'imagem'
  let corpoHf: Record<string, unknown>
  if (tipo === 'imagem') corpoHf = { prompt: String(corpo.prompt ?? '').slice(0, 2000), aspect_ratio: String(corpo.proporcao ?? '9:16'), resolution: '1080p' }
  else {
    const { data: link } = await db.storage.from('arquivos').createSignedUrl(String(corpo.imagem ?? ''), 3600)
    if (!link?.signedUrl) throw new Error('Não achei a imagem para animar.')
    corpoHf = { image_url: link.signedUrl, prompt: String(corpo.prompt ?? 'movimento de câmera lento e natural').slice(0, 2000), duration: Math.min(10, Math.max(3, Number(corpo.duracao ?? 5))) }
  }
  const r = await fetch(`${HF}/${tipo === 'imagem' ? MODELO_IMAGEM : MODELO_VIDEO}`, { method: 'POST', headers: { Authorization: `Key ${chave}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpoHf) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.request_id) {
    const msg = String(j?.detail ?? j?.message ?? j?.error ?? `erro ${r.status}`)
    if (r.status === 401 || r.status === 403) throw new Error('A Higgsfield recusou a chave. Confira se colou KEY_ID:KEY_SECRET.')
    if (/balance|credit|fund/i.test(msg)) throw new Error('A conta da Higgsfield está sem saldo.')
    throw new Error(`A Higgsfield respondeu: ${msg}`)
  }
  return { pedido: String(j.request_id), tipo }
}

async function brollStatus(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? ''), peca = String(corpo.peca ?? '')
  const chave = await chaveDe(db, empresa, 'higgsfield', 'Higgsfield')
  const r = await fetch(`${HF}/requests/${encodeURIComponent(String(corpo.pedido ?? ''))}/status`, { headers: { Authorization: `Key ${chave}` } })
  const j = await r.json().catch(() => ({}))
  const status = String(j.status ?? 'queued')
  if (status === 'failed' || status === 'nsfw' || status === 'canceled') return { status, erro: status === 'nsfw' ? 'A Higgsfield bloqueou esta imagem pela moderação. Mude o pedido.' : 'A geração falhou (o crédito volta para a conta).' }
  if (status !== 'completed') return { status }
  const video = corpo.tipo === 'video'
  const url = video ? j.video?.url : j.images?.[0]?.url
  if (!url) return { status: 'failed', erro: 'A Higgsfield não devolveu o arquivo.' }
  const arquivo = await fetch(url)
  if (!arquivo.ok) return { status: 'failed', erro: 'Não consegui baixar o arquivo gerado.' }
  const blob = await arquivo.blob()
  const ext = video ? 'mp4' : (blob.type.includes('png') ? 'png' : 'jpg')
  const caminho = video ? `${empresa}/${peca || 'broll'}/broll-${crypto.randomUUID()}.mp4` : `agentes/broll/${empresa}/${peca || 'geral'}/${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from(video ? 'videos' : 'arquivos').upload(caminho, blob, { contentType: video ? 'video/mp4' : blob.type || 'image/jpeg' })
  if (error) return { status: 'failed', erro: `Não consegui guardar o arquivo: ${error.message}` }
  const dur = Math.min(10, Math.max(3, Number(corpo.duracao ?? 5)))
  await registrarCusto(db, empresa, video ? 'broll_video' : 'broll_imagem', peca, video ? `Clipe gerado (${dur} s)` : 'Imagem gerada', video ? dur * PRECO_VIDEO_S : PRECO_IMAGEM, video ? MODELO_VIDEO : MODELO_IMAGEM)
  return { status, caminho, bucket: video ? 'videos' : 'arquivos', tipo: video ? 'video' : 'imagem' }
}

// ideias de b-roll: o agente lê a fala e propõe cenas reais que ilustram o que é dito (prompt em inglês para a IA de imagem)
const FERRAMENTA_BROLL = {
  name: 'entregar_brolls', description: 'Entrega as ideias de b-roll.',
  input_schema: { type: 'object', required: ['ideias'], properties: { ideias: { type: 'array', items: { type: 'object', required: ['de', 'ate', 'descricao', 'prompt'], properties: {
    de: { type: 'integer', description: 'palavra em que entra' }, ate: { type: 'integer', description: 'palavra em que sai' },
    descricao: { type: 'string', description: 'Em português, o que a cena mostra (vira a descrição da mídia)' },
    prompt: { type: 'string', description: 'Prompt em inglês para gerar a FOTO: cena realista, cinematográfica, vertical, luz quente, estética de clínica de estética premium; sem texto, sem logos, sem rosto reconhecível de pessoa real, sem procedimento com agulha em close' },
    movimento: { type: 'string', description: 'Em inglês, o movimento de câmera para animar a foto (ex.: slow push in, gentle pan right)' },
  } } } } },
}
async function brollIdeias(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? ''), peca = String(corpo.peca ?? '')
  const ia = await preparar(db, empresa)
  const fala = String(corpo.fala ?? '').slice(0, 30000)
  const sistema = 'Você é diretor de fotografia de reels de uma escola de harmonização orofacial de alto padrão. Lendo a fala (número | palavra), proponha cenas reais de cobertura (b-roll) de 2 a 5 segundos que ILUSTRAM o que está sendo dito naquele momento (ex.: falou de agenda cheia → recepção movimentada; falou de estudo → profissional estudando anatomia). Nada de pessoas famosas, logos, texto na imagem, sangue ou agulha em close. Responda chamando a ferramenta entregar_brolls.'
  const r = await ia(sistema, [{ type: 'text', text: `QUANTAS: até ${Math.min(6, Math.max(1, Number(corpo.quantos ?? 4)))}\n\nFALA:\n${fala}` }], FERRAMENTA_BROLL, 'broll_ideias', peca, (e) => `Ideias de b-roll: ${Array.isArray(e.ideias) ? e.ideias.length : 0}`, 4000)
  return { ideias: Array.isArray(r?.ideias) ? r!.ideias : [] }
}

// ===== narração com a ElevenLabs (vídeo sem gravar) =====
const PRECO_CARACTERE = 0.0003
async function vozes(db: SupabaseClient, corpo: Record<string, unknown>) {
  const chave = await chaveDe(db, String(corpo.empresa ?? ''), 'elevenlabs', 'ElevenLabs')
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': chave } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(r.status === 401 ? 'A ElevenLabs recusou a chave.' : `A ElevenLabs respondeu ${r.status}.`)
  return { vozes: ((j.voices ?? []) as { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }[]).map((v) => ({ id: v.voice_id, nome: v.name, tipo: v.category, detalhes: Object.values(v.labels ?? {}).join(' · '), amostra: v.preview_url })) }
}
async function narrar(db: SupabaseClient, corpo: Record<string, unknown>) {
  const empresa = String(corpo.empresa ?? ''), peca = String(corpo.peca ?? '')
  const chave = await chaveDe(db, empresa, 'elevenlabs', 'ElevenLabs')
  const texto = String(corpo.texto ?? '').trim().slice(0, 5000)
  if (!texto) throw new Error('Escreva o texto da narração.')
  const voz = String(corpo.voz ?? '')
  if (!voz) throw new Error('Escolha uma voz.')
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.audio_base64) throw new Error(r.status === 401 ? 'A ElevenLabs recusou a chave.' : /quota|credit|limit/i.test(JSON.stringify(j)) ? 'A conta da ElevenLabs está sem caracteres no plano.' : `A ElevenLabs respondeu ${r.status}.`)
  // palavras com o tempo, a partir do tempo de cada letra
  const a = j.alignment ?? { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] }
  const palavras: { p: string; i: number; f: number }[] = []
  let atual = '', ini = 0, fim = 0
  a.characters.forEach((c: string, k: number) => {
    if (/\s/.test(c)) { if (atual) palavras.push({ p: atual, i: ini, f: fim }); atual = ''; return }
    if (!atual) ini = a.character_start_times_seconds[k]
    atual += c; fim = a.character_end_times_seconds[k]
  })
  if (atual) palavras.push({ p: atual, i: ini, f: fim })
  const bytes = Uint8Array.from(atob(j.audio_base64), (c) => c.charCodeAt(0))
  const caminho = `agentes/narracao/${empresa}/${crypto.randomUUID()}.mp3`
  const { error } = await db.storage.from('arquivos').upload(caminho, new Blob([bytes], { type: 'audio/mpeg' }), { contentType: 'audio/mpeg' })
  if (error) throw new Error(`Não consegui guardar a narração: ${error.message}`)
  await registrarCusto(db, empresa, 'narracao', peca, `Narração de ${texto.length} caracteres`, texto.length * PRECO_CARACTERE, 'eleven_multilingual_v2')
  return { caminho, palavras, duracao: palavras.at(-1)?.f ?? 0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode usar o editor.' }, 403)
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const corpo = await req.json().catch(() => ({}))
    if (corpo.acao === 'cena') return json(await cena(db, corpo))
    if (corpo.acao === 'cortes') return json(await cortes(db, corpo))
    if (corpo.acao === 'broll_ideias') return json(await brollIdeias(db, corpo))
    if (corpo.acao === 'broll_gerar') return json(await brollGerar(db, corpo))
    if (corpo.acao === 'broll_status') return json(await brollStatus(db, corpo))
    if (corpo.acao === 'vozes') return json(await vozes(db, corpo))
    if (corpo.acao === 'narrar') return json(await narrar(db, corpo))
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: (e as Error).message })
  }
})
