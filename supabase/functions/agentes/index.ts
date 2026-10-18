// Agentes de IA (núcleo). Recebe o id de um trabalho "na fila", responde na hora e faz o trabalho em segundo plano:
// chama o Claude com o perfil da empresa e o contexto do sistema, grava as peças para aprovação e o custo.
// Hoje: agente de Marketing → conteúdo do Instagram (plano dia a dia, peça avulsa, ideias, ajustes). Nada é publicado: só vira rascunho para aprovar.
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
type Peca = { tipo: string; dia: string; titulo: string; objetivo?: string; legenda?: string; roteiro?: string[]; texto_arte?: string; cta?: string; hashtags?: string[]; observacao?: string; prompt_imagem?: string; horario?: string; pendencia?: string }
const TIPOS = ['post', 'carrossel', 'reels', 'stories']
type DiaPlano = { dia: string; post?: number; carrossel?: number; reels?: number; stories?: number }
type Campanha = { id: string; nome: string; descricao?: string; inicio?: string; fim?: string }
// o que fica guardado da peça (sem perder campanha e arte quando o agente reescreve)
const conteudoDe = (p: Peca, extra: Record<string, unknown> = {}) => ({ objetivo: p.objetivo, legenda: p.legenda, roteiro: p.roteiro, texto_arte: p.texto_arte, cta: p.cta, hashtags: p.hashtags, observacao: p.observacao, prompt_imagem: p.prompt_imagem, horario: p.horario, pendencia: p.pendencia || undefined, ...extra })

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
            prompt_imagem: { type: 'string', description: 'Para post e carrossel: pedido pronto para colar no ChatGPT e gerar a arte (cena, enquadramento, luz, cores da marca preto e dourado, texto que vai na arte). Nunca pedir rosto de paciente nem antes e depois.' },
            horario: { type: 'string', description: 'Horário sugerido para postar, HH:MM (ex.: 09:00, 12:00, 18:00)' },
            pendencia: { type: 'string', description: 'Só se a peça depende de algo que NÃO está nos materiais/contexto e a equipe precisa confirmar (ex.: qual bônus vale, data de encerramento). Diga em uma frase o que confirmar. Se não há dúvida, deixe vazio.' },
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
  input_schema: {
    ...PROPS_PECA,
    properties: { ...PROPS_PECA.properties, aprendizado: { type: 'string', description: 'Se o pedido de ajuste mostra um gosto que vale para as PRÓXIMAS peças (ex.: "prefere legendas curtas, até 5 linhas", "gosta de emoji no começo"), escreva em uma frase curta. Se foi algo só desta peça, deixe vazio.' } },
    required: ['tipo', 'titulo', 'objetivo'],
  },
}

// memória do agente: o que ele aprendeu com a equipe (ajustes, descartes e o que foi escrito à mão)
async function lembrar(db: SupabaseClient, empresa: string, agente: string, frase: string) {
  const f = frase.trim()
  if (!f) return
  const { data } = await db.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', agente).maybeSingle()
  const perfil = (data?.perfil ?? {}) as Record<string, unknown>
  const memoria = (Array.isArray(perfil.memoria) ? perfil.memoria : []) as { texto: string; em: string; origem: string }[]
  if (memoria.some((m) => m.texto.toLowerCase() === f.toLowerCase())) return
  const nova = [...memoria, { texto: f, em: new Date().toISOString(), origem: 'ajuste' }].slice(-40)
  await db.from('agentes_empresa').update({ perfil: { ...perfil, memoria: nova } }).eq('empresa_id', empresa).eq('agente_id', agente)
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
  // grupos de links de pagamento criados no Comercial: não são campanhas, só ofertas que estão à venda agora
  for (const g of grupos.data ?? []) linhas.push(`Grupo de links de pagamento ativo "${g.nome}" (oferta à venda agora): ${g.descricao ?? ''}`)
  return linhas.join('\n\n')
}

