// Preenche a carta e a mensagem de WhatsApp ({campo} → valor) e calcula o valor cobrado de cada pessoa.
// Mesma conta no envio (supabase/functions/notificacao/modelo.ts) e na tela (src/pages/cobranca/notificacao/modelo.ts): mantenha os dois iguais.
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

// quem notifica (orientação do advogado, 22/10/2026): o nome fantasia, seguido do CNPJ de quem era o credor na data da
// compra (antes da empresa atual, a conta da Hotmart era de outra empresa do mesmo dono); o pagamento vai para a conta atual
function credora(itens: Item[], cfg: Dados) {
  const atual = String(cfg.cnpj ?? '[CNPJ]'), anterior = cfg.cnpj_anterior ? String(cfg.cnpj_anterior) : null, corte = cfg.cnpj_anterior_ate ? String(cfg.cnpj_anterior_ate) : null
  const antigos = anterior && corte ? itens.filter((it) => it.data_compra && String(it.data_compra).slice(0, 10) < corte).length : 0
  const cnpj = !antigos ? atual : antigos === itens.length ? anterior! : `${atual} (compras a partir de ${data(corte)}) e ${anterior} (compras anteriores)`
  return { razao_social: String(cfg.nome_fantasia || cfg.razao_social || '[nome]'), cnpj }
}

// tudo o que a carta pode usar, já formatado (uma carta por pessoa, com todos os cursos dela)
export function campos(p: Dados, itens: Item[], cfg: Dados, hoje: string): Record<string, string> {
  const m = Number(cfg.multa_pct ?? 2), j = Number(cfg.juros_mes_pct ?? 1)
  const t = itens.map((it) => contaItem(it, hoje, m, j)).reduce((s, c) => ({ principal: s.principal + c.principal, encargos: s.encargos + c.encargos, total: s.total + c.total }), { principal: 0, encargos: 0, total: 0 })
  const um = itens.length === 1 ? itens[0] : null
  return {
    ...credora(itens, cfg),
    nome: String(p.aluno_nome ?? ''), primeiro_nome: primeiro(p.aluno_nome), cpf: cpf(p.documento), email: String(p.email ?? ''),
    detalhamento: detalhamento(itens, hoje, m, j), valor_principal: brl(t.principal), valor_encargos: brl(t.encargos), valor_total: brl(p.boleto_valor ?? t.total),
    multa_pct: pct(m), juros_pct: pct(j), produto: itens.map((it) => it.produto).join(', '),
    data_compra: data(um?.data_compra), parcelas_total: String(um?.parcelas_total ?? '—'), parcelas_pagas: String(um?.parcelas_pagas ?? '—'),
    valor_parcela: um ? brl(um.valor_parcela) : '—', primeira_em_aberto: data(itens.map((it) => it.parou_em).filter(Boolean).sort()[0]),
    parcelas_em_aberto: String(itens.reduce((s, it) => s + contaItem(it, hoje, m, j).cobradas, 0)),
    prazo: data(p.prazo_ate), link_boleto: String(p.boleto_url ?? '[o link do boleto entra aqui]'), data_envio: data(hoje),
    linha_digitavel: String(p.boleto_linha || '[a linha digitável entra aqui]'), pix_copia_cola: String(p.boleto_pix || '[o Pix copia e cola entra aqui]'),
    endereco: String(cfg.endereco ?? '[endereço]'),
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
