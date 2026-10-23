// Visão geral do ecossistema: o que espera validação, o que está travado, as próximas entregas e as decisões
// pendentes; os sistemas com a situação de cada um; e o roteiro por fases embaixo.
import { useState } from 'react'
import { hojeISO } from '../../../lib/format'
import { Icone } from '../../../components/Icone'
import { NOME_STATUS, PRIORIDADE, SISTEMAS, domingoDe, ordemTrabalho, sabadoDe, type Entrega, type Prioridade, type StatusEntrega, type UsoProjeto } from './dados'
import { BloqueiosDecisoes, TabelaSistemas } from './Sistemas'
import { ConferenciaPublicar, ProximasEntregas } from './Proximas'
import { Roteiro } from './Roteiro'

type Filtros = { sistema: string; situacao: string; prioridade: string; prazo: string }
const VAZIO: Filtros = { sistema: '', situacao: 'abertas', prioridade: '', prazo: '' }

function Cartao({ icone, rotulo, n, alvo, tom }: { icone: string; rotulo: string; n: number; alvo: string; tom?: string }) {
  return (
    <a className={`prj-cartao-kpi${tom && n ? ' ' + tom : ''}`} href={`#${alvo}`}>
      <Icone nome={icone} tam={26} /><span><b>{rotulo}</b><strong>{n}</strong></span><span className="pequeno">Ver itens →</span>
    </a>
  )
}

export function VisaoGeral({ uso, abrir, abrirEpico, abrirSistema }: { uso: UsoProjeto; abrir: (e: Entrega) => void; abrirEpico: (id: string) => void; abrirSistema: (s: string) => void }) {
  const [f, setF] = useState<Filtros>(VAZIO)
  const p = uso.dados!
  const hoje = hojeISO(), domingo = domingoDe()
  const sistemaDe = (e: Entrega) => p.epicos.find((x) => x.id === e.epico_id)?.sistema ?? 'Agentes'
  const passa = (e: Entrega) => (!f.sistema || sistemaDe(e) === f.sistema) && (!f.prioridade || e.prioridade === f.prioridade)
    && (!f.prazo || (f.prazo === 'vencido' ? !!e.prazo && e.prazo < hoje : f.prazo === 'semana' ? !!e.prazo && e.prazo <= sabadoDe(domingo) : !e.prazo))
  const naoPublicadas = p.entregas.filter((e) => e.status !== 'publicado' && passa(e))
  const proximas = naoPublicadas.filter((e) => f.situacao === 'abertas' ? e.status !== 'espera' || e.prioridade === 'alta' : !f.situacao || e.status === f.situacao).sort(ordemTrabalho)
  const travas = naoPublicadas.filter((e) => e.bloqueio || e.decisao).sort((a, b) => Number(!!b.bloqueio) - Number(!!a.bloqueio))
  const validar = naoPublicadas.filter((e) => e.status === 'testar')
  const mudar = (k: keyof Filtros, v: string) => setF({ ...f, [k]: v })

  return (
    <section>
      <div className="prj-filtros">
        <label>Sistema<select value={f.sistema} onChange={(e) => mudar('sistema', e.target.value)}><option value="">Todos</option>{SISTEMAS.map((s) => <option key={s.nome}>{s.nome}</option>)}</select></label>
        <label>Situação<select value={f.situacao} onChange={(e) => mudar('situacao', e.target.value)}>
          <option value="abertas">Em andamento e prioridade alta</option><option value="">Todas não publicadas</option>
          {(['semana', 'construindo', 'testar', 'espera'] as StatusEntrega[]).map((s) => <option key={s} value={s}>{NOME_STATUS[s]}</option>)}</select></label>
        <label>Prioridade<select value={f.prioridade} onChange={(e) => mudar('prioridade', e.target.value)}><option value="">Todas</option>{(Object.keys(PRIORIDADE) as Prioridade[]).map((x) => <option key={x} value={x}>{PRIORIDADE[x].rotulo}</option>)}</select></label>
        <label>Prazo<select value={f.prazo} onChange={(e) => mudar('prazo', e.target.value)}><option value="">Todos</option><option value="vencido">Vencido</option><option value="semana">Até o fim desta semana</option><option value="sem">Sem prazo</option></select></label>
        {JSON.stringify(f) !== JSON.stringify(VAZIO) && <button className="link pequeno" onClick={() => setF(VAZIO)}>× Limpar</button>}
      </div>

      <div className="prj-kpis-4">
        <Cartao icone="check" rotulo="A validar" n={validar.length} alvo="prj-validar" tom="alerta" />
        <Cartao icone="alerta" rotulo="Bloqueios" n={travas.filter((e) => e.bloqueio).length} alvo="prj-travas" tom="erro" />
        <Cartao icone="raio" rotulo="Próximas entregas" n={proximas.length} alvo="prj-proximas" />
        <Cartao icone="ajuda" rotulo="Decisões pendentes" n={travas.filter((e) => !e.bloqueio).length} alvo="prj-travas" tom="alerta" />
      </div>

      <div className="prj-grade-2">
        <TabelaSistemas uso={uso} abrir={abrir} abrirSistema={abrirSistema} />
        <BloqueiosDecisoes uso={uso} abrir={abrir} itens={travas} />
        <ProximasEntregas uso={uso} itens={proximas} abrir={abrir} />
        <ConferenciaPublicar itens={validar} abrir={abrir} />
      </div>

      <h2 className="prj-titulo-roteiro">Roteiro por fases</h2>
      <Roteiro uso={uso} abrirEpico={abrirEpico} />
    </section>
  )
}