type Exemplo = { tipo: string; titulo: string; conteudo: { legenda?: string; roteiro?: string[] } }
function pedidoMarketing(perfil: Record<string, string>, pedido: Record<string, unknown>, ctx: string, exemplos: Exemplo[] = []) {
  const memoria = (Array.isArray((perfil as Record<string, unknown>).memoria) ? (perfil as Record<string, unknown>).memoria : []) as { texto: string }[]
  const inicio = String(pedido.semana_inicio)
  const nDias = Math.min(14, Math.max(1, Number(pedido.dias ?? 7)))
  const fim = new Date(new Date(inicio + 'T12:00:00Z').getTime() + (nDias - 1) * 86400000).toISOString().slice(0, 10)
  const dias = Math.min(nDias, Number(pedido.stories ?? 3)), telas = Number(pedido.stories_telas ?? 5)
  const partes = [
    Number(pedido.posts ?? 3) > 0 && `${pedido.posts ?? 3} post(s) ou carrossel(is)`,
    Number(pedido.reels ?? 2) > 0 && `${pedido.reels ?? 2} reels`,
    dias > 0 && `stories em ${dias} dia(s)${dias >= nDias && nDias > 1 ? ' (todos os dias)' : ''}, cada dia com uma sequência de ${telas} telas (o roteiro de cada stories tem exatamente ${telas} itens, um por tela)`,
  ].filter(Boolean)
  const plano = (Array.isArray(pedido.plano) ? pedido.plano : []) as DiaPlano[]
  const campanha = (pedido.campanha ?? null) as Campanha | null
  const linhasPlano = plano.map((d) => {
    const itens = [
      d.post ? `${d.post} post` : '', d.carrossel ? `${d.carrossel} carrossel` : '', d.reels ? `${d.reels} reels` : '',
      d.stories ? `${d.stories} sequência(s) de stories com exatamente ${telas} telas cada` : '',
    ].filter(Boolean)
    return itens.length ? `- ${d.dia}: ${itens.join(', ')}` : ''
  }).filter(Boolean)
  const avulsa = pedido.modo === 'peca'
  const nomes: Record<string, string> = { post: 'post', carrossel: 'carrossel', reels: 'reels', stories: `sequência de stories com exatamente ${telas} telas` }
  const qtd = avulsa ? `1 ${nomes[String(pedido.tipo_peca)] ?? 'post'} (tipo "${String(pedido.tipo_peca ?? 'post')}")` : partes.join(' e ')
  const sistema = [
    'Você é o Agente de Marketing de uma empresa brasileira. Escreve em português do Brasil, pronto para colar no Instagram.',
    'Você prepara o conteúdo (peças avulsas, alguns dias ou a semana); a equipe aprova antes de publicar. Seja concreto: ganchos fortes nos 3 primeiros segundos dos reels, legendas com quebra de linha, chamadas para ação claras.',
    'Respeite sempre as regras abaixo, em especial o que é proibido. Não invente números, depoimentos, preços ou datas que não estejam no contexto.',
    '',
    `EMPRESA: ${perfil.empresa ?? ''}`,
    `O QUE VENDE: ${perfil.o_que_vende ?? ''}`,
    `PÚBLICO: ${perfil.publico ?? ''}`,
    `TOM DE VOZ: ${perfil.tom ?? ''}`,
    `NUNCA FAZER: ${perfil.evitar ?? ''}`,
    `REGRAS DO CONSELHO: ${perfil.conselho ?? ''}`,
    perfil.instagram ? `PERFIL NO INSTAGRAM: ${perfil.instagram}` : '',
    perfil.instrucoes ? `\nINSTRUÇÕES DA EQUIPE PARA ESTE AGENTE (siga sempre): ${perfil.instrucoes}` : '',
    perfil.materiais ? `\nOFERTAS E MATERIAIS DA EMPRESA (fonte da verdade: preços, condições, bônus e datas só podem vir daqui):\n${perfil.materiais}` : '',
    memoria.length ? `\nO QUE VOCÊ JÁ APRENDEU COM ESTA EQUIPE (gostos e recusas; siga sempre):\n${memoria.map((m) => `- ${m.texto}`).join('\n')}` : '',
    exemplos.length ? `\nPEÇAS QUE A EQUIPE APROVOU (use como referência de estilo, sem repetir o conteúdo):\n${exemplos.map((e) => `[${e.tipo}] ${e.titulo}\n${(e.conteudo.legenda ?? (e.conteudo.roteiro ?? []).join(' / ')).slice(0, 700)}`).join('\n---\n')}` : '',
  ].filter(Boolean).join('\n')
  const usuario = [
    linhasPlano.length ? `Monte exatamente este plano, dia por dia (cada peça com o "dia" e o "tipo" indicados; nem mais, nem menos):\n${linhasPlano.join('\n')}`
      : avulsa ? `Faça UMA peça só, para o dia ${inicio}: ${qtd}. É uma peça avulsa pedida pela equipe: capriche no gancho e na chamada.`
      : nDias === 1 ? `Monte o conteúdo do dia ${inicio}: ${qtd}.`
      : `Monte o conteúdo de ${inicio} a ${fim} (${nDias} dias): ${qtd}. Espalhe pelos dias (não precisa ter peça todo dia).`,
    pedido.foco ? `${avulsa ? 'Sobre o que é a peça' : 'Foco pedido pela equipe'}: ${pedido.foco}` : avulsa ? 'Tema livre: escolha o que mais ajuda a vender agora.' : 'Foco livre: equilibre atrair, educar e vender.',
    campanha ? `CAMPANHA destas peças: ${campanha.nome}${campanha.inicio ? ` (de ${campanha.inicio}${campanha.fim ? ` a ${campanha.fim}` : ''})` : ''}. ${campanha.descricao ?? ''}` : '',
    ctx ? `Informações atuais do sistema:\n${ctx}` : '',
    'Entregue OBRIGATORIAMENTE chamando a ferramenta entregar_semana, com todas as peças de uma vez. Não escreva nada fora da ferramenta.',
  ].filter(Boolean).join('\n\n')
  return { sistema, usuario }
}

