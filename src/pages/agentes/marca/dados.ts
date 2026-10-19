// Base da marca → A marca: os textos que vão em todo pedido aos agentes (quem é, o que vende, para quem, a voz,
// os limites e as condições fixas). Ficam em agentes_empresa.perfil; a página edita todos juntos e salva de uma vez.
import { atualizarPerfil } from '../memoria'

export const CAMPOS_TEXTO = ['empresa', 'o_que_vende', 'publico', 'tom', 'voz', 'evitar', 'conselho', 'materiais'] as const
export type CampoTexto = (typeof CAMPOS_TEXTO)[number]
export type PerfilMarketing = Partial<Record<CampoTexto | 'instagram', string>>
export type Textos = Record<CampoTexto, string>

export const textosDe = (perfil: Record<string, unknown>): Textos =>
  Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, typeof perfil[k] === 'string' ? (perfil[k] as string) : ''])) as Textos

export const iguais = (a: Textos, b: Textos) => CAMPOS_TEXTO.every((k) => a[k].trim() === b[k].trim())

// grava só os textos desta página; o resto do perfil (campanhas, logos, memória, configuração) fica como está
export function salvarTextos(empresa: string, textos: Textos) {
  return atualizarPerfil(empresa, 'marketing', (p) => {
    const novo = { ...p }
    for (const k of CAMPOS_TEXTO) {
      const v = textos[k].trim()
      if (v) novo[k] = v; else delete novo[k]
    }
    return novo
  })
}

// a primeira frase, curta, para os resumos
export const primeiraFrase = (s: string, max = 90) => {
  const f = s.trim().split(/(?<=[.!?])\s/)[0] ?? ''
  return f.length > max ? `${f.slice(0, max - 1)}…` : f
}

export type Selo = { texto: string; tom: 'ok' | 'alerta' | 'info' }
export const seloDe = (preenchido: boolean): Selo => (preenchido ? { texto: 'Preenchido', tom: 'ok' } : { texto: 'Falta preencher', tom: 'alerta' })
