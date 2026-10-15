// Área do online: tudo o que vem da Hotmart e não é curso presencial.
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConsulta, buscarTudo } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno } from '../lib/format'
import { Badge, Erro, KpiIcone, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'

export type CompraOnline = {
  em: string; produto_id: number | null; oferta_codigo: string | null; np: number; comprador_nome: string | null; produto_nome: string | null; integracao_id: string
  pagas: number; estornos: number; ultima_cobranca: number | null; primeira_data: string | null; ultima_data: string | null; total_pago: number | null; total_liquido: number | null
  valor_parcela: number | null; liquido_parcela: number | null; rastreio: string | null; forma: string | null; restantes: number; proxima_data: string | null
  situacao: 'em_dia' | 'atrasado' | 'quitado' | 'estornado' | 'desistiu'; a_receber_liquido: number; a_receber_bruto: number; vendedora_nome: string | null
}
type PagOnline = { id: string; comprador_nome: string | null; comprador_email: string; produto_nome: string | null; valor: number | null; valor_liquido: number | null; forma: string | null; parcelas_cartao: number | null; recorrencia: number | null; dia: string; rastreio: string | null; comissao: number | null; vendedora_nome: string | null }
type Previsao = { mes: string; parcelas: number; bruto: number; liquido: number; de_atrasados: number; liquido_em_dia: number; parcelas_em_dia: number }
type Atraso = CompraOnline & { cobrancas_vencidas: number; valor_vencido: number; parou_em: string }

export const SITUACAO_ONLINE: Record<string, { rotulo: string; tom: string }> = {
  em_dia: { rotulo: 'Em dia', tom: 'ok' }, atrasado: { rotulo: 'Atrasado', tom: 'erro' }, quitado: { rotulo: 'Quitado', tom: 'neutro' }, estornado: { rotulo: 'Estornado', tom: 'alerta' }, desistiu: { rotulo: 'Parou de pagar (+6 meses)', tom: 'neutro' },
}
const FORMA: Record<string, string> = { CREDIT_CARD: 'Cartão', BILLET: 'Boleto', PIX: 'Pix', PAYPAL: 'PayPal', GOOGLE_PAY: 'Google Pay', APPLE_PAY: 'Apple Pay' }
const mesAtual = () => hojeISO().slice(0, 7)
const parcelaTxt = (c: CompraOnline) => c.ultima_cobranca ? `${c.ultima_cobranca}/${c.np}` : c.np > 1 ? `${c.np}x no cartão` : 'à vista'
const dias = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000) : 0

function useOnline() {
  // compras com pagamento nos últimos 24 meses (o histórico inteiro tem milhares de linhas)
  const compras = useConsulta<CompraOnline[]>(() => buscarTudo<CompraOnline>((de, ate) => supabase.from('v_online_compras').select('*')
    .gte('ultima_data', new Date(Date.now() - 730 * 864e5).toISOString()).order('em').order('produto_id').order('oferta_codigo').order('np').range(de, ate)))
  const previsao = useConsulta<Previsao[]>(() => supabase.from('v_online_previsao').select('*').order('mes'))
  const pags = useConsulta<PagOnline[]>(() => supabase.from('v_online_pagamentos').select('id,comprador_nome,comprador_email,produto_nome,valor,valor_liquido,forma,parcelas_cartao,recorrencia,dia,rastreio,comissao,vendedora_nome').gte('data_aprovacao', new Date(Date.now() - 400 * 864e5).toISOString()).order('data_aprovacao', { ascending: false }).limit(1000))
  const atrasos = useConsulta<Atraso[]>(() => supabase.from('v_online_atrasos').select('*').order('proxima_data'))
  return { compras, previsao, pags, atrasos }
}

/* ───────── Painel ───────── */
const somaLiq = (xs: PagOnline[]) => xs.reduce((s, p) => s + Number(p.valor_liquido ?? 0), 0)

