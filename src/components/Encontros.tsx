import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { msgErro, useConsulta } from '../lib/dados'
import { dataBR } from '../lib/format'
import { useAuth } from '../auth'
import { Campo, Erro, Modal, Vazio } from './ui'
import { Icone } from './Icone'
import { linkGoogle } from '../pages/Agenda'

type Black = { codigo: string; encontro_id: string | null; lugares: number; compraram: number; matriculados: number }
// vagas da Black naquela data: lugares − alunos já matriculados na turma − compradores da Black com aquele código
const livres = (b: Black) => Math.max(0, b.lugares - b.matriculados - b.compraram)
function SeloBlack({ b }: { b: Black }) {
  const l = livres(b)
  return <span className={`badge ${l === 0 ? 'badge-erro' : 'badge-ouro'}`} title={`Código da página: ${b.codigo}`}>Black: {b.compraram} compraram · {l === 0 ? 'lotado' : `${l} livre${l > 1 ? 's' : ''}`}</span>
}

type Encontro = { id: string; turma_id: string; titulo: string; data_inicio: string; data_fim: string | null; horario: string | null; local: string | null; observacao: string | null; cancelado: boolean }

export function Encontros({ turma, onMudou }: { turma: { id: string; nome: string; curso_nome: string; local: string | null; status: string }; onMudou: () => void }) {
  const { isAdmin } = useAuth()
  const lista = useConsulta<Encontro[]>(() => supabase.from('encontros').select('*').eq('turma_id', turma.id).eq('cancelado', false).order('data_inicio'), [turma.id])
  const black = useConsulta<Black[]>(() => supabase.from('v_black_turmas').select('codigo,encontro_id,lugares,compraram,matriculados').eq('turma_id', turma.id), [turma.id])
  const blackDa = (encontroId: string | null) => (black.dados ?? []).filter((b) => b.encontro_id === encontroId)
  const [editando, setEditando] = useState<Partial<Encontro> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const es = lista.dados ?? []
  const ehResidencia = /resid/i.test(turma.curso_nome)

  // A turma passa a ter como início e fim o primeiro e o último encontro.
  const sincronizarTurma = async () => {
    const { data } = await supabase.from('encontros').select('data_inicio,data_fim').eq('turma_id', turma.id).eq('cancelado', false)
    const ds = (data ?? []) as { data_inicio: string; data_fim: string | null }[]
    if (ds.length === 0) return
    const ini = ds.map((d) => d.data_inicio).sort()[0]
    const fim = ds.map((d) => d.data_fim ?? d.data_inicio).sort().slice(-1)[0]
    await supabase.from('turmas').update({ data_inicio: ini, data_fim: fim }).eq('id', turma.id)
  }

  const salvar = async () => {
    const f = editando!
    if (!f.titulo?.trim() || !f.data_inicio) return setErro('Preencha o nome e o primeiro dia.')
    if (f.data_fim && f.data_fim < f.data_inicio) return setErro('O último dia não pode ser antes do primeiro.')
    const reg = { turma_id: turma.id, titulo: f.titulo.trim(), data_inicio: f.data_inicio, data_fim: f.data_fim || null, horario: f.horario?.trim() || null, local: f.local?.trim() || null, observacao: f.observacao?.trim() || null }
    const { error } = f.id ? await supabase.from('encontros').update(reg).eq('id', f.id) : await supabase.from('encontros').insert(reg)
    if (error) return setErro(msgErro(error))
    await sincronizarTurma()
    setEditando(null); setErro(null); lista.recarregar(); onMudou()
  }
  const cancelar = async (e: Encontro) => {
    const { error } = await supabase.from('encontros').update({ cancelado: true }).eq('id', e.id)
    if (error) return setErro(msgErro(error))
    await sincronizarTurma(); lista.recarregar(); onMudou()
  }
  const novo = () => setEditando({ titulo: ehResidencia ? `Módulo ${es.length + 1}` : es.length ? `Encontro ${es.length + 1}` : 'Curso', local: turma.local ?? '' })

  return (
    <section className="bloco">
      <div className="bloco-topo">
        <h2><Icone nome="agenda" className="ouro" /> Datas {ehResidencia ? 'dos módulos' : 'do curso'}</h2>
        {isAdmin && <button className="btn btn-mini btn-ouro" onClick={novo}><Icone nome="mais" tam={14} /> {ehResidencia ? 'Adicionar módulo' : 'Adicionar data'}</button>}
      </div>
      <Erro msg={erro && !editando ? erro : null} />
      {blackDa(null).length > 0 && <p className="pequeno">{blackDa(null).map((b) => <SeloBlack key={b.codigo} b={b} />)}</p>}
      {es.length === 0 ? <Vazio>{ehResidencia ? 'Nenhum módulo com data ainda. A Mini Residência tem 4 módulos — cadastre cada um.' : 'Nenhuma data cadastrada.'}</Vazio> : (
        <ul className="lista">
          {es.map((e) => (
            <li key={e.id}>
              <div>
                <div className="forte">{e.titulo} {blackDa(e.id).map((b) => <SeloBlack key={b.codigo} b={b} />)}</div>
                <div className="muted pequeno">{dataBR(e.data_inicio)}{e.data_fim && e.data_fim !== e.data_inicio && ` a ${dataBR(e.data_fim)}`}{e.horario && ` · ${e.horario}`}{(e.local ?? turma.local) && ` · ${e.local ?? turma.local}`}</div>
                {e.observacao && <div className="muted pequeno">{e.observacao}</div>}
              </div>
              <div className="acoes-linha">
                <a className="btn btn-mini" href={linkGoogle({ id: e.id, tipo: 'encontro', turma_id: turma.id, turma_nome: turma.nome, curso_nome: turma.curso_nome, titulo: e.titulo, data_inicio: e.data_inicio, data_fim: e.data_fim ?? e.data_inicio, horario: e.horario, local: e.local ?? turma.local, observacao: e.observacao, turma_status: turma.status })} target="_blank" rel="noreferrer">Google Agenda</a>
                {isAdmin && <button className="btn btn-mini" onClick={() => { setErro(null); setEditando(e) }}>Editar</button>}
                {isAdmin && <button className="btn btn-mini" onClick={() => cancelar(e)}>Remover</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal titulo={editando?.id ? 'Editar data' : ehResidencia ? 'Novo módulo' : 'Nova data'} aberto={!!editando} onFechar={() => setEditando(null)}>
        {editando && (
          <div className="form-grade">
            <Campo rotulo="Nome" dica={ehResidencia ? 'Ex.: Módulo 1 — Toxina' : undefined}><input value={editando.titulo ?? ''} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} autoFocus /></Campo>
            <Campo rotulo="Primeiro dia"><input type="date" value={editando.data_inicio ?? ''} onChange={(e) => setEditando({ ...editando, data_inicio: e.target.value })} /></Campo>
            <Campo rotulo="Último dia" dica="Deixe vazio se for um dia só"><input type="date" value={editando.data_fim ?? ''} onChange={(e) => setEditando({ ...editando, data_fim: e.target.value })} /></Campo>
            <Campo rotulo="Horário (opcional)"><input value={editando.horario ?? ''} placeholder="08h às 18h" onChange={(e) => setEditando({ ...editando, horario: e.target.value })} /></Campo>
            <Campo rotulo="Local"><input value={editando.local ?? ''} onChange={(e) => setEditando({ ...editando, local: e.target.value })} /></Campo>
            <Campo rotulo="Observação (opcional)"><input value={editando.observacao ?? ''} onChange={(e) => setEditando({ ...editando, observacao: e.target.value })} /></Campo>
            <Erro msg={erro} />
            <div className="modal-acoes"><button className="btn" onClick={() => setEditando(null)}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar</button></div>
          </div>
        )}
      </Modal>
    </section>
  )
}
