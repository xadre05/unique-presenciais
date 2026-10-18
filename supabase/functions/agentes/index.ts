// Agentes de IA (núcleo). Recebe o id de um trabalho "na fila", responde na hora e faz o trabalho em segundo plano:
// chama o Claude com o perfil da empresa e o contexto do sistema, grava as peças para aprovação e o custo.
// Hoje: agente de Marketing → conteúdo para as redes (Instagram, TikTok, YouTube, Facebook, LinkedIn): plano dia a dia, peça avulsa, ideias, ajustes. Nada é publicado: só vira rascunho para aprovar.
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
type Peca = { ref?: number; rede?: string; tipo: string; dia: string; titulo: string; objetivo?: string; legenda?: string; roteiro?: string[]; texto_arte?: string; cta?: string; hashtags?: string[]; observacao?: string; prompt_imagem?: string; horario?: string; pendencia?: string }
const TIPOS = ['post', 'carrossel', 'reels', 'stories', 'video']
// como escrever em cada rede e o nome de cada formato nela ("reels" = vídeo curto vertical; "video" = vídeo longo)
const REDES: Record<string, { nome: string; guia: string; nomes: Record<string, string> }> = {
  instagram: { nome: 'Instagram', nomes: { post: 'post', carrossel: 'carrossel', reels: 'reels', stories: 'stories' },
    guia: 'Ganchos fortes nos 3 primeiros segundos dos reels, legendas com quebra de linha, chamadas para ação claras, até 8 hashtags.' },
  tiktok: { nome: 'TikTok', nomes: { reels: 'vídeo do TikTok (vertical, 15 a 60 s)', carrossel: 'carrossel de fotos do TikTok', stories: 'stories do TikTok (some em 24 h)' },
    guia: 'Linguagem nativa do TikTok: gancho no 1º segundo, ritmo rápido, fala direta para a câmera, texto na tela curto, legenda curta com 3 a 5 hashtags, nada com cara de anúncio.' },
  youtube: { nome: 'YouTube', nomes: { reels: 'YouTube Shorts (vertical, até 60 s)', video: 'vídeo longo do YouTube (horizontal, 6 a 15 min)', post: 'post da comunidade do YouTube (texto com imagem ou enquete)' },
    guia: 'Shorts: gancho no 1º segundo e fechamento que leve ao canal. Vídeo longo: título que as pessoas buscam (até 60 caracteres) no campo titulo, roteiro em blocos com tempo aproximado (abertura, conteúdo, chamada), descrição com capítulos na legenda, e o prompt_imagem descreve a capa (thumbnail) com rosto expressivo e até 4 palavras. Post da comunidade: texto curto que puxa conversa com quem já segue o canal (pergunta, enquete ou bastidor), chamando para o vídeo mais recente.' },
  facebook: { nome: 'Facebook', nomes: { post: 'post', carrossel: 'post com várias fotos (carrossel)', reels: 'reels do Facebook', stories: 'stories' },
    guia: 'Público um pouco mais velho: texto pode ser um pouco mais longo e explicativo, tom acolhedor, poucas hashtags (até 3).' },
  linkedin: { nome: 'LinkedIn', nomes: { post: 'post', carrossel: 'carrossel em PDF', reels: 'vídeo curto' },
    guia: 'Tom profissional e de autoridade: bastidores da escola, mercado de HOF, carreira e gestão de consultório. Sem gírias, emojis com moderação, até 3 hashtags.' },
  pinterest: { nome: 'Pinterest', nomes: { post: 'Pin (imagem vertical 2:3)', carrossel: 'Pin carrossel', reels: 'Pin em vídeo (vertical)' },
    guia: 'Pinterest é busca: título com as palavras que as pessoas procuram (até 100 caracteres), descrição curta e útil com palavras-chave e chamada para o link, sem hashtags em excesso. Arte vertical 2:3 com texto grande.' },
  threads: { nome: 'Threads', nomes: { post: 'post de texto do Threads', carrossel: 'post do Threads com fotos' },
    guia: 'Conversa, não anúncio: texto curto (até 500 caracteres), tom pessoal e de opinião, termina com uma pergunta para puxar resposta. No máximo 1 marcador de tópico.' },
}
const NOMES_REDES = Object.keys(REDES)
type CadastroRedes = Record<string, { ativa?: boolean; perfil?: string }>
// canais que a empresa usa (Base da marca → Redes sociais); sem cadastro valem Instagram, YouTube e TikTok
const redesAtivas = (perfil: Record<string, unknown>) => {
  const cad = (perfil.redes ?? null) as CadastroRedes | null
  const lista = cad ? NOMES_REDES.filter((r) => cad[r]?.ativa) : []
  return lista.length ? lista : ['instagram', 'youtube', 'tiktok']
}
const formatosDe = (rede: string) => Object.entries(REDES[rede].nomes).map(([tipo, nome]) => `${nome} = "${tipo}"`).join(', ')
const listaCanais = (redes: string[]) => redes.map((r) => `${REDES[r].nome} (rede "${r}": ${formatosDe(r)})`).join('; ')
const redeDo = (x: unknown) => (typeof x === 'string' && REDES[x] ? x : 'instagram')
type DiaPlano = { dia: string; post?: number; carrossel?: number; reels?: number; stories?: number; video?: number }
type Campanha = { id: string; nome: string; descricao?: string; inicio?: string; fim?: string }
// o que fica guardado da peça (sem perder campanha e arte quando o agente reescreve)
const conteudoDe = (p: Peca, extra: Record<string, unknown> = {}) => ({ rede: 'instagram', objetivo: p.objetivo, legenda: p.legenda, roteiro: p.roteiro, texto_arte: p.texto_arte, cta: p.cta, hashtags: p.hashtags, observacao: p.observacao, prompt_imagem: p.prompt_imagem, horario: p.horario, pendencia: p.pendencia || undefined, ...extra })

