// Visão geral → as próximas entregas (na ordem de trabalho) e a conferência "antes de publicar" do que está para testar.
import { Badge, Vazio } from '../../../components/ui'
import { dataBR, hojeISO } from '../../../lib/format'
import { NOME_STATUS, PASSOS_PUBLICAR, PRIORIDADE, TOM_STATUS, type Entrega, type UsoProjeto } from './dados'

export function ProximasEntregas({ uso, itens, abrir }: { uso: UsoProjeto; itens: Entrega[]; abrir: (e: Entrega) => void }) {
  const p = uso.dados!
  const hoje = hojeISO()
  return (
    <section className="prj-caixa" id="prj-proximas">
      <h2>Próximas entregas <span className="muted pequeno">({itens.length})</span></h2>
      {itens.length === 0 ? <Vazio>Nada com esses filtros.</Vazio> : (
        <div className="tabela-rolagem">
          <table className="prj-tabela">
            <thead><tr><th>Entrega</th><th>Sistema</th><th>Prioridade</th><th>Prazo</th><th>Situação</th></tr></thead>
            <tbody>
              {itens.map((e) => {
                const ep = p.epicos.find((x) => x.id === e.epico_id)
                return (
                  <tr key={e.id}>
                    <td><button className="link prj-celula-nome" onClick={() => abrir(e)}>{e.nome}</button></td>
                    <td className="muted pequeno">{ep?.sistema ?? '—'}</td>
                    <td><Badge tom={PRIORIDADE[e.prioridade].tom}>{PRIORIDADE[e.prioridade].rotulo}</Badge></td>
                    <td className={e.prazo && e.prazo < hoje ? 'erro-txt pequeno' : 'pequeno'}>{e.prazo ? dataBR(e.prazo) : <span className="muted">a definir</span>}</td>
                    <td><Badge tom={TOM_STATUS[e.status]}>{NOME_STATUS[e.status]}</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function ConferenciaPublicar({ itens, abrir }: { itens: Entrega[]; abrir: (e: Entrega) => void }) {
  return (
    <section className="prj-caixa" id="prj-validar">
      <h2>Antes de publicar</h2>
      {itens.length === 0 ? <Vazio>Nada esperando validação.</Vazio> : itens.map((e) => {
        const feitos = PASSOS_PUBLICAR.filter((x) => e[x.campo]).length
        return (
          <div key={e.id} className="prj-conf">
            <button className="link" onClick={() => abrir(e)}>{e.nome}</button>
            <ol>
              {PASSOS_PUBLICAR.map((x, i) => <li key={x.campo} className={e[x.campo] ? 'ok' : ''}><span className="prj-conf-num">{i + 1}</span>{x.rotulo}<span className="pequeno">{e[x.campo] ? 'Feito' : 'Pendente'}</span></li>)}
            </ol>
            <span className="muted pequeno">{feitos} de {PASSOS_PUBLICAR.length} · pronto, validado e publicado são situações diferentes</span>
          </div>
        )
      })}
    </section>
  )
}
