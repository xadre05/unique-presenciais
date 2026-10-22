// Agente de Cobrança (WhatsApp). Conversa sozinho com quem deve, com os dados reais da dívida (Hotmart + notificação):
// tira dúvidas, manda segunda via, fecha acordo dentro dos limites (Cobranças → Configurações) e, quando
// não pode resolver (contestação, "já paguei", fora dos limites), avisa a equipe e para de insistir naquele ponto.
// Ações:
//   responder  sistema (x-cron-chave, chamado pelo crm-whatsapp quando chega mensagem no número da cobrança) {conversa_id, mensagem_id}
//   avisar     sistema (x-cron-chave, chamado pela notificacao) {telefone, nome, texto} → manda o aviso inicial pelo número da cobrança
//   simular    administrador {cobranca_id, texto} → finge ser a pessoa no número de teste e devolve a resposta da IA
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { config, contexto, ficha, type Cfg, type Contexto } from './dados.ts'
import { cancelarBoleto, emitirBoleto, enderecoBoleto, interPronto, usarInter } from './inter.ts'
import { boletoAsaas, cancelarAsaas } from './asaas.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-chave', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const EMPRESA = 'a0000000-0000-4000-8000-000000000001'
const PRECO: Record<string, { entrada: number; saida: number }> = { 'claude-sonnet-5-5': { entrada: 2, saida: 10 }, 'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 } }
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
const somaDias = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10)
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

const SISTEMA = [
  'Você é o assistente de cobrança da Unique HOF Academy (escola de harmonização orofacial) no WhatsApp. Fala com alunos que têm parcelas de cursos em aberto.',
  'Tom: educado, humano, curto (mensagens de WhatsApp, 1 a 4 frases), firme e sem constranger. Nunca ameace, nunca humilhe, nunca fale da dívida com outra pessoa além do próprio aluno, nunca use caixa alta para pressionar. Não use emojis em excesso (no máximo um, e só se combinar). Não use a palavra "grátis".',
  'Use SÓ os dados da ficha (valores, datas, boleto, Pix). Nunca invente valor, data, desconto ou promessa. Se perguntarem como chegou no valor: são as parcelas vencidas e não pagas, com multa e juros de mora desde o vencimento de cada uma.',
  'Se perguntarem se é um robô, diga com honestidade que é o assistente virtual da equipe de cobrança.',
  'Segunda via: mande o link do boleto e o Pix copia e cola da ficha.',
  'Acordo: só ofereça quando a pessoa pedir desconto, disser que não consegue pagar o valor ou pedir para negociar. Ofereça exatamente o que os LIMITES DO ACORDO permitem (ex.: pagar à vista só o valor das parcelas, sem multa e juros, com vencimento até a data limite). Se ela aceitar e disser a data (dentro do limite), use acao="acordo" com vencimento_acordo; se não disser data, use a data limite. Parcelamento: se os limites disserem que não pode, explique com gentileza que a condição especial é só à vista.',
  'Se a pessoa disser que já pagou: peça o comprovante (pode mandar por aqui ou para o e-mail da ficha) e use acao="pagou". Se ela mandar uma imagem ou documento depois de falar de pagamento, agradeça, diga que a equipe vai conferir e use acao="pagou".',
  'Se a pessoa contestar a dívida (diz que cancelou, pediu reembolso, nunca comprou, não reconhece, foi cobrada em dobro, fala em advogado ou Procon): não discuta, diga que vai encaminhar para a equipe verificar e use acao="contestou" com o motivo.',
  'Se pedir algo fora dos limites ou que você não sabe responder com a ficha: diga que vai verificar com a equipe e use acao="humano" com o motivo.',
  'Se pedir para não receber mais mensagens: respeite, diga que anotou e que dúvidas e comprovantes podem ir para o e-mail da ficha; use acao="parar".',
  'Se não houver dívida na ficha para este número: diga que não encontrou débito neste número e peça o nome completo e o e-mail da compra; use acao="humano".',
  'Se a última mensagem da pessoa só agradece ou encerra (ok, obrigado), responda curto ou deixe resposta vazia.',
  'Sempre responda chamando a ferramenta agir.',
].join('\n')