type Anexo = { nome: string; tipo: 'imagem' | 'pdf'; media_type: string; dados: string }
// arquivos de referência mandados no pedido (prints, imagens, PDF): vão junto com o texto
function comAnexos(usuario: string, anexos: Anexo[]) {
  if (!anexos.length) return usuario
  return [
    ...anexos.map((a) => a.tipo === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.dados } }
      : { type: 'image', source: { type: 'base64', media_type: a.media_type, data: a.dados } }),
    { type: 'text', text: `${usuario}\n\nOs arquivos acima foram enviados pela equipe como REFERÊNCIA (${anexos.map((a) => a.nome).join(', ')}): use como modelo de estilo, formato e ideia, adaptando para a marca. Não copie textos nem marcas de terceiros.` },
  ]
}

async function chamarClaude(chave: string, modelo: string, sistema: string, usuario: string | unknown[], ferramenta: typeof FERRAMENTA | typeof FERRAMENTA_AJUSTE = FERRAMENTA) {
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
    if (r.status === 401) throw new Error('A Anthropic recusou a chave. Confira a chave em Agentes → Configurações.')
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
  const tipoPedido = TIPOS.includes(String(t.pedido.tipo_novo ?? '')) ? String(t.pedido.tipo_novo) : peca.tipo
  const { anterior: _x, arte: _y, ...semExtras } = (peca.conteudo ?? {}) as Record<string, unknown>
  const atual = { tipo: tipoPedido, dia: peca.dia, titulo: peca.titulo, ...semExtras }
  const lembrarIsso = t.pedido.lembrar
  const sobreMemoria = lembrarIsso === true
    ? '\n\nA equipe marcou que este gosto vale para as PRÓXIMAS peças também: preencha "aprendizado" com uma regra geral e curta (sem citar esta peça), para você seguir sempre.'
    : lembrarIsso === false ? '\n\nEste ajuste vale só para esta peça: deixe "aprendizado" vazio.' : ''
  const usuario = `Esta é uma peça que você preparou:\n${JSON.stringify(atual, null, 2)}\n\nPedido de ajuste da equipe: ${String(t.pedido.instrucao ?? '')}${sobreMemoria}\n\nReescreva a peça inteira já com o ajuste (mantenha o que não foi pedido para mudar) e entregue OBRIGATORIAMENTE chamando a ferramenta entregar_peca.`
  const { entrega: p, entrada, saida } = await chamarClaude(chave, modelo, sistema, usuario, FERRAMENTA_AJUSTE)
  // marcado "lembrar": guarda sempre (se o agente não resumir, guarda o próprio pedido); desmarcado: nunca guarda
  const sugerido = String((p as Record<string, unknown>).aprendizado ?? '').trim()
  const aprendizado = lembrarIsso === false ? '' : sugerido || (lembrarIsso === true ? String(t.pedido.instrucao ?? '').trim() : '')
  if (aprendizado) await lembrar(db, t.empresa_id, t.agente_id, aprendizado)
  const { anterior: _a, ...semHistorico } = (peca.conteudo ?? {}) as Record<string, unknown>
  const tipoNovo = TIPOS.includes(String(t.pedido.tipo_novo ?? '')) ? String(t.pedido.tipo_novo) : peca.tipo
  // peça que era só ideia não guarda "versão anterior" vazia
  const anterior = semHistorico.etapa === 'ideia' ? undefined : semHistorico
  await db.from('agentes_pecas').update({
    titulo: p.titulo || peca.titulo, tipo: tipoNovo, status: 'rascunho', atualizado_em: new Date().toISOString(),
    conteudo: conteudoDe(p, { campanha: semHistorico.campanha, arte: semHistorico.arte, anterior }),
  }).eq('id', peca.id)
  await db.from('agentes_trabalhos').update({
    pedido: { ...t.pedido, aprendizado: aprendizado || null },
    status: 'pronto', resumo: `Ajuste: ${String(t.pedido.instrucao ?? '').slice(0, 200)}${aprendizado ? ` · Aprendeu: ${aprendizado}` : ''}`, modelo, tokens_entrada: entrada, tokens_saida: saida,
    custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

// ideias que a equipe anotou (sem IA, sem custo): viram cartões na coluna Ideias para o agente escrever depois
async function guardarIdeias(db: SupabaseClient, t: Trabalho) {
  const lista = (Array.isArray(t.pedido.pecas) ? t.pedido.pecas : []) as { tipo: string; dia?: string; titulo: string; tema?: string; campanha?: string }[]
  const pecas = lista.filter((x) => TIPOS.includes(x.tipo) && x.titulo?.trim()).map((x, i) => ({
    trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: x.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(x.dia ?? '') ? x.dia : null,
    titulo: x.titulo.trim(), ordem: i, conteudo: { etapa: 'ideia', objetivo: x.tema?.trim() || undefined, campanha: x.campanha || undefined },
  }))
  if (pecas.length) { const { error } = await db.from('agentes_pecas').insert(pecas); if (error) throw new Error(error.message) }
  await db.from('agentes_trabalhos').update({ status: 'pronto', resumo: `${pecas.length} ideia(s) anotada(s)`, custo_usd: 0, terminado_em: new Date().toISOString() }).eq('id', t.id)
}

async function executar(db: SupabaseClient, t: Trabalho) {
  try {
    const [{ data: cfg }, { data: perfilAg }, { data: chave }, { data: gastos }] = await Promise.all([
      db.from('agentes_config').select('modelo,limite_mes_usd').eq('empresa_id', t.empresa_id).maybeSingle(),
      db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', t.empresa_id).eq('agente_id', t.agente_id).maybeSingle(),
      db.rpc('agentes_ler_chave', { p_empresa: t.empresa_id }),
      db.from('agentes_trabalhos').select('custo_usd,agente_id').eq('empresa_id', t.empresa_id).gte('criado_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])
    if (t.tipo === 'ideia') return await guardarIdeias(db, t)
    if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
    if (!perfilAg?.ativo) throw new Error('Este agente está desligado. Ligue em Configurar agente.')
    const gastoMes = (gastos ?? []).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
    if (cfg?.limite_mes_usd != null && gastoMes >= Number(cfg.limite_mes_usd)) throw new Error(`Limite do mês da empresa atingido (US$ ${Number(cfg.limite_mes_usd).toFixed(2)}). Aumente em Configurações.`)
    // configuração própria do agente (modelo, limite e instruções), guardada no perfil dele
    const pa = (perfilAg.perfil ?? {}) as Record<string, unknown>
    const gastoAgente = (gastos ?? []).filter((g) => g.agente_id === t.agente_id).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
    if (pa.limite_mes_usd != null && pa.limite_mes_usd !== '' && gastoAgente >= Number(pa.limite_mes_usd)) throw new Error(`Limite do mês deste agente atingido (US$ ${Number(pa.limite_mes_usd).toFixed(2)}). Aumente em Configurar agente.`)
    const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? cfg?.modelo ?? 'claude-sonnet-5-5'
    if (t.agente_id !== 'marketing' || !['semana', 'ajuste', 'ideia'].includes(t.tipo)) throw new Error('Trabalho que este agente ainda não sabe fazer.')
    if (t.tipo === 'ajuste') return await ajustar(db, t, (perfilAg.perfil ?? {}) as Record<string, string>, String(chave), modelo)

    // posts/reels e stories em dois pedidos ao mesmo tempo: sai na metade do tempo
    const perfil = (perfilAg.perfil ?? {}) as Record<string, string>
    const ctx = await contexto(db)
    const { data: exemplos } = await db.from('agentes_pecas').select('tipo,titulo,conteudo').eq('empresa_id', t.empresa_id).eq('agente_id', t.agente_id).in('status', ['aprovada', 'postada']).order('atualizado_em', { ascending: false }).limit(3)
    const plano = (Array.isArray(t.pedido.plano) ? t.pedido.plano : []) as DiaPlano[]
    const soma = (ds: DiaPlano[], k: keyof DiaPlano) => ds.reduce((s, d) => s + Number(d[k] ?? 0), 0)
    const pedidos = (plano.length
      ? [
        { ...t.pedido, plano: plano.map((d) => ({ ...d, stories: 0 })), posts: soma(plano, 'post') + soma(plano, 'carrossel'), reels: soma(plano, 'reels'), stories: 0 },
        { ...t.pedido, plano: plano.map((d) => ({ dia: d.dia, stories: d.stories ?? 0 })), posts: 0, reels: 0, stories: soma(plano, 'stories') },
      ]
      : [{ ...t.pedido, stories: 0 }, { ...t.pedido, posts: 0, reels: 0 }]
    ).filter((pd) => Number(pd.posts ?? 0) + Number(pd.reels ?? 0) + Number(pd.stories ?? 0) > 0)
    // stories são textos curtos e muitos: vão no modelo econômico (cerca de 20x mais barato); posts e reels no modelo escolhido
    const modeloDe = (pd: Record<string, unknown>) => (Number(pd.posts ?? 0) + Number(pd.reels ?? 0) === 0 && pa.stories_economico !== false ? 'claude-haiku-5-5' : modelo)
    const campanhaId = (t.pedido.campanha as Campanha | null)?.id
    const anexos = (Array.isArray(t.pedido.anexos) ? t.pedido.anexos : []) as Anexo[]
    const respostas = await Promise.all(pedidos.map(async (pd) => { const { sistema, usuario } = pedidoMarketing(perfil, pd, ctx, (exemplos ?? []) as Exemplo[]); const m = modeloDe(pd); return { ...(await chamarClaude(String(chave), m, sistema, comAnexos(usuario, anexos))), modelo: m } }))
    const entrega = { resumo: respostas.map((r) => r.entrega.resumo).filter(Boolean)[0] ?? null, pecas: respostas.flatMap((r) => r.entrega.pecas ?? []) }
    const entrada = respostas.reduce((s, r) => s + r.entrada, 0), saida = respostas.reduce((s, r) => s + r.saida, 0)
    const custoTotal = Math.round(respostas.reduce((s, r) => s + custo(r.modelo, r.entrada, r.saida), 0) * 10000) / 10000
    const pecas = entrega.pecas.map((p, i) => ({
      trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: p.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(p.dia) ? p.dia : null,
      titulo: p.titulo || `Peça ${i + 1}`, ordem: i,
      conteudo: conteudoDe(p, { campanha: campanhaId }),
    }))
    if (pecas.length) { const { error } = await db.from('agentes_pecas').insert(pecas); if (error) throw new Error(error.message) }
    await db.from('agentes_trabalhos').update({
      // os arquivos já foram usados: fica só o nome, para não pesar o histórico
      pedido: { ...t.pedido, anexos: anexos.map((a) => ({ nome: a.nome, tipo: a.tipo })) },
      status: 'pronto', resumo: entrega.resumo ?? null, modelo: [...new Set(respostas.map((r) => r.modelo))].join(' + '), tokens_entrada: entrada, tokens_saida: saida,
      custo_usd: custoTotal, terminado_em: new Date().toISOString(),
    }).eq('id', t.id)
  } catch (e) {
    const anexosLeves = (Array.isArray(t.pedido.anexos) ? t.pedido.anexos as Anexo[] : []).map((a) => ({ nome: a.nome, tipo: a.tipo }))
    await db.from('agentes_trabalhos').update({ status: 'erro', erro: (e as Error).message, terminado_em: new Date().toISOString(), pedido: { ...t.pedido, anexos: anexosLeves } }).eq('id', t.id)
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
