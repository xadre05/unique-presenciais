// Recebe o aviso (webhook 2.0) que a Hotmart manda quando um pagamento muda de situação.
// Endereço: /functions/v1/hotmart-aviso?conta=hotmart_unique (ou hotmart_pra). Valida o Hottok cadastrado na tela.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
const quando = (ms: unknown) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : typeof ms === 'string' && ms ? new Date(ms).toISOString() : null)
const STATUS: Record<string, string> = {
  PURCHASE_APPROVED: 'APPROVED', PURCHASE_COMPLETE: 'COMPLETE', PURCHASE_CANCELED: 'CANCELED', PURCHASE_REFUNDED: 'REFUNDED',
  PURCHASE_CHARGEBACK: 'CHARGEBACK', PURCHASE_PROTEST: 'DISPUTE', PURCHASE_DELAYED: 'DELAYED', PURCHASE_EXPIRED: 'EXPIRED', PURCHASE_BILLET_PRINTED: 'BILLET_PRINTED',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return resp({ ok: true })
  const conta = new URL(req.url).searchParams.get('conta') ?? ''
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: integ } = await db.from('integracoes').select('id,ativa,traz_pagamentos').eq('id', conta).maybeSingle()
  if (!integ) return resp({ erro: 'conta desconhecida' }, 404)

  const corpo = await req.json().catch(() => null)
  if (!corpo) return resp({ erro: 'corpo inválido' }, 400)
  const { data: cred } = await db.rpc('ler_credenciais_integracao', { p_integracao: conta })
  const hottok = req.headers.get('x-hotmart-hottok') ?? corpo.hottok ?? ''
  if (!cred?.hottok || hottok !== cred.hottok) return resp({ erro: 'hottok inválido' }, 401)

  await db.from('integracoes').update({ ultimo_aviso_em: new Date().toISOString() }).eq('id', conta)
  if (!integ.ativa || !integ.traz_pagamentos) return resp({ ok: true, ignorado: 'integração desligada' })

  const evento = String(corpo.event ?? '')
  const d = corpo.data ?? {}
  const pu = d.purchase ?? {}
  const transacao = String(pu.transaction ?? '')
  if (!transacao) return resp({ ok: true, ignorado: 'sem transação' })   // ex.: abandono de carrinho, acesso à área de membros
  const rec = Number(pu.recurrence_number ?? pu.recurrency_number ?? 0) || null
  const id = rec ? `${transacao}#${rec}` : transacao
  const bruto = Number(pu.price?.value ?? pu.full_price?.value ?? 0) || null
  const produtor = (d.commissions ?? []).find((c: { source?: string }) => c.source === 'PRODUCER')
  const status = String(pu.status ?? STATUS[evento] ?? evento)

  const { data: ja } = await db.from('hotmart_pagamentos').select('id').eq('id', id).maybeSingle()
  const reg = {
    id, transacao, integracao_id: conta, status, evento,
    comprador_nome: d.buyer?.name ?? null, comprador_email: d.buyer?.email ?? null, comprador_doc: d.buyer?.document ?? null,
    produto_id: d.product?.id ?? null, produto_nome: d.product?.name ?? null, oferta_codigo: pu.offer?.code ?? null,
    valor: bruto, valor_liquido: produtor?.value ?? null,
    forma: pu.payment?.type ?? null, parcelas_cartao: pu.payment?.installments_number ?? null, recorrencia: rec,
    data_pedido: quando(pu.order_date), data_aprovacao: quando(pu.approved_date), bruto: corpo, atualizado_em: new Date().toISOString(),
  }
  if (ja) await db.from('hotmart_pagamentos').update({ status, evento, bruto: corpo, valor_liquido: reg.valor_liquido, comprador_doc: reg.comprador_doc, data_aprovacao: reg.data_aprovacao, atualizado_em: reg.atualizado_em }).eq('id', id)
  else await db.from('hotmart_pagamentos').insert(reg)
  const { data: r } = await db.rpc('processar_pagamento_hotmart', { p_id: id })
  return resp({ ok: true, resultado: r })
})
