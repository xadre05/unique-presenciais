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
