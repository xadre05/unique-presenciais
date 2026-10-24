// ════════════════════════════════════════════════════════════════════
// CRM — NÚCLEO (parte separada)
// Nada aqui pode importar vendedora, Hotmart, comissão ou telas da Unique.
// É o que vai junto para o Unique Clinical (cada clínica = uma empresa).
// ════════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase'

export type LinhaContato = {
  nome?: string | null
  telefone?: string | null
  emails?: string[]
  tags?: string[]
  entrou_em?: string | null
  cidade?: string | null
  uf?: string | null
  instagram?: string | null
}

const nulo = (v: string | null | undefined) => v == null || ['', 'null', 'none', '(none)', 'undefined'].includes(v.trim().toLowerCase())

/** Celular brasileiro → só dígitos com 55 (ex.: 5511987654321). Fixo, quebrado ou estrangeiro → null. */
export function telefoneBR(t: string | null | undefined): string | null {
  if (nulo(t)) return null
  let d = String(t).replace(/\D/g, '')
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d
  if (d.startsWith('55') && (d.length === 12 || d.length === 13) && Number(d.slice(2, 4)) >= 11) {
    let n = d.slice(4)
    if (n.length === 8 && '6789'.includes(n[0])) n = '9' + n
    if (n.length === 9 && n[0] === '9') return '55' + d.slice(2, 4) + n
  }
  return null
}

export function emailValido(e: string | null | undefined): string | null {
  if (nulo(e)) return null
  const x = String(e).trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x) ? x : null
}

export function nomeValido(n: string | null | undefined): string | null {
  if (nulo(n)) return null
  const s = String(n).trim().replace(/\s+/g, ' ')
  if (s.length < 2 || /\d|@|http/i.test(s)) return null
  return /[A-Za-zÀ-ÿ]{2,}/.test(s) ? s : null
}

export const primeiroNome = (n: string | null | undefined) => {
  const p = (n ?? '').trim().split(/\s+/)[0] ?? ''
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''
}

/** Troca {nome} (primeiro nome do contato) e {atendente} (primeiro nome de quem manda). */
export function preencherMensagem(texto: string, v: { nome?: string | null; atendente?: string | null; link?: string | null }) {
  return texto
    .replace(/\{primeiro_nome\}|\{nome\}/gi, primeiroNome(v.nome))
    .replace(/\{atendente\}/gi, primeiroNome(v.atendente))
    .replace(/\{link\}/gi, v.link ?? '')
    .replace(/[ \t]+([,.!?])/g, '$1')
}

/** Link do WhatsApp (abre no app/celular de quem clica) com a mensagem já escrita. */
export function linkWhats(telefone: string | null | undefined, texto?: string) {
  if (!telefone) return null
  const d = telefone.replace(/\D/g, '')
  return `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`
}

export const telefoneLegivel = (t: string | null | undefined) => {
  if (!t) return '—'
  const d = t.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  return '+' + d
}

/** Lê CSV com vírgula ou ponto e vírgula, com aspas e quebra de linha dentro de aspas. */
export function lerCSV(texto: string): { cabecalho: string[]; linhas: string[][] } {
  const t = texto.replace(/^﻿/, '')
  const primeira = t.slice(0, t.indexOf('\n') === -1 ? t.length : t.indexOf('\n'))
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (aspas) {
      if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++ } else aspas = false }
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha)
      linha = []
    } else campo += ch
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  const cabecalho = (linhas.shift() ?? []).map((c) => c.trim())
  return { cabecalho, linhas }
}

/** dd/mm/aaaa [hh:mm[:ss]] → ISO (horário de Brasília). Aceita ISO também. */
export function dataBRparaISO(s: string | null | undefined): string | null {
  if (nulo(s)) return null
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '12'}:${m[5] ?? '00'}:${m[6] ?? '00'}-03:00`
  const d = new Date(String(s))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/** Manda os contatos para a base da empresa em lotes. Junta por telefone e e-mail; nunca apaga o que já existe. */
export async function importarContatos(empresaId: string, linhas: LinhaContato[], origem: string, progresso?: (feitos: number, total: number) => void) {
  const tot = { novos: 0, atualizados: 0, ignorados: 0 }
  const LOTE = 1000
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { data, error } = await supabase.rpc('crm_importar_contatos', { p_empresa: empresaId, p_linhas: linhas.slice(i, i + LOTE), p_origem: origem })
    if (error) throw new Error(error.message)
    const r = data as typeof tot
    tot.novos += r.novos; tot.atualizados += r.atualizados; tot.ignorados += r.ignorados
    progresso?.(Math.min(i + LOTE, linhas.length), linhas.length)
  }
  return tot
}