const FERRAMENTA = {
  name: 'agir', description: 'A resposta para a pessoa e o que o sistema deve fazer.',
  input_schema: { type: 'object', required: ['resposta', 'acao'], properties: {
    resposta: { type: 'string', description: 'A mensagem de WhatsApp para a pessoa (vazia = não responder)' },
    acao: { type: 'string', enum: ['nenhuma', 'acordo', 'pagou', 'contestou', 'humano', 'parar'] },
    vencimento_acordo: { type: 'string', description: 'Só no acordo: AAAA-MM-DD, dentro do limite' },
    motivo: { type: 'string', description: 'Para pagou/contestou/humano/parar: uma frase para a equipe' },
  } },
}

async function perguntarIA(db: SupabaseClient, c: Contexto, cfg: Cfg) {
  const [{ data: chave }, { data: ac }] = await Promise.all([db.rpc('agentes_ler_chave', { p_empresa: EMPRESA }), db.from('agentes_config').select('modelo').eq('empresa_id', EMPRESA).maybeSingle()])
  if (!chave) throw new Error('Falta a chave do Claude em Agentes → Configurações.')
  const modelo = ac?.modelo && PRECO[ac.modelo] ? ac.modelo : 'claude-sonnet-5-5'
  const conversa = c.historico.map((m) => `${m.de === 'pessoa' ? 'PESSOA' : 'NÓS'}: ${m.texto}`).join('\n')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': String(chave), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: 1200, system: SISTEMA, tools: [FERRAMENTA], tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: `FICHA\n${ficha(c, cfg, hoje())}\n\nCONVERSA (a última é a mais recente)\n${conversa}\n\nResponda à última mensagem da pessoa.` }] }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`IA: ${d?.error?.message ?? r.status}`)
  // se o modelo responder em texto em vez de chamar a ferramenta, o texto vira a resposta (sem ação)
  const blocos = (d.content ?? []) as { type: string; input?: unknown; text?: string }[]
  const e = (blocos.find((b) => b.type === 'tool_use')?.input ?? { resposta: blocos.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(), acao: 'nenhuma' }) as { resposta?: string; acao?: string; vencimento_acordo?: string; motivo?: string }
  const custo = (Number(d.usage?.input_tokens ?? 0) * PRECO[modelo].entrada + Number(d.usage?.output_tokens ?? 0) * PRECO[modelo].saida) / 1e6
  await db.from('agentes_trabalhos').insert({ empresa_id: EMPRESA, agente_id: 'cobranca', tipo: 'resposta', status: 'pronto', pedido: { conversa: c.conversa },
    resumo: `${c.nome ?? c.telefone}: ${e.acao ?? '?'} — ${String(e.resposta ?? '').slice(0, 120)}`, modelo, tokens_entrada: d.usage?.input_tokens ?? 0, tokens_saida: d.usage?.output_tokens ?? 0,
    custo_usd: Math.round(custo * 10000) / 10000, terminado_em: new Date().toISOString() })
  return e
}

const registrar = (db: SupabaseClient, ids: string[], resultado: string, observacao: string | null) =>
  db.from('cobranca_contatos').insert(ids.map((id) => ({ cobranca_id: id, canal: 'whatsapp', resultado, observacao, quem_nome: 'IA de cobrança' })))
const pedirAjuda = (db: SupabaseClient, ids: string[], motivo: string) =>
  db.from('cobrancas').update({ ia_atencao: motivo.slice(0, 300), ia_atencao_em: new Date().toISOString() }).in('id', ids)

