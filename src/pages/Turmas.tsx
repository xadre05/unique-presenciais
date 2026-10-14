import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, STATUS_TURMA } from '../lib/format'
import type { Turma } from '../lib/types'
import { Badge, Campo, Erro, InputNumero, Modal, Vazio } from '../components/ui'
import { Ocupacao } from './Painel'
import { useAuth } from '../auth'

export default function Turmas() {
  const [verTodas, setVerTodas] = useState(false)
  const turmas = useConsulta<Turma[]>(() => {
    let q = supabase.from('v_turmas').select('*').order('data_inicio', { ascending: true, nullsFirst: false })
    if (!verTodas) q = q.not('status', 'in', '(realizada,cancelada)')
    return q
  }, [verTodas])
  const [editando, setEditando] = useState<Partial<Turma> | null>(null)
  const { isAdmin } = useAuth()

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Turmas</h1><p className="muted">Cada turma tem curso, datas, local e vagas. Os alunos entram nela pela matrícula.</p></div>
        <div className="acoes">
          <label className="check"><input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> mostrar realizadas e canceladas</label>
          {isAdmin && <button className="btn btn-ouro" onClick={() => setEditando({ vagas: 12, status: 'aberta', local: 'Brasília' })}>+ Nova turma</button>}
        </div>
      </header>
      {turmas.erro && <Erro msg={turmas.erro} />}
      {(turmas.dados ?? []).length === 0 && !turmas.carregando ? <Vazio>Nenhuma turma.</Vazio> : (
        <div className="cards">
          {(turmas.dados ?? []).map((t) => (
            <Link to={`/turmas/${t.id}`} key={t.id} className="card-turma">
              <div className="card-topo"><span className="muted pequeno">{t.curso_nome}</span><Badge tom={t.status === 'aberta' ? 'info' : t.status === 'lotada' ? 'ok' : t.status === 'cancelada' ? 'apagado' : 'neutro'}>{STATUS_TURMA[t.status]}</Badge></div>
              <h3>{t.nome}</h3>
              <div className="muted pequeno">{t.data_inicio ? `${dataBR(t.data_inicio)} a ${dataBR(t.data_fim)}` : 'Datas a definir'} · {t.local}</div>
              <Ocupacao inscritos={t.inscritos} vagas={t.vagas} />
              <div className="card-linhas">
                <div><span className="muted">Fechado</span><b>{brl(t.valor_fechado)}</b></div>
                <div><span className="muted">Recebido</span><b className="ok-txt">{brl(t.recebido)}</b></div>
                <div><span className="muted">A receber</span><b>{brl(t.a_receber)}</b></div>
                {Number(t.atrasado) > 0 && <div><span className="muted">Atrasado</span><b className="erro-txt">{brl(t.atrasado)}</b></div>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <FormTurma turma={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); turmas.recarregar() }} />
    </div>
  )
}

export function FormTurma({ turma, onFechar, onSalvo }: { turma: Partial<Turma> | null; onFechar: () => void; onSalvo: () => void }) {
  const { cursos } = useCadastros()
  const [f, setF] = useState<Partial<Turma>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState<Partial<Turma> | null>(null)
  if (turma !== ultimo) { setUltimo(turma); setF(turma ?? {}); setErro(null) }
  const set = (k: keyof Turma, v: unknown) => setF((x) => ({ ...x, [k]: v }))

  const salvar = async () => {
    setErro(null)
    if (!f.curso_id) return setErro('Escolha o curso.')
    if (!f.nome?.trim()) return setErro('Dê um nome para a turma.')
    if (f.data_inicio && f.data_fim && f.data_fim < f.data_inicio) return setErro('A data de fim é antes do início.')
    setSalvando(true)
    const reg = { curso_id: f.curso_id, nome: f.nome.trim(), data_inicio: f.data_inicio || null, data_fim: f.data_fim || null, local: f.local || null, vagas: f.vagas || 12, status: f.status || 'aberta', observacoes: f.observacoes || null }
    const { error } = f.id ? await supabase.from('turmas').update(reg).eq('id', f.id) : await supabase.from('turmas').insert(reg)
    setSalvando(false)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }

  return (
    <Modal titulo={f.id ? 'Editar turma' : 'Nova turma'} aberto={!!turma} onFechar={onFechar}>
      <div className="form-grade">
        <Campo rotulo="Curso">
          <select value={f.curso_id ?? ''} onChange={(e) => set('curso_id', e.target.value)}>
            <option value="">Escolha…</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Nome da turma" dica="Ex.: Mini Residência — 3ª Turma"><input value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} /></Campo>
        <Campo rotulo="Primeiro dia"><input type="date" value={f.data_inicio ?? ''} onChange={(e) => set('data_inicio', e.target.value)} /></Campo>
        <Campo rotulo="Último dia"><input type="date" value={f.data_fim ?? ''} onChange={(e) => set('data_fim', e.target.value)} /></Campo>
        <Campo rotulo="Local"><input value={f.local ?? ''} onChange={(e) => set('local', e.target.value)} /></Campo>
        <Campo rotulo="Vagas"><InputNumero valor={f.vagas ?? 12} onChange={(v) => set('vagas', v)} max={200} sufixo="vagas" /></Campo>
        <Campo rotulo="Situação">
          <select value={f.status ?? 'aberta'} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(STATUS_TURMA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Observações"><textarea rows={3} value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>Salvar turma</button></div>
    </Modal>
  )
}