export function PainelOnline() {
  const { compras, previsao, pags, atrasos } = useOnline()
  const m = mesAtual()
  const todos = pags.dados ?? []
  const doMes = todos.filter((p) => p.dia.startsWith(m))
  const prevMes = (previsao.dados ?? []).find((p) => p.mes.startsWith(m))
  const at = atrasos.dados ?? []
  const novas = (compras.dados ?? []).filter((c) => (c.primeira_data ?? '').slice(0, 7) === m && (c.ultima_cobranca == null || c.ultima_cobranca <= c.pagas))
  const vendido = novas.reduce((s, c) => s + (c.ultima_cobranca != null ? Number(c.liquido_parcela ?? 0) * c.np : Number(c.total_liquido ?? 0)), 0)
  const emDia = (compras.dados ?? []).filter((c) => c.situacao === 'em_dia')
  const mesNome = mesAno(m + '-01').split(' ')[0]
  if (pags.carregando && !pags.dados) return null
  return (<>
    <h2 className="titulo-secao">Online <span className="muted pequeno">· pagamentos da Hotmart, valores líquidos, sem os cursos presenciais · <Link to="/pagamentos?area=online" className="link">ver tudo do online</Link></span></h2>
    <section className="kpis kpis-5">
      <KpiIcone icone="sacola" rotulo={`Vendido em ${mesNome}`} valor={brl(vendido)} sub={`${novas.length} compra(s) nova(s), valor do contrato`} destaque />
      <KpiIcone icone="moedas" rotulo={`Recebido em ${mesNome}`} valor={brl(somaLiq(doMes))} tom="ok" sub={`${doMes.length} pagamento(s) até hoje`} />
      <KpiIcone icone="relogio" rotulo={`Ainda deve cair em ${mesNome}`} valor={brl(prevMes?.liquido_em_dia ?? 0)} tom="info" sub={`${prevMes?.parcelas_em_dia ?? 0} parcela(s) de quem está em dia`} />
      <KpiIcone icone="documento" rotulo="A receber" valor={brl(emDia.reduce((s, c) => s + Number(c.a_receber_liquido), 0))} sub={`${emDia.length} parcelamento(s) em dia`} />
      <KpiIcone icone="alerta" rotulo="Em atraso" valor={brl(at.reduce((s, a) => s + Number(a.valor_vencido), 0))} tom="erro" sub={`${at.reduce((s, a) => s + a.cobrancas_vencidas, 0)} cobrança(s) vencida(s) · ${at.length} aluno(s)`} subTom={at.length ? 'erro' : undefined} />
    </section>
    <Erro msg={compras.erro || previsao.erro || pags.erro || atrasos.erro} />
  </>)
}