const FERRAMENTA = {
  name: 'entregar_semana',
  description: 'Entrega o conteúdo pedido para a rede social, peça por peça, para a equipe aprovar.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Duas ou três frases explicando a linha da semana (o fio que liga as peças) e por quê.' },
      pecas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['post', 'carrossel', 'reels', 'stories', 'video'], description: 'reels = vídeo curto vertical (Reels, TikTok, Shorts); video = vídeo longo do YouTube' },
            dia: { type: 'string', description: 'Data AAAA-MM-DD dentro da semana pedida' },
            titulo: { type: 'string', description: 'Nome curto da peça para a equipe reconhecer' },
            objetivo: { type: 'string', description: 'Para que serve: atrair, educar, gerar desejo, vender, prova social…' },
            legenda: { type: 'string', description: 'Legenda pronta para colar (com quebras de linha). Stories podem não ter.' },
            roteiro: { type: 'array', items: { type: 'string' }, description: 'Vídeo curto: cenas/falas em ordem. Vídeo longo: blocos com tempo aproximado. Carrossel: texto de cada lâmina. Stories: cada tela em ordem.' },
            texto_arte: { type: 'string', description: 'Texto curto que vai escrito na arte/capa' },
            cta: { type: 'string', description: 'Chamada para ação' },
            hashtags: { type: 'array', items: { type: 'string' } },
            observacao: { type: 'string', description: 'Dica de gravação, imagem ou cuidado com as regras do conselho' },
            prompt_imagem: { type: 'string', description: 'Para post e carrossel (e a capa do vídeo longo): pedido pronto para colar no ChatGPT e gerar a arte (cena, enquadramento, luz, cores da marca preto e dourado, texto que vai na arte). Nunca pedir rosto de paciente nem antes e depois.' },
            rede: { type: 'string', enum: NOMES_REDES, description: 'Só quando o item pede para você escolher o canal: o canal escolhido' },
            ref: { type: 'integer', description: 'Quando a lista pedida é numerada: o número do item que esta peça atende' },
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

// perfis da empresa em cada canal ligado (para citar o @ certo e não inventar)
function perfisRedes(perfil: Record<string, unknown>) {
  const cad = (perfil.redes ?? {}) as CadastroRedes
  const linhas = redesAtivas(perfil).map((r) => `${REDES[r].nome}${cad[r]?.perfil ? `: ${cad[r]?.perfil}` : ''}`)
  if (!cad.instagram && perfil.instagram) linhas.unshift(`Instagram: ${perfil.instagram}`)
  return `CANAIS QUE A EMPRESA USA: ${[...new Set(linhas)].join(' · ')}`
}

