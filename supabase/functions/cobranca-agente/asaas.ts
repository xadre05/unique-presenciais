// Asaas (boleto com Pix) para o acordo da IA. CÓPIA do que a função notificacao usa (supabase/functions/notificacao/index.ts):
// mantenha as duas iguais.
const base = (k: string) => (k.includes('_hmlg_') ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3')
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

export async function asaas(k: string, caminho: string, metodo = 'GET', corpo?: unknown) {
  const r = await fetch(base(k) + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', access_token: k, 'User-Agent': 'unique-comercial' }, body: corpo ? JSON.stringify(corpo) : undefined })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Asaas: ${(d?.errors ?? []).map((e: { description?: string }) => e.description).join('; ') || r.status}`)
  return d
}

type End = { zip_code?: string; address?: string; number?: string; complement?: string; neighborhood?: string } | null
type Pessoa = { nome: string; cpf: string; email: string; telefone: string; end: End; ref: string }
async function cliente(k: string, p: Pessoa) {
  const achado = await asaas(k, `/customers?cpfCnpj=${p.cpf}`)
  if (achado?.data?.[0]?.id) return achado.data[0].id as string
  const novo = await asaas(k, '/customers', 'POST', {
    name: p.nome, cpfCnpj: p.cpf, email: p.email || undefined, mobilePhone: digitos(p.telefone).replace(/^55(?=\d{10,11}$)/, '') || undefined, externalReference: p.ref,
    postalCode: digitos(p.end?.zip_code) || undefined, address: p.end?.address, addressNumber: p.end?.number, complement: p.end?.complement, province: p.end?.neighborhood,
    notificationDisabled: true,
  })
  return novo.id as string
}

// boleto com Pix (a pessoa escolhe na página do Asaas); devolve o id e o link da página de pagamento
export async function boletoAsaas(k: string, p: Pessoa, valor: number, vencimento: string, descricao: string, grupo: string) {
  const pag = await asaas(k, '/payments', 'POST', { customer: await cliente(k, p), billingType: 'UNDEFINED', value: valor, dueDate: vencimento, description: descricao.slice(0, 480), externalReference: grupo })
  return { id: String(pag.id), url: String(pag.invoiceUrl ?? pag.bankSlipUrl ?? '') }
}
export const cancelarAsaas = (k: string, id: string) => asaas(k, `/payments/${encodeURIComponent(id)}`, 'DELETE')
