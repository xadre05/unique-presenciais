// Reunião de pauta (19/10/2026): o Agente de Marketing conversa com a equipe ANTES de gerar qualquer conteúdo,
// como uma social media numa reunião. Chega preparado (o que já saiu, o que está planejado, campanhas, agenda,
// biblioteca e resultados dos posts), sugere com o porquê e vai montando a ata. Nada é gerado aqui: o plano só
// é montado quando a equipe clica em "Montar o plano" (trabalho propor_plano, com a ata junto).
// Regras em docs/agentes/REGRAS_AGENTE_MARKETING.md (seção Reunião de pauta).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { pautaModelos } from './referencias.ts'

type Mensagem = { de: 'equipe' | 'agente'; texto: string }
export type Escopo = { tipo: 'dia' | 'dias' | 'semana' | 'mes' | 'campanha'; inicio: string; fim: string; campanha?: string; texto?: string }
type Campanha = { id: string; nome: string; descricao?: string; inicio?: string; fim?: string }
type Ferramenta = { name: string; description: string; input_schema: Record<string, unknown> }

// o que a função principal empresta para a reunião (mesmas regras de chave, limite, marca e biblioteca)
export type Dependencias = {
  prepararAgente: (db: SupabaseClient, empresa: string, agente: string) => Promise<{ chave: string; pa: Record<string, unknown>; modelo: string }>
  chamarClaude: (chave: string, modelo: string, sistema: string, usuario: string | unknown[], ferramenta: Ferramenta) => Promise<{ entrega: unknown; entrada: number; saida: number }>
  blocoEmpresa: (perfil: Record<string, string>, exemplos: never[]) => string[]
  conhecimento: (db: SupabaseClient, empresa: string, consulta: string, limite?: number) => Promise<{ bloco: string; fontes: string[] }>
  contexto: (db: SupabaseClient) => Promise<string>
  custo: (modelo: string, entrada: number, saida: number) => number
  canais: (perfil: Record<string, unknown>) => string
  redes: string[]
  tipos: string[]
}

const NOME_ESCOPO: Record<Escopo['tipo'], string> = { dia: 'um dia', dias: 'os próximos dias', semana: 'a semana', mes: 'o mês', campanha: 'uma campanha' }
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const somaDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export function ferramentaReuniao(redes: string[], tipos: string[]): Ferramenta {
  return {
    name: 'responder_reuniao',
    description: 'Responde à equipe na reunião de pauta e devolve a ata atualizada.',
    input_schema: {
      type: 'object',
      properties: {
        resposta: { type: 'string', description: 'Sua fala na reunião, em português do Brasil. Até 6 frases; na abertura pode usar até 4 tópicos curtos começando com "- ". Termine com no máximo UMA pergunta.' },
        opcoes: { type: 'array', items: { type: 'string' }, description: 'Até 3 respostas rápidas que a equipe pode clicar (ex.: "Concordo", "Prefiro focar na Black", "Menos vídeo")' },
        pronta: { type: 'boolean', description: 'true quando a ata já tem período, canais com formatos e quantidade, e pelo menos um assunto com o porquê, sem pendência aberta' },
        ata: {
          type: 'object',
          description: 'O estado atual do que foi combinado. Mantenha o que já estava e mude só o que a conversa mudou.',
          properties: {
            objetivo: { type: 'string', description: 'O objetivo do período em uma frase' },
            publico: { type: 'string' },
            inicio: { type: 'string', description: 'AAAA-MM-DD' },
            fim: { type: 'string', description: 'AAAA-MM-DD' },
            campanha: { type: 'string', description: 'Nome exato de uma campanha cadastrada, ou vazio' },
            canais: { type: 'array', items: { type: 'object', properties: { rede: { type: 'string', enum: redes }, formatos: { type: 'array', items: { type: 'string', enum: tipos } }, quantidade: { type: 'integer', description: 'Peças nesse canal no período' } }, required: ['rede', 'formatos', 'quantidade'] } },
            total: { type: 'integer', description: 'Total de peças no período' },
            assuntos: { type: 'array', items: { type: 'object', properties: { tema: { type: 'string' }, porque: { type: 'string', description: 'Por que postar isso agora (dado da pauta, campanha, data, pedido da equipe)' }, rede: { type: 'string', enum: redes }, tipo: { type: 'string', enum: tipos }, dia: { type: 'string', description: 'AAAA-MM-DD, se já combinado' } }, required: ['tema', 'porque'] } },
            evitar: { type: 'array', items: { type: 'string' }, description: 'O que a equipe pediu para não fazer neste período' },
            observacoes: { type: 'string' },
          },
        },
      },
      required: ['resposta', 'ata', 'pronta'],
    },
  }
}

