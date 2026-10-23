// Épicos: os projetos grandes do ecossistema. À esquerda a lista por fase; à direita o épico aberto, com as entregas
// em andamento, a lista de espera (na ordem em que vão ser feitas) e o que já foi publicado.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { dataBR } from '../../../lib/format'
import { Badge, Campo, Erro, Vazio } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { FASES, NOME_STATUS, STATUS_EPICO, TOM_STATUS, camposDoStatus, progressoEpico, type Entrega, type Epico, type StatusEpico, type UsoProjeto } from './dados'

function FormEpico({ epico, uso }: { epico: Epico; uso: UsoProjeto }) {
  const [nome, setNome] = useState(epico.nome)
  const [desc, setDesc] = useState(epico.descricao ?? '')
  const mudou = nome !== epico.nome || desc !== (epico.descricao ?? '')
  const mudar = (c: Partial<Epico>) => uso.gravar(() => supabase.from('proj_epicos').update(c).eq('id', epico.id))
  return (
    <div className="prj-form-epico">
      <Campo rotulo="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
      <Campo rotulo="Para que serve"><textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      <div className="linha-acoes">
        <select value={epico.fase} onChange={(e) => mudar({ fase: Number(e.target.value) })} aria-label="Fase">
          {Object.entries(FASES).map(([n, f]) => <option key={n} value={n}>Fase {n} · {f.nome}</option>)}
        </select>
        <select value={epico.status} onChange={(e) => mudar({ status: e.target.value as StatusEpico })} aria-label="Situação">
          {(Object.keys(STATUS_EPICO) as StatusEpico[]).map((s) => <option key={s} value={s}>{STATUS_EPICO[s].rotulo}</option>)}
        </select>
        <button className="btn btn-mini btn-ouro" disabled={!mudou || !nome.trim()} onClick={() => mudar({ nome: nome.trim(), descricao: desc.trim() || null })}>Salvar</button>
      </div>
    </div>
  )
}

export function Epicos({ uso, selecionado, selecionar, abrir }: { uso: UsoProjeto; selecionado: string | null; selecionar: (id: string) => void; abrir: (e: Entrega) => void }) {
  const [nova, setNova] = useState('')
  const p = uso.dados!
  const epico = p.epicos.find((e) => e.id === selecionado) ?? p.epicos[0]
  const doEpico = epico ? p.entregas.filter((e) => e.epico_id === epico.id) : []
  const espera = doEpico.filter((e) => e.status === 'espera').sort((a, b) => a.ordem - b.ordem)
  const andando = doEpico.filter((e) => ['semana', 'construindo', 'testar'].includes(e.status))
  const feitas = doEpico.filter((e) => e.status === 'publicado')

  const novoEpico = async () => {
    const nome = window.prompt('Nome do novo épico (projeto grande):')?.trim()
    if (!nome) return
    const { data, error } = await supabase.from('proj_epicos').insert({ nome, fase: 2, ordem: p.epicos.length }).select('id').single()
    if (error) return uso.gravar(async () => ({ error }))
    await uso.recarregar(); selecionar(data.id)
  }
  const addEntrega = async () => {
    if (!epico || !nova.trim()) return
    if (await uso.gravar(() => supabase.from('proj_entregas').insert({ epico_id: epico.id, nome: nova.trim(), ordem: espera.length }))) setNova('')
  }
  // trocar de lugar com a vizinha na lista de espera
  const subir = (i: number, d: -1 | 1) => {
    const a = espera.at(i), b = espera.at(i + d)
    if (!a || !b || i + d < 0) return
    uso.gravar(async () => {
      const r1 = await supabase.from('proj_entregas').update({ ordem: i + d }).eq('id', a.id)
      const r2 = await supabase.from('proj_entregas').update({ ordem: i }).eq('id', b.id)
      return { error: r1.error ?? r2.error }
    })
  }

  return (
    <section className="prj-epicos">
      <aside className="prj-epicos-lista">
        <button className="btn btn-mini btn-contorno-ouro" onClick={novoEpico}>+ Novo épico</button>
        {Object.keys(FASES).map(Number).map((f) => (
          <div key={f}>
            <span className="nav-grupo">Fase {f} · {FASES[f].nome}</span>
            {p.epicos.filter((e) => e.fase === f).map((e) => {
              const pr = progressoEpico(e, p.entregas)
              return <button key={e.id} className={`prj-epico-item${epico?.id === e.id ? ' ativo' : ''}`} onClick={() => selecionar(e.id)}>
                <span>{e.nome}</span><span className="muted pequeno">{pr.feitas}/{pr.total}</span></button>
            })}
          </div>
        ))}
      </aside>
      {!epico ? <Vazio>Nenhum épico ainda.</Vazio> : (
        <div className="prj-epico-detalhe">
          <FormEpico key={epico.id} epico={epico} uso={uso} />
          <h3>Em andamento ({andando.length})</h3>
          {andando.length === 0 ? <p className="muted pequeno">Nada deste épico na semana.</p> : (
            <ul className="prj-entregas">{andando.map((e) => <li key={e.id}><button className="link" onClick={() => abrir(e)}>{e.nome}</button><Badge tom={TOM_STATUS[e.status]}>{NOME_STATUS[e.status]}</Badge></li>)}</ul>
          )}
          <h3>Lista de espera ({espera.length})</h3>
          <p className="muted pequeno">Na ordem em que vão ser feitas. A de cima é a próxima.</p>
          <ul className="prj-entregas">
            {espera.map((e, i) => (
              <li key={e.id}>
                <span className="prj-ordem"><button className="btn-icone" aria-label="Subir" disabled={i === 0} onClick={() => subir(i, -1)}><Icone nome="cima" tam={14} /></button>
                  <button className="btn-icone" aria-label="Descer" disabled={i === espera.length - 1} onClick={() => subir(i, 1)}><Icone nome="baixo" tam={14} /></button></span>
                <button className="link" onClick={() => abrir(e)}>{e.nome}</button>
                <button className="btn btn-mini" onClick={() => uso.gravar(() => supabase.from('proj_entregas').update(camposDoStatus('semana', e)).eq('id', e.id))}>Para esta semana</button>
              </li>
            ))}
          </ul>
          <div className="prj-add">
            <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEntrega()} placeholder="Nova entrega (algo que cabe numa semana)" />
            <button className="btn btn-mini" disabled={!nova.trim()} onClick={addEntrega}>Adicionar</button>
          </div>
          {feitas.length > 0 && <>
            <h3>Publicadas ({feitas.length})</h3>
            <ul className="prj-entregas">{feitas.map((e) => <li key={e.id}><button className="link" onClick={() => abrir(e)}>{e.nome}</button><span className="muted pequeno">{e.publicado_em ? dataBR(e.publicado_em.slice(0, 10)) : ''}</span></li>)}</ul>
          </>}
          <Erro msg={uso.erro} />
        </div>
      )}
    </section>
  )
}
