// Histórico: cada trabalho que os agentes fizeram, quando, quanto custou e se deu certo.
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { dataHoraBR } from '../../lib/format'
import { Badge, Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { rotuloTrabalho, usd, visualDe, type Trabalho } from './comum'

const STATUS: Record<string, { rotulo: string; tom: string }> = {
  na_fila: { rotulo: 'Na fila', tom: 'neutro' }, trabalhando: { rotulo: 'Trabalhando', tom: 'info' },
  pronto: { rotulo: 'Pronto', tom: 'ok' }, erro: { rotulo: 'Erro', tom: 'erro' },
}

export default function Historico() {
  const t = useConsulta<Trabalho[]>(() => supabase.from('agentes_trabalhos').select('*').eq('empresa_id', EMPRESA_UNIQUE).order('criado_em', { ascending: false }).limit(200))
  const total = (t.dados ?? []).reduce((s, x) => s + Number(x.custo_usd ?? 0), 0)
  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Histórico</h1><p className="muted">Tudo o que os agentes fizeram. Custo dos trabalhos listados: {usd(total)}.</p></div></header>
      {!t.carregando && !(t.dados ?? []).length && <Vazio>Os agentes ainda não fizeram nenhum trabalho.</Vazio>}
      {!!(t.dados ?? []).length && (
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Agente</th><th>O quê</th><th>Situação</th><th className="num">Custo</th></tr></thead>
          <tbody>{(t.dados ?? []).map((x) => (
            <tr key={x.id}>
              <td className="pequeno">{dataHoraBR(x.criado_em)}</td>
              <td><b style={{ color: visualDe(x.agente_id).cor }}>{visualDe(x.agente_id).nome}</b></td>
              <td className="pequeno">{rotuloTrabalho(x)}{x.resumo && <div className="muted">{x.resumo.slice(0, 140)}</div>}{x.erro && <div className="erro-txt">{x.erro}</div>}</td>
              <td><Badge tom={STATUS[x.status]?.tom}>{STATUS[x.status]?.rotulo ?? x.status}</Badge></td>
              <td className="num">{x.custo_usd != null ? usd(x.custo_usd) : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
