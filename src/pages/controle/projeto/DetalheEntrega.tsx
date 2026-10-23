// Uma entrega aberta: o que é, quando fica pronta, em que pé está, as tarefas (quem faz cada uma) e, ao publicar,
// o resumo do que mudou.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { dataBR } from '../../../lib/format'
import { Campo, Erro, Modal } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { NOME_QUEM, NOME_STATUS, camposDoStatus, type Entrega, type Quem, type StatusEntrega, type UsoProjeto } from './dados'

type Props = { entrega: Entrega; uso: UsoProjeto; aoFechar: () => void }

export function DetalheEntrega({ entrega, uso, aoFechar }: Props) {
  const [nome, setNome] = useState(entrega.nome)
  const [pronto, setPronto] = useState(entrega.pronto_quando ?? '')
  const [resumo, setResumo] = useState(entrega.resumo ?? '')
  const [notas, setNotas] = useState(entrega.notas ?? '')
  const [nova, setNova] = useState('')
  const [quem, setQuem] = useState<Quem>('claude')
  const p = uso.dados!
  const epico = p.epicos.find((e) => e.id === entrega.epico_id)
  const tarefas = p.tarefas.filter((t) => t.entrega_id === entrega.id)
  const feitas = tarefas.filter((t) => t.feito).length
  const mudou = nome !== entrega.nome || pronto !== (entrega.pronto_quando ?? '') || resumo !== (entrega.resumo ?? '') || notas !== (entrega.notas ?? '')

  const salvar = () => uso.gravar(() => supabase.from('proj_entregas').update({ nome: nome.trim() || entrega.nome, pronto_quando: pronto.trim() || null, resumo: resumo.trim() || null, notas: notas.trim() || null }).eq('id', entrega.id))
  const mudarStatus = (s: StatusEntrega) => uso.gravar(() => supabase.from('proj_entregas').update(camposDoStatus(s, entrega)).eq('id', entrega.id))
  const addTarefa = async () => {
    if (!nova.trim()) return
    if (await uso.gravar(() => supabase.from('proj_tarefas').insert({ entrega_id: entrega.id, titulo: nova.trim(), quem, ordem: tarefas.length }))) setNova('')
  }
  const excluir = async () => {
    if (!window.confirm(`Excluir a entrega "${entrega.nome}" e as tarefas dela?`)) return
    if (await uso.gravar(() => supabase.from('proj_entregas').delete().eq('id', entrega.id))) aoFechar()
  }

  return (
    <Modal titulo={epico ? `${epico.nome} · entrega` : 'Entrega'} aberto onFechar={aoFechar} largo>
      <Campo rotulo="Entrega"><input value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
      <Campo rotulo="Está pronta quando…" dica="O que precisa funcionar para você aprovar.">
        <textarea rows={3} value={pronto} onChange={(e) => setPronto(e.target.value)} placeholder="Ex.: consigo mandar a Black para as vitalícias com um modelo aprovado e ver quem leu e respondeu" />
      </Campo>
      <div className="prj-status-linha">
        {(Object.keys(NOME_STATUS) as StatusEntrega[]).map((s) => (
          <button key={s} className={`prj-status-btn${entrega.status === s ? ' ativo' : ''}`} onClick={() => mudarStatus(s)}>{NOME_STATUS[s]}</button>
        ))}
      </div>
      <p className="muted pequeno">
        {entrega.semana ? `Semana de ${dataBR(entrega.semana)}` : 'Ainda não foi escolhida para uma semana'}
        {entrega.publicado_em ? ` · publicada em ${dataBR(entrega.publicado_em.slice(0, 10))}` : ''}
      </p>

      <h3>Tarefas {tarefas.length > 0 && <span className="muted pequeno">{feitas} de {tarefas.length} feitas</span>}</h3>
      <ul className="prj-tarefas">
        {tarefas.map((t) => (
          <li key={t.id} className={t.feito ? 'feito' : ''}>
            <label className="check"><input type="checkbox" checked={t.feito} onChange={(e) => uso.gravar(() => supabase.from('proj_tarefas').update({ feito: e.target.checked }).eq('id', t.id))} /> {t.titulo}</label>
            <span className={`prj-quem prj-quem-${t.quem}`}>{NOME_QUEM[t.quem]}</span>
            <button className="btn-icone" aria-label="Excluir tarefa" onClick={() => uso.gravar(() => supabase.from('proj_tarefas').delete().eq('id', t.id))}><Icone nome="lixeira" tam={14} /></button>
          </li>
        ))}
      </ul>
      <div className="prj-add">
        <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTarefa()} placeholder="Nova tarefa" />
        <select value={quem} onChange={(e) => setQuem(e.target.value as Quem)} aria-label="Quem faz">
          {(Object.keys(NOME_QUEM) as Quem[]).map((q) => <option key={q} value={q}>{NOME_QUEM[q]}</option>)}
        </select>
        <button className="btn btn-mini" onClick={addTarefa} disabled={!nova.trim()}>Adicionar</button>
      </div>

      <Campo rotulo="Decisões e pontos combinados" dica="O que foi discutido sobre esta entrega, para ninguém esquecer.">
        <textarea rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ex.: 22/10 — vitalícios primeiro; quem está devendo fica fora" />
      </Campo>
      {(entrega.status === 'testar' || entrega.status === 'publicado') && (
        <Campo rotulo="O que mudou (resumo da publicação)"><textarea rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)} /></Campo>
      )}
      <Erro msg={uso.erro} />
      <div className="modal-acoes">
        <button className="link pequeno erro-txt" onClick={excluir}>Excluir entrega</button>
        <button className="btn" onClick={aoFechar}>Fechar</button>
        <button className="btn btn-ouro" disabled={!mudou} onClick={salvar}>Salvar</button>
      </div>
    </Modal>
  )
}
