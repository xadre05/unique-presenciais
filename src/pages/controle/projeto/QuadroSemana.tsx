// O quadro da semana (domingo a sábado): as entregas escolhidas, andando da esquerda para a direita.
// Arraste o cartão para outra coluna, ou abra o cartão e troque a situação. Entrega não terminada passa para a semana seguinte.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { dataBR } from '../../../lib/format'
import { Modal, Vazio } from '../../../components/ui'
import { COLUNAS, FASES, camposDoStatus, domingoDe, sabadoDe, type Entrega, type StatusEntrega, type UsoProjeto } from './dados'

const LIMITE_SEMANA = 2

export function CartaoEntrega({ e, uso, abrir }: { e: Entrega; uso: UsoProjeto; abrir: (e: Entrega) => void }) {
  const p = uso.dados!
  const epico = p.epicos.find((x) => x.id === e.epico_id)
  const tarefas = p.tarefas.filter((t) => t.entrega_id === e.id)
  const feitas = tarefas.filter((t) => t.feito).length
  return (
    <button className="prj-cartao" draggable onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e.id)} onClick={() => abrir(e)}>
      {epico && <span className="prj-cartao-epico">{epico.nome}</span>}
      <b>{e.nome}</b>
      {e.pronto_quando && <span className="muted pequeno prj-cartao-pronto">{e.pronto_quando}</span>}
      {tarefas.length > 0 && (
        <span className="prj-barra" title={`${feitas} de ${tarefas.length} tarefas feitas`}><span style={{ width: `${(100 * feitas) / tarefas.length}%` }} /></span>
      )}
      {tarefas.length > 0 && <span className="muted pequeno">{feitas}/{tarefas.length} tarefas</span>}
    </button>
  )
}

export function QuadroSemana({ uso, abrir }: { uso: UsoProjeto; abrir: (e: Entrega) => void }) {
  const [escolher, setEscolher] = useState(false)
  const [sobre, setSobre] = useState<StatusEntrega | null>(null)
  const p = uso.dados!
  const domingo = domingoDe()
  // publicado: só o desta semana; o resto que está andando aparece mesmo se veio de semana passada
  const naColuna = (s: StatusEntrega) => p.entregas.filter((e) => e.status === s && (s !== 'publicado' || (e.publicado_em ?? '') >= domingo))
  const ativas = p.entregas.filter((e) => e.status === 'semana' || e.status === 'construindo').length
  const espera = p.entregas.filter((e) => e.status === 'espera')

  const mover = (id: string, s: StatusEntrega) => {
    const e = p.entregas.find((x) => x.id === id)
    if (e && e.status !== s) uso.gravar(() => supabase.from('proj_entregas').update(camposDoStatus(s, e)).eq('id', id))
  }

  return (
    <section>
      <div className="prj-semana-topo">
        <div><h2>Semana de {dataBR(domingo)} a {dataBR(sabadoDe(domingo))}</h2>
          <p className="muted pequeno">No máximo {LIMITE_SEMANA} entregas sendo feitas ao mesmo tempo. Ideia nova vai para a caixa de ideias, não para cá.</p></div>
        <button className="btn btn-ouro btn-mini" onClick={() => setEscolher(true)}>Escolher da lista de espera</button>
      </div>
      {ativas > LIMITE_SEMANA && <div className="nota pequeno alerta-txt">Tem {ativas} entregas abertas na semana. Termine uma antes de puxar outra.</div>}
      <div className="prj-quadro">
        {COLUNAS.map((c) => {
          const itens = naColuna(c.status)
          return (
            <div key={c.status} className={`prj-coluna${sobre === c.status ? ' sobre' : ''}`}
              onDragOver={(ev) => { ev.preventDefault(); setSobre(c.status) }} onDragLeave={() => setSobre(null)}
              onDrop={(ev) => { ev.preventDefault(); setSobre(null); mover(ev.dataTransfer.getData('text/plain'), c.status) }}>
              <div className="prj-coluna-topo"><b>{c.rotulo}</b><span className="prj-conta">{itens.length}</span></div>
              <p className="muted pequeno prj-coluna-explica">{c.explica}</p>
              {itens.map((e) => <CartaoEntrega key={e.id} e={e} uso={uso} abrir={abrir} />)}
            </div>
          )
        })}
      </div>
      {escolher && (
        <Modal titulo="Escolher entregas para esta semana" aberto onFechar={() => setEscolher(false)} largo>
          {espera.length === 0 ? <Vazio>A lista de espera está vazia.</Vazio> : (
            <ul className="prj-escolher">
              {p.epicos.filter((ep) => espera.some((e) => e.epico_id === ep.id)).map((ep) => (
                <li key={ep.id}><span className="muted pequeno">Fase {ep.fase} · {FASES[ep.fase]?.nome} · <b>{ep.nome}</b></span>
                  {espera.filter((e) => e.epico_id === ep.id).map((e) => (
                    <div key={e.id} className="prj-escolher-item"><span>{e.nome}</span>
                      <button className="btn btn-mini btn-contorno-ouro" onClick={() => mover(e.id, 'semana')}>Para esta semana</button></div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </section>
  )
}
