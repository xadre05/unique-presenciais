// Mesma conta da carta usada no envio (supabase/functions/notificacao/modelo.ts): mantenha os dois iguais
// Preenche a carta e a mensagem de WhatsApp ({campo} → valor) e calcula o valor cobrado de cada pessoa.
export type Dados = Record<string, string | number | null | undefined>

const brl = (v: unknown) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: unknown) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—')
const primeiro = (nome: unknown) => String(nome ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (l) => l.toUpperCase()) ?? ''
const cpf = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d || '—' }
const pct = (v: unknown) => `${String(Number(v ?? 0)).replace('.', ',')}%`
const centavos = (v: number) => Math.round(v * 100) / 100
const somaMeses = (iso: string, n: number) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const a = new Date(Date.UTC(y, m - 1 + n, 1)); a.setUTCDate(Math.min(d, new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0)).getUTCDate())); return a.toISOString().slice(0, 10) }
const diasEntre = (de: string, ate: string) => Math.max(0, Math.round((Date.parse(ate + 'T12:00:00Z') - Date.parse(de + 'T12:00:00Z')) / 864e5))

// uma dívida (um curso): só as parcelas já vencidas; multa sobre cada parcela e juros simples pro rata desde o vencimento de cada uma
export type Item = { produto: string; data_compra: string | null; parcelas_total: number | null; parcelas_pagas: number | null; valor_parcela: number; parou_em: string | null; vencidas: number }
// prescrição (advogado, 22/10/2026): parcela vencida há mais de 5 anos não é cobrada nem negativada
export function contaItem(it: Item, hoje: string, multaPct: number, jurosMesPct: number) {
  let principal = 0, multa = 0, juros = 0, cobradas = 0, prescritas = 0
  let primeira: string | null = null
  const limite = somaMeses(hoje, -60)
  for (let k = 0; k < it.vencidas; k++) {
    const venc = it.parou_em ? somaMeses(it.parou_em, k) : hoje
    if (venc < limite) { prescritas++; continue }
    cobradas++; primeira ??= venc
    principal += it.valor_parcela
    multa += it.valor_parcela * multaPct / 100
    juros += it.valor_parcela * (jurosMesPct / 100) * (diasEntre(venc, hoje) / 30)
  }
  return { principal: centavos(principal), encargos: centavos(multa + juros), total: centavos(principal + multa + juros), cobradas, prescritas, primeira }
}

export function detalhamento(itens: Item[], hoje: string, multaPct: number, jurosMesPct: number) {
  return itens.map((it) => {
    const c = contaItem(it, hoje, multaPct, jurosMesPct)
    return `• ${it.produto}: compra em ${data(it.data_compra)}, ${it.parcelas_total ?? '—'} parcelas de ${brl(it.valor_parcela)}; ${it.parcelas_pagas ?? '—'} paga(s); `
      + `${c.cobradas} parcela(s) vencida(s) sem pagamento desde ${data(c.primeira)} = ${brl(c.principal)}`
  }).join('\n')
}

// tudo o que a carta pode usar, já formatado (uma carta por pessoa, com todos os cursos dela)
export function campos(p: Dados, itens: Item[], cfg: Dados, hoje: string): Record<string, string> {
  const m = Number(cfg.multa_pct ?? 2), j = Number(cfg.juros_mes_pct ?? 1)
  const t = itens.map((it) => contaItem(it, hoje, m, j)).reduce((s, c) => ({ principal: s.principal + c.principal, encargos: s.encargos + c.encargos, total: s.total + c.total }), { principal: 0, encargos: 0, total: 0 })
  const um = itens.length === 1 ? itens[0] : null
  return {
    nome: String(p.aluno_nome ?? ''), primeiro_nome: primeiro(p.aluno_nome), cpf: cpf(p.documento), email: String(p.email ?? ''),
    detalhamento: detalhamento(itens, hoje, m, j), valor_principal: brl(t.principal), valor_encargos: brl(t.encargos), valor_total: brl(p.boleto_valor ?? t.total),
    multa_pct: pct(m), juros_pct: pct(j), produto: itens.map((it) => it.produto).join(', '),
    data_compra: data(um?.data_compra), parcelas_total: String(um?.parcelas_total ?? '—'), parcelas_pagas: String(um?.parcelas_pagas ?? '—'),
    valor_parcela: um ? brl(um.valor_parcela) : '—', primeira_em_aberto: data(itens.map((it) => it.parou_em).filter(Boolean).sort()[0]),
    parcelas_em_aberto: String(itens.reduce((s, it) => s + contaItem(it, hoje, m, j).cobradas, 0)),
    prazo: data(p.prazo_ate), link_boleto: String(p.boleto_url ?? '[o link do boleto entra aqui]'), data_envio: data(hoje),
    razao_social: String(cfg.razao_social ?? '[razão social]'), cnpj: String(cfg.cnpj ?? '[CNPJ]'), endereco: String(cfg.endereco ?? '[endereço]'),
    cidade: String(cfg.cidade ?? '[cidade]'), email_contato: String(cfg.email_contato ?? '[e-mail]'), whatsapp_contato: String(cfg.whatsapp_contato ?? '[WhatsApp]'),
    remetente_nome: String(cfg.remetente_nome ?? cfg.razao_social ?? ''),
  }
}

export const preencher = (modelo: string, v: Record<string, string>) => modelo.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m))

// horário comercial (orientação do advogado): segunda a sexta, das 9h às 18h, horário de Brasília
export function horarioComercial(agora = new Date()) {
  const br = new Date(agora.getTime() - 3 * 3600e3)
  const dia = br.getUTCDay(), hora = br.getUTCHours()
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18
}

export type Config = {
  pct_comissao: number | null; razao_social: string | null; cnpj: string | null; endereco: string | null; cidade: string | null; email_contato: string | null
  whatsapp_contato: string | null; remetente_nome: string | null; prazo_dias: number; carta_assunto: string | null; carta_modelo: string | null; whatsapp_modelo: string | null
  advogado_liberou_em: string | null; advogado_liberou_por: string | null; compra_ate: string; multa_pct: number; juros_mes_pct: number
}
// por cobrança online: CPF, data da compra e as dúvidas que pedem conferência na Hotmart (v_cobranca_conferencia)
export type Conferencia = {
  cobranca_id: string; cpf: string | null; compra_em: string | null; tipo_plano: string | null; nao_pagas_hotmart: number | null; duvidas: string[]
  np: number | null; pagas: number | null; vencidas: number | null; valor_parcela: number | null; parou_em: string | null; status_hotmart: string | null
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
