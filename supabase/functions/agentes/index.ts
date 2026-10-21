// Agentes de IA (núcleo). Recebe o id de um trabalho "na fila", responde na hora e faz o trabalho em segundo plano:
// chama o Claude com o perfil da empresa e o contexto do sistema, grava as peças para aprovação e o custo.
// Hoje: agente de Marketing → conteúdo para redes sociais, e-mail, WhatsApp e site (imagem, carrossel, vídeos, stories, live,
// texto/enquete, artigo, e-mail, mensagem, PDF): reunião de pauta (reuniao.ts), planos, ideias, textos, ajustes e artes.
// Nada é publicado: só vira rascunho para aprovar.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { blocoAta, reunir, type Dependencias } from './reuniao.ts'
import { analisarReferencia, blocoModelos } from './referencias.ts'
import { blocoProdutos, testarVoz, textoCampanha } from './marca.ts'

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
const TIPOS = ['post', 'carrossel', 'reels', 'stories', 'video', 'live', 'texto', 'artigo', 'email', 'mensagem', 'pdf']
// como preencher os campos em cada formato (as telas mostram os mesmos campos com estes nomes)
const GUIA_FORMATO: Record<string, string> = {
  post: 'Imagem: roteiro = linhas do texto que vai na arte; legenda pronta; prompt_imagem descreve a arte.',
  carrossel: 'Carrossel: roteiro = uma lâmina por item (primeira linha = título da lâmina, até 100 caracteres; depois uma quebra de linha e o texto de apoio, até 300); a primeira lâmina é a capa; legenda pronta; prompt_imagem descreve o visual das lâminas.',
  reels: 'Vídeo curto vertical: roteiro = cenas em ordem (primeira linha = tempo ou nome da cena, ex.: "0–3 s · Gancho"; depois uma quebra de linha com a fala e o que aparece na tela); legenda pronta; texto_arte = texto da capa.',
  stories: 'Stories: roteiro = cada tela em ordem (primeira linha = texto em destaque; depois uma quebra de linha com o texto de apoio e a interação — enquete, caixinha, link — quando fizer sentido).',
  video: 'Vídeo longo: titulo = título buscável; roteiro = blocos em ordem (primeira linha = tempo aproximado e tema do bloco; depois uma quebra de linha com o conteúdo); legenda = descrição com capítulos; texto_arte = texto da thumbnail.',
  live: 'Live: titulo = tema da live; roteiro = pauta em blocos (primeira linha = tempo e nome do bloco; depois uma quebra de linha com o que falar), incluindo 3 a 5 perguntas para puxar o público e o momento da chamada; legenda = texto de divulgação da live (data e horário se houver); observacao = orientações da transmissão.',
  texto: 'Texto / enquete: legenda = texto da publicação (termina com uma pergunta); roteiro = opções da enquete (2 a 4), ou vazio se não for enquete.',
  artigo: 'Artigo: titulo = título do artigo; roteiro = estrutura (primeira linha = intertítulo; depois uma quebra de linha com o resumo da seção); legenda = artigo completo, com intertítulos e parágrafos curtos; prompt_imagem = capa. Sem hashtags.',
  email: 'E-mail: titulo = assunto (até 50 caracteres); texto_arte = prévia (até 90 caracteres); legenda = corpo do e-mail, curto e escaneável; cta = texto do botão; roteiro = 2 ou 3 outros assuntos para testar. Sem hashtags.',
  mensagem: 'Mensagem de WhatsApp: legenda = a mensagem, curta, pessoal, com no máximo 1 link e sem cara de spam; roteiro = 2 ou 3 variações da mesma mensagem; cta = a ação esperada. Sem hashtags.',
  pdf: 'Material PDF: titulo = título do material; roteiro = uma página por item (primeira linha = título da página; depois uma quebra de linha com o conteúdo); a primeira é a capa; legenda = texto de apresentação para enviar junto; observacao = orientação de diagramação (tamanho, hierarquia, cores da marca); prompt_imagem = capa. Sem hashtags.',
}
// peça marcada como anúncio (pacote de criativos da campanha): mesmos campos, outro jeito de escrever
const GUIA_ANUNCIO = 'ANÚNCIO PAGO (Meta Ads: feed, stories e reels), quando o item diz "ANÚNCIO PAGO": quem vê não segue o perfil e decide em 2 segundos. titulo = título do anúncio (até 40 caracteres); legenda = texto principal do anúncio (3 a 6 linhas curtas: dor ou desejo, oferta, prova, chamada; a primeira linha precisa funcionar sozinha, porque o resto fica escondido em "Ver mais"); cta = o botão do anúncio (Saiba mais, Comprar agora, Inscreva-se ou Enviar mensagem); texto_arte = frase grande na tela (até 6 palavras). Vídeo de anúncio (reels): o PRIMEIRO item do roteiro se chama "Ganchos para testar" e traz 3 a 5 aberturas diferentes, numeradas, uma por linha (a equipe grava o corpo uma vez e troca só os 3 primeiros segundos); os itens seguintes são as cenas do corpo (até 30 s no total), com a fala e o texto na tela. Imagem de anúncio (post): roteiro = 3 a 5 variações da frase da arte para testar. observacao = formatos para exportar (9:16 para stories e reels; 4:5 para o feed), público sugerido e cuidados com as regras do conselho e da Meta (sem promessa de resultado, sem antes e depois). Sem hashtags.'
const guiaFormatos = (tipos: string[]) => [...new Set(tipos)].map((t) => GUIA_FORMATO[t]).filter(Boolean).map((g) => `- ${g}`).join('\n')
// como escrever em cada rede e o nome de cada formato nela ("reels" = vídeo curto vertical; "video" = vídeo longo)
const REDES: Record<string, { nome: string; guia: string; nomes: Record<string, string> }> = {
  instagram: { nome: 'Instagram', nomes: { post: 'post de imagem', carrossel: 'carrossel', reels: 'reels', stories: 'stories', live: 'live do Instagram' },
    guia: 'Ganchos fortes nos 3 primeiros segundos dos reels, legendas com quebra de linha, chamadas para ação claras, até 8 hashtags.' },
  tiktok: { nome: 'TikTok', nomes: { reels: 'vídeo do TikTok (vertical, 15 a 60 s)', carrossel: 'carrossel de fotos do TikTok', stories: 'stories do TikTok (some em 24 h)', live: 'live do TikTok' },
    guia: 'Linguagem nativa do TikTok: gancho no 1º segundo, ritmo rápido, fala direta para a câmera, texto na tela curto, legenda curta com 3 a 5 hashtags, nada com cara de anúncio.' },
  youtube: { nome: 'YouTube', nomes: { reels: 'YouTube Shorts (vertical, até 60 s)', video: 'vídeo longo do YouTube (horizontal, 6 a 15 min)', post: 'post de imagem na comunidade do YouTube', texto: 'post de texto ou enquete na comunidade do YouTube', live: 'live do YouTube' },
    guia: 'Shorts: gancho no 1º segundo e fechamento que leve ao canal. Vídeo longo: título que as pessoas buscam (até 60 caracteres) no campo titulo, roteiro em blocos com tempo aproximado (abertura, conteúdo, chamada), descrição com capítulos na legenda, e o prompt_imagem descreve a capa (thumbnail) com rosto expressivo e até 4 palavras. Post da comunidade: texto curto que puxa conversa com quem já segue o canal (pergunta, enquete ou bastidor), chamando para o vídeo mais recente.' },
  facebook: { nome: 'Facebook', nomes: { post: 'post de imagem', carrossel: 'post com várias fotos (carrossel)', reels: 'reels do Facebook', stories: 'stories', texto: 'post de texto ou enquete', live: 'live do Facebook' },
    guia: 'Público um pouco mais velho: texto pode ser um pouco mais longo e explicativo, tom acolhedor, poucas hashtags (até 3).' },
  linkedin: { nome: 'LinkedIn', nomes: { post: 'post de imagem', carrossel: 'carrossel em PDF', reels: 'vídeo', texto: 'post de texto ou enquete', artigo: 'artigo ou newsletter do LinkedIn', live: 'live do LinkedIn' },
    guia: 'Tom profissional e de autoridade: bastidores da escola, mercado de HOF, carreira e gestão de consultório. Sem gírias, emojis com moderação, até 3 hashtags.' },
  pinterest: { nome: 'Pinterest', nomes: { post: 'Pin (imagem vertical 2:3)', carrossel: 'Pin carrossel', reels: 'Pin em vídeo (vertical)' },
    guia: 'Pinterest é busca: título com as palavras que as pessoas procuram (até 100 caracteres), descrição curta e útil com palavras-chave e chamada para o link, sem hashtags em excesso. Arte vertical 2:3 com texto grande.' },
  threads: { nome: 'Threads', nomes: { texto: 'post de texto ou enquete do Threads', post: 'post do Threads com imagem', carrossel: 'post do Threads com fotos' },
    guia: 'Conversa, não anúncio: texto curto (até 500 caracteres), tom pessoal e de opinião, termina com uma pergunta para puxar resposta. No máximo 1 marcador de tópico.' },
  email: { nome: 'E-mail', nomes: { email: 'e-mail para a lista', pdf: 'material PDF enviado por e-mail' },
    guia: 'E-mail para quem já conhece a marca: assunto curioso e honesto (sem caixa alta nem promessa exagerada), um assunto por e-mail, parágrafos curtos, uma chamada só.' },
  whatsapp: { nome: 'WhatsApp', nomes: { mensagem: 'mensagem de WhatsApp', pdf: 'material PDF enviado no WhatsApp' },
    guia: 'Mensagem de pessoa para pessoa: curta, sem lista de emojis, sem cara de disparo em massa, chama pelo nome quando fizer sentido ({nome}), uma pergunta ou ação no final.' },
  site: { nome: 'Site', nomes: { artigo: 'artigo do blog', pdf: 'material PDF para baixar no site' },
    guia: 'Conteúdo de site é encontrado pela busca: título com as palavras que as pessoas procuram, intertítulos claros, respostas diretas, chamada para a próxima etapa no fim.' },
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
type Campanha = { id: string; nome: string; descricao?: string; inicio?: string; fim?: string; hora_fim?: string; objetivo?: string; oferta?: string; comunicacao?: string; link?: string }
// versões da peça: cada escrita do agente vira uma versão (a tela mostra o histórico, compara e restaura)
type Versao = { n: number; em: string | null; por: string; origem: string; nota: string; aprovada?: boolean; dados: Record<string, unknown> }
const CAMPOS_VERSAO = ['objetivo', 'legenda', 'roteiro', 'orientacoes', 'cta', 'hashtags', 'texto_arte', 'prompt_imagem', 'observacao', 'visual', 'artes']
function fotoVersao(titulo: string, tipo: string, c: Record<string, unknown>) {
  const d: Record<string, unknown> = { titulo, tipo }
  for (const k of CAMPOS_VERSAO) { const v = c[k]; if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) d[k] = v }
  return d
}
function comVersao(antes: { titulo: string; tipo: string; conteudo: Record<string, unknown> } | null, depois: { titulo: string; tipo: string; conteudo: Record<string, unknown> }, origem: string, nota: string) {
  const c = antes?.conteudo ?? {}
  const lista = (Array.isArray(c.versoes) ? c.versoes : []) as Versao[]
  // peça de antes do histórico: o que ela tinha vira a v1
  if (!lista.length && antes && c.etapa !== 'ideia' && (c.legenda || (Array.isArray(c.roteiro) && c.roteiro.length))) lista.push({ n: 1, em: null, por: 'Agente de Marketing', origem: 'ia', nota: 'Versão anterior', dados: fotoVersao(antes.titulo, antes.tipo, c) })
  const n = (lista.at(-1)?.n ?? 0) + 1
  return [...lista, { n, em: new Date().toISOString(), por: 'Agente de Marketing', origem, nota, dados: fotoVersao(depois.titulo, depois.tipo, depois.conteudo) }].slice(-20)
}
const primeiraVersao = (titulo: string, tipo: string, conteudo: Record<string, unknown>) => ({ ...conteudo, versoes: comVersao(null, { titulo, tipo, conteudo }, 'ia', 'Primeira proposta') })

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
            tipo: { type: 'string', enum: TIPOS, description: 'post = imagem; reels = vídeo curto vertical (Reels, TikTok, Shorts); video = vídeo longo; live; texto = publicação de texto ou enquete; artigo; email; mensagem = WhatsApp; pdf = material PDF' },
            dia: { type: 'string', description: 'Data AAAA-MM-DD dentro da semana pedida' },
            titulo: { type: 'string', description: 'Nome curto da peça para a equipe reconhecer' },
            objetivo: { type: 'string', description: 'Para que serve: atrair, educar, gerar desejo, vender, prova social…' },
            legenda: { type: 'string', description: 'Legenda pronta para colar (com quebras de linha). Stories podem não ter.' },
            roteiro: { type: 'array', items: { type: 'string' }, description: 'Itens em ordem: cenas (vídeo curto), blocos (vídeo longo, live), lâminas (carrossel), telas (stories), páginas (PDF). Em cada item: primeira linha = título curto do item; depois uma quebra de linha e o texto.' },
            texto_arte: { type: 'string', description: 'Texto curto que vai escrito na arte/capa' },
            cta: { type: 'string', description: 'Chamada para ação' },
            hashtags: { type: 'array', items: { type: 'string' } },
            observacao: { type: 'string', description: 'Dica de gravação, imagem ou cuidado com as regras do conselho' },
            prompt_imagem: { type: 'string', description: 'Para post e carrossel (e a capa do vídeo longo): pedido pronto para colar no ChatGPT e gerar a arte (cena, enquadramento, luz, cores da marca preto e dourado, texto que vai na arte). Antes e depois só com as fotos reais que a equipe enviar (paciente autorizou); nunca inventar nem gerar com IA o rosto ou o resultado de um paciente.' },
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
  // gostos de arte ("Arte: …") ficam só para o Agente de Arte
  const memoria = ((Array.isArray((perfil as Record<string, unknown>).memoria) ? (perfil as Record<string, unknown>).memoria : []) as { texto: string }[]).filter((m) => !m.texto.startsWith('Arte:'))
  return [
    'Respeite sempre as regras abaixo, em especial o que é proibido. Não invente números, depoimentos, preços ou datas que não estejam no contexto.',
    '',
    `EMPRESA: ${perfil.empresa ?? ''}`,
    `O QUE VENDE: ${perfil.o_que_vende ?? ''}`,
    `PÚBLICO: ${perfil.publico ?? ''}`,
    perfil.diferenciais ? `DIFERENCIAIS: ${perfil.diferenciais}` : '',
    `TOM DE VOZ: ${perfil.tom ?? ''}`,
    `NUNCA FAZER: ${perfil.evitar ?? ''}`,
    `REGRAS DO CONSELHO: ${perfil.conselho ?? ''}`,
    perfisRedes(perfil as Record<string, unknown>),
    perfil.voz ? `\nCOMO A MARCA FALA (perfil de voz aprovado pela equipe; escreva assim): ${perfil.voz}` : '',
    perfil.instrucoes ? `\nINSTRUÇÕES DA EQUIPE PARA ESTE AGENTE (siga sempre): ${perfil.instrucoes}` : '',
    blocoProdutos(perfil as Record<string, unknown>),
    perfil.materiais ? `\nCONDIÇÕES GERAIS E PERGUNTAS FREQUENTES DA EMPRESA (fonte da verdade: preços, condições, bônus e datas só podem vir daqui, dos produtos ou da campanha):\n${perfil.materiais}` : '',
    memoria.length ? `\nO QUE VOCÊ JÁ APRENDEU COM ESTA EQUIPE (gostos e recusas; siga sempre):\n${memoria.map((m) => `- ${m.texto}`).join('\n')}` : '',
    exemplos.length ? `\nPEÇAS QUE A EQUIPE APROVOU (use como referência de estilo, sem repetir o conteúdo):\n${exemplos.map((e) => `[${e.tipo}] ${e.titulo}\n${(e.conteudo.legenda ?? (e.conteudo.roteiro ?? []).join(' / ')).slice(0, 700)}`).join('\n---\n')}` : '',
  ]
}
// Biblioteca da marca: trechos sobre o assunto do pedido (busca por texto). Vão no pedido com a fonte de cada um.
type TrechoMarca = { fonte_titulo: string; conteudo: string }
// materiais de uma campanha (página de vendas, roteiros, copy): o texto inteiro, porque é a fonte da verdade dela
async function materiaisCampanha(db: SupabaseClient, empresa: string, campanhas: string[]) {
  const ids = [...new Set(campanhas.filter(Boolean))]
  if (!ids.length) return { bloco: '', fontes: [] as string[] }
  const { data: lidas } = await db.from('marca_fontes').select('id,titulo,papel,caracteres').eq('empresa_id', empresa).in('campanha_id', ids)
    .eq('ativo', true).eq('aprovada', true).eq('status', 'pronta')
  if (!lidas?.length) return { bloco: '', fontes: [] as string[] }
  // regras e copy primeiro (curtas e decisivas), depois página, roteiros e apresentação; dentro de cada papel, o menor primeiro,
  // para os materiais longos (roteiro de YouTube) não tirarem espaço dos outros
  const fs = [...lidas].sort((a, b) => (PRIORIDADE_PAPEL[a.papel ?? 'outro'] ?? 9) - (PRIORIDADE_PAPEL[b.papel ?? 'outro'] ?? 9) || a.caracteres - b.caracteres)
  const { data: ts } = await db.from('marca_trechos').select('fonte_id,conteudo,ordem').in('fonte_id', fs.map((f) => f.id)).order('ordem').limit(3000)
  const partes: string[] = [], usadas: string[] = []
  let total = 0
  for (const f of fs) {
    const espaco = Math.min(LIMITE_POR_MATERIAL, LIMITE_TOTAL_MATERIAIS - total)
    if (espaco < 2000) break
    const inteiro = (ts ?? []).filter((t) => t.fonte_id === f.id).map((t) => t.conteudo).join("\n\n")
    const texto = inteiro.slice(0, espaco)
    if (!texto) continue
    const cortado = texto.length < inteiro.length ? '\n[…material continua; o restante não coube]' : ''
    partes.push(`[Material: ${f.titulo}${f.papel ? ` · ${NOME_PAPEL[f.papel] ?? f.papel}` : ''}]\n${texto}${cortado}`); usadas.push(f.titulo); total += texto.length
  }
  if (!partes.length) return { bloco: '', fontes: [] as string[] }
  return {
    bloco: `MATERIAIS DA CAMPANHA (já prontos e aprovados pela equipe; são a fonte da verdade desta campanha: use a mesma oferta, as mesmas promessas, palavras, argumentos e a estrutura dos roteiros e da copy; nunca contradiga; pode reaproveitar frases curtas e adaptar ao formato):\n${partes.join('\n---\n')}`,
    fontes: usadas,
  }
}
const PRIORIDADE_PAPEL: Record<string, number> = { copy: 0, pagina: 1, roteiro: 2, apresentacao: 3, outro: 4 }
// ~100 mil caracteres ≈ 25 mil tokens de entrada por pedido (cerca de US$ 0,05 no Sonnet)
const LIMITE_POR_MATERIAL = 25000, LIMITE_TOTAL_MATERIAIS = 100000
const NOME_PAPEL: Record<string, string> = { pagina: 'página de vendas', roteiro: 'roteiro de vídeo', copy: 'copy/texto de venda', apresentacao: 'apresentação', outro: 'material' }

