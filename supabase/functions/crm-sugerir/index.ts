// "Sugerir com IA" na conversa do Atendimento: lê as últimas mensagens e as respostas prontas da empresa e escreve um
// rascunho da próxima resposta. Não envia nada: o texto volta para a caixa de escrever e a pessoa revisa antes.
// Entrada (usuário logado, membro da empresa): { conversa_id }. Saída: { texto }.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const PRECO: Record<string, { entrada: number; saida: number }> = { 'claude-sonnet-5-5': { entrada: 2, saida: 10 }, 'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 } }

const SISTEMA = [
  'Você escreve o rascunho da próxima mensagem de WhatsApp de um atendente humano para um cliente. O atendente vai revisar antes de enviar.',
  'Responda à última mensagem do cliente, no mesmo tom da conversa: educado, próximo, curto (1 a 4 frases), sem formalidade excessiva.',
  'Use só o que está na conversa e nas respostas prontas da empresa. Não invente preço, data, link, condição ou promessa: se faltar uma informação, escreva o texto com um marcador entre colchetes, como [data da turma].',
  'Não use a palavra "grátis". No máximo um emoji, e só se a conversa já usar.',
  'Devolva só o texto da mensagem, sem aspas e sem explicação.',
].join('\n')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { conversa_id } = await req.json().catch(() => ({}))
    // a leitura pelo usuário respeita as permissões: só quem é da empresa enxerga a conversa
    const { data: conv } = await usuario.from('crm_conversas').select('id, empresa_id, contato:crm_contatos(nome)').eq('id', String(conversa_id ?? '')).maybeSingle()
    if (!conv) return json({ erro: 'Conversa não encontrada.' }, 404)
    const empresa = String(conv.empresa_id)
    const [{ data: msgs }, { data: resp }, { data: chave }, { data: ac }] = await Promise.all([
      db.from('crm_mensagens').select('direcao, texto, tipo, criado_em').eq('conversa_id', conv.id).order('criado_em', { ascending: false }).limit(25),
      db.from('crm_respostas').select('atalho, texto').eq('empresa_id', empresa).limit(40),
      db.rpc('agentes_ler_chave', { p_empresa: empresa }),
      db.from('agentes_config').select('modelo').eq('empresa_id', empresa).maybeSingle(),
    ])
    if (!chave) return json({ erro: 'Falta a chave do Claude em Agentes → Configurações.' }, 400)
    if (!msgs?.length) return json({ erro: 'Ainda não há mensagens nesta conversa.' }, 400)
    const modelo = ac?.modelo && PRECO[ac.modelo] ? ac.modelo : 'claude-sonnet-5-5'
    const conversa = [...msgs].reverse().map((m) => `${m.direcao === 'entrada' ? 'CLIENTE' : 'NÓS'}: ${m.texto?.trim() || `[${m.tipo}]`}`).join('\n')
    const prontas = (resp ?? []).map((r) => `/${r.atalho}: ${r.texto}`).join('\n')
    const nome = (conv.contato as { nome?: string } | null)?.nome ?? ''
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: 600, system: SISTEMA,
        messages: [{ role: 'user', content: `CLIENTE: ${nome || '(sem nome)'}\n\nRESPOSTAS PRONTAS DA EMPRESA\n${prontas || '(nenhuma)'}\n\nCONVERSA (a última é a mais recente)\n${conversa}\n\nEscreva a próxima mensagem.` }] }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return json({ erro: `IA: ${d?.error?.message ?? r.status}` }, 502)
    const texto = ((d.content ?? []) as { type: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    const custo = (Number(d.usage?.input_tokens ?? 0) * PRECO[modelo].entrada + Number(d.usage?.output_tokens ?? 0) * PRECO[modelo].saida) / 1e6
    await db.from('agentes_trabalhos').insert({ empresa_id: empresa, agente_id: 'atendimento', tipo: 'sugestao', status: 'pronto', pedido: { conversa: conv.id },
      resumo: `Sugestão de resposta para ${nome || 'contato'}`, modelo, tokens_entrada: d.usage?.input_tokens ?? 0, tokens_saida: d.usage?.output_tokens ?? 0,
      custo_usd: Math.round(custo * 10000) / 10000, terminado_em: new Date().toISOString() })
    return json({ texto })
  } catch (e) {
    return json({ erro: (e as Error).message }, 500)
  }
})
