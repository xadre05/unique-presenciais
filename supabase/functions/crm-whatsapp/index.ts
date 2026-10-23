// ════════════════════════════════════════════════════════════════════
// CRM — WhatsApp (parte separada). Não conhece vendedora, Hotmart nem comissão.
//
// Ações (POST JSON {acao}):
//   enviar              tela (login)  {conversa_id | contato_id+canal_id | telefone+nome+canal_id} + {texto | midia | modelo}
//                                     midia = {caminho, tipo, nome?, mime?, legenda?} (arquivo já no bucket crm-midia)
//                                     modelo = {nome, idioma, parametros[]} (modelo aprovado pela Meta)
//   reenviar            tela (login)  {mensagem_id}  — tenta de novo uma mensagem que não saiu
//   transcrever         tela (login)  {mensagem_id}  — transcreve de novo um áudio
//   modelos_sincronizar tela (admin)  {canal_id}     — puxa os modelos da conta da Meta
//   modelo_criar        tela (admin)  {canal_id, nome, categoria, corpo, exemplo[]} — manda um modelo para aprovação
//   simular_entrada     tela (admin)  {canal_id, telefone, nome, texto, do_celular?}  — só no número de teste
//   processar_fila      cron (x-cron-chave) disparos, follow-ups e mensagens agendadas
//   enviar_sistema      sistema (x-cron-chave) {conversa_id | canal_id+telefone+nome?} + {texto | modelo} — mensagem de um agente de IA
// Número atendido por IA: config.ia_funcao = nome da função que responde (ex.: 'cobranca-agente'); cada mensagem que
// chega é repassada a ela ({acao:'responder', conversa_id, mensagem_id}), sem esperar a resposta.
//   webhook             provedor      ?canal=<id>&chave=<chave_webhook>  (mensagens que chegam)
// ════════════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import type { Canal, Envio, Midia, Modelo } from './conectores.ts'
import { lerWebhook, rotuloMidia, type Recebida } from './webhook.ts'
import { canalESegredos, despachar, processarAgendadas, processarCadencias, processarFila } from './filas.ts'
import { guardarRecebida, linkTemporario, transcreverGuardado } from './midia.ts'
import { criarModelo, sincronizarModelos, textoDoModelo } from './modelos.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-chave',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const emSegundoPlano = (p: Promise<unknown>) => { const rt = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime; if (rt) rt.waitUntil(p); else p.catch(() => null) }