// acordo: boleto novo (à vista, sem multa e juros se permitido) no Inter, ou no Asaas se o Inter não estiver configurado;
// cancela o boleto anterior (menos o que já foi para negativação)
async function fecharAcordo(db: SupabaseClient, c: Contexto, cfg: Cfg, vencPedido: string | undefined) {
  const dia = hoje(), limite = somaDias(dia, cfg.acordo_prazo_max_dias)
  const venc = vencPedido && /^\d{4}-\d{2}-\d{2}$/.test(vencPedido) && vencPedido >= dia && vencPedido <= limite ? vencPedido : limite
  const valorDe = (x: Contexto['dividas'][number]) => (cfg.acordo_tira_encargos ? x.principal : x.total)
  const valor = Math.round(c.dividas.reduce((s, x) => s + valorDe(x), 0) * 100) / 100
  const ids = c.dividas.map((x) => x.id)
  if (!(valor >= 2.5)) return { texto: '', erro: 'valor do acordo inválido' }
  const [{ data: cred }, { data: credAsaas }] = await Promise.all([db.rpc('ler_credenciais_integracao', { p_integracao: 'inter' }), db.rpc('ler_credenciais_integracao', { p_integracao: 'asaas' })])
  const kAsaas = String(credAsaas?.api_key ?? '')
  const usaInter = interPronto(cred ?? {})
  const { data: conf } = await db.from('v_cobranca_conferencia').select('cpf').in('cobranca_id', ids).not('cpf', 'is', null).limit(1).maybeSingle()
  const { data: cob } = await db.from('cobrancas').select('email, aluno_nome, telefone').eq('id', ids[0]).single()
  const { data: hc } = await db.from('hotmart_compradores').select('documento, endereco').eq('email', String(cob?.email ?? '').toLowerCase()).maybeSingle()
  const cpf = String(conf?.cpf ?? hc?.documento ?? '').replace(/\D/g, '')
  const motivoSem = !usaInter && !kAsaas ? 'nenhum banco configurado (Inter ou Asaas)' : cpf.length !== 11 && cpf.length !== 14 ? 'sem CPF'
    : usaInter && !enderecoBoleto(hc?.endereco ?? null) ? 'sem endereço completo' : null
  const agora = new Date().toISOString()
  const base = { etapa: 'acordo', acordo_em: agora, acordo_forma: 'à vista pelo WhatsApp (IA)', acordo_parcelas: 1, acordo_primeiro_venc: venc, atualizado_em: agora }
  const dataBR = venc.split('-').reverse().join('/')
  if (motivoSem) {
    for (const x of c.dividas) await db.from('cobrancas').update({ ...base, acordo_valor: valorDe(x) }).eq('id', x.id)
    await registrar(db, ids, `Acordo aceito pelo WhatsApp: ${brl(valor)} até ${dataBR}`, `Boleto não gerado automaticamente (${motivoSem}).`)
    await pedirAjuda(db, ids, `Acordo aceito (${brl(valor)} até ${dataBR}): gerar e mandar o boleto (${motivoSem})`)
    return { texto: 'Combinado! Vou gerar o boleto com esse valor e te mando aqui ainda hoje.' }
  }
  const grupo = crypto.randomUUID()
  const produtos = c.dividas.map((d) => d.produto).join(', ')
  const pessoa = { nome: String(cob?.aluno_nome ?? c.nome ?? ''), cpf, email: String(cob?.email ?? ''), telefone: String(cob?.telefone ?? c.telefone), end: hc?.endereco ?? null }
  // boleto anterior que ainda pode ser cancelado (o que já foi pedido para negativação fica)
  const antigos = (banco: string) => [...new Set(c.dividas.filter((d) => d.boleto_banco === banco && d.boleto_id && !String(d.fase_legal ?? '').startsWith('negativ')).map((d) => d.boleto_id!))]
  let novo: { id: string; banco: string; url: string; linha: string | null; pix: string | null }
  if (usaInter) {
    const b = await usarInter(cred, async (x) => {
      const n = await emitirBoleto(x, { seuNumero: grupo.replace(/-/g, '').slice(0, 15), valor, vencimento: venc, pagador: pessoa,
        linhas: [`Acordo: ${produtos}`.slice(0, 78), cfg.acordo_tira_encargos ? 'Pagamento à vista sem multa e juros, conforme acordo pelo WhatsApp.' : 'Acordo feito pelo WhatsApp.'] })
      for (const id of antigos('inter')) await cancelarBoleto(x, id, 'Substituído por acordo').catch(() => null)
      return n
    })
    let url = ''
    if (b.pdf) {
      const caminho = `cobranca/boletos/${grupo}.pdf`
      const { error } = await db.storage.from('arquivos').upload(caminho, new Blob([b.pdf], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true })
      if (!error) url = (await db.storage.from('arquivos').createSignedUrl(caminho, 90 * 86400)).data?.signedUrl ?? ''
    }
    novo = { id: b.codigo, banco: 'inter', url, linha: b.linha, pix: b.pix || null }
  } else {
    const b = await boletoAsaas(kAsaas, { ...pessoa, ref: ids[0] }, valor, venc, `Acordo — ${produtos}`, grupo)
    for (const id of antigos('asaas')) await cancelarAsaas(kAsaas, id).catch(() => null)
    novo = { id: b.id, banco: 'asaas', url: b.url, linha: null, pix: null }
  }
  for (const x of c.dividas) {
    await db.from('cobrancas').update({ ...base, acordo_valor: valorDe(x), boleto_id: novo.id, boleto_banco: novo.banco, boleto_url: novo.url || null, boleto_linha: novo.linha, boleto_pix: novo.pix,
      boleto_valor: valorDe(x), boleto_principal: x.principal, boleto_encargos: cfg.acordo_tira_encargos ? 0 : x.encargos, prazo_ate: venc, notificacao_grupo: grupo }).eq('id', x.id)
  }
  await registrar(db, ids, `Acordo fechado pelo WhatsApp: ${brl(valor)} à vista até ${dataBR} (boleto novo no ${novo.banco === 'inter' ? 'Inter' : 'Asaas'})`, null)
  const pagar = novo.banco === 'asaas' ? `Pague por boleto ou Pix neste link: ${novo.url}` : novo.url || `Linha digitável: ${novo.linha}`
  return { texto: [`Pronto! Boleto de ${brl(valor)} com vencimento em ${dataBR}:`, pagar, novo.pix ? `Pix copia e cola: ${novo.pix}` : ''].filter(Boolean).join('\n') }
}