async function conhecimento(db: SupabaseClient, empresa: string, consulta: string, limite = 6, campanhas: string[] = []) {
  const mat = await materiaisCampanha(db, empresa, campanhas)
  const geral = await conhecimentoGeral(db, empresa, consulta, limite)
  return { bloco: [mat.bloco, geral.bloco].filter(Boolean).join('\n\n'), fontes: [...mat.fontes, ...geral.fontes] }
}

async function conhecimentoGeral(db: SupabaseClient, empresa: string, consulta: string, limite = 6) {
  const q = consulta.replace(/\s+/g, ' ').trim().slice(0, 600)
  if (!q) return { bloco: '', fontes: [] as string[] }
  const { data } = await db.rpc('marca_buscar', { p_empresa: empresa, p_consulta: q, p_limite: limite })
  const usados: TrechoMarca[] = []
  let total = 0
  for (const t of (data ?? []) as TrechoMarca[]) { if (total + t.conteudo.length > 8000) break; usados.push(t); total += t.conteudo.length }
  if (!usados.length) return { bloco: '', fontes: [] as string[] }
  const bloco = `CONHECIMENTO DA MARCA (trechos da biblioteca da empresa sobre este assunto). Use para falar com precisão, com as ideias, os termos e o jeito de ensinar da marca; não copie frases longas e não afirme nada técnico que não esteja aqui ou no contexto:\n${usados.map((t) => `[Fonte: ${t.fonte_titulo}]\n${t.conteudo}`).join('\n---\n')}`
  return { bloco, fontes: [...new Set(usados.map((t) => t.fonte_titulo))] }
}
const comBloco = (bloco: string, texto: string) => (bloco ? `${bloco}\n\n${texto}` : texto)

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
    campanha ? `CAMPANHA destas peças: ${textoCampanha(campanha)}` : '',
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
// lista que a IA devolveu: array, objeto com índices ({"0": …}) ou nada
const comoLista = <T,>(v: unknown): T[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []) as T[]
// JSON escrito pela IA dentro de um texto: tenta como veio; depois troca quebras de linha cruas dentro das aspas
// (o erro mais comum em legendas e roteiros); por fim corta do primeiro [ ou { até o último ] ou }
function jsonTolerante(texto: string): unknown {
  const tentar = (s: string) => { try { return JSON.parse(s) } catch { return undefined } }
  const semControle = (s: string) => {
    let dentro = false, escapado = false, saida = ''
    for (const ch of s) {
      if (escapado) { saida += ch; escapado = false; continue }
      if (ch === '\\') { saida += ch; escapado = dentro; continue }
      if (ch === '"') dentro = !dentro
      saida += dentro && ch === '\n' ? '\\n' : dentro && ch === '\r' ? '' : dentro && ch === '\t' ? '\\t' : ch
    }
    return saida
  }
  // texto que a IA parou no meio (ex.: "[{...,"roteiro":[...]" sem fechar a peça e a lista): fecha o que ficou aberto
  const fechar = (s: string) => {
    const pilha: string[] = []
    let dentro = false, escapado = false
    for (const ch of s) {
      if (escapado) { escapado = false; continue }
      if (ch === '\\') { escapado = dentro; continue }
      if (ch === '"') { dentro = !dentro; continue }
      if (dentro) continue
      if (ch === '[' || ch === '{') pilha.push(ch === '[' ? ']' : '}')
      else if (ch === ']' || ch === '}') pilha.pop()
    }
    return (dentro ? s + '"' : s).replace(/[,:\s]+$/, '') + pilha.reverse().join('')
  }
  const ini = texto.search(/[[{]/), fim = Math.max(texto.lastIndexOf(']'), texto.lastIndexOf('}'))
  const recorte = ini >= 0 && fim > ini ? texto.slice(ini, fim + 1) : texto
  const limpo = semControle(texto)
  return tentar(texto) ?? tentar(limpo) ?? tentar(recorte) ?? tentar(semControle(recorte)) ?? tentar(fechar(limpo))
}
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
  // às vezes uma lista vem como texto JSON ("[{...}]") dentro da ferramenta: converte de volta
  if (entrega && typeof entrega === 'object') {
    for (const [k, v] of Object.entries(entrega as Record<string, unknown>)) {
      if (typeof v === 'string' && /^\s*[[{]/.test(v)) { const lido = jsonTolerante(v); if (lido !== undefined) (entrega as Record<string, unknown>)[k] = lido }
    }
  }
  return { entrega: entrega as { resumo: string; pecas: Peca[]; itens?: ItemPlano[] } & Peca, entrada: Number(uso.input_tokens ?? 0), saida: Number(uso.output_tokens ?? 0) }
}

// ajuste de uma peça já feita: a equipe pede ("mais 3 telas", "mais curta", "fala da turma de março") e o agente reescreve
async function ajustar(db: SupabaseClient, t: Trabalho, perfil: Record<string, string>, chave: string, modelo: string) {
  const { data: peca } = await db.from('agentes_pecas').select('*').eq('id', String(t.pedido.peca_id)).eq('empresa_id', t.empresa_id).maybeSingle()
  if (!peca) throw new Error('Peça não encontrada.')
  const { sistema } = pedidoMarketing(perfil, { semana_inicio: peca.dia ?? new Date().toISOString().slice(0, 10), rede: (peca.conteudo ?? {}).rede }, '')
  const tipoPedido = TIPOS.includes(String(t.pedido.tipo_novo ?? '')) ? String(t.pedido.tipo_novo) : peca.tipo
  const { anterior: _x, arte: _y, versoes: _v, artes: _w, aprovado_texto: _t, producao_ok: _p, fontes: _f, ...semExtras } = (peca.conteudo ?? {}) as Record<string, unknown>
  const atual = { tipo: tipoPedido, dia: peca.dia, titulo: peca.titulo, ...semExtras }
  const lembrarIsso = t.pedido.lembrar
  const sobreMemoria = lembrarIsso === true
    ? '\n\nA equipe marcou que este gosto vale para as PRÓXIMAS peças também: preencha "aprendizado" com uma regra geral e curta (sem citar esta peça), para você seguir sempre.'
    : lembrarIsso === false ? '\n\nEste ajuste vale só para esta peça: deixe "aprendizado" vazio.' : ''
  const guia = GUIA_FORMATO[tipoPedido] ? `\n\nCOMO PREENCHER ESTE FORMATO: ${GUIA_FORMATO[tipoPedido]}` : ''
  const usuario = `Esta é uma peça que você preparou:\n${JSON.stringify(atual, null, 2)}\n\nPedido de ajuste da equipe: ${String(t.pedido.instrucao ?? '')}${sobreMemoria}\n\nReescreva a peça inteira já com o ajuste (mantenha o que não foi pedido para mudar) e entregue OBRIGATORIAMENTE chamando a ferramenta entregar_peca.${guia}`
  const kn = await conhecimento(db, t.empresa_id, `${peca.titulo} ${String((peca.conteudo ?? {}).objetivo ?? '')} ${String(t.pedido.instrucao ?? '')}`, 6, [String((peca.conteudo ?? {}).campanha ?? '')])
  const { entrega: p, entrada, saida } = await chamarClaude(chave, modelo, sistema, comBloco(kn.bloco, usuario), FERRAMENTA_AJUSTE)
  // marcado "lembrar": guarda sempre (se o agente não resumir, guarda o próprio pedido); desmarcado: nunca guarda
  const sugerido = String((p as Record<string, unknown>).aprendizado ?? '').trim()
  const aprendizado = lembrarIsso === false ? '' : sugerido || (lembrarIsso === true ? String(t.pedido.instrucao ?? '').trim() : '')
  if (aprendizado) await lembrar(db, t.empresa_id, t.agente_id, aprendizado)
  // o que não é texto fica (direção visual, artes, orientações dos itens, horário…); o texto aprovado volta para revisão
  const { anterior: _a, etapa: _e, versoes: _v2, aprovado_texto: _t2, producao_ok: _p2, livre: _l, proposta: _pr, ...guardar } = (peca.conteudo ?? {}) as Record<string, unknown>
  const tipoNovo = TIPOS.includes(String(t.pedido.tipo_novo ?? '')) ? String(t.pedido.tipo_novo) : peca.tipo
  const titulo = p.titulo || peca.titulo
  const novo = { ...guardar, ...conteudoDe(p, { rede: redeDo(guardar.rede), campanha: guardar.campanha, plano: guardar.plano, reuniao: guardar.reuniao, briefing: guardar.briefing, horario: p.horario || guardar.horario, fontes: kn.fontes.length ? kn.fontes : guardar.fontes }) }
  const nota = String(t.pedido.nota ?? '').trim() || `Ajuste com IA: ${String(t.pedido.instrucao ?? '').slice(0, 120)}`
  await db.from('agentes_pecas').update({
    titulo, tipo: tipoNovo, status: 'rascunho', atualizado_em: new Date().toISOString(),
    // "anterior" segue para a tela antiga (produção) mostrar a versão de antes; a tela nova usa "versoes"
    conteudo: { ...novo, anterior: _e === 'ideia' ? undefined : guardar, versoes: comVersao(peca, { titulo, tipo: tipoNovo, conteudo: novo }, 'ajuste_ia', nota) },
  }).eq('id', peca.id)
  await db.from('agentes_trabalhos').update({
    pedido: { ...t.pedido, aprendizado: aprendizado || null },
    status: 'pronto', resumo: `Ajuste: ${String(t.pedido.instrucao ?? '').slice(0, 200)}${aprendizado ? ` · Aprendeu: ${aprendizado}` : ''}`, modelo, tokens_entrada: entrada, tokens_saida: saida,
    custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

// ideias que a equipe anotou (sem IA, sem custo): viram cartões na coluna Ideias para o agente escrever depois
async function guardarIdeias(db: SupabaseClient, t: Trabalho) {
  // lote: marca as peças criadas juntas no "Já sei o que quero postar" (a tela pede os textos logo depois)
  const lista = (Array.isArray(t.pedido.pecas) ? t.pedido.pecas : []) as { tipo: string; rede?: string; dia?: string; titulo: string; tema?: string; campanha?: string; plano?: string; proposta?: boolean; briefing?: Briefing; lote?: string }[]
  const pecas = lista.filter((x) => (TIPOS.includes(x.tipo) || x.tipo === 'auto') && x.titulo?.trim()).map((x, i) => ({
    trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: x.tipo === 'auto' ? 'post' : x.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(x.dia ?? '') ? x.dia : null,
    titulo: x.titulo.trim(), ordem: i, conteudo: { etapa: 'ideia', livre: x.tipo === 'auto' || undefined, proposta: x.proposta === true || undefined, rede: redeDo(x.rede), objetivo: x.tema?.trim() || undefined, campanha: x.campanha || undefined, plano: x.plano || undefined, briefing: x.briefing, lote: x.lote || undefined },
  }))
  if (pecas.length) { const { error } = await db.from('agentes_pecas').insert(pecas); if (error) throw new Error(error.message) }
  await db.from('agentes_trabalhos').update({ status: 'pronto', resumo: `${pecas.length} ideia(s) anotada(s)`, custo_usd: 0, terminado_em: new Date().toISOString() }).eq('id', t.id)
}

// ===== escrever: peças planejadas (ideias) viram rascunhos. Regra 5: planejar e gerar são passos separados =====
type PecaBanco = { id: string; tipo: string; dia: string | null; titulo: string; conteudo: Record<string, unknown> }
type Briefing = { objetivo?: string; publico?: string; telas?: number; duracao?: string; orientacao?: string; finalidade?: 'anuncio' | 'organico' }

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
      b.finalidade === 'anuncio' ? 'ANÚNCIO PAGO (siga o guia de anúncio)' : b.finalidade === 'organico' ? 'orgânico, para o perfil' : '',
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
    pecas.some((p) => (p.conteudo.briefing as Briefing | undefined)?.finalidade === 'anuncio') ? GUIA_ANUNCIO : '',
    `COMO PREENCHER CADA FORMATO:\n${guiaFormatos([...pecas.filter((p) => p.conteudo.livre !== true).map((p) => p.tipo), ...(pecas.some((p) => p.conteudo.livre === true) ? ativas.flatMap((r) => Object.keys(REDES[r].nomes)) : [])])}`,
    ...blocoEmpresa(perfil as Record<string, string>, exemplos),
  ].filter(Boolean).join('\n')
  const usuario = [
    `Escreva estas ${pecas.length} peças, uma para cada item da lista. Em cada peça preencha "ref" com o número do item e mantenha o "tipo" e o "dia" do item:\n${itens.join('\n')}`,
    pedido.tema ? `Tema central pedido pela equipe: ${pedido.tema}` : '',
    pedido.adaptar !== false && redes.length > 1 ? 'Todas partem da mesma ideia central, mas adapte a abertura, a profundidade e a chamada ao jeito de cada canal. Não repita o mesmo texto entre canais.' : '',
    usadas.length ? `Campanhas:\n${usadas.map((c) => `- ${textoCampanha(c)}`).join('\n')}` : '',
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
      const nomesCamp = (Array.isArray(perfil.campanhas) ? perfil.campanhas as Campanha[] : []).filter((c) => g.some((p) => p.conteudo.campanha === c.id)).map((c) => c.nome)
      const kn = await conhecimento(db, t.empresa_id, [t.pedido.tema, ...nomesCamp, ...g.map((p) => `${p.titulo} ${p.conteudo.objetivo ?? ''}`)].filter(Boolean).join(' '), g.length > 3 ? 10 : 6, g.map((p) => String(p.conteudo.campanha ?? '')))
      // referências de formato guardadas na Base da marca (mesmo formato das peças do grupo)
      const modelos = await blocoModelos(db, t.empresa_id, [...new Set(g.map((p) => p.tipo))])
      return { grupo: g, modelo: m, fontes: kn.fontes, ...(await chamarClaude(chave, m, sistema, comAnexos(comBloco(kn.bloco, [modelos, usuario].filter(Boolean).join('\n\n')), anexos))) }
    }))
    let escritas = 0
    // o que veio e não casou com nenhuma peça fica no histórico do trabalho, para conferir
    const naoCasou: unknown[] = []
    for (const r of respostas) {
      const entregues = comoLista<Peca>(r.entrega.pecas).filter((x) => x && typeof x === 'object')
      // peça única: se a IA pôs legenda, cta etc. fora da lista (no nível de cima), junta na peça
      if (r.grupo.length === 1 && entregues.length === 1) {
        const solto = r.entrega as unknown as Record<string, unknown>, alvo = entregues[0] as unknown as Record<string, unknown>
        for (const k of ['legenda', 'roteiro', 'texto_arte', 'cta', 'hashtags', 'observacao', 'prompt_imagem', 'horario', 'pendencia', 'objetivo', 'titulo']) if (alvo[k] == null && solto[k] != null) alvo[k] = solto[k]
      }
      // guarda o que veio cru (até 20 mil caracteres) para não perder um texto já pago
      if (entregues.length !== r.grupo.length) naoCasou.push({ pedidas: r.grupo.length, vieram: entregues.length, refs: entregues.map((x) => x.ref), tipoPecas: typeof r.entrega.pecas, bruto: typeof r.entrega.pecas === 'string' ? String(r.entrega.pecas).slice(0, 20000) : undefined })
      await Promise.all(r.grupo.map(async (p, i) => {
        // pelo número do item; se o número veio diferente (ex.: "1)" ou a posição na lista toda), vale a ordem quando a quantidade bate
        const e = entregues.find((x) => parseInt(String(x.ref), 10) === i + 1) ?? (entregues.length === r.grupo.length || entregues.every((x) => !x.ref) ? entregues[i] : undefined)
        if (!e) return db.from('agentes_pecas').update({ conteudo: { ...p.conteudo, etapa: 'ideia' } }).eq('id', p.id)
        escritas++
        const livre = p.conteudo.livre === true
        const tipo = livre && TIPOS.includes(String(e.tipo)) ? String(e.tipo) : p.tipo
        const rede = livre && e.rede && REDES[e.rede] ? e.rede : redeDo(p.conteudo.rede)
        return db.from('agentes_pecas').update({
          titulo: e.titulo || p.titulo, tipo, status: 'rascunho', atualizado_em: new Date().toISOString(),
          conteudo: primeiraVersao(e.titulo || p.titulo, tipo, conteudoDe(e, { rede, campanha: p.conteudo.campanha, plano: p.conteudo.plano, reuniao: p.conteudo.reuniao, briefing: p.conteudo.briefing, visual: p.conteudo.visual, fontes: r.fontes.length ? r.fontes : undefined })),
        }).eq('id', p.id)
      }))
    }
    const entrada = respostas.reduce((s, r) => s + r.entrada, 0), saida = respostas.reduce((s, r) => s + r.saida, 0)
    await db.from('agentes_trabalhos').update({
      pedido: { ...t.pedido, peca_ids: ids, anexos: anexos.map((a) => ({ nome: a.nome, tipo: a.tipo })), nao_casou: naoCasou.length ? naoCasou : undefined },
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

// texto de uma página (link enviado pela equipe), sem HTML. Mantém a quebra entre blocos (títulos, parágrafos, itens),
// que é o que separa os trechos quando a página vira material de campanha.
async function lerPagina(link: string, limite = 6000) {
  try {
    const r = await fetch(link, { signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'Mozilla/5.0 (agente de marketing)' } })
    if (!r.ok) return ''
    return textoDoHtml(await r.text()).slice(0, limite)
  } catch { return '' }
}

const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
function textoDoHtml(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|section|h[1-6]|li|tr|blockquote|article|header|footer)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
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
    `O QUE CADA FORMATO ENTREGA:\n${guiaFormatos(canais.flatMap((c) => c.formatos))}`,
    ...blocoEmpresa(perfil as Record<string, string>, []),
  ].filter(Boolean).join('\n')
  const usuario = [
    `Datas disponíveis (use só estas): ${datas.join(', ')}.`,
    total ? `Monte exatamente ${total} peça(s) no total, distribuídas entre os canais abaixo.` : '',
    `Canais e formatos permitidos:\n${canais.map((c) => `- ${REDES[c.rede].nome} (rede "${c.rede}")${total ? '' : `: até ${c.quantidade} peça(s) por ${unidade}`}; formatos: ${c.formatos.map((f) => `${REDES[c.rede].nomes[f] ?? f} (tipo "${f}")`).join(', ')}`).join('\n')}`,
    referencia ? `Página de referência enviada pela equipe (use o conteúdo como base, sem copiar):\n${referencia}` : '',
    blocoAta(pd.ata as Record<string, unknown> | undefined),
    anteriores.length ? `Esta é a proposta atual:\n${anteriores.map((i) => `- ${i.dia} · ${i.rede} · ${i.tipo} · ${i.titulo}${i.angulo ? ` — ${i.angulo}` : ''}`).join('\n')}\n\nAJUSTE PEDIDO PELA EQUIPE: ${pd.ajuste ?? ''}\nRefaça a proposta inteira já com o ajuste, mantendo o que não foi pedido para mudar.` : '',
    pd.objetivo ? `Objetivo: ${pd.objetivo}` : '', pd.publico ? `Público: ${pd.publico}` : '',
    pd.tema ? `Tema ou orientação da equipe: ${pd.tema}` : 'Tema livre: equilibre atrair, educar, relacionar e vender.',
    campanha ? `Campanha: ${textoCampanha(campanha)}` : 'Sem campanha: o plano pode ser educativo e de relacionamento, sem empurrar oferta.',
    'Distribua bem pelas datas, varie formatos e assuntos e crie uma sequência que faça sentido (um conteúdo prepara o outro). Uma mesma ideia pode aparecer em canais diferentes no mesmo dia, adaptada.',
    'Entregue OBRIGATORIAMENTE chamando a ferramenta propor_calendario. Não escreva nada fora da ferramenta.',
  ].filter(Boolean).join('\n\n')
  const ctx = await contexto(db)
  const assuntos = ((pd.ata as { assuntos?: { tema: string }[] } | undefined)?.assuntos ?? []).map((a) => a.tema)
  const kn = await conhecimento(db, t.empresa_id, [pd.tema, pd.objetivo, pd.publico, textoCampanha(campanha), plano.nome, ...assuntos].filter(Boolean).join(' '), 10, [String((campanha as { id?: string } | null)?.id ?? '')])
  const { entrega, entrada, saida } = await chamarClaude(chave, modelo, sistema, comBloco(kn.bloco, `${usuario}\n\nInformações atuais do sistema:\n${ctx}`), FERRAMENTA_PLANO)
  const permitidos = new Map(canais.map((c) => [c.rede, c.formatos]))
  const itens = comoLista<ItemPlano>(entrega.itens).filter((i) => datas.includes(i.dia) && permitidos.get(i.rede)?.includes(i.tipo)).slice(0, total || 60)
  if (!itens.length) throw new Error('O agente não conseguiu montar a proposta. Tente de novo.')
  const briefing = { objetivo: pd.objetivo || undefined, publico: pd.publico || undefined, orientacao: pd.orientacao || undefined }
  const { data, error } = await db.from('agentes_pecas').insert(itens.map((i, n) => ({
    trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: i.tipo, dia: i.dia, titulo: (i.titulo || 'Peça').trim(), ordem: n,
    conteudo: { etapa: 'ideia', proposta: true, rede: i.rede, objetivo: i.angulo, horario: i.horario, plano: plano.id, campanha: campanha?.id, briefing, reuniao: typeof pd.reuniao === 'string' ? pd.reuniao : undefined },
  }))).select('id')
  if (error) throw new Error(error.message)
  const substituir = (Array.isArray(pd.substituir) ? pd.substituir : []) as string[]
  if (substituir.length) await db.from('agentes_pecas').update({ status: 'descartada' }).in('id', substituir).eq('empresa_id', t.empresa_id)
  await db.from('agentes_trabalhos').update({
    pedido: { ...pd, peca_ids: (data ?? []).map((d) => d.id) }, status: 'pronto', resumo: entrega.resumo ?? `${itens.length} peças propostas`,
    modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

// ===== perfil de voz: o agente lê amostras da biblioteca e descreve como a marca fala. A equipe revisa e salva =====
const FERRAMENTA_VOZ = {
  name: 'entregar_perfil_voz',
  description: 'Entrega o perfil de voz da marca, para a equipe revisar.',
  input_schema: {
    type: 'object',
    properties: {
      perfil: { type: 'string', description: 'Perfil de voz em português do Brasil, em tópicos curtos, com estas partes: 1) Como explica (estrutura, exemplos, comparações que usa); 2) Termos e nomes próprios da marca (protocolos, técnicas, métodos) — liste os que aparecem; 3) Expressões e bordões que se repetem; 4) Posicionamento (no que acredita, o que critica no mercado); 5) Tom com o público (iniciante x experiente); 6) O que evitar para não soar diferente da marca. Só o que aparece nos trechos; nada inventado. Máximo 2.500 caracteres.' },
    },
    required: ['perfil'],
  },
}

async function gerarVoz(db: SupabaseClient, empresa: string) {
  const { chave, pa, modelo } = await prepararAgente(db, empresa, 'marketing')
  const { data: fontes } = await db.from('marca_fontes').select('id,titulo').eq('empresa_id', empresa).eq('ativo', true).eq('aprovada', true).eq('status', 'pronta').limit(60)
  if (!fontes?.length) throw new Error('A biblioteca está vazia. Envie apostilas, roteiros ou textos da marca antes de gerar o perfil de voz.')
  // amostra espalhada: os primeiros trechos de cada fonte, até ~60 mil caracteres
  const porFonte = Math.max(2, Math.floor(40 / fontes.length))
  const amostras: string[] = []
  let total = 0
  for (const f of fontes) {
    const { data: tr } = await db.from('marca_trechos').select('conteudo').eq('fonte_id', f.id).order('ordem').limit(porFonte)
    for (const t of tr ?? []) { if (total > 60000) break; amostras.push(`[${f.titulo}]\n${t.conteudo}`); total += t.conteudo.length }
  }
  const sistema = ['Você analisa materiais de uma empresa brasileira para descrever como a marca fala e ensina, para outro redator escrever igual.', ...blocoEmpresa(pa as Record<string, string>, [])].join('\n')
  const usuario = `Trechos dos materiais da marca:\n\n${amostras.join('\n---\n')}\n\nDescreva o perfil de voz chamando OBRIGATORIAMENTE a ferramenta entregar_perfil_voz.`
  const { entrega, entrada, saida } = await chamarClaude(chave, modelo, sistema, usuario, FERRAMENTA_VOZ)
  const perfil = String((entrega as unknown as { perfil?: string }).perfil ?? '').trim()
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'marketing', tipo: 'voz', status: 'pronto', pedido: { fontes: fontes.length }, resumo: 'Perfil de voz gerado a partir da biblioteca', modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: custo(modelo, entrada, saida), terminado_em: new Date().toISOString() })
  if (!perfil) throw new Error('O agente não conseguiu montar o perfil. Tente de novo.')
  return { perfil }
}

// créditos: quem usa o sistema vê e limita o consumo em créditos (1 crédito = US$ 0,01 de custo); o custo em dólar fica gravado
const CREDITOS_POR_USD = 100
function checarCreditos(gastoUsd: number, limite: unknown, aviso: string, onde: string) {
  if (limite == null || limite === '') return
  if (Math.ceil(gastoUsd * CREDITOS_POR_USD - 1e-9) >= Number(limite)) throw new Error(`${aviso} (limite de ${Number(limite)} créditos). Aumente em ${onde}.`)
}

// chave, agente ligado, limites do mês (empresa e agente) e o modelo a usar
async function prepararAgente(db: SupabaseClient, empresa: string, agente: string) {
  const [{ data: cfg }, { data: perfilAg }, { data: chave }, { data: gastos }] = await Promise.all([
    db.from('agentes_config').select('modelo,limite_mes_creditos').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', empresa).eq('agente_id', agente).maybeSingle(),
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_trabalhos').select('custo_usd,agente_id').eq('empresa_id', empresa).gte('criado_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  if (!perfilAg?.ativo) throw new Error('Este agente está desligado. Ligue em Configurar agente.')
  const gastoMes = (gastos ?? []).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
  checarCreditos(gastoMes, cfg?.limite_mes_creditos, 'Os créditos do mês da empresa acabaram', 'Configurações')
  // configuração própria do agente (modelo, limite e instruções), guardada no perfil dele
  const pa = (perfilAg.perfil ?? {}) as Record<string, unknown>
  const gastoAgente = (gastos ?? []).filter((g) => g.agente_id === agente).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
  checarCreditos(gastoAgente, pa.limite_mes_creditos, 'Os créditos do mês deste agente acabaram', 'Configurar agente')
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? cfg?.modelo ?? 'claude-sonnet-5-5'
  return { chave: String(chave), pa, perfilAg, modelo }
}

// ===== Agente de Arte: gera ou ajusta a arte de uma peça (ou de uma lâmina) com a IA de imagem da OpenAI =====
// Junta o texto da lâmina, a Direção visual, as Pessoas da marca escolhidas (fotos como referência do rosto),
// as fotos reais de antes e depois (autorizadas) e as referências. A arte gerada entra nos arquivos da peça e vira versão.
const MODELO_IMAGEM = 'gpt-image-2'
const TAM_ARTE: Record<string, string> = { '4:5': '1024x1280', '9:16': '1008x1792', '16:9': '1792x1008', '1:1': '1024x1024', '2:3': '1024x1536', 'A4': '1056x1488' }
const tamSeguro = (p: string) => (['9:16', '2:3', '4:5', 'A4'].includes(p) ? '1024x1536' : p === '16:9' ? '1536x1024' : '1024x1024')
// preço aproximado do gpt-image (US$ por milhão de tokens): entrada 8, saída 30
const custoImagem = (ent: number, sai: number) => Math.round(((ent * 8 + sai * 30) / 1_000_000) * 10000) / 10000

async function prepararArte(db: SupabaseClient, empresa: string) {
  const [{ data: cfg }, { data: perfilAg }, { data: chave }, { data: gastos }] = await Promise.all([
    db.from('agentes_config').select('limite_mes_creditos').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle(),
    db.rpc('agentes_ler_chave_ia', { p_empresa: empresa, p_provedor: 'openai' }),
    db.from('agentes_trabalhos').select('custo_usd').eq('empresa_id', empresa).gte('criado_em', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])
  if (!chave) throw new Error('Falta cadastrar a chave da OpenAI em Agentes → Configurações.')
  if (!perfilAg?.ativo) throw new Error('Este agente está desligado. Ligue em Configurar agente.')
  const gastoMes = (gastos ?? []).reduce((s, g) => s + Number(g.custo_usd ?? 0), 0)
  checarCreditos(gastoMes, cfg?.limite_mes_creditos, 'Os créditos do mês da empresa acabaram', 'Configurações')
  return { chave: String(chave), pa: (perfilAg.perfil ?? {}) as Record<string, unknown> }
}

type Ref = { caminho: string; nome?: string }
// logo da arte: o escolhido na peça; no automático, o marcado para o fundo da arte (1ª cor da paleta escura → "para fundo escuro")
type Logo = Ref & { uso?: 'escuro' | 'claro' }
const POSICAO_LOGO: Record<string, string> = { auto: 'pequeno e discreto, onde ficar mais elegante (topo ou rodapé)', topo: 'pequeno, centralizado no TOPO', rodape: 'pequeno, centralizado no RODAPÉ', canto: 'pequeno, no CANTO INFERIOR direito' }
function escolherLogo(logos: Logo[], escolha: string | undefined, paleta: { hex: string }[] | undefined) {
  if (escolha === 'nenhum' || !logos.length) return undefined
  const escolhido = logos.find((l) => l.caminho === escolha)
  if (escolhido) return escolhido
  const hex = (paleta?.[0]?.hex ?? '#000000').replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0)
  const fundo = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? 'escuro' : 'claro'
  return logos.find((l) => l.uso === fundo) ?? logos.find((l) => !l.uso) ?? logos[0]
}
// "Lâmina 1 (capa):" e parecidos, do começo dos itens antigos (a tela tira o mesmo prefixo)
const PREFIXO_ITEM = /^(l[âa]mina|tela|cena|p[áa]gina|bloco|se[çc][ãa]o)\s*\d+\s*(\([^)]*\))?\s*[:,\-–—.]\s*/i
async function baixarImagem(db: SupabaseClient, caminho: string) {
  const { data } = await db.storage.from('arquivos').download(caminho)
  if (!data) return null
  const tipo = /\.jpe?g$/i.test(caminho) ? 'image/jpeg' : /\.webp$/i.test(caminho) ? 'image/webp' : 'image/png'
  return new Blob([await data.arrayBuffer()], { type: tipo })
}

async function chamarImagem(chave: string, prompt: string, tamanho: string, imagens: Blob[]) {
  const pedir = (size: string) => {
    if (!imagens.length) {
      return fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODELO_IMAGEM, prompt, size, quality: 'medium', n: 1 }),
      })
    }
    const f = new FormData()
    f.append('model', MODELO_IMAGEM); f.append('prompt', prompt); f.append('size', size); f.append('quality', 'medium')
    imagens.forEach((b, i) => f.append('image[]', b, `imagem-${i + 1}.${b.type === 'image/jpeg' ? 'jpg' : b.type === 'image/webp' ? 'webp' : 'png'}`))
    return fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: f })
  }
  let r = await pedir(tamanho)
  let corpo = await r.json().catch(() => ({}))
  // tamanho sob medida recusado: tenta o tamanho padrão mais próximo
  if (!r.ok && r.status === 400 && /size/i.test(String(corpo?.error?.message ?? ''))) {
    r = await pedir(tamSeguro(Object.entries(TAM_ARTE).find(([, v]) => v === tamanho)?.[0] ?? '1:1'))
    corpo = await r.json().catch(() => ({}))
  }
  if (!r.ok) {
    const msg = String(corpo?.error?.message ?? `erro ${r.status}`)
    if (r.status === 401) throw new Error('A OpenAI recusou a chave. Confira a chave em Agentes → Configurações.')
    if (/verif/i.test(msg)) throw new Error('A OpenAI pede para verificar a organização antes de gerar imagem: platform.openai.com → Settings → Organization → Verify.')
    if (/billing|quota|credit/i.test(msg)) throw new Error('A conta da OpenAI está sem crédito. Coloque crédito em platform.openai.com → Settings → Billing.')
    if (/safety|moderation|policy/i.test(msg)) throw new Error('A OpenAI recusou este pedido de imagem pelas regras dela. Mude a orientação e tente de novo.')
    throw new Error(`A IA de imagem respondeu ${r.status}: ${msg}`)
  }
  const b64 = corpo?.data?.[0]?.b64_json
  if (!b64) throw new Error('A IA de imagem não devolveu a arte. Tente de novo.')
  const uso = corpo.usage ?? {}
  return { bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), entrada: Number(uso.input_tokens ?? 0), saida: Number(uso.output_tokens ?? 0) }
}

