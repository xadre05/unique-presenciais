// Análise dos posts do Instagram pelo Claude (19/10/2026): o que funcionou e por quê, no período e formato escolhidos
// na tela. Com mais de um ano no filtro, compara os anos (quantidade, alcance mediano, salvos e compartilhamentos por
// formato) e explica a diferença pelo conteúdo. Não sabe se um post foi impulsionado: o dado do Instagram não diz.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

export type Filtro = { de?: string; ate?: string; tipo?: string }
type Post = { tipo: string; legenda: string | null; publicado_em: string; metricas: Record<string, number> }

const FERRAMENTA = {
  name: 'entregar_analise',
  description: 'Entrega a análise dos posts do Instagram para a equipe.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Duas ou três frases com a leitura geral do período.' },
      comparacao: { type: 'array', items: { type: 'string' }, description: 'Só se o período tiver mais de um ano: o que mudou de um ano para o outro e por quê (conteúdo, formato, frequência), com os números' },
      funcionou: { type: 'array', items: { type: 'object', properties: { padrao: { type: 'string' }, porque: { type: 'string', description: 'O dado que mostra (compare com a mediana)' }, exemplos: { type: 'array', items: { type: 'string' }, description: 'Datas e começo da legenda dos posts que provam' } }, required: ['padrao', 'porque'] } },
      nao_funcionou: { type: 'array', items: { type: 'object', properties: { padrao: { type: 'string' }, porque: { type: 'string' }, exemplos: { type: 'array', items: { type: 'string' } } }, required: ['padrao', 'porque'] } },
      recomendacoes: { type: 'array', items: { type: 'string' }, description: 'O que fazer nas próximas semanas, em frases curtas e práticas' },
      aprendizados: { type: 'array', items: { type: 'string' }, description: 'Regras curtas para o agente seguir ao criar conteúdo (ex.: "Carrossel educativo com 7+ lâminas tem o dobro de salvos")' },
    },
    required: ['resumo', 'funcionou', 'nao_funcionou', 'recomendacoes', 'aprendizados'],
  },
}
const PRECO: Record<string, [number, number]> = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] }
const num = (p: Post, k: string) => Number(p.metricas[k] ?? 0)
const mediana = (ns: number[]) => { const v = ns.filter((n) => n > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0 }
const media = (ps: Post[], k: string) => Math.round(ps.reduce((s, p) => s + num(p, k), 0) / Math.max(1, ps.length))
const linha = (p: Post) => `- ${p.publicado_em.slice(0, 10)} · ${p.tipo} · ${Object.entries(p.metricas).map(([k, v]) => `${k} ${v}`).join(' · ')} · "${String(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 220)}"`

// números por ano e formato: base para comparar períodos sem mandar todos os posts
function quadroAnos(lista: Post[]) {
  const anos = [...new Set(lista.map((p) => p.publicado_em.slice(0, 4)))].sort()
  const tipos = [...new Set(lista.map((p) => p.tipo))]
  return anos.flatMap((a) => {
    const doAno = lista.filter((p) => p.publicado_em.startsWith(a))
    return [`${a}: ${doAno.length} posts · alcance mediano ${mediana(doAno.map((p) => num(p, 'alcance')))} · salvos/post ${media(doAno, 'salvos')} · compart./post ${media(doAno, 'compartilhamentos')}`,
      ...tipos.map((t) => { const ps = doAno.filter((p) => p.tipo === t); return ps.length ? `  ${t}: ${ps.length} · alcance mediano ${mediana(ps.map((p) => num(p, 'alcance')))} · salvos/post ${media(ps, 'salvos')} · compart./post ${media(ps, 'compartilhamentos')}` : '' }).filter(Boolean)]
  }).join('\n')
}

// posts que entram no pedido: os de mais alcance, os de menos e os mais recentes (sem repetir)
function amostra(lista: Post[]) {
  if (lista.length <= 80) return lista
  const porAlcance = [...lista].sort((a, b) => num(b, 'alcance') - num(a, 'alcance'))
  const escolhidos = new Set([...porAlcance.slice(0, 30), ...porAlcance.slice(-15), ...lista.slice(0, 25)])
  return [...escolhidos].sort((a, b) => b.publicado_em.localeCompare(a.publicado_em))
}

export async function analisar(db: SupabaseClient, empresa: string, f: Filtro) {
  let q = db.from('marca_posts').select('tipo,legenda,publicado_em,metricas').eq('empresa_id', empresa).eq('rede', 'instagram')
  if (f.de) q = q.gte('publicado_em', f.de)
  if (f.ate) q = q.lte('publicado_em', f.ate + 'T23:59:59Z')
  if (f.tipo) q = q.eq('tipo', f.tipo)
  const [{ data: posts }, { data: chave }, { data: cfg }, { data: ag }] = await Promise.all([
    q.order('publicado_em', { ascending: false }).limit(1500),
    db.rpc('agentes_ler_chave', { p_empresa: empresa }),
    db.from('agentes_config').select('modelo').eq('empresa_id', empresa).maybeSingle(),
    db.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle(),
  ])
  if (!chave) throw new Error('Falta cadastrar a chave do Claude em Agentes → Configurações.')
  const lista = (posts ?? []) as Post[]
  if (lista.length < 5) throw new Error('Há poucos posts neste filtro para analisar (mínimo 5).')
  const pa = (ag?.perfil ?? {}) as Record<string, unknown>
  const modelo = (typeof pa.modelo === 'string' && PRECO[pa.modelo] ? pa.modelo : null) ?? (cfg?.modelo && PRECO[cfg.modelo] ? cfg.modelo : 'claude-sonnet-5-5')
  const med = mediana(lista.map((p) => num(p, 'alcance')))
  const varios = new Set(lista.map((p) => p.publicado_em.slice(0, 4))).size > 1
  const escolhidos = amostra(lista)
  const sistema = [
    `Você é analista de social media de uma empresa brasileira (${String(pa.empresa ?? '')}: ${String(pa.o_que_vende ?? '').slice(0, 300)}). Analise os posts do Instagram e diga, com base nos números, o que funcionou, o que não funcionou e por quê, e o que fazer a seguir.`,
    `Compare cada post com a mediana de alcance do período (${med}) e olhe também salvos e compartilhamentos (sinal de conteúdo útil). Não invente números: use só os dados abaixo.`,
    varios ? 'O período tem mais de um ano: preencha "comparacao" explicando o que mudou entre os anos e por quê (assunto, gancho, formato, frequência), com os números do quadro.' : '',
    'Os números vêm do Instagram e não dizem se um post foi impulsionado (anúncio). Se um post fugir muito do padrão sem motivo de conteúdo, diga que pode ter sido impulsionado e que a equipe deve confirmar; não afirme.',
    'Português do Brasil, direto e prático.',
  ].filter(Boolean).join('\n')
  const usuario = [
    `PERÍODO: ${f.de ?? 'início'} a ${f.ate ?? 'hoje'}${f.tipo ? ` · só ${f.tipo}` : ''} · ${lista.length} posts.`,
    `NÚMEROS POR ANO E FORMATO:\n${quadroAnos(lista)}`,
    `POSTS (${escolhidos.length}${escolhidos.length < lista.length ? ` de ${lista.length}: os de mais e de menos alcance e os mais recentes` : ''}, do mais novo ao mais antigo):\n${escolhidos.map(linha).join('\n')}`,
    'Entregue OBRIGATORIAMENTE chamando a ferramenta entregar_analise.',
  ].join('\n\n')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: 8000, system: sistema, messages: [{ role: 'user', content: usuario }], tools: [FERRAMENTA], tool_choice: { type: 'auto' } }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(r.status === 401 ? 'A Anthropic recusou a chave. Confira em Agentes → Configurações.' : `Claude respondeu ${r.status}: ${d?.error?.message ?? ''}`)
  const entrega = (d.content ?? []).find((b: { type: string }) => b.type === 'tool_use')?.input
  if (!entrega) throw new Error('O agente não entregou a análise. Tente de novo.')
  const [pe, ps] = PRECO[modelo], ent = Number(d.usage?.input_tokens ?? 0), sai = Number(d.usage?.output_tokens ?? 0)
  const custo = Math.round(((ent * pe + sai * ps) / 1_000_000) * 10000) / 10000
  await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'marketing', tipo: 'analise', status: 'pronto', pedido: { posts: lista.length, filtro: f }, resumo: String(entrega.resumo ?? '').slice(0, 200), modelo, tokens_entrada: ent, tokens_saida: sai, custo_usd: custo, terminado_em: new Date().toISOString() })
  return { ...entrega, em: new Date().toISOString(), posts: lista.length, mediana: med, filtro: f }
}
