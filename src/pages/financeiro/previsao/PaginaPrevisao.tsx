// Previsão de caixa: o que já entrou e o que ainda vai entrar no período, separado pelo jeito que o dinheiro chega
// (Parcelado Hotmart cobra sozinho; Pix, boleto e acordos dependem de cobrar). Pendências (atrasado, sem data,
// aluno avisou que pagou) ficam à parte, com o que fazer. Atualiza sozinho com a Hotmart e o presencial.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { brl, hojeISO } from '../../../lib/format'
import { Erro, Kpi } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { FiltroTopo } from '../FiltroTopo'
import { comoConsulta, entradasEntre, intervaloMes, mesDe, somar, type Entrada, type Parcelado } from '../dados'
import { NOME_JEITO, PERIODOS, intervaloDo, jeitoEntrada, jeitoPrevisto, quando, type Jeito, type Periodo, type Previsto } from './regras'
import { ComoEntra } from './ComoEntra'
import { Pendencias, LinhaDoTempo, JaEntrou } from './ListasPrevisao'
import { SaldoHotmart } from './SaldoHotmart'
import { Antecipacao } from './Antecipacao'

type Cobra = '' | 'auto' | 'manual'

export default function PaginaPrevisao() {
  const hoje = hojeISO()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [conta, setConta] = useState('')
  const [jeito, setJeito] = useState<Jeito | ''>('')
  const [cobra, setCobra] = useState<Cobra>('')
  const [ini, fim] = intervaloDo(periodo, hoje)
  const prev = useConsulta<Previsto[]>(() => supabase.from('v_fin_previsao').select('*').order('data', { nullsFirst: false }), [])
  // o que já entrou neste mês (só o período "Este mês" começa antes de hoje)
  const ent = useConsulta<Entrada[]>(() => comoConsulta(entradasEntre(intervaloMes(mesDe(hoje))[0], hoje, '')), [hoje])
  const comPassado = periodo === 'mes'
  const parc = useConsulta<Parcelado[]>(() => supabase.from('v_fin_parcelado').select('*').order('nome'), [])

  const passa = (conta_id: string | null, j: Jeito, auto: boolean) =>
    (!conta || conta_id === conta) && (!jeito || j === jeito) && (!cobra || (cobra === 'auto') === auto)
  const previstos = useMemo(() => (prev.dados ?? []).filter((p) => passa(p.conta_id, jeitoPrevisto(p), p.automatico)), [prev.dados, conta, jeito, cobra]) // eslint-disable-line react-hooks/exhaustive-deps
  const entradas = useMemo(() => (ent.dados ?? []).filter((e) => passa(e.conta_id, jeitoEntrada(e), jeitoEntrada(e) === 'parcelado_hotmart')), [ent.dados, conta, jeito, cobra]) // eslint-disable-line react-hooks/exhaustive-deps

  const desde = ini > hoje ? ini : hoje
  const vaiEntrar = previstos.filter((p) => { const q = quando(p); return p.situacao === 'a_vencer' && !!q && q >= desde && q <= fim })
  const pendentes = previstos.filter((p) => p.situacao !== 'a_vencer')
  const entrou = comPassado ? somar(entradas, (e) => e.liquido) : 0, vai = somar(vaiEntrar, (p) => p.valor), pend = somar(pendentes, (p) => p.valor)
  const auto = somar(vaiEntrar.filter((p) => p.automatico), (p) => p.valor)
  const segura = somar(vaiEntrar, (p) => p.valor_aluno - p.valor)
  const nomePeriodo = PERIODOS.find(([id]) => id === periodo)?.[1].toLowerCase() ?? ''

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Previsão de caixa</h1>
        <p className="muted">O que já entrou e o que ainda vai entrar. Atualiza sozinho com a Hotmart e com as parcelas do presencial.</p></div></header>
      <nav className="abas fin-periodos" aria-label="Período">{PERIODOS.map(([id, nome]) => <button key={id} className={periodo === id ? 'ativa' : ''} onClick={() => setPeriodo(id)}>{nome}</button>)}</nav>
      <FiltroTopo semMes mes="" aoMudarMes={() => undefined} conta={conta} aoMudarConta={setConta}>
        <label className="select-icone"><Icone nome="moedas" tam={16} /><select value={jeito} onChange={(e) => setJeito(e.target.value as Jeito | '')} aria-label="Forma">
          <option value="">Todas as formas</option>{Object.entries(NOME_JEITO).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label className="select-icone"><Icone nome="trocar" tam={16} /><select value={cobra} onChange={(e) => setCobra(e.target.value as Cobra)} aria-label="Cobrança">
          <option value="">Automático e manual</option><option value="auto">Só automático (a Hotmart cobra)</option><option value="manual">Só o que depende de cobrar</option></select></label>
        {(conta || jeito || cobra) && <button className="link pequeno" onClick={() => { setConta(''); setJeito(''); setCobra('') }}>Limpar filtros</button>}
      </FiltroTopo>
      <Erro msg={prev.erro || ent.erro || parc.erro} />

      <section className="kpis">
        {comPassado && <Kpi rotulo={`Já entrou (${nomePeriodo})`} valor={brl(entrou)} tom="ok" sub={`${entradas.length} pagamento(s) até hoje`} />}
        <Kpi rotulo="Ainda vai entrar" valor={brl(vai)} tom="info" sub={`${brl(auto)} automático · ${brl(vai - auto)} depende de cobrar`} />
        <Kpi rotulo="Pendente, sem data certa" valor={brl(pend)} tom={pend ? 'alerta' : undefined} sub={`${pendentes.length} parcela(s): atrasadas, sem data ou a conferir`} />
        <Kpi rotulo="Fica com a Hotmart (antecipação)" valor={brl(segura)} sub="parcelas que pagam o que ela já adiantou" />
      </section>
      {comPassado && <p className="fin-total">Se tudo que está previsto entrar, {nomePeriodo} fecha com <b>{brl(entrou + vai)}</b>{pend > 0 && <> (ou <b>{brl(entrou + vai + pend)}</b> se as pendências forem pagas)</>}.</p>}

      <ComoEntra entradas={comPassado ? entradas : []} previstos={vaiEntrar} pendentes={pendentes} jeito={jeito} aoEscolher={setJeito} />
      <SaldoHotmart pagasNoMes={ent.dados ?? []} />
      <Pendencias linhas={pendentes} />
      <LinhaDoTempo linhas={vaiEntrar} titulo={`O que vai entrar (${nomePeriodo})`} />
      {comPassado && <JaEntrou linhas={entradas} />}
      <Antecipacao contratos={(parc.dados ?? []).filter((p) => !conta || p.conta_id === conta)} />
      <p className="muted pequeno">Contas a pagar ainda não entram nesta conta. O detalhe de cada mês está em <Link className="link" to="/financeiro/receber">A receber</Link> e <Link className="link" to="/financeiro/entradas">Entradas</Link>.</p>
    </div>
  )
}
