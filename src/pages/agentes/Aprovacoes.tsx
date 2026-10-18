// Tudo o que os agentes prepararam e está esperando a sua decisão, de todos os agentes.
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { PecaCartao } from './PecaCartao'
import { visualDe, type Peca } from './comum'

export default function Aprovacoes() {
  const pecas = useConsulta<(Peca & { agente_id: string })[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA_UNIQUE).eq('status', 'rascunho').order('dia').order('ordem'))
  const porAgente = new Map<string, (Peca & { agente_id: string })[]>()
  for (const p of pecas.dados ?? []) porAgente.set(p.agente_id, [...(porAgente.get(p.agente_id) ?? []), p])
  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Aprovações</h1><p className="muted">O que os agentes prepararam e espera a sua decisão.</p></div></header>
      {!pecas.carregando && porAgente.size === 0 && <Vazio>Nada esperando aprovação.</Vazio>}
      {[...porAgente.entries()].map(([agente, ps]) => (
        <section key={agente} className="bloco">
          <h2 style={{ color: visualDe(agente).cor }}>Agente de {visualDe(agente).nome} <span className="muted pequeno">{ps.length} peça(s)</span></h2>
          <div className="pecas-grade">{ps.map((p) => <PecaCartao key={p.id} peca={p} aoMudar={pecas.recarregar} />)}</div>
        </section>
      ))}
    </div>
  )
}
