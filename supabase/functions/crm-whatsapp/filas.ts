// CRM — WhatsApp: o que sai sozinho pelo cron — disparos, follow-ups automáticos e mensagens agendadas.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { mandar, type Canal, type Envio, type Segredos } from './conectores.ts'

const sortear = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const primeiroNome = (n: string | null) => { const p = (n ?? '').trim().split(/\s+/)[0] ?? ''; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : '' }
const preencher = (t: string, nome: string | null) => t.replace(/\{primeiro_nome\}|\{nome\}/gi, primeiroNome(nome)).replace(/[ \t]+([,.!?])/g, '$1')

export async function canalESegredos(db: SupabaseClient, canalId: string) {
  const { data: canal } = await db.from('crm_canais').select('*').eq('id', canalId).single()
  const { data: seg } = await db.from('crm_canais_segredos').select('*').eq('canal_id', canalId).single()
  if (!canal || !seg) throw new Error('Número não encontrado.')
  return { canal: canal as Canal, seg: seg as Segredos }
}

// manda uma mensagem já registrada e atualiza o status
export async function despachar(db: SupabaseClient, msgId: string, canal: Canal, seg: Segredos, telefone: string, envio: Envio, reenvio = false) {
  try {
    const idExt = await mandar(canal, seg, telefone, envio, reenvio)
    await db.from('crm_mensagens').update({ status: 'enviada', id_externo: idExt }).eq('id', msgId)
    return { ok: true as const }
  } catch (e) {
    const erro = (e as Error).message
    await db.from('crm_mensagens').update({ status: 'erro', erro }).eq('id', msgId)
    return { ok: false as const, erro }
  }
}

export async function processarFila(db: SupabaseClient) {
  const { data: itens, error } = await db.rpc('crm_proximos_envios', { p_max: 40 })
  if (error) throw new Error(error.message)
  const cache = new Map<string, { canal: Canal; seg: Segredos }>()
  let enviados = 0, erros = 0
  for (const it of (itens ?? []) as { item_id: string; disparo_id: string; contato_id: string; canal_id: string; empresa_id: string }[]) {
    // trava o item (se outra execução pegou antes, pula)
    const { data: travado } = await db.from('crm_disparo_itens').update({ status: 'enviado', enviado_em: new Date().toISOString() }).eq('id', it.item_id).eq('status', 'fila').select('atendente_id').maybeSingle()
    if (!travado) continue
    if (!cache.has(it.canal_id)) cache.set(it.canal_id, await canalESegredos(db, it.canal_id))
    const { canal, seg } = cache.get(it.canal_id)!
    const { data: d } = await db.from('crm_disparos').select('mensagens, atendente_id').eq('id', it.disparo_id).single()
    const { data: c } = await db.from('crm_contatos').select('nome, telefone, nao_contatar, telefone_invalido').eq('id', it.contato_id).single()
    if (!c?.telefone || c.nao_contatar || c.telefone_invalido) { await db.from('crm_disparo_itens').update({ status: 'pulado', erro: 'sem WhatsApp ou pediu para não receber' }).eq('id', it.item_id); continue }
    await db.from('crm_conversas').upsert({ empresa_id: it.empresa_id, contato_id: it.contato_id, canal_id: it.canal_id, atendente_id: travado.atendente_id ?? d?.atendente_id ?? null },
      { onConflict: 'canal_id,contato_id', ignoreDuplicates: true })
    const { data: conv } = await db.from('crm_conversas').select('id').eq('canal_id', it.canal_id).eq('contato_id', it.contato_id).single()
    const texto = preencher(String(sortear((d?.mensagens ?? ['']) as string[])), c.nome)
    const { data: msgId } = await db.rpc('crm_registrar_saida', { p_conversa: conv!.id, p_texto: texto, p_autor: 'disparo', p_autor_id: null })
    const r = await despachar(db, msgId as string, canal, seg, c.telefone, { texto })
    await db.from('crm_disparo_itens').update({ mensagem_id: msgId, ...(r.ok ? {} : { status: 'erro', erro: r.erro }) }).eq('id', it.item_id)
    if (r.ok) enviados++; else erros++
  }
  // disparos sem nada na fila → concluídos
  const { data: abertos } = await db.from('crm_disparos').select('id').eq('status', 'enviando')
  for (const d of abertos ?? []) {
    const { count } = await db.from('crm_disparo_itens').select('id', { count: 'exact', head: true }).eq('disparo_id', d.id).eq('status', 'fila')
    if (!count) await db.from('crm_disparos').update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', d.id)
  }
  return { enviados, erros }
}