async function enviarWhats(url: string, chave: string, corpo: Record<string, unknown>) {
  const r = await fetch(`${url}/functions/v1/crm-whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-chave': chave }, body: JSON.stringify({ acao: 'enviar_sistema', ...corpo }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.erro) throw new Error(d.erro ?? `WhatsApp ${r.status}`)
  return d as { conversa: string }
}

// responde a última mensagem da pessoa (espera alguns segundos para juntar mensagens seguidas)
async function responder(db: SupabaseClient, url: string, chave: string, conversaId: string, mensagemId: string | null, aguardar = true) {
  const cfg = await config(db)
  if (!cfg.ia_ligada) return { pulou: 'IA desligada' }
  const { data: conv } = await db.from('crm_conversas').select('canal_id').eq('id', conversaId).single()
  if (conv?.canal_id !== cfg.ia_canal_id) return { pulou: 'outro número' }
  if (aguardar) await espera(6000)
  const { data: ultima } = await db.from('crm_mensagens').select('id').eq('conversa_id', conversaId).eq('direcao', 'entrada').order('criado_em', { ascending: false }).limit(1).single()
  if (mensagemId && ultima?.id !== mensagemId) return { pulou: 'chegou outra mensagem depois' }
  await db.from('crm_conversas').update({ com_ia: true, atendente_id: null }).eq('id', conversaId)
  const c = await contexto(db, conversaId)
  if (!c) return { pulou: 'sem conversa' }
  const e = await perguntarIA(db, c, cfg)
  const ids = c.dividas.map((x) => x.id)
  let texto = String(e.resposta ?? '').trim()
  if (e.acao === 'acordo' && c.dividas.length) {
    const r = await fecharAcordo(db, c, cfg, e.vencimento_acordo)
    texto = [texto, r.texto].filter(Boolean).join('\n\n')
  } else if (e.acao === 'pagou' && ids.length) {
    await registrar(db, ids, 'Disse pelo WhatsApp que já pagou', e.motivo ?? null)
    await pedirAjuda(db, ids, `Disse que já pagou: conferir o comprovante. ${e.motivo ?? ''}`.trim())
  } else if (e.acao === 'contestou' && ids.length) {
    await registrar(db, ids, 'Contestou a dívida pelo WhatsApp', e.motivo ?? null)
    await pedirAjuda(db, ids, `Contestou: ${e.motivo ?? 'ver a conversa'}`)
  } else if (e.acao === 'humano') {
    if (ids.length) { await registrar(db, ids, 'A IA pediu ajuda da equipe', e.motivo ?? null); await pedirAjuda(db, ids, e.motivo ?? 'ver a conversa') }
  } else if (e.acao === 'parar') {
    await db.from('crm_contatos').update({ nao_contatar: true, nao_contatar_em: new Date().toISOString(), nao_contatar_motivo: 'Pediu à IA de cobrança para não receber mensagens' }).eq('id', c.contato)
    if (ids.length) { await registrar(db, ids, 'Pediu para não receber mais mensagens', e.motivo ?? null); await pedirAjuda(db, ids, 'Pediu para não receber mais WhatsApp') }
  }
  if (texto) await enviarWhats(url, chave, { conversa_id: conversaId, texto })
  if (texto && ids.length) await registrar(db, ids, 'Resposta da IA de cobrança pelo WhatsApp', texto)
  return { acao: e.acao, resposta: texto }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  try {
    const corpo = await req.json().catch(() => ({}))
    const { data: chave } = await db.rpc('crm_chave_cron')
    const sistema = !!chave && req.headers.get('x-cron-chave') === chave

    if (corpo.acao === 'responder' && sistema) return json(await responder(db, url, String(chave), String(corpo.conversa_id), corpo.mensagem_id ? String(corpo.mensagem_id) : null))

    if (corpo.acao === 'avisar' && sistema) {
      const cfg = await config(db)
      if (!cfg.ia_ligada || !cfg.ia_canal_id) return json({ pulou: 'IA desligada' })
      // número de teste (simulador): não manda o aviso de uma carta de verdade para lá, e a cobrança não fica como avisada
      const { data: canalIA } = await db.from('crm_canais').select('tipo').eq('id', cfg.ia_canal_id).maybeSingle()
      if (!canalIA || canalIA.tipo === 'teste') return json({ pulou: 'número da IA é o de teste' })
      return json(await enviarWhats(url, String(chave), { canal_id: cfg.ia_canal_id, telefone: corpo.telefone, nome: corpo.nome, texto: corpo.texto }))
    }

    // daqui para baixo: administrador (teste na tela)
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: admin } = await usuario.rpc('is_admin')
    if (admin !== true) return json({ erro: 'Só o administrador.' }, 403)

    if (corpo.acao === 'simular') {
      // a pessoa "escreve" no número de teste; a IA responde na hora (sem esperar)
      const cfg = await config(db)
      const { data: canal } = await db.from('crm_canais').select('id, tipo').eq('id', cfg.ia_canal_id ?? '').maybeSingle()
      if (!canal || canal.tipo !== 'teste') return json({ erro: 'Para testar, escolha o "Número de teste (simulador)" como número da IA de cobrança.' }, 400)
      if (!cfg.ia_ligada) return json({ erro: 'Ligue a IA de cobrança primeiro.' }, 400)
      const { data: cob } = await db.from('cobrancas').select('telefone, aluno_nome').eq('id', String(corpo.cobranca_id ?? '')).single()
      if (!cob?.telefone) return json({ erro: 'Essa cobrança não tem telefone.' }, 400)
      const { data: rec, error } = await db.rpc('crm_receber_mensagem', { p_canal: canal.id, p_telefone: String(cob.telefone).replace(/\D/g, ''), p_nome: cob.aluno_nome, p_texto: String(corpo.texto ?? ''), p_id_externo: `sim-${crypto.randomUUID()}` })
      if (error) return json({ erro: error.message }, 400)
      const r = await responder(db, url, String(chave), String(rec.conversa), String(rec.mensagem), false)
      return json({ ...r, conversa: rec.conversa })
    }
    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: (e as Error).message }, 500)
  }
})