// número atendido por um agente de IA: repassa a mensagem que chegou (a função do agente decide se e o que responder)
function repassarParaIA(canal: Canal, url: string, chave: string | null, rec: { conversa?: string; mensagem?: string } | null) {
  const funcao = String(canal.config?.ia_funcao ?? '')
  if (!funcao || !chave || !rec?.conversa) return
  emSegundoPlano(fetch(`${url}/functions/v1/${funcao}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-chave': chave }, body: JSON.stringify({ acao: 'responder', conversa_id: rec.conversa, mensagem_id: rec.mensagem }) }).then((r) => r.text()).catch(() => null))
}

async function receber(db: SupabaseClient, canal: Canal, seg: Awaited<ReturnType<typeof canalESegredos>>['seg'], m: Recebida) {
  const { data: rec } = await db.rpc('crm_receber_mensagem', { p_canal: canal.id, p_telefone: m.telefone, p_nome: m.nome, p_texto: m.texto ?? rotuloMidia(m.tipo), p_tipo: m.tipo, p_id_externo: m.id })
  if (!rec || rec.repetida) return null
  if (m.midia && rec.mensagem) emSegundoPlano(guardarRecebida(db, canal, seg, rec.mensagem, m.midia, m.tipo))
  // veio de anúncio "clique para WhatsApp": a origem fica no contato (só a primeira)
  if (m.anuncio && rec.contato) await db.from('crm_contatos').update({ primeira_origem: m.anuncio }).eq('id', rec.contato).is('primeira_origem', null)
  // resposta à pesquisa de satisfação (pedida ao resolver, vale por 48 h): só um número de 1 a 5
  const nota = /^\s*([1-5])\s*$/.exec(m.texto ?? '')?.[1]
  if (nota && rec.conversa) await db.from('crm_conversas').update({ csat_nota: Number(nota), csat_em: new Date().toISOString() }).eq('id', rec.conversa)
    .is('csat_nota', null).gt('csat_pedido_em', new Date(Date.now() - 48 * 3600e3).toISOString())
  return rec
}

async function webhook(db: SupabaseClient, url: string, req: Request, u: URL) {
  const { canal, seg } = await canalESegredos(db, u.searchParams.get('canal')!)
  // verificação da Meta (GET com hub.challenge)
  if (req.method === 'GET') return u.searchParams.get('hub.verify_token') === seg.chave_webhook ? new Response(u.searchParams.get('hub.challenge') ?? '') : json({ erro: 'chave' }, 403)
  if (canal.tipo !== 'whatsapp_oficial' && u.searchParams.get('chave') !== seg.chave_webhook) return json({ erro: 'chave' }, 403)
  const corpo = await req.json().catch(() => ({}))
  // status de conexão (servidor próprio)
  if (canal.tipo === 'whatsapp_qr' && String(corpo?.event ?? '').toLowerCase().includes('connection')) {
    const st = String(corpo?.data?.state ?? '')
    await db.from('crm_canais').update({ status: st === 'open' ? 'conectado' : st === 'connecting' ? 'conectando' : 'desconectado' }).eq('id', canal.id)
    return json({ ok: true })
  }
  const lido = lerWebhook(canal, corpo)
  const chaveIA = canal.config?.ia_funcao ? ((await db.rpc('crm_chave_cron')).data as string | null) : null
  for (const m of lido.recebidas) { const rec = await receber(db, canal, seg, m); if (rec) repassarParaIA(canal, url, chaveIA, rec) }
  for (const m of lido.ecos) await db.rpc('crm_registrar_eco', { p_canal: canal.id, p_telefone: m.telefone, p_texto: m.texto ?? rotuloMidia(m.tipo), p_tipo: m.tipo, p_id_externo: m.id })
  for (const s of lido.status) await db.rpc('crm_status_mensagem', { p_canal: canal.id, p_id_externo: s.id, p_status: s.status, p_erro: s.erro ?? null })
  // qualquer aviso do número prova que ele está vivo
  if (canal.status !== 'conectado' && (lido.recebidas.length || lido.ecos.length)) await db.from('crm_canais').update({ status: 'conectado', status_info: null }).eq('id', canal.id)
  return json({ ok: true })
}

// o que vai sair (texto, arquivo ou modelo) e o texto que fica gravado na conversa
type Pedido = { texto?: string; midia?: { caminho: string; tipo: Midia['tipo']; nome?: string; mime?: string; legenda?: string }; modelo?: Modelo }
async function montarEnvio(db: SupabaseClient, canalId: string, p: Pedido): Promise<{ envio: Envio; texto: string; extra: Record<string, unknown> }> {
  if (p.modelo) {
    const { data: mod } = await db.from('crm_modelos').select('corpo, status').eq('canal_id', canalId).eq('nome', p.modelo.nome).eq('idioma', p.modelo.idioma).maybeSingle()
    if (!mod) throw new Error('Modelo não encontrado neste número.')
    if (mod.status !== 'APPROVED') throw new Error('Esse modelo ainda não foi aprovado pela Meta.')
    const parametros = (p.modelo.parametros ?? []).map(String)
    return { envio: { modelo: { ...p.modelo, parametros } }, texto: textoDoModelo(mod.corpo, parametros), extra: { modelo: JSON.stringify({ ...p.modelo, parametros }) } }
  }
  if (p.midia?.caminho) {
    const link = await linkTemporario(db, p.midia.caminho)
    return { envio: { midia: { tipo: p.midia.tipo, link, nome: p.midia.nome, legenda: p.midia.legenda } }, texto: p.midia.legenda?.trim() || rotuloMidia(p.midia.tipo) || '[arquivo]',
      extra: { tipo: p.midia.tipo, midia_url: p.midia.caminho, midia_nome: p.midia.nome ?? null, midia_mime: p.midia.mime ?? null } }
  }
  const texto = String(p.texto ?? '').trim()
  if (!texto) throw new Error('Escreva a mensagem.')
  return { envio: { texto }, texto, extra: {} }
}

// a mesma mensagem, de novo (texto, arquivo ou modelo)
async function envioDeNovo(db: SupabaseClient, m: { texto: string | null; tipo: string; midia_url: string | null; midia_nome: string | null; modelo: string | null }): Promise<Envio> {
  if (m.modelo) return { modelo: JSON.parse(m.modelo) as Modelo }
  if (m.midia_url) return { midia: { tipo: m.tipo as Midia['tipo'], link: await linkTemporario(db, m.midia_url), nome: m.midia_nome, legenda: m.texto?.startsWith('[') ? null : m.texto } }
  return { texto: m.texto ?? '' }
}

async function contatoPorTelefone(db: SupabaseClient, empresa: string, telefone: string, nome: string | null, origem: string, tags: string[] = []) {
  const tel = telefone.replace(/\D/g, '')
  if (tel.length < 12) throw new Error('Telefone inválido: use 55 + DDD + número.')
  let { data: c } = await db.from('crm_contatos').select('id, nao_contatar').eq('empresa_id', empresa).eq('telefone', tel).is('mesclado_em', null).maybeSingle()
  if (!c) ({ data: c } = await db.from('crm_contatos').insert({ empresa_id: empresa, nome: nome || null, telefone: tel, origem, entrou_em: new Date().toISOString(), tags }).select('id, nao_contatar').single())
  if (c?.nao_contatar) throw new Error('Essa pessoa pediu para não receber mensagens.')
  return c!.id as string
}
async function conversaDe(db: SupabaseClient, empresa: string, contatoId: string, canalId: string, extra: Record<string, unknown> = {}) {
  await db.from('crm_conversas').upsert({ empresa_id: empresa, contato_id: contatoId, canal_id: canalId, ...extra }, { onConflict: 'canal_id,contato_id', ignoreDuplicates: true })
  const { data: v } = await db.from('crm_conversas').select('id').eq('canal_id', canalId).eq('contato_id', contatoId).single()
  return v!.id as string
}

async function enviarNaConversa(db: SupabaseClient, conversaId: string, pedido: Pedido, autor: 'atendente' | 'ia', autorId: string | null) {
  const { data: conv } = await db.from('crm_conversas').select('id, canal_id, contato_id').eq('id', conversaId).single()
  const { data: contato } = await db.from('crm_contatos').select('telefone').eq('id', conv!.contato_id).single()
  const { canal, seg } = await canalESegredos(db, conv!.canal_id)
  if (canal.status !== 'conectado' && canal.tipo !== 'teste') return json({ erro: `O número "${canal.nome}" não está conectado.` }, 400)
  const { envio, texto, extra } = await montarEnvio(db, canal.id, pedido)
  const { data: msgId, error } = await db.rpc('crm_registrar_saida', { p_conversa: conv!.id, p_texto: texto, p_autor: autor, p_autor_id: autorId })
  if (error) return json({ erro: error.message }, 400)
  if (Object.keys(extra).length) await db.from('crm_mensagens').update(extra).eq('id', msgId)
  const r = await despachar(db, msgId as string, canal, seg, contato!.telefone, envio)
  return json(r.ok ? { ok: true, mensagem: msgId, conversa: conv!.id } : { erro: r.erro, mensagem: msgId, conversa: conv!.id }, r.ok ? 200 : 502)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const u = new URL(req.url)
  try {
    if (u.searchParams.get('canal')) return await webhook(db, url, req, u)
    const corpo = await req.json().catch(() => ({}))
    const acao = String(corpo.acao ?? '')

    // ── sistema (cron e agentes de IA) ──
    if (acao === 'processar_fila' || acao === 'enviar_sistema') {
      const { data: chave } = await db.rpc('crm_chave_cron')
      if (!chave || req.headers.get('x-cron-chave') !== chave) return json({ erro: 'chave' }, 403)
      if (acao === 'processar_fila') return json({ disparos: await processarFila(db), followups: await processarCadencias(db), agendadas: await processarAgendadas(db) })
      let conversaId = corpo.conversa_id ? String(corpo.conversa_id) : null
      if (!conversaId) {
        const { canal } = await canalESegredos(db, String(corpo.canal_id ?? ''))
        const contato = await contatoPorTelefone(db, canal.empresa_id, String(corpo.telefone ?? ''), corpo.nome ?? null, 'cobranca', ['cobranca'])
        conversaId = await conversaDe(db, canal.empresa_id, contato, canal.id, { com_ia: true })
      }
      return await enviarNaConversa(db, conversaId, { texto: corpo.texto, modelo: corpo.modelo }, 'ia', null)
    }

    // daqui para baixo: pessoa logada, com as regras de acesso dela
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: eu } = await usuario.auth.getUser()
    if (!eu?.user) return json({ erro: 'Entre no sistema de novo.' }, 401)
    const souAdmin = async (empresa: string) => (await usuario.rpc('crm_sou_admin', { p_empresa: empresa })).data === true

    if (acao === 'enviar') {
      let conversaId = corpo.conversa_id ? String(corpo.conversa_id) : null
      if (!conversaId) {
        // começar conversa nova: com um contato já cadastrado ou só com o telefone
        const { data: k } = await usuario.from('crm_canais').select('id, empresa_id').eq('id', String(corpo.canal_id ?? '')).maybeSingle()
        if (!k) return json({ erro: 'Escolha o número.' }, 400)
        let contato = corpo.contato_id ? String(corpo.contato_id) : null
        if (contato) { const { data: c } = await usuario.from('crm_contatos').select('id').eq('id', contato).eq('empresa_id', k.empresa_id).maybeSingle(); if (!c) return json({ erro: 'Contato não encontrado.' }, 404) }
        else contato = await contatoPorTelefone(db, k.empresa_id, String(corpo.telefone ?? ''), corpo.nome ?? null, 'manual')
        conversaId = await conversaDe(db, k.empresa_id, contato, k.id, { atendente_id: eu.user.id })
      }
      const { data: conv } = await usuario.from('crm_conversas').select('id, atendente_id').eq('id', conversaId).maybeSingle()
      if (!conv) return json({ erro: 'Conversa não encontrada.' }, 404)
      if (!conv.atendente_id) await db.from('crm_conversas').update({ atendente_id: eu.user.id }).eq('id', conv.id)   // quem responde assume
      return await enviarNaConversa(db, conv.id, { texto: corpo.texto, midia: corpo.midia, modelo: corpo.modelo }, 'atendente', eu.user.id)
    }

    if (acao === 'reenviar') {
      // a pessoa só consegue ler a mensagem se pode ver a conversa (regras de acesso dela)
      const { data: m } = await usuario.from('crm_mensagens').select('id, conversa_id, texto, tipo, status, direcao, midia_url, midia_nome, modelo').eq('id', String(corpo.mensagem_id ?? '')).maybeSingle()
      if (!m || m.direcao !== 'saida') return json({ erro: 'Mensagem não encontrada.' }, 404)
      if (m.status !== 'erro') return json({ erro: 'Essa mensagem já saiu.' }, 400)
      const { data: conv } = await db.from('crm_conversas').select('canal_id, contato_id').eq('id', m.conversa_id).single()
      const { data: contato } = await db.from('crm_contatos').select('telefone').eq('id', conv!.contato_id).single()
      const { canal, seg } = await canalESegredos(db, conv!.canal_id)
      if (canal.status !== 'conectado' && canal.tipo !== 'teste') return json({ erro: `O número "${canal.nome}" não está conectado.` }, 400)
      await db.from('crm_mensagens').update({ status: 'pendente', erro: null }).eq('id', m.id)
      const r = await despachar(db, m.id, canal, seg, contato!.telefone, await envioDeNovo(db, m), true)
      return json(r.ok ? { ok: true } : { erro: r.erro }, r.ok ? 200 : 502)
    }

    if (acao === 'transcrever') {
      const { data: m } = await usuario.from('crm_mensagens').select('id, empresa_id, midia_url, midia_mime, tipo').eq('id', String(corpo.mensagem_id ?? '')).maybeSingle()
      if (!m?.midia_url || m.tipo !== 'audio') return json({ erro: 'Áudio não encontrado.' }, 404)
      await transcreverGuardado(db, m.empresa_id, m.id, m.midia_url, m.midia_mime)
      const { data: t } = await db.from('crm_mensagens').select('transcricao').eq('id', m.id).single()
      return t?.transcricao ? json({ ok: true, transcricao: t.transcricao }) : json({ erro: 'Não consegui transcrever (falta a chave da OpenAI em Agentes → Configurações?).' }, 400)
    }

    if (acao === 'modelos_sincronizar' || acao === 'modelo_criar') {
      const { canal, seg } = await canalESegredos(db, String(corpo.canal_id ?? ''))
      if (!(await souAdmin(canal.empresa_id))) return json({ erro: 'Só o administrador.' }, 403)
      if (canal.tipo !== 'whatsapp_oficial') return json({ erro: 'Modelos só existem na API oficial da Meta.' }, 400)
      if (acao === 'modelos_sincronizar') return json({ ok: true, modelos: await sincronizarModelos(db, canal, seg) })
      return json({ ok: true, ...(await criarModelo(db, canal, seg, { nome: String(corpo.nome ?? ''), categoria: String(corpo.categoria ?? 'UTILITY'), corpo: String(corpo.corpo ?? ''), exemplo: (corpo.exemplo ?? []).map(String) })) })
    }

    if (acao === 'simular_entrada') {
      const { canal } = await canalESegredos(db, String(corpo.canal_id ?? ''))
      if (!(await souAdmin(canal.empresa_id))) return json({ erro: 'Só o administrador.' }, 403)
      if (canal.tipo !== 'teste') return json({ erro: 'Simulação só no número de teste.' }, 400)
      const tel = String(corpo.telefone ?? '').replace(/\D/g, '')
      if (tel.length < 10) return json({ erro: 'Telefone inválido.' }, 400)
      const { data, error } = corpo.do_celular
        ? await db.rpc('crm_registrar_eco', { p_canal: canal.id, p_telefone: tel, p_texto: String(corpo.texto ?? ''), p_id_externo: `sim-${crypto.randomUUID()}` })
        : await db.rpc('crm_receber_mensagem', { p_canal: canal.id, p_telefone: tel, p_nome: corpo.nome ?? null, p_texto: String(corpo.texto ?? ''), p_id_externo: `sim-${crypto.randomUUID()}` })
      if (error) return json({ erro: error.message }, 400)
      if (!corpo.do_celular) repassarParaIA(canal, url, canal.config?.ia_funcao ? ((await db.rpc('crm_chave_cron')).data as string | null) : null, data)
      return json({ ok: true, ...data })
    }

    return json({ erro: 'Ação desconhecida.' }, 400)
  } catch (e) {
    return json({ erro: (e as Error).message }, 500)
  }
})
