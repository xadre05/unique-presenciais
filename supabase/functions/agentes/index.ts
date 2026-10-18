// Agentes de IA (núcleo). Recebe o id de um trabalho "na fila", responde na hora e faz o trabalho em segundo plano:
// chama o Claude com o perfil da empresa e o contexto do sistema, grava as peças para aprovação e o custo.
// Hoje: agente de Marketing → semana de conteúdo do Instagram. Nada é publicado: só vira rascunho para aprovar.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// preço por milhão de tokens (US$), tabela oficial da Anthropic (out/2026)
const PRECO: Record<string, { entrada: number; saida: number }> = {
  'claude-sonnet-5-5': { entrada: 2, saida: 10 },
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 },
}
const custo = (modelo: string, ent: number, sai: number) => {
  const p = PRECO[modelo] ?? PRECO['claude-sonnet-5-5']
  return Math.round(((ent * p.entrada + sai * p.saida) / 1_000_000) * 10000) / 10000
}

type Trabalho = { id: string; empresa_id: string; agente_id: string; tipo: string; status: string; pedido: Record<string, unknown> }
type Peca = { tipo: string; dia: string; titulo: string; objetivo?: string; legenda?: string; roteiro?: string[]; texto_arte?: string; cta?: string; hashtags?: string[]; observacao?: string }

const FERRAMENTA = {
  name: 'entregar_semana',
  description: 'Entrega a semana de conteúdo do Instagram, peça por peça, para a equipe aprovar.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Duas ou três frases explicando a linha da semana (o fio que liga as peças) e por quê.' },
      pecas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['post', 'carrossel', 'reels', 'stories'] },
            dia: { type: 'string', description: 'Data AAAA-MM-DD dentro da semana pedida' },
            titulo: { type: 'string', description: 'Nome curto da peça para a equipe reconhecer' },
            objetivo: { type: 'string', description: 'Para que serve: atrair, educar, gerar desejo, vender, prova social…' },
            legenda: { type: 'string', description: 'Legenda pronta para colar (com quebras de linha). Stories podem não ter.' },
            roteiro: { type: 'array', items: { type: 'string' }, description: 'Reels: cenas/falas em ordem. Carrossel: texto de cada lâmina. Stories: cada tela em ordem.' },
            texto_arte: { type: 'string', description: 'Texto curto que vai escrito na arte/capa' },
            cta: { type: 'string', description: 'Chamada para ação' },
            hashtags: { type: 'array', items: { type: 'string' } },
            observacao: { type: 'string', description: 'Dica de gravação, imagem ou cuidado com as regras do conselho' },
          },
          required: ['tipo', 'dia', 'titulo', 'objetivo'],
        },
      },
    },
    required: ['resumo', 'pecas'],
  },
}

const PROPS_PECA = FERRAMENTA.input_schema.properties.pecas.items
const FERRAMENTA_AJUSTE = {
  name: 'entregar_peca',
  description: 'Entrega a peça ajustada, completa, para a equipe aprovar.',
  input_schema: { ...PROPS_PECA, required: ['tipo', 'titulo', 'objetivo'] },
}

async function contexto(db: SupabaseClient) {
  const [cursos, turmas, grupos] = await Promise.all([
    db.from('cursos').select('nome').eq('ativo', true).order('nome'),
    db.from('v_turmas').select('nome,curso_nome,data_inicio,vagas,inscritos,vendas_abertas,status').gte('data_inicio', new Date().toISOString().slice(0, 10)).order('data_inicio').limit(12),
    db.from('links_grupos').select('nome,descricao').eq('ativo', true),
  ])
  const linhas: string[] = []
  if (cursos.data?.length) linhas.push(`Cursos presenciais cadastrados: ${cursos.data.map((c) => c.nome).join('; ')}.`)
  const abertas = (turmas.data ?? []).filter((t) => t.vendas_abertas && !['cancelada', 'realizada'].includes(String(t.status)))
  if (abertas.length) linhas.push('Próximas turmas com vendas abertas:\n' + abertas.map((t) => `- ${t.curso_nome} · ${t.nome} · início ${t.data_inicio} · ${Math.max(0, Number(t.vagas ?? 0) - Number(t.inscritos ?? 0))} vagas livres de ${t.vagas ?? '?'}`).join('\n'))
  for (const g of grupos.data ?? []) linhas.push(`Campanha ativa "${g.nome}": ${g.descricao ?? ''}`)
  return linhas.join('\n\n')
}