async function gerarArte(db: SupabaseClient, t: Trabalho) {
  const { chave, pa } = await prepararArte(db, t.empresa_id)
  const { data: peca } = await db.from('agentes_pecas').select('*').eq('id', String(t.pedido.peca_id)).eq('empresa_id', t.empresa_id).maybeSingle()
  if (!peca) throw new Error('Peça não encontrada.')
  const c = (peca.conteudo ?? {}) as Record<string, unknown>
  const v = (c.visual ?? {}) as { estilo?: string; proporcao?: string; paleta?: { nome: string; hex: string }[]; referencias?: Ref[]; antesDepois?: Ref[]; autorizado?: boolean; pessoas?: string[]; logo?: string; logoPosicao?: string; elementos?: Ref[] }
  const roteiro = (Array.isArray(c.roteiro) ? c.roteiro : []) as string[]
  const orientacoes = (Array.isArray(c.orientacoes) ? c.orientacoes : []) as string[]
  const artes = (Array.isArray(c.artes) ? [...c.artes] : []) as { arquivo?: string; nome?: string; orientacao?: string; gerada?: boolean; elementos?: Ref[] }[]
  const item = typeof t.pedido.item === 'number' ? Number(t.pedido.item) : null
  const idx = item ?? 0
  const ajuste = String(t.pedido.ajuste ?? '').trim()
  const proporcao = v.proporcao || '4:5'
  const rede = REDES[redeDo(c.rede)]
  const nomeFormato = rede.nomes[peca.tipo] ?? peca.tipo

  // imagens enviadas junto (a ordem vira "imagem 1, 2…" no pedido)
  const imagens: Blob[] = [], quais: string[] = []
  const juntar = async (caminho: string | undefined, papel: string) => {
    if (!caminho || imagens.length >= 12) return
    const b = await baixarImagem(db, caminho)
    if (b) { imagens.push(b); quais.push(`imagem ${imagens.length}: ${papel}`) }
  }
  if (ajuste && artes[idx]?.arquivo) await juntar(artes[idx].arquivo, 'a ARTE ATUAL, que deve ser ajustada')
  // identidade visual da empresa (Base da marca): o logo real e as referências de estilo
  const logo = escolherLogo((Array.isArray(pa.logos) ? pa.logos : []) as Logo[], v.logo, v.paleta)
  const antesDoLogo = imagens.length
  await juntar(logo?.caminho, 'o LOGO OFICIAL da empresa: reproduza exatamente este logo, sem redesenhar, sem mudar letras, cores ou símbolo')
  const comLogo = imagens.length > antesDoLogo
  for (const f of ((Array.isArray(pa.estilo_refs) ? pa.estilo_refs : []) as Ref[]).slice(0, 2)) await juntar(f.caminho, 'referência do ESTILO DA MARCA (fontes, cores, acabamento e diagramação que a marca usa): siga este padrão visual')
  const ids = (v.pessoas ?? []).slice(0, 3)
  const { data: pessoas } = ids.length ? await db.from('marca_pessoas').select('id,nome,papel,fotos,autorizado').in('id', ids).eq('empresa_id', t.empresa_id) : { data: [] }
  const nomesPessoas: string[] = []
  for (const p of (pessoas ?? []).filter((p) => p.autorizado)) {
    nomesPessoas.push(`${p.nome}${p.papel ? ` (${p.papel})` : ''}`)
    for (const f of ((p.fotos ?? []) as Ref[]).slice(0, 3)) await juntar(f.caminho, `foto de ${p.nome}: referência do ROSTO (a roupa, o fundo e a pose desta foto NÃO precisam ser copiados)`)
  }
  // imagens que a equipe quer NA arte (logo de produto, foto de produto, selo): entram como são
  for (const f of ((item !== null ? artes[idx]?.elementos : v.elementos) ?? []).slice(0, 4)) await juntar(f.caminho, `IMAGEM PARA USAR NA ARTE${f.nome ? ` (${f.nome})` : ''}: coloque na arte exatamente como é, sem redesenhar; siga a orientação sobre onde ela vai`)
  if (v.autorizado) for (const f of (v.antesDepois ?? []).slice(0, 4)) await juntar(f.caminho, 'foto REAL de antes/depois de paciente (autorizada): use como está, sem alterar o resultado')
  if (!ajuste && item !== null && item > 0 && artes[0]?.arquivo) await juntar(artes[0].arquivo, 'a CAPA deste mesmo carrossel: siga o mesmo estilo, fontes, cores e diagramação')
  for (const f of (v.referencias ?? []).slice(0, 3)) await juntar(f.caminho, 'referência de estilo (inspire-se, sem copiar texto, marca ou pessoas)')

  // o texto vem da tela, como a equipe vê (título e apoio); sem ele, sai do roteiro sem o "Lâmina 1 (capa):" do começo
  const daTela = (t.pedido.texto ?? null) as { titulo?: string; apoio?: string } | null
  const [tituloItem, ...restoItem] = (item !== null ? roteiro[item] ?? '' : '').replace(PREFIXO_ITEM, '').split('\n')
  const titulo = (daTela ? daTela.titulo : item !== null ? tituloItem : c.texto_arte as string | undefined)?.trim() ?? ''
  const apoio = (daTela ? daTela.apoio : item !== null ? restoItem.join(' ') : peca.tipo === 'post' ? roteiro.join(' ') : '')?.trim().slice(0, 300) ?? ''
  const textoArte = [titulo && `Título: "${titulo}"`, apoio && `Texto de apoio (curto, menor): "${apoio}"`].filter(Boolean).join('\n')
  const memoria = ((Array.isArray(pa.memoria) ? pa.memoria : []) as { texto: string }[]).filter((m) => m.texto.startsWith('Arte:')).map((m) => `- ${m.texto.replace(/^Arte:\s*/, '')}`)
  const qualPeca = item !== null ? `${item === 0 ? 'a CAPA' : `a lâmina ${item + 1}`} de ${roteiro.length} de um ${nomeFormato} do ${rede.nome}` : `a arte de um ${nomeFormato} do ${rede.nome}`
  const prompt = [
    `Crie ${qualPeca} para a empresa ${String(pa.empresa ?? '')} (${String(pa.o_que_vende ?? '').slice(0, 200)}). Público: ${String(pa.publico ?? '').slice(0, 200)}.`,
    `Proporção ${proporcao}. Estilo: ${v.estilo || 'editorial premium'}. Paleta da marca: ${(v.paleta ?? []).map((x) => `${x.nome} ${x.hex}`).join(', ') || 'preto e dourado'}.`,
    textoArte ? `TEXTO NA ARTE, em português do Brasil, escrito EXATAMENTE assim (com acentos, sem erros, sem inventar outras palavras):\n${textoArte}\nTipografia elegante, legível no celular, com bom contraste e margens seguras.` : 'Sem texto na arte.',
    c.prompt_imagem ? `Orientação da peça: ${String(c.prompt_imagem).slice(0, 1200)}` : '',
    item !== null && (artes[item]?.orientacao || orientacoes[item]) ? `Orientação desta lâmina: ${[artes[item]?.orientacao, orientacoes[item]].filter(Boolean).join(' · ')}` : '',
    nomesPessoas.length ? `Na arte aparece: ${nomesPessoas.join(', ')}. Mantenha o rosto e os traços idênticos aos das fotos enviadas (a pessoa precisa ser reconhecida); roupa, cor da roupa, cabelo, pose, enquadramento e cenário seguem a orientação da peça.` : 'Não coloque pessoas reconhecíveis, a não ser que a orientação peça; nunca invente o rosto de um paciente.',
    comLogo ? `Coloque o LOGO OFICIAL enviado ${POSICAO_LOGO[v.logoPosicao ?? 'auto'] ?? POSICAO_LOGO.auto}, exatamente como ele é.`
      : v.logo === 'nenhum' ? 'A arte vai SEM logo: não desenhe logotipo, monograma nem símbolo da empresa.'
      : 'NÃO desenhe logotipo, monograma nem símbolo de marca: a empresa não enviou o logo. Se quiser assinar a arte, use só o nome da empresa em texto simples e pequeno.',
    'Não escreva na arte rótulos de organização como "Lâmina 1", "Capa", "Cena" ou números de página: só o texto pedido.',
    'Nunca crie nem altere fotos de resultado de paciente; antes e depois só com as fotos reais enviadas, sem modificar.',
    quais.length ? `IMAGENS ENVIADAS:\n${quais.join('\n')}` : '',
    memoria.length ? `GOSTOS DA EQUIPE (siga sempre):\n${memoria.join('\n')}` : '',
    pa.evitar ? `Nunca: ${String(pa.evitar).slice(0, 300)}` : '',
    ajuste ? `AJUSTE PEDIDO PELA EQUIPE na arte atual (imagem 1): ${ajuste}. Mude só o que foi pedido e mantenha o resto igual.` : '',
  ].filter(Boolean).join('\n\n')

  const { bytes, entrada, saida } = await chamarImagem(chave, prompt, TAM_ARTE[proporcao] ?? '1024x1024', imagens)
  const caminho = `agentes/pecas/${peca.id}/arte-${idx + 1}-${Date.now()}.png`
  const { error: eUp } = await db.storage.from('arquivos').upload(caminho, bytes, { contentType: 'image/png', upsert: false })
  if (eUp) throw new Error('Não consegui guardar a arte gerada: ' + eUp.message)
  if (ajuste && t.pedido.lembrar === true) await lembrar(db, t.empresa_id, t.agente_id, `Arte: ${ajuste}`)
  // lê a peça de novo: a equipe pode ter mexido no texto enquanto a arte era criada; só a arte muda
  const { data: fresca } = await db.from('agentes_pecas').select('titulo,tipo,conteudo').eq('id', peca.id).maybeSingle()
  const c2 = (fresca?.conteudo ?? c) as Record<string, unknown>
  const artes2 = (Array.isArray(c2.artes) ? [...c2.artes] : []) as typeof artes
  while (artes2.length <= idx) artes2.push({})
  artes2[idx] = { ...artes2[idx], arquivo: caminho, nome: `${item !== null ? `Lâmina ${idx + 1}` : 'Arte'} (IA)`, gerada: true }
  const { versoes: _v, anterior: _a, ...resto } = c2
  const novo = { ...resto, artes: artes2 }
  const nota = ajuste ? `Arte ajustada: ${ajuste.slice(0, 100)}` : `Arte ${item !== null ? `da lâmina ${idx + 1}` : 'da peça'} gerada pela IA`
  await db.from('agentes_pecas').update({
    atualizado_em: new Date().toISOString(),
    conteudo: { ...novo, versoes: comVersao({ ...peca, ...(fresca ?? {}), conteudo: c2 }, { titulo: fresca?.titulo ?? peca.titulo, tipo: fresca?.tipo ?? peca.tipo, conteudo: novo }, 'arte_ia', nota) },
  }).eq('id', peca.id)
  await db.from('agentes_trabalhos').update({
    status: 'pronto', resumo: nota, modelo: MODELO_IMAGEM, tokens_entrada: entrada, tokens_saida: saida,
    custo_usd: custoImagem(entrada, saida), terminado_em: new Date().toISOString(),
  }).eq('id', t.id)
}

