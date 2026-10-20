// Mesma conta da carta usada no envio (supabase/functions/notificacao/modelo.ts): mantenha os dois iguais
// Preenche a carta e a mensagem de WhatsApp com os dados de cada cobrança ({campo} → valor)
export type Dados = Record<string, string | number | null | undefined>

const brl = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: unknown) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')
const primeiro = (nome: unknown) => String(nome ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (l) => l.toUpperCase()) ?? ''
const cpf = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d || '—' }

// tudo o que a carta pode usar, já formatado
export function campos(c: Dados, cfg: Dados, extra: Dados): Record<string, string> {
  const emAberto = Math.round(Number(c.valor_restante ?? 0) / Math.max(Number(extra.valor_parcela ?? 0), 0.01))
  return {
    nome: String(c.aluno_nome ?? ''), primeiro_nome: primeiro(c.aluno_nome), cpf: cpf(extra.documento), email: String(c.email ?? ''),
    produto: String(c.produto ?? 'curso'), data_compra: data(extra.data_compra), parcelas_total: String(extra.parcelas_total ?? '—'),
    parcelas_pagas: String(extra.parcelas_pagas ?? '—'), valor_parcela: brl(extra.valor_parcela), primeira_em_aberto: data(c.parou_em),
    parcelas_em_aberto: String(Number.isFinite(emAberto) && emAberto > 0 ? emAberto : c.cobrancas_vencidas ?? '—'),
    valor_total: brl(c.boleto_valor ?? c.valor_restante), prazo: data(c.prazo_ate), link_boleto: String(c.boleto_url ?? '[o link do boleto entra aqui]'),
    data_envio: data(new Date().toISOString()), razao_social: String(cfg.razao_social ?? '[razão social]'), cnpj: String(cfg.cnpj ?? '[CNPJ]'),
    endereco: String(cfg.endereco ?? '[endereço]'), cidade: String(cfg.cidade ?? '[cidade]'), email_contato: String(cfg.email_contato ?? '[e-mail]'),
    whatsapp_contato: String(cfg.whatsapp_contato ?? '[WhatsApp]'), remetente_nome: String(cfg.remetente_nome ?? cfg.razao_social ?? ''),
  }
}

export const preencher = (modelo: string, v: Record<string, string>) => modelo.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m))

export type Config = {
  pct_comissao: number | null; razao_social: string | null; cnpj: string | null; endereco: string | null; cidade: string | null; email_contato: string | null
  whatsapp_contato: string | null; remetente_nome: string | null; prazo_dias: number; carta_assunto: string | null; carta_modelo: string | null; whatsapp_modelo: string | null
}
export type Extra = { cobranca_id: string; documento: string | null; endereco: Record<string, string> | null; data_compra: string | null; parcelas_total: number | null; parcelas_pagas: number | null; valor_parcela: number | null }

export const FASES: Record<string, { rotulo: string; tom: string }> = {
  '': { rotulo: 'Não notificado', tom: 'neutro' }, preparada: { rotulo: 'Boleto gerado', tom: 'info' }, notificada: { rotulo: 'Notificado — prazo correndo', tom: 'info' },
  prazo_vencido: { rotulo: 'Prazo vencido', tom: 'alerta' }, negativacao_pedida: { rotulo: 'Negativação pedida', tom: 'erro' }, negativada: { rotulo: 'Negativado', tom: 'erro' },
  advogado: { rotulo: 'Com o advogado', tom: 'erro' }, paga: { rotulo: 'Pagou', tom: 'ok' },
}
// o que falta para poder notificar (CPF e e-mail) e para negativar (endereço completo)
export function pendencias(email: string | null, ex: Extra | undefined) {
  const p: string[] = []
  if (!email) p.push('e-mail')
  const doc = String(ex?.documento ?? '').replace(/\D/g, '')
  if (doc.length !== 11 && doc.length !== 14) p.push('CPF')
  const e = ex?.endereco ?? {}
  const semEnd = !String(e.zip_code ?? '').replace(/\D/g, '') || !e.address || !e.neighborhood
  return { notificar: p, negativar: semEnd ? [...p, 'endereço'] : p }
}