// peças que já saíram (últimas 4 semanas) e o que já está planejado no período
async function pecasDaPauta(db: SupabaseClient, empresa: string, e: Escopo) {
  const { data } = await db.from('agentes_pecas').select('dia,tipo,titulo,status,conteudo').eq('empresa_id', empresa).eq('agente_id', 'marketing')
    .neq('status', 'descartada').gte('dia', somaDias(e.inicio, -28)).lte('dia', e.fim).order('dia').limit(120)
  const linha = (p: { dia: string; tipo: string; titulo: string; status: string; conteudo: Record<string, unknown> }) =>
    `- ${dm(p.dia)} · ${String(p.conteudo?.rede ?? 'instagram')} · ${p.tipo} · ${p.titulo} (${p.status === 'postada' ? 'postada' : p.conteudo?.etapa === 'ideia' ? 'ideia' : p.status})`
  const antes = (data ?? []).filter((p) => p.dia < e.inicio)
  const no = (data ?? []).filter((p) => p.dia >= e.inicio)
  return [
    antes.length ? `PEÇAS DAS ÚLTIMAS 4 SEMANAS (${antes.length}):\n${antes.slice(-40).map(linha).join('\n')}` : 'PEÇAS DAS ÚLTIMAS 4 SEMANAS: nenhuma registrada no sistema.',
    no.length ? `JÁ PLANEJADO NO PERÍODO DA REUNIÃO (não duplicar):\n${no.map(linha).join('\n')}` : '',
  ]
}

// resultados dos posts publicados (Instagram ligado em Base da marca); sem ligação, avisa que não há dado
async function resultadosDaPauta(db: SupabaseClient, empresa: string) {
  const { data, error } = await db.from('marca_posts').select('tipo,legenda,publicado_em,metricas').eq('empresa_id', empresa).eq('rede', 'instagram').order('publicado_em', { ascending: false }).limit(30)
  if (error || !data?.length) return 'RESULTADOS DOS POSTS: ainda não há dados (o Instagram não está ligado). Não invente desempenho; se precisar, pergunte à equipe o que funcionou.'
  const num = (m: Record<string, unknown>, k: string) => Number(m?.[k] ?? 0)
  const alcances = data.map((p) => num(p.metricas, 'alcance')).filter((n) => n > 0).sort((a, b) => a - b)
  const mediana = alcances.length ? alcances[Math.floor(alcances.length / 2)] : 0
  const linha = (p: { tipo: string; legenda: string | null; publicado_em: string; metricas: Record<string, unknown> }) =>
    `- ${dm(p.publicado_em.slice(0, 10))} · ${p.tipo} · alcance ${num(p.metricas, 'alcance')} · curtidas ${num(p.metricas, 'curtidas')} · comentários ${num(p.metricas, 'comentarios')} · salvos ${num(p.metricas, 'salvos')} · compartilhamentos ${num(p.metricas, 'compartilhamentos')} · "${String(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 90)}"`
  return `RESULTADOS DOS ÚLTIMOS ${data.length} POSTS DO INSTAGRAM (alcance mediano ${mediana}; compare cada post com esse número):\n${data.map(linha).join('\n')}`
}