// follow-ups automáticos: tarefas já são criadas no banco; aqui só saem as mensagens
export async function processarCadencias(db: SupabaseClient) {
  const { data: itens, error } = await db.rpc('crm_cadencias_vencidas', { p_max: 50 })
  if (error) throw new Error(error.message)
  let enviadas = 0, sem_canal = 0
  for (const it of (itens ?? []) as { inscricao_id: string; empresa_id: string; contato_id: string; texto: string | null; dados: Record<string, string> | null }[]) {
    const { data: c } = await db.from('crm_contatos').select('nome, telefone, nao_contatar, telefone_invalido').eq('id', it.contato_id).single()
    if (!c?.telefone || c.nao_contatar || c.telefone_invalido || !it.texto) continue
    // conversa existente com esse contato; senão o número padrão da empresa
    const { data: conv0 } = await db.from('crm_conversas').select('id, canal_id').eq('contato_id', it.contato_id).order('ultima_em', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    let canalId = conv0?.canal_id as string | undefined
    if (!canalId) {
      const { data: emp } = await db.from('crm_empresas').select('config').eq('id', it.empresa_id).single()
      canalId = emp?.config?.canal_padrao
      if (!canalId) { const { data: k } = await db.from('crm_canais').select('id').eq('empresa_id', it.empresa_id).eq('status', 'conectado').neq('tipo', 'teste').limit(1).maybeSingle(); canalId = k?.id }
    }
    if (!canalId) { sem_canal++; continue }
    const { canal, seg } = await canalESegredos(db, canalId)
    if (canal.status !== 'conectado') { sem_canal++; continue }
    await db.from('crm_conversas').upsert({ empresa_id: it.empresa_id, contato_id: it.contato_id, canal_id: canalId }, { onConflict: 'canal_id,contato_id', ignoreDuplicates: true })
    const { data: conv } = await db.from('crm_conversas').select('id').eq('canal_id', canalId).eq('contato_id', it.contato_id).single()
    let texto = preencher(it.texto, c.nome)
    for (const [k, v] of Object.entries(it.dados ?? {})) texto = texto.replaceAll(`{${k}}`, String(v ?? ''))
    const { data: msgId } = await db.rpc('crm_registrar_saida', { p_conversa: conv!.id, p_texto: texto, p_autor: 'disparo', p_autor_id: null })
    const r = await despachar(db, msgId as string, canal, seg, c.telefone, { texto })
    if (r.ok) enviadas++
  }
  return { enviadas, sem_canal }
}

// mensagens agendadas na conversa: saem na hora marcada; "só se não respondeu" pula se a pessoa escreveu depois de agendar
export async function processarAgendadas(db: SupabaseClient) {
  const { data: itens } = await db.from('crm_agendadas').select('id, conversa_id, texto, so_sem_resposta, criado_em, criado_por').eq('status', 'agendada').lte('enviar_em', new Date().toISOString()).order('enviar_em').limit(40)
  let enviadas = 0, puladas = 0
  for (const a of itens ?? []) {
    const { data: travada } = await db.from('crm_agendadas').update({ status: 'enviada', processada_em: new Date().toISOString() }).eq('id', a.id).eq('status', 'agendada').select('id').maybeSingle()
    if (!travada) continue
    const { data: conv } = await db.from('crm_conversas').select('id, canal_id, contato_id').eq('id', a.conversa_id).single()
    const { data: c } = await db.from('crm_contatos').select('telefone, nao_contatar').eq('id', conv!.contato_id).single()
    const pular = async (motivo: string) => { await db.from('crm_agendadas').update({ status: 'pulada', erro: motivo }).eq('id', a.id); puladas++ }
    if (!c?.telefone || c.nao_contatar) { await pular('sem WhatsApp ou pediu para não receber'); continue }
    if (a.so_sem_resposta) {
      const { count } = await db.from('crm_mensagens').select('id', { count: 'exact', head: true }).eq('conversa_id', a.conversa_id).eq('direcao', 'entrada').gt('criado_em', a.criado_em)
      if (count) { await pular('a pessoa respondeu antes'); continue }
    }
    const { canal, seg } = await canalESegredos(db, conv!.canal_id)
    if (canal.status !== 'conectado') { await db.from('crm_agendadas').update({ status: 'erro', erro: `número "${canal.nome}" fora do ar` }).eq('id', a.id); continue }
    const { data: msgId } = await db.rpc('crm_registrar_saida', { p_conversa: conv!.id, p_texto: a.texto, p_autor: 'atendente', p_autor_id: a.criado_por })
    const r = await despachar(db, msgId as string, canal, seg, c.telefone, { texto: a.texto })
    await db.from('crm_agendadas').update({ mensagem_id: msgId, ...(r.ok ? {} : { status: 'erro', erro: r.erro }) }).eq('id', a.id)
    if (r.ok) enviadas++
  }
  return { enviadas, puladas }
}
