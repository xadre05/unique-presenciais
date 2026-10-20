// Visão geral do dinheiro da empresa: o que entrou e saiu no mês, o que vai entrar e sair nos próximos meses,
// quanto está na rua (dívida) e o gráfico dos últimos 12 meses.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, hojeISO } from '../../lib/format'
import { Erro, Kpi } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { Barras, type Ponto } from './Barras'
import { FiltroTopo } from './FiltroTopo'
import { buscarTudo, comoConsulta, intervaloMes, mesDe, nomeMes, somaMes, somar, type Entrada, type Saida } from './dados'
import { quando, vaiEntrar, type Previsto } from './previsao/regras'

type Leve = Pick<Entrada, 'data' | 'liquido' | 'taxa' | 'bruto' | 'conta_id' | 'origem'>
type Divida = { valor_restante: number | null; valor_vencido: number | null; email: string | null; chave: string; integracao_id: string | null }

export default function VisaoGeral() {
  const hoje = hojeISO()
  const [mes, setMes] = useState(mesDe(hoje))
  const [conta, setConta] = useState('')
  const inicio12 = intervaloMes(somaMes(mesDe(hoje), -11))[0]
  const desde = inicio12 < intervaloMes(mes)[0] ? inicio12 : intervaloMes(mes)[0]
  const entradas = useConsulta<Leve[]>(() => comoConsulta(buscarTudo<Leve>((de, ate) => supabase.from('v_fin_entradas').select('data,liquido,taxa,bruto,conta_id,origem')
    .gte('data', desde).order('data').order('id').range(de, ate))), [desde])
  const integracoes = useConsulta<{ id: string; conta_id: string | null }[]>(() => supabase.from('integracoes').select('id,conta_id'), [])
  const saidas = useConsulta<Saida[]>(() => supabase.from('v_fin_saidas').select('*'), [])
  // o que vai entrar, no mês em que o dinheiro fica disponível (Parcelado Hotmart: dia 1º do mês seguinte) e já sem o que paga a antecipação
  const receber = useConsulta<Previsto[]>(() => supabase.from('v_fin_previsao').select('*'), [])
  const dividas = useConsulta<Divida[]>(() => supabase.from('cobrancas').select('valor_restante,valor_vencido,email,chave,integracao_id').not('etapa', 'in', '(paga,sem_acordo,encerrada)'), [])

  const daConta = <T extends { conta_id: string | null }>(xs: T[]) => (conta ? xs.filter((x) => x.conta_id === conta) : xs)
  const [ini, fim] = intervaloMes(mes)
  const doMes = useMemo(() => daConta(entradas.dados ?? []).filter((e) => e.data >= ini && e.data <= fim), [entradas.dados, conta, ini, fim]) // eslint-disable-line react-hooks/exhaustive-deps
  const saidasConta = daConta(saidas.dados ?? [])
  const pagasMes = saidasConta.filter((s) => s.pago_em && s.pago_em >= ini && s.pago_em <= fim)
  const aPagarMes = saidasConta.filter((s) => !s.pago_em && (s.vencimento ?? '') <= fim)
  const entrou = somar(doMes, (e) => e.liquido), saiu = somar(pagasMes, (s) => s.valor)

  const pontos: Ponto[] = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = somaMes(mesDe(hoje), i - 11)
    return {
      mes: m,
      entrou: somar(daConta(entradas.dados ?? []).filter((e) => mesDe(e.data) === m), (e) => e.liquido),
      saiu: somar(saidasConta.filter((s) => s.pago_em && mesDe(s.pago_em) === m), (s) => s.valor),
    }
  }), [entradas.dados, saidas.dados, conta, hoje]) // eslint-disable-line react-hooks/exhaustive-deps

  const proximos = Array.from({ length: 6 }, (_, i) => {
    const m = somaMes(mesDe(hoje), i)
    const rec = somar(daConta(receber.dados ?? []).filter((r) => vaiEntrar(r) && !!quando(r) && mesDe(quando(r)!) === m), (r) => r.valor)
    const pag = somar(saidasConta.filter((s) => !s.pago_em && s.vencimento && mesDe(s.vencimento) === m), (s) => s.valor)
    return { m, rec, pag }
  })
  const semData = somar(daConta(receber.dados ?? []).filter((r) => !vaiEntrar(r)), (r) => r.valor)
  const atrasadoPagar = somar(saidasConta.filter((s) => !s.pago_em && s.vencimento && s.vencimento < hoje), (s) => s.valor)
  // a dívida não tem conta bancária; filtrando por uma conta Hotmart, mostra só as dívidas daquela conta
  const contaDaIntegracao = (i: string | null) => (integracoes.dados ?? []).find((x) => x.id === i)?.conta_id ?? null
  const abertas = (dividas.dados ?? []).filter((d) => !conta || contaDaIntegracao(d.integracao_id) === conta)

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Financeiro</h1>
        <p className="muted">O dinheiro da empresa num lugar só: o que entrou (Hotmart, presencial e dívidas recuperadas), o que saiu, o que ainda vai entrar e quanto está na rua.</p></div></header>
      <FiltroTopo mes={mes} aoMudarMes={setMes} conta={conta} aoMudarConta={setConta} />
      <Erro msg={entradas.erro || saidas.erro || receber.erro || dividas.erro} />

      <section className="kpis">
        <Kpi rotulo={`Entrou em ${nomeMes(mes)}`} valor={entradas.carregando && !entradas.dados ? '…' : brl(entrou)} tom="ok" sub={`${doMes.length} recebimento(s) · taxas da Hotmart ${brl(somar(doMes, (e) => e.taxa))}`} />
        <Kpi rotulo={`Saiu em ${nomeMes(mes)}`} valor={brl(saiu)} sub={`${pagasMes.length} pagamento(s) lançado(s)`} />
        <Kpi rotulo="Resultado do mês" valor={brl(entrou - saiu)} tom={entrou - saiu >= 0 ? 'ok' : 'erro'} sub="entrou menos saiu" />
        <Kpi rotulo="A pagar até o fim do mês" valor={brl(somar(aPagarMes, (s) => s.valor))} tom={atrasadoPagar > 0 ? 'erro' : undefined} sub={atrasadoPagar > 0 ? `${brl(atrasadoPagar)} já atrasado` : `${aPagarMes.length} conta(s)`} />
      </section>

      <section className="bloco">
        <div className="fin-titulo"><h2>Entrou e saiu nos últimos 12 meses</h2><span className="muted pequeno"><span className="fin-leg fin-leg-entrou" /> entrou <span className="fin-leg fin-leg-saiu" /> saiu · clique num mês para ver</span></div>
        <Barras pontos={pontos} ativo={mes} aoClicar={setMes} />
      </section>

      <div className="fin-duas">
        <section className="bloco">
          <div className="fin-titulo"><h2>Próximos meses</h2><Link className="link pequeno" to="/financeiro/receber">Ver tudo a receber</Link></div>
          <table className="tabela">
            <thead><tr><th>Mês</th><th className="num">Vai entrar</th><th className="num">Vai sair</th><th className="num">Sobra</th></tr></thead>
            <tbody>{proximos.map((p) => <tr key={p.m}><td>{nomeMes(p.m)}</td><td className="num ok-txt">{brl(p.rec)}</td><td className="num">{brl(p.pag)}</td><td className={`num forte ${p.rec - p.pag < 0 ? 'erro-txt' : ''}`}>{brl(p.rec - p.pag)}</td></tr>)}</tbody>
          </table>
          <p className="muted pequeno">Vai entrar: no mês em que o dinheiro fica disponível (o Parcelado Hotmart libera no dia 1º do mês seguinte, já sem o que paga a antecipação), parcelas do presencial e acordos.{semData > 0 && ` Mais ${brl(semData)} pendente (atrasado, sem data ou a conferir): veja em Previsão de caixa.`} Vai sair: despesas lançadas e comissões liberadas ainda não pagas.</p>
        </section>
        <section className="bloco">
          <div className="fin-titulo"><h2>Dinheiro na rua</h2><Link className="link pequeno" to="/cobrancas">Abrir a cobrança</Link></div>
          <div className="fin-rua">
            <div><span className="muted pequeno">Dívida total</span><b className="erro-txt">{brl(somar(abertas, (d) => d.valor_restante))}</b></div>
            <div><span className="muted pequeno">Já venceu</span><b>{brl(somar(abertas, (d) => d.valor_vencido))}</b></div>
            <div><span className="muted pequeno">Pessoas</span><b>{new Set(abertas.map((d) => d.email ?? d.chave)).size}</b></div>
          </div>
          <p className="muted pequeno">Alunos que pararam de pagar (online e presencial). A cobrança, a notificação e a negativação ficam na área Comercial, em Cobranças.</p>
          <div className="fin-aviso"><Icone nome="info" tam={18} /><span><b>Saldo na Hotmart, antecipações e saques</b> ainda não aparecem aqui: a Hotmart não entrega isso pela integração. Com o arquivo do Extrato exportado da Hotmart, isso entra também.</span></div>
        </section>
      </div>
    </div>
  )
}

