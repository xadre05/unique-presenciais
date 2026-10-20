// Leitura dos arquivos que a Hotmart exporta, no navegador: CSV (separado por ";", com aspas) e Excel (.xls/.xlsx,
// que na Hotmart é um .xlsx). Devolve linhas como objetos pelo nome da coluna.
import { strFromU8, unzipSync } from 'fflate'

export type Linha = Record<string, string>

export function lerCsv(texto: string, sep = ';'): Linha[] {
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  const t = texto.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ } else if (c === '"') aspas = false; else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((x) => x !== '')) linhas.push(linha)
      linha = []
    } else campo += c
  }
  if (campo || linha.length) { linha.push(campo); if (linha.some((x) => x !== '')) linhas.push(linha) }
  return paraObjetos(linhas)
}

function paraObjetos(linhas: string[][]): Linha[] {
  const [cab, ...resto] = linhas
  if (!cab) return []
  const nomes = cab.map((n) => n.trim())
  return resto.map((l) => Object.fromEntries(nomes.map((n, i) => [n, (l[i] ?? '').trim()])))
}

// .xlsx: um zip com a planilha em XML; os textos podem estar na própria célula ou na lista de textos compartilhados
export async function lerXlsx(arquivo: File): Promise<Linha[]> {
  const zip = unzipSync(new Uint8Array(await arquivo.arrayBuffer()))
  const xml = (nome: string) => (zip[nome] ? new DOMParser().parseFromString(strFromU8(zip[nome]), 'application/xml') : null)
  const compartilhados = [...(xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? [])].map((si) => si.textContent ?? '')
  const folha = xml('xl/worksheets/sheet1.xml')
  if (!folha) throw new Error('Não encontrei a planilha dentro do arquivo.')
  const coluna = (ref: string) => ref.replace(/\d+/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  const linhas = [...folha.getElementsByTagName('row')].map((row) => {
    const l: string[] = []
    for (const c of [...row.getElementsByTagName('c')]) {
      const tipo = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      l[coluna(c.getAttribute('r') ?? 'A')] = tipo === 's' ? compartilhados[Number(v)] ?? '' : tipo === 'inlineStr' ? c.textContent ?? '' : v
    }
    return Array.from(l, (x) => x ?? '')
  })
  return paraObjetos(linhas)
}

export const lerPlanilha = async (f: File) => (/\.xlsx?$/i.test(f.name) ? lerXlsx(f) : lerCsv(await f.text()))

// "1.234,56" ou "1234.56" → número
export function numero(s: string | undefined) {
  const t = (s ?? '').trim()
  if (!t) return 0
  return Number(/,\d{1,2}$/.test(t) || t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}
// "31/12/2024" (com ou sem hora) → "2024-12-31"
export const dataIso = (s: string | undefined) => { const m = (s ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null }
export const dataHoraIso = (s: string | undefined) => { const d = dataIso(s); const h = (s ?? '').match(/(\d{2}:\d{2}:\d{2})/)?.[1]; return d ? `${d}T${h ?? '00:00:00'}` : null }