type Exemplo = { tipo: string; titulo: string; conteudo: { legenda?: string; roteiro?: string[] } }
// o que o agente sabe da empresa (Base da marca, instruções, ofertas, memória e peças aprovadas): vale para todo pedido
function blocoEmpresa(perfil: Record<string, string>, exemplos: Exemplo[]) {
  const memoria = (Array.isArray((perfil as Record<string, unknown>).memoria) ? (perfil as Record<string, unknown>).memoria : []) as { texto: string }[]
  return [
    'Respeite sempre as regras abaixo, em especial o que é proibido. Não invente números, depoimentos, preços ou datas que não estejam no contexto.',
    '',
    `EMPRESA: ${perfil.empresa ?? ''}`,
    `O QUE VENDE: ${perfil.o_que_vende ?? ''}`,
    `PÚBLICO: ${perfil.publico ?? ''}`,
    `TOM DE VOZ: ${perfil.tom ?? ''}`,
    `NUNCA FAZER: ${perfil.evitar ?? ''}`,
    `REGRAS DO CONSELHO: ${perfil.conselho ?? ''}`,
    perfisRedes(perfil as Record<string, unknown>),
    perfil.instrucoes ? `\nINSTRUÇÕES DA EQUIPE PARA ESTE AGENTE (siga sempre): ${perfil.instrucoes}` : '',
    perfil.materiais ? `\nOFERTAS E MATERIAIS DA EMPRESA (fonte da verdade: preços, condições, bônus e datas só podem vir daqui):\n${perfil.materiais}` : '',
    memoria.length ? `\nO QUE VOCÊ JÁ APRENDEU COM ESTA EQUIPE (gostos e recusas; siga sempre):\n${memoria.map((m) => `- ${m.texto}`).join('\n')}` : '',
    exemplos.length ? `\nPEÇAS QUE A EQUIPE APROVOU (use como referência de estilo, sem repetir o conteúdo):\n${exemplos.map((e) => `[${e.tipo}] ${e.titulo}\n${(e.conteudo.legenda ?? (e.conteudo.roteiro ?? []).join(' / ')).slice(0, 700)}`).join('\n---\n')}` : '',
  ]
}
function pedidoMarketing(perfil: Record<string, string>, pedido: Record<string, unknown>, ctx: string, exemplos: Exemplo[] = []) {
  const inicio = String(pedido.semana_inicio)
  const nDias = Math.min(14, Math.max(1, Number(pedido.dias ?? 7)))
  const fim = new Date(new Date(inicio + 'T12:00:00Z').getTime() + (nDias - 1) * 86400000).toISOString().slice(0, 10)
  const dias = Math.min(nDias, Number(pedido.stories ?? 3)), telas = Number(pedido.stories_telas ?? 5)
  const partes = [
    Number(pedido.posts ?? 3) > 0 && `${pedido.posts ?? 3} post(s) ou carrossel(is)`,
    Number(pedido.reels ?? 2) > 0 && `${pedido.reels ?? 2} reels`,
    dias > 0 && `stories em ${dias} dia(s)${dias >= nDias && nDias > 1 ? ' (todos os dias)' : ''}, cada dia com uma sequência de ${telas} telas (o roteiro de cada stories tem exatamente ${telas} itens, um por tela)`,
  ].filter(Boolean)
  const rede = REDES[redeDo(pedido.rede)]
  const nomeDe = (tipo: string) => `${rede.nomes[tipo] ?? tipo} (tipo "${tipo}")`
  const plano = (Array.isArray(pedido.plano) ? pedido.plano : []) as DiaPlano[]
  const campanha = (pedido.campanha ?? null) as Campanha | null
  const linhasPlano = plano.map((d) => {
    const itens = [
      d.post ? `${d.post} ${nomeDe('post')}` : '', d.carrossel ? `${d.carrossel} ${nomeDe('carrossel')}` : '', d.reels ? `${d.reels} ${nomeDe('reels')}` : '',
      d.video ? `${d.video} ${nomeDe('video')}` : '', d.stories ? `${d.stories} sequência(s) de stories com exatamente ${telas} telas cada (tipo "stories")` : '',
    ].filter(Boolean)
    return itens.length ? `- ${d.dia}: ${itens.join(', ')}` : ''
  }).filter(Boolean)
  const avulsa = pedido.modo === 'peca'
  const nomes: Record<string, string> = { ...rede.nomes, stories: `sequência de stories com exatamente ${telas} telas` }
  const qtd = avulsa ? `1 ${nomes[String(pedido.tipo_peca)] ?? 'post'} (tipo "${String(pedido.tipo_peca ?? 'post')}")` : partes.join(' e ')
  const sistema = [
    `Você é o Agente de Marketing de uma empresa brasileira. Escreve em português do Brasil, pronto para colar no ${rede.nome}.`,
    `Você prepara o conteúdo (peças avulsas, alguns dias ou a semana); a equipe aprova antes de publicar. Seja concreto. REDE DESTE PEDIDO: ${rede.nome}. ${rede.guia}`,
    ...blocoEmpresa(perfil, exemplos),
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

type Ferramenta = { name: string; description: string; input_schema: Record<string, unknown> }
async function chamarClaude(chave: string, modelo: string, sistema: string, usuario: string | unknown[], ferramenta: Ferramenta = FERRAMENTA) {
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
  return { entrega: entrega as { resumo: string; pecas: Peca[]; itens?: ItemPlano[] } & Peca, entrada: Number(uso.input_tokens ?? 0), saida: Number(uso.output_tokens ?? 0) }
}

// ajuste de uma peça já feita: a equipe pede ("mais 3 telas", "mais curta", "fala da turma de março") e o agente reescreve
async function ajustar(db: SupabaseClient, t: Trabalho, perfil: Record<string, string>, chave: string, modelo: string) {
  const { data: peca } = await db.from('agentes_pecas').select('*').eq('id', String(t.pedido.peca_id)).eq('empresa_id', t.empresa_id).maybeSingle()
  if (!peca) throw new Error('Peça não encontrada.')
  const { sistema } = pedidoMarketing(perfil, { semana_inicio: peca.dia ?? new Date().toISOString().slice(0, 10), rede: (peca.conteudo ?? {}).rede }, '')
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
    conteudo: conteudoDe(p, { rede: redeDo(semHistorico.rede), campanha: semHistorico.campanha, plano: semHistorico.plano, briefing: semHistorico.briefing, arte: semHistorico.arte, anterior }),
  }).eq('id', peca.id)
  await db.from('agentes_trabalhos').update({
    pedido: { ...t.pedido, aprendizado: aprendizado || null },
    status: 'pronto', resumo: `Ajuste: ${String(t.pedido.instrucao ?? '').slice(0, 200)}${aprendizado ? ` · Aprendeu: ${aprendizado}` : ''}`, modelo, tokens_entrada: entrada, tokens_saida: saida,
    custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

// ideias que a equipe anotou (sem IA, sem custo): viram cartões na coluna Ideias para o agente escrever depois
async function guardarIdeias(db: SupabaseClient, t: Trabalho) {
  const lista = (Array.isArray(t.pedido.pecas) ? t.pedido.pecas : []) as { tipo: string; rede?: string; dia?: string; titulo: string; tema?: string; campanha?: string; plano?: string; proposta?: boolean; briefing?: Briefing }[]
  const pecas = lista.filter((x) => (TIPOS.includes(x.tipo) || x.tipo === 'auto') && x.titulo?.trim()).map((x, i) => ({
    trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: x.tipo === 'auto' ? 'post' : x.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(x.dia ?? '') ? x.dia : null,
    titulo: x.titulo.trim(), ordem: i, conteudo: { etapa: 'ideia', livre: x.tipo === 'auto' || undefined, proposta: x.proposta === true || undefined, rede: redeDo(x.rede), objetivo: x.tema?.trim() || undefined, campanha: x.campanha || undefined, plano: x.plano || undefined, briefing: x.briefing },
  }))
  if (pecas.length) { const { error } = await db.from('agentes_pecas').insert(pecas); if (error) throw new Error(error.message) }
  await db.from('agentes_trabalhos').update({ status: 'pronto', resumo: `${pecas.length} ideia(s) anotada(s)`, custo_usd: 0, terminado_em: new Date().toISOString() }).eq('id', t.id)
}

// ===== escrever: peças planejadas (ideias) viram rascunhos. Regra 5: planejar e gerar são passos separados =====
type PecaBanco = { id: string; tipo: string; dia: string | null; titulo: string; conteudo: Record<string, unknown> }
type Briefing = { objetivo?: string; publico?: string; telas?: number; duracao?: string; orientacao?: string }

function pedidoEscrever(perfil: Record<string, unknown>, pecas: PecaBanco[], pedido: Record<string, unknown>, ctx: string, exemplos: Exemplo[]) {
  const ativas = redesAtivas(perfil)
  const redes = [...new Set([...(pecas.some((p) => p.conteudo.livre === true) ? ativas : []), ...pecas.filter((p) => p.conteudo.livre !== true).map((p) => redeDo(p.conteudo.rede))])]
  const campanhas = (Array.isArray(perfil.campanhas) ? perfil.campanhas : []) as Campanha[]
  const itens = pecas.map((p, i) => {
    const r = REDES[redeDo(p.conteudo.rede)], b = (p.conteudo.briefing ?? {}) as Briefing
    const camp = campanhas.find((c) => c.id === p.conteudo.campanha)
    const livre = p.conteudo.livre === true
    const partes = [
      p.dia ?? 'sem dia',
      livre ? `canal e formato: ESCOLHA o mais indicado para a mensagem entre ${listaCanais(ativas)} e informe em "rede" e "tipo"` : `${r.nome} · ${r.nomes[p.tipo] ?? p.tipo} (tipo "${p.tipo}")`,
      b.telas ? `exatamente ${b.telas} telas` : '', b.duracao ? `duração ${b.duracao}` : '',
      b.objetivo ? `objetivo: ${b.objetivo}` : '', b.publico ? `público: ${b.publico}` : '',
      camp ? `campanha: ${camp.nome}` : 'sem campanha (pode ser educativo ou de relacionamento, sem empurrar oferta)',
      p.titulo ? `título provisório: ${p.titulo}` : '', p.conteudo.objetivo ? `tema: ${p.conteudo.objetivo}` : '',
      b.orientacao ? `gravação: ${b.orientacao}` : '',
    ].filter(Boolean)
    return `${i + 1}) ${partes.join(' · ')}`
  })
  const usadas = [...new Set(pecas.map((p) => String(p.conteudo.campanha ?? '')).filter(Boolean))].map((id) => campanhas.find((c) => c.id === id)).filter(Boolean) as Campanha[]
  const sistema = [
    'Você é o Agente de Marketing de uma empresa brasileira. Escreve em português do Brasil, pronto para colar em cada canal.',
    'Você escreve os rascunhos de peças que a equipe já planejou; a equipe aprova antes de publicar. Seja concreto.',
    `COMO ESCREVER EM CADA CANAL:\n${redes.map((r) => `- ${REDES[r].nome}: ${REDES[r].guia}`).join('\n')}`,
    'Vídeos: roteiro cena a cena (ou bloco a bloco no vídeo longo) com a fala e o que aparece na tela, respeitando a duração; dicas de gravação no campo observacao.',
    ...blocoEmpresa(perfil as Record<string, string>, exemplos),
  ].filter(Boolean).join('\n')
  const usuario = [
    `Escreva estas ${pecas.length} peças, uma para cada item da lista. Em cada peça preencha "ref" com o número do item e mantenha o "tipo" e o "dia" do item:\n${itens.join('\n')}`,
    pedido.tema ? `Tema central pedido pela equipe: ${pedido.tema}` : '',
    pedido.adaptar !== false && redes.length > 1 ? 'Todas partem da mesma ideia central, mas adapte a abertura, a profundidade e a chamada ao jeito de cada canal. Não repita o mesmo texto entre canais.' : '',
    usadas.length ? `Campanhas:\n${usadas.map((c) => `- ${c.nome}${c.inicio ? ` (de ${c.inicio}${c.fim ? ` a ${c.fim}` : ''})` : ''}: ${c.descricao ?? ''}`).join('\n')}` : '',
    ctx ? `Informações atuais do sistema:\n${ctx}` : '',
    'Entregue OBRIGATORIAMENTE chamando a ferramenta entregar_semana, com todas as peças de uma vez. Não escreva nada fora da ferramenta.',
  ].filter(Boolean).join('\n\n')
  return { sistema, usuario }
}

async function escrever(db: SupabaseClient, t: Trabalho, perfil: Record<string, unknown>, chave: string, modelo: string, economico: boolean) {
  let ids = (Array.isArray(t.pedido.peca_ids) ? t.pedido.peca_ids : []) as string[]
  const novas = (Array.isArray(t.pedido.novas) ? t.pedido.novas : []) as { tipo: string; rede?: string; dia?: string; titulo: string; tema?: string; campanha?: string; plano?: string; briefing?: Briefing }[]
  if (novas.length) {
    const linhas = novas.filter((x) => TIPOS.includes(x.tipo) || x.tipo === 'auto').slice(0, 40).map((x, i) => ({
      trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: x.tipo === 'auto' ? 'post' : x.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(x.dia ?? '') ? x.dia : null, titulo: (x.titulo || 'Peça').trim(), ordem: i,
      conteudo: { etapa: 'producao', livre: x.tipo === 'auto' || undefined, rede: redeDo(x.rede), objetivo: x.tema?.trim() || undefined, campanha: x.campanha || undefined, plano: x.plano || undefined, briefing: x.briefing },
    }))
    const { data, error } = await db.from('agentes_pecas').insert(linhas).select('id')
    if (error) throw new Error(error.message)
    ids = (data ?? []).map((d) => d.id)
  }
  // a tela mostra estas peças como "o agente está escrevendo"
  await db.from('agentes_trabalhos').update({ pedido: { ...t.pedido, peca_ids: ids } }).eq('id', t.id)
  const { data: lidas } = await db.from('agentes_pecas').select('id,tipo,dia,titulo,conteudo').in('id', ids).eq('empresa_id', t.empresa_id)
  const pecas = (lidas ?? []) as PecaBanco[]
  if (!pecas.length) throw new Error('Nenhuma peça para escrever.')
  const voltarParaIdeia = () => Promise.all(pecas.map((p) => db.from('agentes_pecas').update({ conteudo: { ...p.conteudo, etapa: 'ideia' } }).eq('id', p.id)))
  await Promise.all(pecas.map((p) => db.from('agentes_pecas').update({ conteudo: { ...p.conteudo, etapa: 'producao' } }).eq('id', p.id)))
  try {
    const ctx = await contexto(db)
    const { data: exemplos } = await db.from('agentes_pecas').select('tipo,titulo,conteudo').eq('empresa_id', t.empresa_id).eq('agente_id', t.agente_id).in('status', ['aprovada', 'postada']).order('atualizado_em', { ascending: false }).limit(3)
    // stories no modelo econômico; o resto no modelo escolhido. Os dois pedidos correm ao mesmo tempo
    const grupos = [pecas.filter((p) => p.tipo !== 'stories'), pecas.filter((p) => p.tipo === 'stories')].filter((g) => g.length)
    const anexos = (Array.isArray(t.pedido.anexos) ? t.pedido.anexos : []) as Anexo[]
    const respostas = await Promise.all(grupos.map(async (g) => {
      const m = g[0].tipo === 'stories' && economico ? 'claude-haiku-5-5' : modelo
      const { sistema, usuario } = pedidoEscrever(perfil, g, t.pedido, ctx, (exemplos ?? []) as Exemplo[])
      return { grupo: g, modelo: m, ...(await chamarClaude(chave, m, sistema, comAnexos(usuario, anexos))) }
    }))
    let escritas = 0
    for (const r of respostas) {
      const entregues = r.entrega.pecas ?? []
      await Promise.all(r.grupo.map(async (p, i) => {
        const e = entregues.find((x) => Number(x.ref) === i + 1) ?? (entregues.every((x) => !x.ref) ? entregues[i] : undefined)
        if (!e) return db.from('agentes_pecas').update({ conteudo: { ...p.conteudo, etapa: 'ideia' } }).eq('id', p.id)
        escritas++
        const livre = p.conteudo.livre === true
        const tipo = livre && TIPOS.includes(String(e.tipo)) ? String(e.tipo) : p.tipo
        const rede = livre && e.rede && REDES[e.rede] ? e.rede : redeDo(p.conteudo.rede)
        return db.from('agentes_pecas').update({
          titulo: e.titulo || p.titulo, tipo, status: 'rascunho', atualizado_em: new Date().toISOString(),
          conteudo: conteudoDe(e, { rede, campanha: p.conteudo.campanha, plano: p.conteudo.plano, briefing: p.conteudo.briefing }),
        }).eq('id', p.id)
      }))
    }
    const entrada = respostas.reduce((s, r) => s + r.entrada, 0), saida = respostas.reduce((s, r) => s + r.saida, 0)
    await db.from('agentes_trabalhos').update({
      pedido: { ...t.pedido, peca_ids: ids, anexos: anexos.map((a) => ({ nome: a.nome, tipo: a.tipo })) },
      status: 'pronto', resumo: respostas.map((r) => r.entrega.resumo).filter(Boolean)[0] ?? `${escritas} rascunho(s) escritos`,
      modelo: [...new Set(respostas.map((r) => r.modelo))].join(' + '), tokens_entrada: entrada, tokens_saida: saida,
      custo_usd: Math.round(respostas.reduce((s, r) => s + custo(r.modelo, r.entrada, r.saida), 0) * 10000) / 10000, terminado_em: new Date().toISOString(),
    }).eq('id', t.id)
  } catch (e) {
    await voltarParaIdeia()
    throw e
  }
}

// ===== propor plano: o agente propõe temas, formatos e datas (sem escrever). A equipe revisa antes de produzir =====
type ItemPlano = { dia: string; rede: string; tipo: string; titulo: string; angulo?: string; horario?: string }
const FERRAMENTA_PLANO = {
  name: 'propor_calendario',
  description: 'Propõe o calendário de conteúdo (temas, canais, formatos e datas) para a equipe revisar antes de escrever.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Duas frases: a linha do plano e por quê.' },
      itens: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            dia: { type: 'string', description: 'AAAA-MM-DD, somente entre as datas disponíveis' },
            rede: { type: 'string', enum: NOMES_REDES },
            tipo: { type: 'string', enum: TIPOS, description: 'reels = vídeo curto vertical (Reels, TikTok, Shorts); video = vídeo longo do YouTube' },
            titulo: { type: 'string', description: 'Título curto da peça' },
            angulo: { type: 'string', description: 'Em uma frase: a abordagem da peça (o que ela diz e para quê)' },
            horario: { type: 'string', description: 'Horário sugerido, HH:MM' },
          },
          required: ['dia', 'rede', 'tipo', 'titulo', 'angulo'],
        },
      },
    },
    required: ['resumo', 'itens'],
  },
}
type CanalPlano = { rede: string; formatos: string[]; quantidade: number }