async function levantarPauta(db: SupabaseClient, d: Dependencias, empresa: string, e: Escopo, campanhas: Campanha[], reuniaoId?: string) {
  const [pecas, resultados, agenda, fontes, anterior, modelos] = await Promise.all([
    pecasDaPauta(db, empresa, e),
    resultadosDaPauta(db, empresa),
    d.contexto(db),
    db.from('marca_fontes').select('titulo').eq('empresa_id', empresa).eq('ativo', true).eq('status', 'pronta').order('criado_em', { ascending: false }).limit(30),
    db.from('agentes_reunioes').select('titulo,ata,criado_em').eq('empresa_id', empresa).eq('agente_id', 'marketing').eq('ativo', true).neq('status', 'aberta').neq('id', reuniaoId ?? '00000000-0000-0000-0000-000000000000').order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    pautaModelos(db, empresa),
  ])
  const ativas = campanhas.filter((c) => !c.fim || c.fim >= e.inicio)
  const ata = anterior.data?.ata as { objetivo?: string; assuntos?: { tema: string }[] } | undefined
  return [
    ...pecas,
    resultados,
    ativas.length ? `CAMPANHAS CADASTRADAS:\n${ativas.map((c) => `- ${c.nome}${c.inicio ? ` (de ${c.inicio}${c.fim ? ` a ${c.fim}` : ''})` : ''}: ${c.descricao ?? ''}`).join('\n')}` : 'CAMPANHAS: nenhuma cadastrada.',
    agenda ? `AGENDA E OFERTAS DO SISTEMA:\n${agenda}` : '',
    `REFERÊNCIAS DE FORMATO:\n${modelos}`,
    fontes.data?.length ? `ASSUNTOS QUE A BIBLIOTECA DA MARCA COBRE: ${fontes.data.map((f) => f.titulo).join('; ')}` : 'BIBLIOTECA DA MARCA: vazia.',
    anterior.data ? `REUNIÃO ANTERIOR (${anterior.data.titulo}): objetivo "${ata?.objetivo ?? ''}"; assuntos: ${(ata?.assuntos ?? []).map((a) => a.tema).join('; ')}. Retome o que foi combinado e diga o que aconteceu, se a pauta mostrar.` : '',
  ].filter(Boolean).join('\n\n')
}

const SISTEMA = [
  'Você é o Agente de Marketing de uma empresa brasileira, no papel de social media, numa REUNIÃO DE PAUTA com a equipe.',
  'O objetivo da reunião é decidir JUNTOS o que postar no período e por quê, antes de gerar qualquer conteúdo. Você não escreve legendas nem roteiros aqui.',
  'Como conduzir:',
  '- Na abertura (a equipe ainda não falou nada além do escopo): no máximo 3 tópicos curtos com o que a pauta mostra de mais importante (o que já está planejado para o período, campanha e fase dela, resultado se houver) e UMA pergunta: o que a equipe quer para o período. Se a equipe trouxe um assunto, comece por ele. Não proponha a lista de peças antes de ouvir a equipe; nas opções rápidas pode oferecer uma sugestão sua.',
  '- Use só os dados da pauta. Se não houver resultado dos posts, diga isso com honestidade e não invente desempenho, números, preços nem datas.',
  '- Uma pergunta por vez, com opções rápidas para clicar. Defenda suas sugestões com dado, mas quem decide é a equipe.',
  '- Evite repetir assuntos que saíram nas últimas semanas, a não ser que tenham ido bem ou que a equipe peça.',
  '- Atualize a ata a cada resposta com o estado atual do combinado (período, canais e formatos com quantidade, assuntos com o porquê, o que evitar). Só entra o que a equipe disse ou aceitou; sugestão sua ainda não aceita NÃO entra. Peças que já estão planejadas na pauta não entram como assunto (já existem); cite-as só na conversa.',
  '- Reunião de um dia ("algo para hoje"): seja rápido, 2 ou 3 trocas, de 1 a 3 peças.',
  '- Quando a ata estiver completa e a equipe quiser seguir, diga que é só clicar em "Montar o plano".',
].join('\n')