async function executar(db: SupabaseClient, t: Trabalho) {
  try {
    if (t.tipo === 'ideia') return await guardarIdeias(db, t)
    if (t.tipo === 'arte') return await gerarArte(db, t)
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
    ).filter((pd: Record<string, unknown>) => Number(pd.posts ?? 0) + Number(pd.reels ?? 0) + Number(pd.stories ?? 0) > 0)
    // stories são textos curtos e muitos: vão no modelo econômico (cerca de 20x mais barato); posts e reels no modelo escolhido
    const modeloDe = (pd: Record<string, unknown>) => (Number(pd.posts ?? 0) + Number(pd.reels ?? 0) === 0 && pa.stories_economico !== false ? 'claude-haiku-5-5' : modelo)
    const campanhaId = (t.pedido.campanha as Campanha | null)?.id
    const anexos = (Array.isArray(t.pedido.anexos) ? t.pedido.anexos : []) as Anexo[]
    const kn = await conhecimento(db, t.empresa_id, [t.pedido.foco, textoCampanha(t.pedido.campanha as Campanha | null)].filter(Boolean).join(' '), 8, [String(campanhaId ?? '')])
    const respostas = await Promise.all(pedidos.map(async (pd) => { const { sistema, usuario } = pedidoMarketing(perfil, pd, ctx, (exemplos ?? []) as Exemplo[]); const m = modeloDe(pd); return { ...(await chamarClaude(String(chave), m, sistema, comAnexos(comBloco(kn.bloco, usuario), anexos))), modelo: m } }))
    const entrega = { resumo: respostas.map((r) => r.entrega.resumo).filter(Boolean)[0] ?? null, pecas: respostas.flatMap((r) => comoLista<Peca>(r.entrega.pecas)) }
    const entrada = respostas.reduce((s, r) => s + r.entrada, 0), saida = respostas.reduce((s, r) => s + r.saida, 0)
    const custoTotal = Math.round(respostas.reduce((s, r) => s + custo(r.modelo, r.entrada, r.saida), 0) * 10000) / 10000
    const pecas = entrega.pecas.map((p, i) => ({
      trabalho_id: t.id, empresa_id: t.empresa_id, agente_id: t.agente_id, tipo: p.tipo, dia: /^\d{4}-\d{2}-\d{2}$/.test(p.dia) ? p.dia : null,
      titulo: p.titulo || `Peça ${i + 1}`, ordem: i,
      conteudo: primeiraVersao(p.titulo || `Peça ${i + 1}`, p.tipo, conteudoDe(p, { rede: redeDo(t.pedido.rede), campanha: campanhaId })),
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

// o que a Reunião de pauta (reuniao.ts) usa daqui: as mesmas regras de chave, limite, marca e biblioteca
const DEPENDENCIAS: Dependencias = {
  prepararAgente: async (db, empresa, agente) => { const r = await prepararAgente(db, empresa, agente); return { chave: r.chave, pa: r.pa, modelo: r.modelo } },
  chamarClaude: (chave, modelo, sistema, usuario, ferramenta) => chamarClaude(chave, modelo, sistema, usuario, ferramenta),
  blocoEmpresa: (perfil) => blocoEmpresa(perfil, []),
  conhecimento, contexto, custo,
  canais: (perfil) => listaCanais(redesAtivas(perfil)),
  redes: NOMES_REDES, tipos: TIPOS,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode acionar os agentes.' }, 403)
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const corpo = await req.json().catch(() => ({}))
  if (corpo.voz) {
    try { return json(await gerarVoz(db, String(corpo.empresa ?? ''))) } catch (e) { return json({ erro: (e as Error).message }) }
  }
  if (corpo.testeVoz) {
    try { return json(await testarVoz(DEPENDENCIAS, db, String(corpo.empresa ?? ''), corpo.testeVoz)) } catch (e) { return json({ erro: (e as Error).message }) }
  }
  if (corpo.referencia) {
    try { return json(await analisarReferencia(DEPENDENCIAS, db, String(corpo.empresa ?? ''), String(corpo.referencia))) } catch (e) { return json({ erro: (e as Error).message }) }
  }
  // material de campanha a partir de um link: o texto da página (sem HTML) volta para a tela guardar na biblioteca
  if (corpo.lerPagina) {
    const link = String(corpo.lerPagina)
    if (!/^https?:\/\//.test(link)) return json({ erro: 'O link precisa começar com https://' })
    const texto = await lerPagina(link, 60000)
    return json(texto.length > 80 ? { texto } : { erro: 'Não consegui ler essa página (pode precisar de login ou estar fora do ar). Envie o arquivo .html ou cole o texto.' })
  }
  if (corpo.reuniao) {
    try { return json(await reunir(DEPENDENCIAS, db, String(corpo.empresa ?? ''), corpo.reuniao)) } catch (e) { return json({ erro: (e as Error).message }) }
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
