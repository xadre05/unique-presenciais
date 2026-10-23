// Caixa de ideias: toda ideia nova entra aqui em uma linha, sem parar o que está sendo feito. Na triagem ela vira
// uma entrega na lista de espera de um épico, entra como tarefa numa entrega que já existe, ou é descartada.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { dataBR } from '../../../lib/format'
import { Erro, Vazio } from '../../../components/ui'
import { FASES, type Ideia, type UsoProjeto } from './dados'

function Triagem({ ideia, uso }: { ideia: Ideia; uso: UsoProjeto }) {
  const p = uso.dados!
  const [epico, setEpico] = useState('')
  const [entrega, setEntrega] = useState('')
  const abertas = p.entregas.filter((e) => e.epico_id === epico && e.status !== 'publicado')

  // nova entrega no fim da lista de espera do épico, ou tarefa dentro de uma entrega existente
  const triar = () => uso.gravar(async () => {
    if (entrega) {
      const n = p.tarefas.filter((t) => t.entrega_id === entrega).length
      const r = await supabase.from('proj_tarefas').insert({ entrega_id: entrega, titulo: ideia.texto, ordem: n })
      if (r.error) return r
      return supabase.from('proj_ideias').update({ status: 'triada', epico_id: epico, entrega_id: entrega }).eq('id', ideia.id)
    }
    const n = p.entregas.filter((e) => e.epico_id === epico && e.status === 'espera').length
    const r = await supabase.from('proj_entregas').insert({ epico_id: epico, nome: ideia.texto, ordem: n }).select('id').single()
    if (r.error) return r
    return supabase.from('proj_ideias').update({ status: 'triada', epico_id: epico, entrega_id: r.data.id }).eq('id', ideia.id)
  })

  return (
    <div className="prj-triagem">
      <select value={epico} onChange={(e) => { setEpico(e.target.value); setEntrega('') }} aria-label="Épico">
        <option value="">Faz parte de qual épico?</option>
        {p.epicos.map((e) => <option key={e.id} value={e.id}>Fase {e.fase} · {e.nome}</option>)}
      </select>
      {epico && (
        <select value={entrega} onChange={(e) => setEntrega(e.target.value)} aria-label="Entrega">
          <option value="">Vira uma entrega nova (lista de espera)</option>
          {abertas.map((e) => <option key={e.id} value={e.id}>Entra em: {e.nome}</option>)}
        </select>
      )}
      <button className="btn btn-mini btn-ouro" disabled={!epico} onClick={triar}>Triar</button>
      <button className="link pequeno" onClick={() => uso.gravar(() => supabase.from('proj_ideias').update({ status: 'descartada' }).eq('id', ideia.id))}>descartar</button>
    </div>
  )
}

export function Ideias({ uso }: { uso: UsoProjeto }) {
  const [texto, setTexto] = useState('')
  const [verTriadas, setVerTriadas] = useState(false)
  const p = uso.dados!
  const novas = p.ideias.filter((i) => i.status === 'nova')
  const triadas = p.ideias.filter((i) => i.status !== 'nova')
  const nomeEpico = (id: string | null) => p.epicos.find((e) => e.id === id)
  const anotar = async () => { if (texto.trim() && (await uso.gravar(() => supabase.from('proj_ideias').insert({ texto: texto.trim() })))) setTexto('') }

  return (
    <section className="prj-ideias">
      <div className="prj-add prj-add-ideia">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && anotar()} placeholder="Teve uma ideia? Escreva em uma linha e aperte Enter" />
        <button className="btn btn-ouro" disabled={!texto.trim()} onClick={anotar}>Anotar</button>
      </div>
      <p className="muted pequeno">Anotar não muda o que está sendo feito. No planejamento de domingo, cada ideia vai para o épico certo.</p>
      <Erro msg={uso.erro} />
      <h3>Esperando triagem ({novas.length})</h3>
      {novas.length === 0 ? <Vazio>Nenhuma ideia esperando.</Vazio> : (
        <ul className="prj-lista-ideias">
          {novas.map((i) => <li key={i.id}><div><b>{i.texto}</b><span className="muted pequeno"> · {dataBR(i.criado_em.slice(0, 10))}</span></div><Triagem ideia={i} uso={uso} /></li>)}
        </ul>
      )}
      {triadas.length > 0 && <button className="link pequeno" onClick={() => setVerTriadas(!verTriadas)}>{verTriadas ? 'Esconder' : 'Ver'} as já triadas ({triadas.length})</button>}
      {verTriadas && (
        <ul className="prj-lista-ideias apagada">
          {triadas.map((i) => {
            const ep = nomeEpico(i.epico_id)
            return <li key={i.id}><span>{i.texto}</span><span className="muted pequeno">{i.status === 'descartada' ? 'Descartada' : ep ? `→ Fase ${ep.fase} · ${FASES[ep.fase]?.nome} · ${ep.nome}` : 'Triada'}</span></li>
          })}
        </ul>
      )}
    </section>
  )
}