function pedidoMarketing(perfil: Record<string, string>, pedido: Record<string, unknown>, ctx: string) {
  const inicio = String(pedido.semana_inicio)
  const fim = new Date(new Date(inicio + 'T12:00:00Z').getTime() + 6 * 86400000).toISOString().slice(0, 10)
  const dias = Number(pedido.stories ?? 3), telas = Number(pedido.stories_telas ?? 5)
  const partes = [
    Number(pedido.posts ?? 3) > 0 && `${pedido.posts ?? 3} post(s) ou carrossel(is)`,
    Number(pedido.reels ?? 2) > 0 && `${pedido.reels ?? 2} reels`,
    dias > 0 && `stories em ${dias} dia(s) da semana${dias >= 7 ? ' (todos os dias)' : ''}, cada dia com uma sequência de ${telas} telas (o roteiro de cada stories tem exatamente ${telas} itens, um por tela)`,
  ].filter(Boolean)
  const qtd = partes.join(' e ')
  const sistema = [
    'Você é o Agente de Marketing de uma empresa brasileira. Escreve em português do Brasil, pronto para colar no Instagram.',
    'Você monta a semana de conteúdo; a equipe aprova antes de publicar. Seja concreto: ganchos fortes nos 3 primeiros segundos dos reels, legendas com quebra de linha, chamadas para ação claras.',
    'Respeite sempre as regras abaixo, em especial o que é proibido. Não invente números, depoimentos, preços ou datas que não estejam no contexto.',
    '',
    `EMPRESA: ${perfil.empresa ?? ''}`,
    `O QUE VENDE: ${perfil.o_que_vende ?? ''}`,
    `PÚBLICO: ${perfil.publico ?? ''}`,
    `TOM DE VOZ: ${perfil.tom ?? ''}`,
    `NUNCA FAZER: ${perfil.evitar ?? ''}`,
    `REGRAS DO CONSELHO: ${perfil.conselho ?? ''}`,
    perfil.instagram ? `PERFIL NO INSTAGRAM: ${perfil.instagram}` : '',
  ].filter(Boolean).join('\n')
  const usuario = [
    `Monte a semana de ${inicio} a ${fim}: ${qtd}. Espalhe pelos dias (não precisa ter peça todo dia).`,
    pedido.foco ? `Foco da semana pedido pela equipe: ${pedido.foco}` : 'Foco livre: equilibre atrair, educar e vender.',
    ctx ? `Informações atuais do sistema:\n${ctx}` : '',
    'Entregue OBRIGATORIAMENTE chamando a ferramenta entregar_semana, com todas as peças de uma vez. Não escreva nada fora da ferramenta.',
  ].filter(Boolean).join('\n\n')
  return { sistema, usuario }
}

