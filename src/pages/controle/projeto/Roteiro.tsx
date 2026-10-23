// Roteiro por fases: cada fase em uma faixa, com os épicos dela e quanto já foi entregue.
import { Badge } from '../../../components/ui'
import { FASES, STATUS_EPICO, progressoEpico, type UsoProjeto } from './dados'

export function Roteiro({ uso, abrirEpico }: { uso: UsoProjeto; abrirEpico: (id: string) => void }) {
  const p = uso.dados!
  const fases = [...new Set([...Object.keys(FASES).map(Number), ...p.epicos.map((e) => e.fase)])].sort((a, b) => a - b)
  return (
      <div className="prj-fases">
        {fases.map((f) => {
          const epicos = p.epicos.filter((e) => e.fase === f)
          return (
            <div key={f} className="prj-fase">
              <div className="prj-fase-topo"><span className="prj-fase-num">Fase {f}</span><b>{FASES[f]?.nome ?? 'Outros'}</b><span className="muted pequeno">{FASES[f]?.quando}</span></div>
              <div className="prj-fase-epicos">
              {epicos.length === 0 && <p className="muted pequeno">Nenhum épico ainda.</p>}
              {epicos.map((e) => {
                const pr = progressoEpico(e, p.entregas)
                const ativas = p.entregas.filter((x) => x.epico_id === e.id && ['semana', 'construindo', 'testar'].includes(x.status)).length
                return (
                  <button key={e.id} className={`prj-epico prj-epico-${e.status}`} onClick={() => abrirEpico(e.id)}>
                    <b className="prj-epico-nome">{e.nome}</b>
                    <span><Badge tom={STATUS_EPICO[e.status].tom}>{STATUS_EPICO[e.status].rotulo}</Badge></span>
                    {e.descricao && <span className="muted pequeno prj-epico-desc">{e.descricao}</span>}
                    <span className="prj-barra"><span style={{ width: `${pr.total ? (100 * pr.feitas) / pr.total : 0}%` }} /></span>
                    <span className="muted pequeno">{pr.feitas} de {pr.total} entregas publicadas{ativas ? ` · ${ativas} em andamento` : ''}</span>
                  </button>
                )
              })}
              </div>
            </div>
          )
        })}
      </div>
  )
}
