// CÓPIA de supabase/functions/notificacao/inter.ts (cada função é publicada sozinha): mantenha as duas iguais.
// Banco Inter, API Cobrança v3 (boleto com Pix). A integração entra com o certificado dela (mTLS) e um token de 60 min.
// A emissão é assíncrona: pede o boleto, espera o Inter devolver a linha digitável e o Pix, e baixa o PDF.
export type CredInter = Record<string, string>
type End = { zip_code?: string; address?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string }
type Pagador = { nome: string; cpf: string; email?: string; telefone?: string; end: End | null }

const BASE = 'https://cdpj.partners.bancointer.com.br'
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const corta = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const interPronto = (c: CredInter) => !!(c.client_id && c.client_secret && c.certificado && c.chave_privada)
// o Inter exige endereço completo no Brasil (rua, cidade, UF e CEP)
export const enderecoBoleto = (e: End | null) => !!e && digitos(e.zip_code).length === 8 && !!e.address && !!e.city && UFS.includes(String(e.state ?? '').toUpperCase())

type Conexao = { http: Deno.HttpClient; token: string; conta: string }
async function conectar(c: CredInter): Promise<Conexao> {
  const http = Deno.createHttpClient({ cert: c.certificado, key: c.chave_privada })
  const corpo = new URLSearchParams({ client_id: c.client_id.trim(), client_secret: c.client_secret.trim(), grant_type: 'client_credentials', scope: 'boleto-cobranca.read boleto-cobranca.write' })
  const r = await fetch(`${BASE}/oauth/v2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo, client: http } as RequestInit)
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) { http.close(); throw new Error(`Inter: não autorizou a integração (${d.error_description ?? d.title ?? r.status}). Confira o Client ID, o Client Secret e o certificado.`) }
  return { http, token: String(d.access_token), conta: digitos(c.conta).replace(/^0+/, '') }
}

async function chamar(x: Conexao, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${BASE}/cobranca/v3${caminho}`, {
    method: metodo, client: x.http, body: corpo ? JSON.stringify(corpo) : undefined,
    headers: { Authorization: `Bearer ${x.token}`, 'Content-Type': 'application/json', ...(x.conta ? { 'x-conta-corrente': x.conta } : {}) },
  } as RequestInit)
  const texto = await r.text()
  const d = texto ? (() => { try { return JSON.parse(texto) } catch { return { texto } } })() : {}
  if (!r.ok) {
    const viol = (d.violacoes ?? []).map((v: { propriedade?: string; razao?: string }) => `${v.propriedade ?? ''} ${v.razao ?? ''}`.trim()).join('; ')
    throw new Error(`Inter: ${d.title ?? r.status}${d.detail ? ` (${d.detail})` : ''}${viol ? `: ${viol}` : ''}`)
  }
  return d
}

export async function usarInter<T>(c: CredInter, fazer: (x: Conexao) => Promise<T>) {
  const x = await conectar(c)
  try { return await fazer(x) } finally { x.http.close() }
}

export type Emitido = { codigo: string; linha: string; pix: string; pdf: Uint8Array<ArrayBuffer> | null }
export async function emitirBoleto(x: Conexao, o: { seuNumero: string; valor: number; vencimento: string; pagador: Pagador; linhas: string[] }): Promise<Emitido> {
  const e = o.pagador.end ?? {}, fone = digitos(o.pagador.telefone).replace(/^55(?=\d{10,11}$)/, '')
  const { codigoSolicitacao } = await chamar(x, 'POST', '/cobrancas', {
    seuNumero: corta(o.seuNumero, 15), valorNominal: Math.round(o.valor * 100) / 100, dataVencimento: o.vencimento, numDiasAgenda: 60,
    pagador: {
      cpfCnpj: digitos(o.pagador.cpf), tipoPessoa: digitos(o.pagador.cpf).length === 14 ? 'JURIDICA' : 'FISICA', nome: corta(o.pagador.nome, 100),
      endereco: corta(e.address, 100), numero: corta(e.number, 10), complemento: corta(e.complement, 30), bairro: corta(e.neighborhood, 60),
      cidade: corta(e.city, 60), uf: String(e.state ?? '').toUpperCase(), cep: digitos(e.zip_code),
      email: corta(o.pagador.email, 50), ...(fone.length >= 10 ? { ddd: fone.slice(0, 2), telefone: fone.slice(2, 11) } : {}),
    },
    mensagem: Object.fromEntries(o.linhas.slice(0, 5).map((l, i) => [`linha${i + 1}`, corta(l, 78)])),
  })
  // a emissão é assíncrona: espera a linha digitável (até ~20 s)
  for (let i = 0; i < 10; i++) {
    await espera(2000)
    const d = await chamar(x, 'GET', `/cobrancas/${codigoSolicitacao}`).catch(() => null)
    if (d?.cobranca?.situacao === 'FALHA_EMISSAO') throw new Error('Inter: falha ao emitir o boleto.')
    if (d?.boleto?.linhaDigitavel) {
      const pdf = await chamar(x, 'GET', `/cobrancas/${codigoSolicitacao}/pdf`).catch(() => null)
      return { codigo: String(codigoSolicitacao), linha: String(d.boleto.linhaDigitavel), pix: String(d.pix?.pixCopiaECola ?? ''), pdf: pdf?.pdf ? Uint8Array.from(atob(pdf.pdf), (ch) => ch.charCodeAt(0)) : null }
    }
  }
  throw new Error(`Inter: o boleto ${codigoSolicitacao} ainda está em processamento. Tente de novo em alguns minutos.`)
}

export const consultarBoleto = (x: Conexao, codigo: string) => chamar(x, 'GET', `/cobrancas/${encodeURIComponent(codigo)}`)
export const cadastrarAviso = (x: Conexao, url: string) => chamar(x, 'PUT', '/cobrancas/webhook', { webhookUrl: url })
export const conferirAcesso = (x: Conexao) => chamar(x, 'GET', `/cobrancas/sumario?dataInicial=${new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)}&dataFinal=${new Date().toISOString().slice(0, 10)}`)
export const cancelarBoleto = (x: Conexao, codigo: string, motivo: string) => chamar(x, 'POST', `/cobrancas/${encodeURIComponent(codigo)}/cancelar`, { motivoCancelamento: motivo.slice(0, 50) })