// texto de uma página de referência (link enviado pela equipe), sem HTML, curto
async function lerPagina(link: string) {
  try {
    const r = await fetch(link, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0 (agente de marketing)' } })
    const html = await r.text()
    return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000)
  } catch { return '' }
}

async function proporPlano(db: SupabaseClient, t: Trabalho, perfil: Record<string, unknown>, chave: string, modelo: string) {
  const pd = t.pedido
  const plano = (pd.plano ?? {}) as { id?: string; nome?: string }
  const datas = (Array.isArray(pd.datas) ? pd.datas : []) as string[]
  const canais = ((Array.isArray(pd.canais) ? pd.canais : []) as CanalPlano[]).filter((c) => REDES[c.rede] && c.formatos?.length)
  const total = Number(pd.total ?? 0)
  const anteriores = (Array.isArray(pd.anteriores) ? pd.anteriores : []) as ItemPlano[]
  const referencia = typeof pd.link === 'string' && /^https?:\/\//.test(pd.link) ? await lerPagina(pd.link) : ''
  if (!plano.id || !datas.length || !canais.length) throw new Error('Faltam datas ou canais no planejamento.')
  const campanha = (pd.campanha ?? null) as Campanha | null
  const unidade = pd.unidade === 'dia' ? 'dia' : 'semana'
  const sistema = [
    'Você é o Agente de Marketing de uma empresa brasileira. Agora você monta só a PROPOSTA de calendário editorial: temas, canais, formatos e datas. Não escreva roteiros nem legendas ainda; a equipe vai revisar a proposta antes.',
    `COMO É CADA CANAL:\n${canais.map((c) => `- ${REDES[c.rede].nome}: ${REDES[c.rede].guia}`).join('\n')}`,
    ...blocoEmpresa(perfil as Record<string, string>, []),
  ].filter(Boolean).join('\n')
  const usuario = [
    `Datas disponíveis (use só estas): ${datas.join(', ')}.`,
    total ? `Monte exatamente ${total} peça(s) no total, distribuídas entre os canais abaixo.` : '',
    `Canais e formatos permitidos:\n${canais.map((c) => `- ${REDES[c.rede].nome} (rede "${c.rede}")${total ? '' : `: até ${c.quantidade} peça(s) por ${unidade}`}; formatos: ${c.formatos.map((f) => `${REDES[c.rede].nomes[f] ?? f} (tipo "${f}")`).join(', ')}`).join('\n')}`,
    referencia ? `Página de referência enviada pela equipe (use o conteúdo como base, sem copiar):\n${referencia}` : '',
    anteriores.length ? `Esta é a proposta atual:\n${anteriores.map((i) => `- ${i.dia} · ${i.rede} · ${i.tipo} · ${i.titulo}${i.angulo ? ` — ${i.angulo}` : ''}`).join('\n')}\n\nAJUSTE PEDIDO PELA EQUIPE: ${pd.ajuste ?? ''}\nRefaça a proposta inteira já com o ajuste, mantendo o que não foi pedido para mudar.` : '',
    pd.objetivo ? `Objetivo: ${pd.objetivo}` : '', pd.publico ? `Público: ${pd.publico}` : '',
    pd.tema ? `Tema ou orientação da equipe: ${pd.tema}` : 'Tema livre: equilibre atrair, educar, relacionar e vender.',
    campanha ? `Campanha: ${campanha.nome}${campanha.inicio ? ` (de ${campanha.inicio}${campanha.fim ? ` a ${campanha.fim}` : ''})` : ''}. ${campanha.descricao ?? ''}` : 'Sem campanha: o plano pode ser educativo e de relacionamento, sem empurrar oferta.',
    'Distribua bem pelas datas, varie formatos e assuntos e crie uma sequência que faça sentido (um conteúdo prepara o outro). Uma mesma ideia pode aparecer em canais diferentes no mesmo dia, adaptada.',
    'Entregue OBRIGATORIAMENTE chamando a ferramenta propor_calendario. Não escreva nada fora da ferramenta.',
  ].filter(Boolean).join('\n\n')
  const ctx = await contexto(db)
  const { entrega, entrada, saida } = await chamarClaude(chave, modelo, sistema, `${usuario}\n\nInformações atuais do sistema:\n${ctx}`, FERRAMENTA_PLANO)
  const permitidos = new Map(canais.map((c) => [c.rede, c.formatos]))
  const itens = (entrega.itens ?? []).filter((i) => datas.includes(i.dia) && permitidos.get(i.rede)?.includes(i.tipo)).slice(0, total || 60)
  if (!itens.length) throw new Error('O agente não conseguiu montar a proposta. Tente de novo.')
  const briefing = { objetivo: pd.objetivo || undefined, publico: pd.publico || undefined, orientacao: pd.orientacao || undefined }
  const { data, error } = await db.from('agentes_pecas').insert(itens.map((i, n) => ({
    trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: i.tipo, dia: i.dia, titulo: (i.titulo || 'Peça').trim(), ordem: n,
    conteudo: { etapa: 'ideia', proposta: true, rede: i.rede, objetivo: i.angulo, horario: i.horario, plano: plano.id, campanha: campanha?.id, briefing },
  }))).select('id')
  if (error) throw new Error(error.message)
  const substituir = (Array.isArray(pd.substituir) ? pd.substituir : []) as string[]
  if (substituir.length) await db.from('agentes_pecas').update({ status: 'descartada' }).in('id', substituir).eq('empresa_id', t.empresa_id)
  await db.from('agentes_trabalhos').update({
    pedido: { ...pd, peca_ids: (data ?? []).map((d) => d.id) }, status: 'pronto', resumo: entrega.resumo ?? `${itens.length} peças propostas`,
    modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

// ===== conversa da Nova peça com IA: resposta na hora (não vira trabalho na fila), com a proposta da peça atualizada =====
const FERRAMENTA_CONVERSA = {
  name: 'responder',
  description: 'Responde à equipe na conversa e atualiza a proposta da peça.',
  input_schema: {
    type: 'object',
    properties: {
      resposta: { type: 'string', description: 'Sua fala na conversa: curta (até 3 frases), útil, em português do Brasil. Pode fazer UMA pergunta por vez.' },
      opcoes: { type: 'array', items: { type: 'string' }, description: 'Até 3 respostas rápidas que a equipe pode clicar (ex.: "Vídeo", "Carrossel", "Sugira o formato")' },
      proposta: {
        type: 'object',
        properties: {
          rede: { type: 'string', enum: NOMES_REDES },
          tipo: { type: 'string', enum: TIPOS },
          titulo: { type: 'string', description: 'Título sugerido para a peça' },
          abordagem: { type: 'string', description: 'Em 1 ou 2 frases: o que a peça diz, o gancho e a chamada' },
          objetivo: { type: 'string' }, publico: { type: 'string' },
          duracao: { type: 'string', description: 'Só para vídeo: duração sugerida' },
        },
      },
    },
    required: ['resposta', 'proposta'],
  },
}
type Mensagem = { de: 'equipe' | 'agente'; texto: string }

async function conversar(db: SupabaseClient, empresa: string, corpo: { mensagens?: Mensagem[]; proposta?: Record<string, unknown> }) {
  const { chave, pa, modelo } = await prepararAgente(db, empresa, 'marketing')
  const mensagens = (corpo.mensagens ?? []).filter((m) => m.texto?.trim()).slice(-16)
  if (!mensagens.length || mensagens[mensagens.length - 1].de !== 'equipe') throw new Error('Escreva sua mensagem.')
  const sistema = [
    'Você é o Agente de Marketing de uma empresa brasileira e está conversando com a equipe para definir UMA peça de conteúdo antes de escrevê-la.',
    `Ajude a definir a abordagem, o canal e o formato. Canais que a empresa usa (só estes): ${listaCanais(redesAtivas(pa))}. Respeite o que a equipe já escolheu.`,
    'Seja breve e prático. Quando faltar informação importante, pergunte uma coisa de cada vez e ofereça opções rápidas. Sempre devolva a proposta atualizada.',
    `Proposta atual (pode estar vazia): ${JSON.stringify(corpo.proposta ?? {})}`,
    ...blocoEmpresa(pa as Record<string, string>, []),
  ].filter(Boolean).join('\n')
  const historico = mensagens.map((m) => `${m.de === 'equipe' ? 'EQUIPE' : 'AGENTE'}: ${m.texto}`).join('\n')
  const usuario = `Conversa até agora:\n${historico}\n\nResponda à última mensagem da equipe chamando OBRIGATORIAMENTE a ferramenta responder.`
  const { entrega, entrada, saida } = await chamarClaude(chave, modelo, sistema, usuario, FERRAMENTA_CONVERSA)
  const e = entrega as unknown as { resposta?: string; opcoes?: string[]; proposta?: Record<string, unknown> }
  // registra o custo como um trabalho já pronto (aparece no Histórico e conta no limite do mês)
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'marketing', tipo: 'conversa', status: 'pronto', pedido: { ultima: mensagens[mensagens.length - 1].texto.slice(0, 300) }, resumo: (e.resposta ?? '').slice(0, 200), modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString() })
  return { resposta: e.resposta ?? '', opcoes: (e.opcoes ?? []).slice(0, 3), proposta: e.proposta ?? {} }
}

// chave, agente ligado, limites do mês (empresa e agente) e o modelo a usar
async function prepararAgente(db: SupabaseClient, empresa: string, agente: string) {
  const [{ data: cfg }, { data: perfilAg }, { data: chave }, { data: gastos }] = await Promise.all([
    db.from('agentes_config').select('modelo,limite_mes_usd').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', empresa).eq('agente_id', agente).maybeSingle(),
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_trabalhos').select('custo_usd,agente_id').eq('empresa_id', empresa).gte('criado_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  if (!perfilAg?.ativo) throw new Error('Este agente está desligado. Ligue em Configurar agente.')
  const gastoMes = (gastos ?? []).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
  if (cfg?.limite_mes_usd != null && gastoMes >= Number(cfg.limite_mes_usd)) throw new Error(`Limite do mês da empresa atingido (US$ ${Number(cfg.limite_mes_usd).toFixed(2)}). Aumente em Configurações.`)
  // configuração própria do agente (modelo, limite e instruções), guardada no perfil dele
  const pa = (perfilAg.perfil ?? {}) as Record<string, unknown>
  const gastoAgente = (gastos ?? []).filter((g) => g.agente_id === agente).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
  if (pa.limite_mes_usd != null && pa.limite_mes_usd !== '' && gastoAgente >= Number(pa.limite_mes_usd)) throw new Error(`Limite do mês deste agente atingido (US$ ${Number(pa.limite_mes_usd).toFixed(2)}). Aumente em Configurar agente.`)
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? cfg?.modelo ?? 'claude-sonnet-5-5'
  return { chave: String(chave), pa, perfilAg, modelo }
}

async function executar(db: SupabaseClient, t: Trabalho) {
  try {
    if (t.tipo === 'ideia') return await guardarIdeias(db, t)
    const { chave, pa, perfilAg, modelo } = await prepararAgente(db, t.empresa_id, t.agente_id)
    if (t.agente_id !== 'marketing' || !['semana', 'ajuste', 'ideia', 'escrever', 'propor_plano'].includes(t.tipo)) throw new Error('Trabalho que este agente ainda não sabe fazer.')
    if (t.tipo === 'ajuste') return await ajustar(db, t, (perfilAg.perfil ?? {}) as Record<string, string>, String(chave), modelo)
    if (t.tipo === 'escrever') return await escrever(db, t, pa, String(chave), modelo, pa.stories_economico !== false)
    if (t.tipo === 'propor_plano') return await proporPlano(db, t, pa, String(chave), modelo)

    // posts/reels e stories em dois pedidos ao mesmo tempo: sai na metade do tempo
    const perfil = (perfilAg.perfil ?? {}) as Record<string, string>
    const ctx = await contexto(db)
    const { data: exemplos } = await db.from('agentes_pecas').select('tipo,titulo,conteudo').eq('empresa_id', t.empresa_id).eq('agente_id', t.agente_id).in('status', ['aprovada', 'postada']).order('atualizado_em', { ascending: false }).limit(3)
    const plano = (Array.isArray(t.pedido.plano) ? t.pedido.plano : []) as DiaPlano[]
    const soma = (ds: DiaPlano[], k: keyof DiaPlano) => ds.reduce((s, d) => s + Number(d[k] ?? 0), 0)
    const pedidos = (plano.length
      ? [
        { ...t.pedido, plano: plano.map((d) => ({ ...d, stories: 0 })), posts: soma(plano, 'post') + soma(plano, 'carrossel') + soma(plano, 'video'), reels: soma(plano, 'reels'), stories: 0 },
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
      conteudo: conteudoDe(p, { rede: redeDo(t.pedido.rede), campanha: campanhaId }),
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

  const corpo = await req.json().catch(() => ({}))
  if (corpo.conversa) {
    try { return json(await conversar(db, String(corpo.empresa ?? ''), corpo.conversa)) } catch (e) { return json({ erro: (e as Error).message }) }
  }
  const { trabalho } = corpo
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