/* ───────── Pagamentos ───────── */
export function PagamentosOnline() {
  const { compras, previsao, pags, atrasos } = useOnline()
  const [aba, setAba] = useState<'atrasados' | 'previsao' | 'recebidos'>('atrasados')
  const [busca, setBusca] = useState('')
  const [mes, setMes] = useState(mesAtual())
  const atrasados = atrasos.dados ?? []
  const emDia = (compras.dados ?? []).filter((c) => c.situacao === 'em_dia')
  const futuro = (previsao.dados ?? []).filter((p) => p.mes.slice(0, 7) >= mesAtual())
  const t = busca.trim().toLowerCase()
  const meses = [...new Set((pags.dados ?? []).map((p) => p.dia.slice(0, 7)))].sort().reverse()
  const recebidos = (pags.dados ?? []).filter((p) => (!mes || p.dia.startsWith(mes)) && (!t || `${p.comprador_nome} ${p.comprador_email} ${p.produto_nome}`.toLowerCase().includes(t)))
  const maxPrev = Math.max(1, ...futuro.map((p) => Number(p.liquido_em_dia)))

  return (<>
    <div className="faixa-info"><Icone nome="info" tam={18} /><span>Vendas do online lidas da Hotmart (as duas contas), sem os cursos presenciais. Valores <b>líquidos</b> (o que cai para você). A previsão considera as cobranças mensais dos parcelamentos da Hotmart; cartão parcelado comum já caiu inteiro.</span></div>
    <section className="resumo-com">
      <button className={`resumo-card rc-pend${aba === 'atrasados' ? ' ativo' : ''}`} onClick={() => setAba('atrasados')}><span className="resumo-icone ic-erro"><Icone nome="alerta" tam={22} /></span><div><div>Vencido sem pagamento</div><b>{brl(atrasados.reduce((s, c) => s + Number(c.valor_vencido), 0))}</b><small>{atrasados.length} aluno(s) · {atrasados.reduce((s, c) => s + c.cobrancas_vencidas, 0)} cobrança(s)</small></div><Icone nome="seta" /></button>
      <button className={`resumo-card rc-lib${aba === 'previsao' ? ' ativo' : ''}`} onClick={() => setAba('previsao')}><span className="resumo-icone ic-info"><Icone nome="agenda" tam={22} /></span><div><div>Ainda a receber de quem está em dia</div><b>{brl(emDia.reduce((s, c) => s + Number(c.a_receber_liquido), 0))}</b><small>{emDia.length} parcelamento(s), de {mesAno(mesAtual() + '-01')} em diante</small></div><Icone nome="seta" /></button>
      <button className={`resumo-card rc-paga${aba === 'recebidos' ? ' ativo' : ''}`} onClick={() => setAba('recebidos')}><span className="resumo-icone ic-ok"><Icone nome="check" tam={22} /></span><div><div>Recebido em {mesAno(mesAtual() + '-01')}</div><b>{brl((pags.dados ?? []).filter((p) => p.dia.startsWith(mesAtual())).reduce((s, p) => s + Number(p.valor_liquido ?? 0), 0))}</b><small>líquido</small></div><Icone nome="seta" /></button>
    </section>
    <Erro msg={compras.erro || previsao.erro || pags.erro} />

    {aba === 'atrasados' && (atrasados.length === 0 ? <Vazio>Nenhum aluno do online atrasado.</Vazio> : (
      <div className="tabela-wrap bloco sem-padding">
        <p className="muted pequeno" style={{ padding: '12px 16px 0', margin: 0 }}><b>Vencido</b> = cobranças que já deviam ter caído e não caíram. <b>Restante do plano</b> = tudo que falta, se a pessoa voltar a pagar até o fim. “Atrasado” só depois de 5 dias da data esperada.</p>
        <table className="tabela">
          <thead><tr><th>Aluno</th><th>Produto</th><th>Última paga</th><th>Parou em</th><th className="num">Vencido</th><th className="num">Restante do plano</th><th>Vendedora</th></tr></thead>
          <tbody>{[...new Set(atrasados.map((a) => a.parou_em))].sort().map((mm) => (
            <Fragment key={mm}>
              <tr className="linha-grupo"><td colSpan={7}>Pararam de pagar em <b>{mesAno(mm)}</b> · {atrasados.filter((a) => a.parou_em === mm).length} aluno(s) · vencido {brl(atrasados.filter((a) => a.parou_em === mm).reduce((s, a) => s + Number(a.valor_vencido), 0))}</td></tr>
              {atrasados.filter((a) => a.parou_em === mm).map((c) => (
                <tr key={c.em + c.produto_id + c.oferta_codigo + c.np}>
                  <td><div className="forte">{c.comprador_nome}</div><div className="muted pequeno">{c.em}</div></td>
                  <td className="pequeno">{c.produto_nome}</td>
                  <td className="pequeno">parcela {parcelaTxt(c)}<div className="muted">em {dataBR(c.ultima_data)}</div></td>
                  <td><b className="erro-txt">{dataBR(c.proxima_data)}</b><div className="muted pequeno">{dias(c.proxima_data)} dias</div></td>
                  <td className="num forte">{brl(c.valor_vencido)}<div className="muted pequeno">{c.cobrancas_vencidas} cobrança(s) de {brl(c.liquido_parcela)}</div></td>
                  <td className="num">{brl(c.a_receber_liquido)}<div className="muted pequeno">{c.restantes} parcela(s)</div></td>
                  <td className="pequeno">{c.vendedora_nome ?? '—'}</td>
                </tr>))}
            </Fragment>))}</tbody>
        </table>
        <p className="muted pequeno" style={{ padding: '0 16px 12px' }}>Pode ser cartão recusado, boleto não pago ou plano cancelado na Hotmart. Confira lá antes de cobrar.</p>
      </div>
    ))}

    {aba === 'previsao' && (<>
      <section className="bloco">
        <h2>Quanto ainda vai cair, mês a mês</h2>
        {futuro.length === 0 ? <Vazio>Nenhuma parcela futura.</Vazio> : (
          <div className="prev-barras">{futuro.map((p) => (
            <div key={p.mes} className="prev-linha">
              <span className="prev-mes">{mesAno(p.mes)}</span>
              <span className="prev-barra"><i style={{ width: `${(Number(p.liquido_em_dia) / maxPrev) * 100}%` }} /></span>
              <b>{brl(p.liquido_em_dia)}</b><span className="muted pequeno">{p.parcelas_em_dia} parcela(s){p.de_atrasados > 0 ? ` · +${brl(Number(p.liquido) - Number(p.liquido_em_dia))} se os atrasados voltarem` : ''}</span>
            </div>))}</div>
        )}
        <p className="muted pequeno">Só parcelas de quem está em dia. Não inclui vendas novas nem cartão parcelado comum (esse já caiu inteiro).</p>
      </section>
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela compacta">
          <thead><tr><th>Aluno</th><th>Produto</th><th>Parcela</th><th>Próxima</th><th className="num">Valor</th><th className="num">Falta</th><th>Vendedora</th></tr></thead>
          <tbody>{emDia.sort((a, b) => (a.proxima_data ?? '').localeCompare(b.proxima_data ?? '')).map((c) => (
            <tr key={c.em + c.produto_id + c.oferta_codigo + c.np}><td className="forte">{c.comprador_nome}</td><td className="pequeno">{c.produto_nome}</td><td>{parcelaTxt(c)}</td><td>{dataBR(c.proxima_data)}</td><td className="num">{brl(c.liquido_parcela)}</td><td className="num">{brl(c.a_receber_liquido)}</td><td className="pequeno">{c.vendedora_nome ?? '—'}</td></tr>))}</tbody>
        </table>
      </div>
    </>)}

    {aba === 'recebidos' && (<>
      <div className="filtros-comissoes">
        <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar aluno, e-mail ou produto" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <label className="select-icone"><select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos os meses</option>{meses.map((x) => <option key={x} value={x}>{mesAno(x + '-01')}</option>)}</select></label>
      </div>
      <p className="muted pequeno">{recebidos.length} pagamento(s) · bruto {brl(recebidos.reduce((s, p) => s + Number(p.valor ?? 0), 0))} · <b>líquido {brl(recebidos.reduce((s, p) => s + Number(p.valor_liquido ?? 0), 0))}</b> · comissões {brl(recebidos.reduce((s, p) => s + Number(p.comissao ?? 0), 0))}</p>
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela compacta">
          <thead><tr><th>Data</th><th>Aluno</th><th>Produto</th><th>Forma</th><th className="num">Pago</th><th className="num">Líquido</th><th>Vendedora</th></tr></thead>
          <tbody>{recebidos.map((p) => (
            <tr key={p.id}><td className="pequeno">{dataBR(p.dia)}</td><td><div className="forte">{p.comprador_nome}</div><div className="muted pequeno">{p.comprador_email}</div></td>
              <td className="pequeno">{p.produto_nome}{p.recorrencia ? <div className="muted">cobrança {p.recorrencia}{p.parcelas_cartao ? `/${p.parcelas_cartao}` : ''}</div> : (p.parcelas_cartao ?? 1) > 1 ? <div className="muted">{p.parcelas_cartao}x no cartão</div> : null}</td>
              <td className="pequeno">{FORMA[p.forma ?? ''] ?? p.forma}</td><td className="num">{brl(p.valor)}</td><td className="num">{brl(p.valor_liquido)}</td>
              <td className="pequeno">{p.vendedora_nome ? <>{p.vendedora_nome} <span className="muted">({brl(p.comissao)})</span></> : p.rastreio ? <span className="muted">{p.rastreio}</span> : '—'}</td></tr>))}</tbody>
        </table>
      </div>
    </>)}
  </>)
}

