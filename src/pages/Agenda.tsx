import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta } from '../lib/dados'
import { dataBR, hojeISO } from '../lib/format'
import { Badge, Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'

export type EventoAgenda = {
  id: string; tipo: 'encontro' | 'turma'; turma_id: string; turma_nome: string; curso_nome: string; titulo: string
  data_inicio: string; data_fim: string; horario: string | null; local: string | null; observacao: string | null; turma_status: string
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function corCurso(nome: string) {
  if (/resid/i.test(nome)) return 'ev-ouro'
  if (/codes/i.test(nome)) return 'ev-azul'
  return 'ev-verde'
}

export function linkGoogle(e: EventoAgenda) {
  const fim = new Date(e.data_fim + 'T12:00:00'); fim.setDate(fim.getDate() + 1)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.tipo === 'encontro' ? `${e.turma_nome} — ${e.titulo}` : e.titulo,
    dates: `${e.data_inicio.replace(/-/g, '')}/${iso(fim).replace(/-/g, '')}`,
    details: [e.curso_nome, e.horario ? `Horário: ${e.horario}` : '', e.observacao ?? ''].filter(Boolean).join('\n'),
    location: e.local ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export default function Agenda() {
  const { isAdmin } = useAuth()
  const hoje = hojeISO()
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const eventos = useConsulta<EventoAgenda[]>(() => supabase.from('v_agenda').select('*').order('data_inicio'))
  const cad = useCadastros()
  const [curso, setCurso] = useState('')

  const evs = (eventos.dados ?? []).filter((e) => !curso || e.curso_nome === curso)
  const cursos = [...new Set((eventos.dados ?? []).map((e) => e.curso_nome))]

  const dias = useMemo(() => {
    const ini = new Date(mes); ini.setDate(1 - ini.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + i); return d })
  }, [mes])
  const doDia = (d: string) => evs.filter((e) => e.data_inicio <= d && e.data_fim >= d)
  const proximos = evs.filter((e) => e.data_fim >= hoje).slice(0, 12)
  const comData = new Set((eventos.dados ?? []).map((e) => e.turma_id))
  const semData = cad.turmas.filter((t) => !comData.has(t.id) && !['realizada', 'cancelada'].includes(t.status))
  const mudarMes = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Agenda dos cursos</h1>
          <p className="muted">Datas de todas as turmas e módulos presenciais. {isAdmin ? 'As datas são cadastradas dentro de cada turma.' : 'Quem cadastra as datas é o administrador.'}</p>
        </div>
        <div className="acoes">
          <select value={curso} onChange={(e) => setCurso(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Todos os cursos</option>
            {cursos.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </header>
      <Erro msg={eventos.erro} />

      {semData.length > 0 && (
        <div className="nota">
          <b>{semData.length} turma(s) sem data na agenda:</b> {semData.map((t, i) => <span key={t.id}>{i > 0 && ', '}<Link to={`/turmas/${t.id}`} className="link">{t.nome}</Link></span>)}.
          {isAdmin ? ' Abra a turma e cadastre os módulos.' : ''}
        </div>
      )}

      <div className="agenda-grade">
        <section className="bloco calendario">
          <div className="cal-topo">
            <button className="btn btn-mini" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="esquerda" tam={16} /></button>
            <h2>{MESES[mes.getMonth()]} de {mes.getFullYear()}</h2>
            <button className="btn btn-mini" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="seta" tam={16} /></button>
            <button className="btn btn-mini" onClick={() => { const d = new Date(); setMes(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Hoje</button>
          </div>
          <div className="cal">
            {DIAS.map((d) => <div key={d} className="cal-dia-semana">{d}</div>)}
            {dias.map((d) => {
              const k = iso(d)
              const es = doDia(k)
              return (
                <div key={k} className={`cal-dia${d.getMonth() !== mes.getMonth() ? ' fora' : ''}${k === hoje ? ' hoje' : ''}`}>
                  <span className="cal-num">{d.getDate()}</span>
                  {es.map((e) => (
                    <Link key={e.id + k} to={`/turmas/${e.turma_id}`} className={`cal-ev ${corCurso(e.curso_nome)}`} title={`${e.turma_nome} — ${e.titulo}`}>
                      {e.tipo === 'encontro' ? `${e.titulo} · ${e.turma_nome}` : e.titulo}
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="cal-legenda">
            <span><i className="ev-ouro" /> Mini Residência</span><span><i className="ev-azul" /> Unique Codes Experience</span><span><i className="ev-verde" /> Outros</span>
          </div>
        </section>

        <section className="bloco">
          <h2><Icone nome="agenda" className="ouro" /> Próximas datas</h2>
          {proximos.length === 0 ? <Vazio>Nenhuma data futura cadastrada.</Vazio> : (
            <ul className="lista">
              {proximos.map((e) => (
                <li key={e.id} className="ev-item">
                  <div className={`ev-barra ${corCurso(e.curso_nome)}`} />
                  <div style={{ flex: 1 }}>
                    <Link to={`/turmas/${e.turma_id}`} className="forte">{e.tipo === 'encontro' ? `${e.titulo} — ${e.turma_nome}` : e.titulo}</Link>
                    <div className="muted pequeno">{dataBR(e.data_inicio)}{e.data_fim !== e.data_inicio && ` a ${dataBR(e.data_fim)}`}{e.horario && ` · ${e.horario}`}</div>
                    {e.local && <div className="muted pequeno"><Icone nome="local" tam={12} /> {e.local}</div>}
                    <a className="link pequeno" href={linkGoogle(e)} target="_blank" rel="noreferrer">+ pôr na minha agenda do Google</a>
                  </div>
                  {e.data_inicio <= hoje && <Badge tom="ok">acontecendo</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