async function chamarClaude(chave: string, modelo: string, sistema: string, usuario: string, ferramenta: typeof FERRAMENTA | typeof FERRAMENTA_AJUSTE = FERRAMENTA) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelo, max_tokens: 32000, system: sistema,
      messages: [{ role: 'user', content: usuario }],
      // os modelos 5.5 não aceitam forçar a ferramenta: fica "auto" e o pedido manda usá-la
      tools: [ferramenta], tool_choice: { type: 'auto' },
    }),
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = corpo?.error?.message ?? `erro ${r.status}`
    if (r.status === 401) throw new Error('A Anthropic recusou a chave. Confira a chave na Central de agentes.')
    if (r.status === 400 && /credit|balance/i.test(msg)) throw new Error('A conta da Anthropic está sem crédito. Coloque crédito em console.anthropic.com → Billing.')
    throw new Error(`Claude respondeu ${r.status}: ${msg}`)
  }
  const uso = corpo.usage ?? {}
  const bloco = (corpo.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
  let entrega: unknown = bloco?.input
  if (!entrega) {
    // sem a ferramenta: tenta ler o JSON que veio no texto
    const texto = (corpo.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n')
    const ini = texto.indexOf('{'), fim = texto.lastIndexOf('}')
    try { if (ini >= 0 && fim > ini) entrega = JSON.parse(texto.slice(ini, fim + 1)) } catch { /* segue para o erro */ }
  }
  if (!entrega) throw new Error('O Claude não entregou no formato esperado. Tente de novo.')
  return { entrega: entrega as { resumo: string; pecas: Peca[] } & Peca, entrada: Number(uso.input_tokens ?? 0), saida: Number(uso.output_tokens ?? 0) }
}

// ajuste de uma peça já feita: a equipe pede ("mais 3 telas", "mais curta", "fala da turma de março") e o agente reescreve
async function ajustar(db: SupabaseClient, t: Trabalho, perfil: Record<string, string>, chave: string, modelo: string) {
  const { data: peca } = await db.from('agentes_pecas').select('*').eq('id', String(t.pedido.peca_id)).eq('empresa_id', t.empresa_id).maybeSingle()
  if (!peca) throw new Error('Peça não encontrada.')
  const { sistema } = pedidoMarketing(perfil, { semana_inicio: peca.dia ?? new Date().toISOString().slice(0, 10) }, '')
  const atual = { tipo: peca.tipo, dia: peca.dia, titulo: peca.titulo, ...peca.conteudo }
  const usuario = `Esta é uma peça que você preparou:\n${JSON.stringify(atual, null, 2)}\n\nPedido de ajuste da equipe: ${String(t.pedido.instrucao ?? '')}\n\nReescreva a peça inteira já com o ajuste (mantenha o que não foi pedido para mudar) e entregue OBRIGATORIAMENTE chamando a ferramenta entregar_peca.`
  const { entrega: p, entrada, saida } = await chamarClaude(chave, modelo, sistema, usuario, FERRAMENTA_AJUSTE)
  const { anterior: _a, ...semHistorico } = (peca.conteudo ?? {}) as Record<string, unknown>
  await db.from('agentes_pecas').update({
    titulo: p.titulo || peca.titulo, status: 'rascunho', atualizado_em: new Date().toISOString(),
    conteudo: { objetivo: p.objetivo, legenda: p.legenda, roteiro: p.roteiro, texto_arte: p.texto_arte, cta: p.cta, hashtags: p.hashtags, observacao: p.observacao, anterior: semHistorico },
  }).eq('id', peca.id)
  await db.from('agentes_trabalhos').update({
    status: 'pronto', resumo: `Ajuste: ${String(t.pedido.instrucao ?? '').slice(0, 200)}`, modelo, tokens_entrada: entrada, tokens_saida: saida,
    custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

async function executar(db: SupabaseClient, t: Trabalho) {
  try {
    const [{ data: cfg }, { data: perfilAg }, { data: chave }, { data: gastos }] = await Promise.all([
      db.from('agentes_config').select('modelo,limite_mes_usd').eq('empresa_id', t.empresa_id).maybeSingle(),
      db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', t.empresa_id).eq('agente_id', t.agente_id).maybeSingle(),
      db.rpc('agentes_ler_chave', { p_empresa: t.empresa_id }),
      db.from('agentes_trabalhos').select('custo_usd').eq('empresa_id', t.empresa_id).gte('criado_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])
    if (!chave) throw new Error('Falta cadastrar a chave do Claude na Central de agentes.')
    if (!perfilAg?.ativo) throw new Error('Este agente está desligado na Central de agentes.')
    const gastoMes = (gastos ?? []).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
    if (cfg?.limite_mes_usd != null && gastoMes >= Number(cfg.limite_mes_usd)) throw new Error(`Limite do mês atingido (US$ ${Number(cfg.limite_mes_usd).toFixed(2)}). Aumente na Central de agentes.`)
    const modelo = cfg?.modelo ?? 'claude-sonnet-5-5'
    if (t.agente_id !== 'marketing' || !['semana', 'ajuste'].includes(t.tipo)) throw new Error('Trabalho que este agente ainda não sabe fazer.')
    if (t.tipo === 'ajuste') return await ajustar(db, t, (perfilAg.perfil ?? {}) as Record<string, string>, String(chave), modelo)

    // posts/reels e stories em dois pedidos ao mesmo tempo: sai na metade do tempo
    const perfil = (perfilAg.perfil ?? {}) as Record<string, string>
    const ctx = await contexto(db)
    const pedidos = [
      { ...t.pedido, stories: 0 },
      { ...t.pedido, posts: 0, reels: 0 },
    ].filter((pd) => Number(pd.posts ?? 0) + Number(pd.reels ?? 0) + Number(pd.stories ?? 0) > 0)
    const respostas = await Promise.all(pedidos.map((pd) => { const { sistema, usuario } = pedidoMarketing(perfil, pd, ctx); return chamarClaude(String(chave), modelo, sistema, usuario) }))
    const entrega = { resumo: respostas.map((r) => r.entrega.resumo).filter(Boolean)[0] ?? null, pecas: respostas.flatMap((r) => r.entrega.pecas ?? []) }
    const entrada = respostas.reduce((s, r) => s + r.entrada, 0), saida = respostas.reduce((s, r) => s + r.saida, 0)
    const pecas = entrega.pecas.map((p, i) => ({
      trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: p.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(p.dia) ? p.dia : null,
      titulo: p.titulo || `Peça ${i + 1}`, ordem: i,
      conteudo: { objetivo: p.objetivo, legenda: p.legenda, roteiro: p.roteiro, texto_arte: p.texto_arte, cta: p.cta, hashtags: p.hashtags, observacao: p.observacao },
    }))
    if (pecas.length) { const { error } = await db.from('agentes_pecas').insert(pecas); if (error) throw new Error(error.message) }
    await db.from('agentes_trabalhos').update({
      status: 'pronto', resumo: entrega.resumo ?? null, modelo, tokens_entrada: entrada, tokens_saida: saida,
      custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
    }).eq('id', t.id)
  } catch (e) {
    await db.from('agentes_trabalhos').update({ status: 'erro', erro: (e as Error).message, terminado_em: new Date().toISOString() }).eq('id', t.id)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode acionar os agentes.' }, 403)
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { trabalho } = await req.json().catch(() => ({}))
  const { data: t } = await db.from('agentes_trabalhos').select('*').eq('id', String(trabalho ?? '')).maybeSingle()
  if (!t) return json({ erro: 'Trabalho não encontrado.' }, 404)
  if (t.status !== 'na_fila') return json({ ok: true, status: t.status })
  // marca como "trabalhando" só se ainda estiver na fila (evita rodar duas vezes)
  const { data: pego } = await db.from('agentes_trabalhos').update({ status: 'trabalhando', iniciado_em: new Date().toISOString() }).eq('id', t.id).eq('status', 'na_fila').select('id').maybeSingle()
  if (!pego) return json({ ok: true, status: 'trabalhando' })

  // @ts-ignore EdgeRuntime existe no Supabase
  EdgeRuntime.waitUntil(executar(db, t as Trabalho))
  return json({ ok: true, status: 'trabalhando' }, 202)
})