/* ───────── Alunos ───────── */
export function AlunosOnline() {
  const { compras } = useOnline()
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const t = busca.trim().toLowerCase()
  const alunos = useMemo(() => {
    const g = new Map<string, CompraOnline[]>()
    for (const c of compras.dados ?? []) g.set(c.em, [...(g.get(c.em) ?? []), c])
    const ordem = ['atrasado', 'em_dia', 'estornado', 'desistiu', 'quitado']
    return [...g.entries()].map(([em, cs]) => ({
      em, nome: cs[0].comprador_nome ?? em, compras: cs,
      situacao: ordem.find((o) => cs.some((c) => c.situacao === o)) ?? 'quitado',
      pago: cs.reduce((s, c) => s + Number(c.total_liquido ?? 0), 0),
      aberto: cs.reduce((s, c) => s + Number(c.a_receber_liquido ?? 0), 0),
      ultima: cs.map((c) => c.ultima_data ?? '').sort().at(-1) ?? '',
      vendedora: [...new Set(cs.map((c) => c.vendedora_nome).filter(Boolean))].join(', '),
    })).filter((a) => (!t || `${a.nome} ${a.em} ${a.compras.map((c) => c.produto_nome).join(' ')}`.toLowerCase().includes(t)) && (!situacao || a.situacao === situacao))
      .sort((a, b) => b.ultima.localeCompare(a.ultima))
  }, [compras.dados, t, situacao])
  return (<>
    <p className="muted">Quem comprou no online (Hotmart) com pagamento nos últimos 2 anos, juntando as duas contas. Uma linha por pessoa; valores líquidos.</p>
    <div className="filtros-alunos">
      <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar por nome, e-mail ou produto" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      <label className="select-icone"><select value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todas as situações</option>{Object.entries(SITUACAO_ONLINE).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select></label>
    </div>
    <Erro msg={compras.erro} />
    {alunos.length === 0 && !compras.carregando ? <Vazio>Ninguém com esses filtros.</Vazio> : (
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela">
          <thead><tr><th>Aluno</th><th>Produtos</th><th>Último pagamento</th><th className="num">Pago (líquido)</th><th className="num">Em aberto</th><th>Situação</th><th>Vendedora</th></tr></thead>
          <tbody>{alunos.slice(0, 300).map((a) => (
            <tr key={a.em}>
              <td><div className="forte">{a.nome}</div><div className="muted pequeno">{a.em}</div></td>
              <td className="pequeno">{a.compras.map((c) => <div key={String(c.produto_id) + c.oferta_codigo + c.np}>{c.produto_nome} <span className="muted">· {parcelaTxt(c)}</span></div>)}</td>
              <td className="pequeno">{dataBR(a.ultima)}</td>
              <td className="num">{brl(a.pago)}</td>
              <td className="num">{a.aberto > 0 ? brl(a.aberto) : '—'}</td>
              <td><Badge tom={SITUACAO_ONLINE[a.situacao]?.tom}>{SITUACAO_ONLINE[a.situacao]?.rotulo}</Badge></td>
              <td className="pequeno">{a.vendedora || '—'}</td>
            </tr>))}</tbody>
        </table>
        {alunos.length > 300 && <p className="muted pequeno" style={{ padding: '0 16px 12px' }}>Mostrando 300 de {alunos.length}. Use a busca.</p>}
      </div>
    )}
  </>)
}
