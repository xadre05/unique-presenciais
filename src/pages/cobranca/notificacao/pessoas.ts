// Regras da tela de notificação (sem tela): em que aba cada dívida está, e o agrupamento por pessoa (CPF),
// porque sai uma carta e um boleto por pessoa somando os cursos dela.
import { aberta, type Cobranca } from '../dados'
import { contaItem, type Conferencia, type Config, type Extra, type Item } from './modelo'

export type Aba = 'para_notificar' | 'conferir' | 'aguardando' | 'notificada' | 'prazo_vencido' | 'negativacao' | 'paga'
export const ABAS: [Aba, string][] = [
  ['para_notificar', 'Prontas para notificar'], ['conferir', 'Conferir na Hotmart'], ['aguardando', 'Compras recentes'],
  ['notificada', 'Prazo correndo'], ['prazo_vencido', 'Prazo vencido'], ['negativacao', 'Negativação'], ['paga', 'Pagaram'],
]

const temDuvida = (c: Cobranca, k?: Conferencia) => !!k?.duvidas?.length && !c.conferido_hotmart_em
const recente = (k: Conferencia | undefined, cfg: Config | null) => !k?.compra_em || (!!cfg && k.compra_em > cfg.compra_ate)

export function abaDe(c: Cobranca, k: Conferencia | undefined, cfg: Config | null): Aba | null {
  if (c.origem !== 'online') return null   // presencial: aguardando o contrato assinado ir para o advogado
  if (c.fase_legal === 'paga') return 'paga'
  if (c.fase_legal === 'negativacao_pedida' || c.fase_legal === 'negativada' || c.fase_legal === 'advogado') return 'negativacao'
  if (c.fase_legal === 'notificada' || c.fase_legal === 'prazo_vencido') return c.fase_legal
  if (!aberta(c) || c.fase_legal) return null
  if (recente(k, cfg)) return 'aguardando'
  return temDuvida(c, k) ? 'conferir' : 'para_notificar'
}

export type Pessoa = {
  chave: string; nome: string; email: string | null; telefone: string | null; cpf: string | null
  cobrancas: Cobranca[]; itens: Item[]; principal: number; encargos: number; total: number
  parou_em: string | null; compra_em: string | null; pendencias: string[]
}

// junta as dívidas da mesma pessoa (CPF; sem CPF, pelo e-mail). Depois de notificada, junta pelo boleto.
export function agrupar(cs: Cobranca[], conf: Map<string, Conferencia>, ex: Map<string, Extra>, cfg: Config | null, hoje: string): Pessoa[] {
  const grupos = new Map<string, Cobranca[]>()
  for (const c of cs) {
    const k = conf.get(c.id)
    const chave = c.boleto_id ? `b:${c.boleto_id}` : k?.cpf ? `c:${k.cpf.replace(/\D/g, '')}` : `e:${(c.email ?? c.id).toLowerCase()}`
    grupos.set(chave, [...(grupos.get(chave) ?? []), c])
  }
  return [...grupos.entries()].map(([chave, lista]) => {
    const itens = lista.map((c) => itemDe(c, conf.get(c.id), ex.get(c.id)))
    const contas = itens.map((it) => contaItem(it, hoje, Number(cfg?.multa_pct ?? 2), Number(cfg?.juros_mes_pct ?? 1)))
    const soma = (f: (x: { principal: number; encargos: number; total: number }) => number) => Math.round(contas.reduce((s, x) => s + f(x), 0) * 100) / 100
    const notificada = lista.some((c) => c.boleto_id)
    const c0 = lista[0], k0 = conf.get(c0.id)
    const doc = (k0?.cpf ?? ex.get(c0.id)?.documento ?? '').replace(/\D/g, '')
    const pend: string[] = []
    if (!c0.email) pend.push('e-mail')
    if (doc.length !== 11 && doc.length !== 14) pend.push('CPF')
    if (!notificada && !enderecoBoleto(ex.get(c0.id))) pend.push('endereço')
    return {
      chave, nome: c0.aluno_nome ?? 'Sem nome', email: c0.email, telefone: lista.find((c) => c.telefone)?.telefone ?? null, cpf: doc || null, cobrancas: lista, itens,
      principal: notificada ? lista.reduce((s, c) => s + Number(c.boleto_principal ?? 0), 0) : soma((x) => x.principal),
      encargos: notificada ? lista.reduce((s, c) => s + Number(c.boleto_encargos ?? 0), 0) : soma((x) => x.encargos),
      total: notificada ? lista.reduce((s, c) => s + Number(c.boleto_valor ?? 0), 0) : soma((x) => x.total),
      parou_em: lista.map((c) => c.parou_em).filter(Boolean).sort()[0] ?? null,
      compra_em: lista.map((c) => conf.get(c.id)?.compra_em).filter(Boolean).sort()[0] ?? null,
      pendencias: pend,
    }
  }).sort((a, b) => (a.parou_em ?? '').localeCompare(b.parou_em ?? ''))
}

function itemDe(c: Cobranca, k: Conferencia | undefined, e: Extra | undefined): Item {
  const parcela = Number(k?.valor_parcela ?? e?.valor_parcela ?? 0)
  return {
    produto: c.produto ?? 'curso', data_compra: e?.data_compra ?? k?.compra_em ?? null, parcelas_total: k?.np ?? e?.parcelas_total ?? null,
    parcelas_pagas: k?.pagas ?? e?.parcelas_pagas ?? null, valor_parcela: parcela, parou_em: k?.parou_em ?? c.parou_em,
    vencidas: Number(k?.vencidas ?? (parcela ? Math.round(Number(c.valor_vencido ?? 0) / parcela) : 0)),
  }
}

// endereço completo no Brasil (rua, cidade, UF e CEP) é exigido pelo banco no boleto
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
export function enderecoBoleto(ex: Extra | undefined) {
  const e = ex?.endereco ?? {}
  return String(e.zip_code ?? '').replace(/\D/g, '').length === 8 && !!e.address && !!e.city && UFS.includes(String(e.state ?? '').toUpperCase())
}

// endereço completo é exigido pelo Serasa para negativar
export function semEndereco(ex: Extra | undefined) {
  const e = ex?.endereco ?? {}
  return !String(e.zip_code ?? '').replace(/\D/g, '') || !e.address || !e.neighborhood
}
