// Tarefas: o que dá para pedir a cada agente agora e o que está na fila ou em andamento.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { dataHoraBR } from '../../lib/format'
import { Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import { useSala } from './useSala'
import { visualDe, type Trabalho } from './comum'

const PEDIDOS: Record<string, { rotulo: string; para: string }[]> = {
  marketing: [{ rotulo: 'Montar a semana de conteúdo', para: '/agentes/marketing' }],
}

export default function Tarefas() {
  const { agentes } = useSala()
  const andamento = useConsulta<Trabalho[]>(() => supabase.from('agentes_trabalhos').select('*').eq('empresa_id', EMPRESA_UNIQUE).in('status', ['na_fila', 'trabalhando']).order('criado_em'))
  const prontos = agentes.filter((a) => a.disponivel)
  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Tarefas</h1><p className="muted">Peça um trabalho a um agente ou acompanhe o que está em andamento.</p></div></header>
      <section className="bloco">
        <h2>Pedir uma tarefa</h2>
        <div className="tarefas-grade">{prontos.map((a) => (
          <div key={a.id} className="tarefa-agente" style={{ ['--cor-agente' as string]: a.cor }}>
            <Retrato agente={a.id} estado={a.estado} alto={110} />
            <div><b>Agente de {a.nome}</b>{(PEDIDOS[a.id] ?? []).map((p) => <Link key={p.rotulo} to={p.para} className="btn btn-contorno btn-mini">{p.rotulo} →</Link>)}</div>
          </div>
        ))}</div>
        <p className="muted pequeno">Em breve: agendar tarefas que se repetem (por exemplo, "toda segunda, montar a semana").</p>
      </section>
      <section className="bloco">
        <h2>Em andamento</h2>
        {!andamento.carregando && !(andamento.dados ?? []).length && <Vazio>Nenhuma tarefa em andamento agora.</Vazio>}
        <ul className="sala-fila">{(andamento.dados ?? []).map((t) => (
          <li key={t.id}><Link to={`/agentes/${t.agente_id}`}><span className="sala-fila-tipo" style={{ ['--cor-agente' as string]: visualDe(t.agente_id).cor }}>{visualDe(t.agente_id).nome}</span>{t.tipo === 'semana' ? 'Semana de conteúdo' : 'Ajuste de peça'} · {t.status === 'na_fila' ? 'na fila' : 'trabalhando'} desde {dataHoraBR(t.criado_em)}</Link></li>
        ))}</ul>
      </section>
    </div>
  )
}
