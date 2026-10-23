// Visão geral → os sistemas do ecossistema (situação, próxima entrega, o que trava) e a caixa de bloqueios e decisões.
import { Badge, Vazio } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { NOME_RESOLVE, NOME_STATUS, SISTEMAS, ordemTrabalho, situacaoSistema, type Entrega, type UsoProjeto } from './dados'

type Props = { uso: UsoProjeto; abrir: (e: Entrega) => void; abrirSistema: (sistema: string) => void }

export function TabelaSistemas({ uso, abrir, abrirSistema }: Props) {
  const p = uso.dados!
  const doSistema = (s: string) => {
    const ids = new Set(p.epicos.filter((e) => (e.sistema ?? 'Agentes') === s).map((e) => e.id))
    return p.entregas.filter((e) => ids.has(e.epico_id))
  }
  return (
    <section className="prj-caixa">
      <h2>Sistemas do ecossistema</h2>
      <div className="tabela-rolagem">
        <table className="prj-tabela">
          <thead><tr><th>Sistema</th><th>Situação</th><th>Próxima entrega</th><th>Trava</th><th /></tr></thead>
          <tbody>
            {SISTEMAS.map((s) => {
              const todas = doSistema(s.nome)
              const abertas = todas.filter((e) => e.status !== 'publicado' && e.status !== 'espera')
              const proxima = todas.filter((e) => e.status !== 'publicado').sort(ordemTrabalho)[0]
              const trava = todas.find((e) => e.status !== 'publicado' && (e.bloqueio || e.decisao))
              const st = situacaoSistema([...abertas, ...(trava ? [trava] : [])])
              const feitas = todas.filter((e) => e.status === 'publicado').length
              return (
                <tr key={s.nome}>
                  <td><span className="prj-sistema"><Icone nome={s.icone} tam={20} /><span><b>{s.nome}</b><span className="muted pequeno">{s.explica} · {feitas}/{todas.length} publicadas</span></span></span></td>
                  <td><Badge tom={st.tom}>{st.rotulo}</Badge></td>
                  <td>{proxima ? <button className="link" onClick={() => abrir(proxima)}>{proxima.nome}</button> : <span className="muted">—</span>}
                    {proxima && <span className="muted pequeno"> · {NOME_STATUS[proxima.status]}</span>}</td>
                  <td>{trava ? <button className="link alerta-txt pequeno" onClick={() => abrir(trava)}>{trava.bloqueio ? 'Bloqueio' : 'Decisão'}</button> : <span className="muted">—</span>}</td>
                  <td><button className="link pequeno" onClick={() => abrirSistema(s.nome)}>Ver →</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function BloqueiosDecisoes({ uso, abrir, itens }: { uso: UsoProjeto; abrir: (e: Entrega) => void; itens: Entrega[] }) {
  const p = uso.dados!
  return (
    <section className="prj-caixa" id="prj-travas">
      <h2>Bloqueios e decisões</h2>
      {itens.length === 0 ? <Vazio>Nada travado.</Vazio> : (
        <ul className="prj-travas-lista">
          {itens.map((e) => {
            const ep = p.epicos.find((x) => x.id === e.epico_id)
            return (
              <li key={e.id} className={e.bloqueio ? 'bloqueio' : 'decisao'}>
                <span className="prj-trava-tipo">{e.bloqueio ? <><Icone nome="alerta" tam={15} /> Bloqueio</> : <><Icone nome="ajuda" tam={15} /> Decisão</>}</span>
                <button className="link prj-trava-nome" onClick={() => abrir(e)}>{e.nome}</button>
                <p className="pequeno">{e.bloqueio ?? e.decisao}</p>
                <div className="prj-trava-rodape pequeno">
                  <span><span className="muted">Quem resolve</span><b>{e.quem_resolve ? NOME_RESOLVE[e.quem_resolve] : '—'}</b></span>
                  <span><span className="muted">Impacto</span>{e.impacto ?? '—'}</span>
                  <span className="muted">{ep?.sistema ?? ''}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
