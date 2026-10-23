// CRM — WhatsApp: como cada tipo de número manda texto, arquivo e modelo aprovado (e baixa o arquivo que chegou).
export type Canal = { id: string; empresa_id: string; tipo: 'teste' | 'whatsapp_qr' | 'whatsapp_oficial'; nome: string; status: string; config: Record<string, unknown> }
export type Segredos = { segredos: Record<string, string>; chave_webhook: string }
export type Midia = { tipo: 'imagem' | 'audio' | 'video' | 'documento'; link: string; nome?: string | null; legenda?: string | null }
export type Modelo = { nome: string; idioma: string; parametros: string[] }
export type Envio = { texto?: string; midia?: Midia; modelo?: Modelo }

const GRAPH = 'https://graph.facebook.com/v21.0'
const TIPO_META: Record<Midia['tipo'], string> = { imagem: 'image', audio: 'audio', video: 'video', documento: 'document' }
const TIPO_EVOLUTION: Record<Midia['tipo'], string> = { imagem: 'image', audio: 'audio', video: 'video', documento: 'document' }

export async function graph(token: string, caminho: string, metodo = 'GET', corpo?: unknown) {
  const r = await fetch(`${GRAPH}/${caminho}`, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: corpo ? JSON.stringify(corpo) : undefined })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d?.error?.error_user_msg ?? d?.error?.message ?? `A Meta respondeu ${r.status}`)
  return d
}

function corpoMeta(telefone: string, e: Envio) {
  const base = { messaging_product: 'whatsapp', to: telefone }
  if (e.modelo) {
    const parametros = e.modelo.parametros.map((t) => ({ type: 'text', text: t || '-' }))
    return { ...base, type: 'template', template: { name: e.modelo.nome, language: { code: e.modelo.idioma }, ...(parametros.length ? { components: [{ type: 'body', parameters: parametros }] } : {}) } }
  }
  if (e.midia) {
    const t = TIPO_META[e.midia.tipo]
    const conteudo: Record<string, string> = { link: e.midia.link }
    if (e.midia.legenda && t !== 'audio') conteudo.caption = e.midia.legenda
    if (t === 'document' && e.midia.nome) conteudo.filename = e.midia.nome
    return { ...base, type: t, [t]: conteudo }
  }
  return { ...base, type: 'text', text: { body: e.texto ?? '' } }
}

async function evolution(canal: Canal, seg: Segredos, telefone: string, e: Envio) {
  const base = String(canal.config.url ?? '').replace(/\/$/, '')
  const inst = encodeURIComponent(String(canal.config.instancia ?? ''))
  if (e.modelo) throw new Error('Modelo aprovado só existe na API oficial da Meta.')
  const [caminho, corpo] = e.midia
    ? [`message/sendMedia/${inst}`, { number: telefone, mediatype: TIPO_EVOLUTION[e.midia.tipo], media: e.midia.link, fileName: e.midia.nome ?? undefined, caption: e.midia.legenda ?? undefined }]
    : [`message/sendText/${inst}`, { number: telefone, text: e.texto ?? '' }]
  const r = await fetch(`${base}/${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: seg.segredos.apikey ?? '' }, body: JSON.stringify(corpo) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`O servidor do WhatsApp respondeu ${r.status}: ${JSON.stringify(d).slice(0, 200)}`)
  return (d?.key?.id as string) ?? null
}

/** Manda texto, arquivo ou modelo aprovado. Devolve o código da mensagem no provedor. */
export async function mandar(canal: Canal, seg: Segredos, telefone: string, e: Envio, reenvio = false): Promise<string | null> {
  // número de teste: "#falha" no texto simula uma mensagem que não saiu (na nova tentativa, sai)
  if (canal.tipo === 'teste') { if ((e.texto ?? '').includes('#falha') && !reenvio) throw new Error('Falha simulada no número de teste.'); return `teste-${crypto.randomUUID()}` }
  if (canal.tipo === 'whatsapp_qr') return evolution(canal, seg, telefone, e)
  if (canal.tipo === 'whatsapp_oficial') {
    const d = await graph(seg.segredos.token ?? '', `${canal.config.phone_number_id}/messages`, 'POST', corpoMeta(telefone, e))
    return d?.messages?.[0]?.id ?? null
  }
  throw new Error('Tipo de número desconhecido.')
}

/** Baixa o arquivo que chegou pela API oficial (foto, áudio, documento). */
export async function baixarMidiaMeta(token: string, mediaId: string) {
  const info = await graph(token, mediaId)
  const r = await fetch(String(info.url), { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`Não consegui baixar o arquivo (${r.status}).`)
  return { bytes: new Uint8Array(await r.arrayBuffer()) as Uint8Array<ArrayBuffer>, mime: String(info.mime_type ?? r.headers.get('content-type') ?? 'application/octet-stream') }
}
