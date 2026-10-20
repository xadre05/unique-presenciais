// Compras pagas com o cartão Hotmart (saem direto do saldo): total do ano por estabelecimento (Facebook Ads, Google…)
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { brl } from '../../../lib/format'
import { somar } from '../dados'

type Linha = { descricao: string; valor: number }
const estabelecimento = (d: string) => {
  const t = d.replace(/^Lançamento de (débito|crédito)\s*/i, '').replace(/[()]/g, '').trim()
  const n = t.split(/[\s*]+/)[0]?.toUpperCase() ?? 'OUTROS'
  return n === 'FACEBK' || n === 'METAPAY' ? 'Facebook / Meta Ads' : n || 'OUTROS'
}

export function CartaoHotmart({ conta, ano }: { conta: string; ano: string }) {
  const q = useConsulta<Linha[]>(() => {
    let c = supabase.from('hotmart_extrato').select('descricao,valor').in('categoria', ['Compra com cartão ou saldo', 'Reembolso cartão hotmart'])
      .gte('data_efetivacao', `${ano}-01-01`).lte('data_efetivacao', `${ano}-12-31`).limit(5000)
    if (conta) c = c.eq('integracao_id', conta)
    return c
  }, [conta, ano])
  const porLoja = new Map<string, number>()
  for (const l of q.dados ?? []) porLoja.set(estabelecimento(l.descricao), (porLoja.get(estabelecimento(l.descricao)) ?? 0) + Number(l.valor))
  const top = [...porLoja.entries()].sort((a, b) => a[1] - b[1]).slice(0, 12)
  if (!top.length) return null
  return (
    <section className="bloco">
      <div className="fin-titulo"><h2>Cartão Hotmart em {ano}</h2><span className="muted">{brl(-somar(q.dados ?? [], (l) => l.valor))}</span></div>
      <table className="tabela"><tbody>{top.map(([n, v]) => <tr key={n}><td>{n}</td><td className="num">{brl(-v)}</td></tr>)}</tbody></table>
      <p className="muted pequeno">Essas compras saem do saldo da Hotmart antes de o dinheiro ir para o banco. Vão entrar no contas a pagar.</p>
    </section>
  )
}
