import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, STATUS_TURMA } from '../lib/format'
import type { Turma } from '../lib/types'
import { Badge, Campo, Erro, InputNumero, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'

const ORDENS: Record<string, string> = { data: 'Data mais próxima', ocupacao: 'Menor ocupação', curso: 'Curso', receber: 'Mais a receber' }

export function selosTurma(t: Turma) {
  const lotada = t.inscritos >= t.vagas
  const selos: { rotulo: string; tom: string }[] = []
  if (t.status === 'cancelada') selos.push({ rotulo: 'Cancelada', tom: 'apagado' })
  else if (t.status === 'realizada') selos.push({ rotulo: 'Realizada', tom: 'neutro' })
  else {
    if (t.status === 'planejada') selos.push({ rotulo: 'Planejada', tom: 'neutro' })
    if (lotada) selos.push({ rotulo: 'Lotada', tom: 'ok' })
    else selos.push(t.vendas_abertas ? { rotulo: 'Vendas abertas', tom: 'info' } : { rotulo: 'Vendas encerradas', tom: 'alerta' })
  }
  return selos
}

export default function Turmas() {
  const { isAdmin } = useAuth()
  const [verTodas, setVerTodas] = useState(false)
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [ordem, setOrdem] = useState('data')
  const turmas = useConsulta<Turma[]>(() => {
    let q = supabase.from('v_turmas').select('*').order('data_inicio', { ascending: true, nullsFirst: false })
    if (!verTodas) q = q.not('status', 'in', '(realizada,cancelada)')
    return q
  }, [verTodas])
  const [editando, setEditando] = useState<Partial<Turma> | null>(null)

  const termo = busca.trim().toLowerCase()
  const ts = (turmas.dados ?? [])
    .filter((t) => !termo || `${t.nome} ${t.curso_nome} ${t.local ?? ''}`.toLowerCase().includes(termo))
    .filter((t) => {
      if (!situacao) return true
      if (situacao === 'lotada') return t.inscritos >= t.vagas
      if (situacao === 'vagas') return t.inscritos < t.vagas && t.vendas_abertas && !['realizada', 'cancelada'].includes(t.status)
      if (situacao === 'encerradas') return !t.vendas_abertas
      if (situacao === 'sem_data') return !t.data_inicio
      if (situacao === 'atraso') return Number(t.atrasado) > 0
      return t.status === situacao
    })
    .sort((a, b) => {
      if (ordem === 'ocupacao') return a.inscritos / a.vagas - b.inscritos / b.vagas
      if (ordem === 'curso') return a.curso_nome.localeCompare(b.curso_nome) || a.nome.localeCompare(b.nome)
      if (ordem === 'receber') return Number(b.a_receber) - Number(a.a_receber)
      return (a.data_inicio ?? '9999').localeCompare(b.data_inicio ?? '9999')
    })
  const ocupadas = ts.reduce((s, t) => s + Number(t.inscritos), 0)
  const livres = ts.filter((t) => !['realizada', 'cancelada'].includes(t.status)).reduce((s, t) => s + Math.max(0, t.vagas - t.inscritos), 0)
  const semData = (turmas.dados ?? []).filter((t) => !t.data_inicio && !['realizada', 'cancelada'].includes(t.status))

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Turmas</h1><p className="muted">Vagas, matrículas e situação financeira por turma.</p></div>
        {isAdmin && <button className="btn btn-ouro btn-grande" onClick={() => setEditando({ vagas: 12, status: 'planejada', vendas_abertas: true, local: 'Brasília' })}><Icone nome="mais" /> Nova turma</button>}
      </header>

      <div className="filtros-turmas">
        <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar turma ou curso" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <label className="select-icone">
          <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="">Todas as situações</option>
            <option value="vagas">Com vagas e vendas abertas</option>
            <option value="lotada">Lotadas</option>
            <option value="encerradas">Vendas encerradas</option>
            <option value="planejada">Planejadas</option>
            <option value="confirmada">Confirmadas</option>
            <option value="sem_data">Sem data</option>
            <option value="atraso">Com pagamento atrasado</option>
          </select>
        </label>
        <label className="select-icone"><Icone nome="ordem" />
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            {Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> Incluir realizadas e canceladas</label>
      </div>

      <div className="faixa-resumo">
        <div><Icone nome="turmas" className="ouro" /><b>{ts.length}</b> turma(s) exibida(s)</div>
        <div><Icone nome="alunos" className="ouro" /><b>{ocupadas}</b> vagas ocupadas</div>
        <div><Icone nome="turmas" className="ouro" /><b>{livres}</b> vagas disponíveis</div>
      </div>

      {turmas.erro && <Erro msg={turmas.erro} />}
      {ts.length === 0 && !turmas.carregando ? <Vazio>Nenhuma turma com esses filtros.</Vazio> : (
        <div className="cards cards-turma">
          {ts.map((t) => {
            const lotada = t.inscritos >= t.vagas
            const livresT = Math.max(0, t.vagas - t.inscritos)
            const encerrada = ['realizada', 'cancelada'].includes(t.status)
            return (
              <article key={t.id} className="card-turma">
                <div className="card-topo">
                  <span className="muted pequeno">{t.curso_nome}</span>
                  <span className="selos">{selosTurma(t).map((s) => <Badge key={s.rotulo} tom={s.tom}>{s.rotulo}</Badge>)}</span>
                </div>
                <h3><Link to={`/turmas/${t.id}`}>{t.nome}</Link></h3>
                <div className="card-info"><Icone nome="local" tam={15} /> {t.local ?? 'Local a definir'}</div>
                {t.data_inicio
                  ? <div className="card-info"><Icone nome="agenda" tam={15} /> {dataBR(t.data_inicio)}{t.data_fim && t.data_fim !== t.data_inicio && ` a ${dataBR(t.data_fim)}`}</div>
                  : <div className="card-info alerta-txt"><Icone nome="alerta" tam={15} /> Datas a definir</div>}
                <div className="ocupacao-grande">
                  <div className="ocupacao-barra"><div style={{ width: Math.min(100, Math.round((t.inscritos / t.vagas) * 100)) + '%' }} className={lotada ? 'cheia' : ''} /></div>
                  <span className="num-txt">{t.inscritos}/{t.vagas}</span>
                </div>
                <div className="muted pequeno">{lotada ? 'Sem vagas disponíveis' : `${livresT} ${livresT === 1 ? 'vaga disponível' : 'vagas disponíveis'}`}</div>
                <div className="card-valores">
                  <div><span>Fechado</span><b>{brl(t.valor_fechado)}</b></div>
                  <div><span>Recebido</span><b className="ok-txt">{brl(t.recebido)}</b></div>
                  <div><span>A receber</span><b>{brl(t.a_receber)}</b></div>
                  {Number(t.atrasado) > 0 && <div><span>Em atraso</span><b className="erro-txt">{brl(t.atrasado)}</b></div>}
                  {Number(t.aguardando_conferencia) > 0 && <div><span>Para conferir</span><b className="info-txt">{brl(t.aguardando_conferencia)}</b></div>}
                </div>
                <div className="card-acoes">
                  <Link to={`/turmas/${t.id}`} className="btn btn-contorno">Ver turma</Link>
                  {encerrada ? (isAdmin && <button className="btn btn-contorno" onClick={() => setEditando(t)}>Editar</button>)
                    : lotada || !t.vendas_abertas
                      ? (isAdmin ? <Link to={`/matricula/nova?turma=${t.id}`} className="btn">Matricular mesmo assim</Link> : <button className="btn" disabled>{lotada ? 'Turma lotada' : 'Vendas encerradas'}</button>)
                      : <Link to={`/matricula/nova?turma=${t.id}`} className="btn btn-ouro">Matricular</Link>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {semData.length > 0 && (
        <section className="bloco faixa-pendencia">
          <Icone nome="agenda" tam={34} className="ouro" />
          <div>
            <h2>Pendências de organização</h2>
            <div className="alerta-txt forte">{semData.length} turma(s) sem datas definidas</div>
            <div className="muted pequeno">{semData.map((t) => t.nome).join(', ')}</div>
          </div>
          {isAdmin && <button className="btn btn-ouro" onClick={() => setSituacao('sem_data')}>Revisar datas</button>}
        </section>
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
    const reg = { curso_id: f.curso_id, nome: f.nome.trim(), data_inicio: f.data_inicio || null, data_fim: f.data_fim || null, local: f.local || null, vagas: f.vagas || 12, status: f.status || 'planejada', vendas_abertas: f.vendas_abertas ?? true, observacoes: f.observacoes || null }
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
          <select value={f.status ?? 'planejada'} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(STATUS_TURMA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Vendas" dica="Encerrar tira a turma da lista de nova matrícula das vendedoras.">
          <select value={(f.vendas_abertas ?? true) ? 's' : 'n'} onChange={(e) => set('vendas_abertas', e.target.value === 's')}>
            <option value="s">Vendas abertas</option>
            <option value="n">Vendas encerradas</option>
          </select>
        </Campo>
      </div>
      <Campo rotulo="Observações"><textarea rows={3} value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>Salvar turma</button></div>
    </Modal>
  )
}