export async function reunir(d: Dependencias, db: SupabaseClient, empresa: string, corpo: { id?: string; escopo?: Escopo; mensagens?: Mensagem[]; ata?: Record<string, unknown> }) {
  const e = corpo.escopo
  if (!e?.inicio || !e?.fim) throw new Error('Escolha o período da reunião.')
  const { chave, pa, modelo } = await d.prepararAgente(db, empresa, 'marketing')
  const mensagens = (corpo.mensagens ?? []).filter((m) => m.texto?.trim()).slice(-24)
  // campanha encerrada não entra na pauta (continua valendo se foi a escolhida na reunião)
  const todas = (Array.isArray(pa.campanhas) ? pa.campanhas : []) as (Campanha & { encerrada?: boolean })[]
  const campanha = todas.find((c) => c.id === e.campanha)
  const campanhas = todas.filter((c) => !c.encerrada || c.id === e.campanha)
  const pauta = await levantarPauta(db, d, empresa, e, campanhas, corpo.id)
  const ultimas = mensagens.filter((m) => m.de === 'equipe').slice(-3).map((m) => m.texto)
  const kn = await d.conhecimento(db, empresa, [e.texto, campanha?.nome, campanha?.descricao, ...ultimas].filter(Boolean).join(' '), 4)
  const sistema = [SISTEMA, `CANAIS QUE A EMPRESA USA (só estes): ${d.canais(pa)}`, ...d.blocoEmpresa(pa as Record<string, string>, [])].join('\n')
  const usuario = [
    kn.bloco,
    `ESCOPO DA REUNIÃO: planejar ${NOME_ESCOPO[e.tipo]} — de ${dm(e.inicio)} a ${dm(e.fim)} (${e.inicio} a ${e.fim}).${campanha ? ` Campanha: ${campanha.nome}.` : ''}${e.texto ? ` O que a equipe trouxe: ${e.texto}` : ''}`,
    `PAUTA (o que você levantou antes da reunião):\n${pauta}`,
    `ATA ATUAL: ${JSON.stringify(corpo.ata ?? {})}`,
    mensagens.length ? `CONVERSA ATÉ AGORA:\n${mensagens.map((m) => `${m.de === 'equipe' ? 'EQUIPE' : 'AGENTE'}: ${m.texto}`).join('\n')}` : 'A reunião está começando: faça a abertura.',
    'Responda chamando OBRIGATORIAMENTE a ferramenta responder_reuniao.',
  ].filter(Boolean).join('\n\n')
  const { entrega, entrada, saida } = await d.chamarClaude(chave, modelo, sistema, usuario, ferramentaReuniao(d.redes, d.tipos))
  const r = entrega as { resposta?: string; opcoes?: string[]; ata?: Record<string, unknown>; pronta?: boolean }
  const gasto = d.custo(modelo, entrada, saida)
  // o custo entra no Histórico e no limite do mês, como qualquer trabalho
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'marketing', tipo: 'reuniao', status: 'pronto', pedido: { reuniao: corpo.id ?? null, ultima: mensagens.at(-1)?.texto.slice(0, 300) ?? 'abertura' }, resumo: (r.resposta ?? '').slice(0, 200), modelo, tokens_entrada: entrada, tokens_saida: saida, custo_usd: gasto, terminado_em: new Date().toISOString() })
  return { resposta: r.resposta ?? '', opcoes: (r.opcoes ?? []).slice(0, 3), ata: r.ata ?? corpo.ata ?? {}, pronta: r.pronta === true, fontes: kn.fontes }
}

// a ata vira instrução para o propor_plano (o calendário segue o que foi decidido na reunião)
export function blocoAta(ata: Record<string, unknown> | undefined) {
  if (!ata || typeof ata !== 'object') return ''
  const a = ata as { objetivo?: string; publico?: string; canais?: { rede: string; formatos?: string[]; quantidade?: number }[]; assuntos?: { tema: string; porque?: string; rede?: string; tipo?: string; dia?: string }[]; evitar?: string[]; observacoes?: string }
  return [
    'ATA DA REUNIÃO DE PAUTA (o que a equipe decidiu; siga):',
    a.objetivo ? `Objetivo: ${a.objetivo}` : '',
    a.publico ? `Público: ${a.publico}` : '',
    a.canais?.length ? `Quantidade combinada por canal (respeite): ${a.canais.map((c) => `${c.rede}: ${c.quantidade ?? '?'} peça(s) (${(c.formatos ?? []).join(', ')})`).join('; ')}` : '',
    a.assuntos?.length ? `Assuntos combinados (cada um vira pelo menos uma peça; use o porquê no ângulo):\n${a.assuntos.map((s) => `- ${s.tema}${s.porque ? ` — porque ${s.porque}` : ''}${s.rede || s.tipo || s.dia ? ` [${[s.rede, s.tipo, s.dia].filter(Boolean).join(' · ')}]` : ''}`).join('\n')}` : '',
    a.evitar?.length ? `Evitar: ${a.evitar.join('; ')}` : '',
    a.observacoes ? `Observações: ${a.observacoes}` : '',
  ].filter(Boolean).join('\n')
}
