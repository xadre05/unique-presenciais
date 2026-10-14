import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta } from '../lib/dados'
import { hojeISO } from '../lib/format'
import { Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'

export type EventoAgenda = {
  id: string; tipo: 'encontro' | 'turma'; turma_id: string; turma_nome: string; curso_nome: string; titulo: string
  data_inicio: string; data_fim: string; horario: string | null; local: string | null; observacao: string | null; turma_status: string
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dia = (s: string) => new Date(s + 'T12:00:00')

export function corCurso(nome: string) {
  if (/resid/i.test(nome)) return 'ev-ouro'
  if (/codes/i.test(nome)) return 'ev-azul'
  return 'ev-verde'
}

// "Mini Residência — 1ª Turma" → "Mini Residência · 1ª turma"
export const turmaCurta = (n: string) => n.replace(' — ', ' · ').replace(/Turma/, 'turma')
export const rotuloCal = (e: EventoAgenda) => rotuloEvento(e).replace('Unique Codes Experience', 'Unique Codes').replace('Módulo ', 'Mód. ')
export const rotuloEvento = (e: EventoAgenda) => e.tipo === 'encontro' ? `${turmaCurta(e.turma_nome)} — ${e.titulo}` : turmaCurta(e.turma_nome)

export function linkGoogle(e: EventoAgenda) {
  const fim = dia(e.data_fim); fim.setDate(fim.getDate() + 1)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: rotuloEvento(e),
    dates: `${e.data_inicio.replace(/-/g, '')}/${iso(fim).replace(/-/g, '')}`,
    details: [e.curso_nome, e.horario ? `Horário: ${e.horario}` : '', e.observacao ?? ''].filter(Boolean).join('\n'),
    location: e.local ?? '',
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function faixaDatas(e: EventoAgenda) {
  const a = dia(e.data_inicio), b = dia(e.data_fim)
  const d1 = String(a.getDate()).padStart(2, '0'), d2 = String(b.getDate()).padStart(2, '0')
  if (e.data_inicio === e.data_fim) return { dias: d1, mes: MES_CURTO[a.getMonth()] }
  if (a.getMonth() === b.getMonth()) return { dias: `${d1}–${d2}`, mes: MES_CURTO[a.getMonth()] }
  return { dias: `${d1}/${a.getMonth() + 1}–${d2}/${b.getMonth() + 1}`, mes: '' }
}

function exportarICS(evs: EventoAgenda[]) {
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unique Presenciais//PT-BR', 'CALSCALE:GREGORIAN']
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
  for (const e of evs) {
    const fim = dia(e.data_fim); fim.setDate(fim.getDate() + 1)
    linhas.push('BEGIN:VEVENT', `UID:${e.id}-${e.data_inicio}@unique-presenciais`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${e.data_inicio.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${iso(fim).replace(/-/g, '')}`,
      `SUMMARY:${esc(rotuloEvento(e))}`, `LOCATION:${esc(e.local ?? '')}`, `DESCRIPTION:${esc([e.curso_nome, e.horario ?? ''].filter(Boolean).join(' · '))}`, 'END:VEVENT')
  }
  linhas.push('END:VCALENDAR')
  const url = URL.createObjectURL(new Blob([linhas.join('\r\n')], { type: 'text/calendar' }))
  const a = document.createElement('a'); a.href = url; a.download = 'agenda-unique-presenciais.ics'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Agenda() {
  const { isAdmin } = useAuth()
  const hoje = hojeISO()
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [modo, setModo] = useState<'mes' | 'lista'>('mes')
  const [curso, setCurso] = useState('')
  const [turma, setTurma] = useState('')
  const eventos = useConsulta<EventoAgenda[]>(() => supabase.from('v_agenda').select('*').order('data_inicio'))
  const cad = useCadastros()

  const todos = eventos.dados ?? []
  const cursos = [...new Set(todos.map((e) => e.curso_nome))]
  const turmas = [...new Map(todos.filter((e) => !curso || e.curso_nome === curso).map((e) => [e.turma_id, e.turma_nome])).entries()]
  const evs = todos.filter((e) => (!curso || e.curso_nome === curso) && (!turma || e.turma_id === turma))
  const futuros = evs.filter((e) => e.data_fim >= hoje)
  const comData = new Set(todos.map((e) => e.turma_id))
  const semData = cad.turmas.filter((t) => !comData.has(t.id) && !['realizada', 'cancelada'].includes(t.status))

  // Semanas do mês, cada evento vira uma faixa contínua dentro da semana.
  const semanas = useMemo(() => {
    const ini = new Date(mes); ini.setDate(1 - ini.getDay())
    return Array.from({ length: 6 }, (_, w) => {
      const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + w * 7 + i); return d })
      const a = iso(dias[0]), b = iso(dias[6])
      const faixas = evs.filter((e) => e.data_inicio <= b && e.data_fim >= a)
        .map((e) => ({ e, c1: e.data_inicio < a ? 0 : dias.findIndex((d) => iso(d) === e.data_inicio), c2: e.data_fim > b ? 6 : dias.findIndex((d) => iso(d) === e.data_fim), corta: e.data_inicio < a }))
      const linhas: number[] = []
      const comLinha = faixas.map((f) => {
        let l = 0
        while (linhas[l] !== undefined && linhas[l] >= f.c1) l++
        linhas[l] = f.c2
        return { ...f, linha: l }
      })
      return { dias, faixas: comLinha }
    }).filter((s, i) => i < 5 || s.dias[0].getMonth() === mes.getMonth())
  }, [mes, evs])
  const mudarMes = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const legenda = cursos.map((c) => ({ c, cor: corCurso(c) }))

  return (
    <div className="pagina agenda">
      <header className="pagina-topo">
        <div><h1>Agenda dos cursos</h1><p className="muted">Turmas e módulos presenciais em um só lugar.</p></div>
        <button className="btn btn-contorno btn-grande" onClick={() => exportarICS(futuros)} disabled={futuros.length === 0}><Icone nome="exportar" /> Exportar agenda</button>
      </header>

      <div className="filtros-agenda">
        <label className="select-icone"><select value={curso} onChange={(e) => { setCurso(e.target.value); setTurma('') }}>
          <option value="">Todos os cursos</option>{cursos.map((c) => <option key={c}>{c}</option>)}
        </select></label>
        <label className="select-icone"><select value={turma} onChange={(e) => setTurma(e.target.value)}>
          <option value="">Todas as turmas</option>{turmas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select></label>
        <div className="alternar">
          <button className={modo === 'mes' ? 'ativo' : ''} onClick={() => setModo('mes')}>Mês</button>
          <button className={modo === 'lista' ? 'ativo' : ''} onClick={() => setModo('lista')}>Lista</button>
        </div>
      </div>
      <Erro msg={eventos.erro} />

      {semData.length > 0 && (
        <div className="nota"><b>{semData.length} turma(s) sem data:</b> {semData.map((t, i) => <span key={t.id}>{i > 0 && ', '}<Link to={`/turmas/${t.id}`} className="link">{t.nome}</Link></span>)}.</div>
      )}

      <div className="agenda-grade">
        {modo === 'mes' ? (
          <section className="bloco calendario">
            <div className="cal-topo">
              <h2>{MESES[mes.getMonth()]} de {mes.getFullYear()}</h2>
              <button className="btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="esquerda" tam={16} /></button>
              <button className="btn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="seta" tam={16} /></button>
              <button className="btn" onClick={() => { const d = new Date(); setMes(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Hoje</button>
            </div>
            <div className="cal2">
              <div className="cal2-cab">{DIAS.map((d) => <div key={d}>{d}</div>)}</div>
              {semanas.map((s, w) => (
                <div className="cal2-semana" key={w}>
                  {s.dias.map((d, i) => (
                    <div key={i} className={`cal2-dia${d.getMonth() !== mes.getMonth() ? ' fora' : ''}${iso(d) === hoje ? ' hoje' : ''}`} style={{ gridColumn: i + 1 }}>
                      <span className="cal2-num">{d.getDate()}</span>
                    </div>
                  ))}
                  {s.faixas.map((f) => (
                    <Link key={f.e.id} to={`/turmas/${f.e.turma_id}`} className={`cal2-faixa ${corCurso(f.e.curso_nome)}`}
                      style={{ gridColumn: `${f.c1 + 1} / ${f.c2 + 2}`, gridRow: f.linha + 2 }} title={`${rotuloEvento(f.e)}${f.e.local ? ' · ' + f.e.local : ''}`}>
                      {f.corta ? '… ' : ''}{rotuloCal(f.e)}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="cal-legenda">{legenda.map((l) => <span key={l.c}><i className={l.cor} /> {l.c}</span>)}</div>
          </section>
        ) : (
          <section className="bloco">
            {futuros.length === 0 ? <Vazio>Nenhuma data futura com esses filtros.</Vazio> : (
              Object.entries(futuros.reduce<Record<string, EventoAgenda[]>>((g, e) => {
                const k = e.data_inicio.slice(0, 7); (g[k] ||= []).push(e); return g
              }, {})).map(([k, es]) => (
                <div key={k} className="lista-mes">
                  <h2>{MESES[Number(k.slice(5, 7)) - 1]} de {k.slice(0, 4)}</h2>
                  {es.map((e) => <ItemData key={e.id} e={e} hoje={hoje} largo />)}
                </div>
              ))
            )}
          </section>
        )}

        <aside className="agenda-lado">
          <section className="bloco">
            <h2><Icone nome="agenda" className="ouro" /> Próximas datas</h2>
            {futuros.length === 0 ? <Vazio>Nenhuma data futura cadastrada.</Vazio> : futuros.slice(0, 6).map((e) => <ItemData key={e.id} e={e} hoje={hoje} />)}
          </section>
          <section className="bloco info-bloco">
            <Icone nome="info" tam={22} />
            <div>
              <div className="forte">Datas vinculadas às turmas</div>
              <p className="muted pequeno">{isAdmin ? 'Para mudar uma data, abra a turma e edite em Organização. A agenda atualiza sozinha.' : 'Quem cadastra e muda as datas é o administrador, dentro de cada turma.'}</p>
              <Link to="/turmas" className="btn btn-contorno btn-bloco">Ver turmas</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function ItemData({ e, hoje, largo }: { e: EventoAgenda; hoje: string; largo?: boolean }) {
  const f = faixaDatas(e)
  const agora = e.data_inicio <= hoje && e.data_fim >= hoje
  return (
    <div className={`item-data${largo ? ' largo' : ''}`}>
      <div className={`bloco-data ${corCurso(e.curso_nome)}`}><b>{f.dias}</b>{f.mes && <span>{f.mes}</span>}</div>
      <div className="item-data-texto">
        <div className="forte">{turmaCurta(e.turma_nome)}</div>
        {e.tipo === 'encontro' && <div className="item-sub">{e.titulo}</div>}
        {e.local && <div className="item-sub"><Icone nome="local" tam={13} /> {e.local}{e.horario && ` · ${e.horario}`}</div>}
        {agora && <div className="ok-txt pequeno">Acontecendo agora</div>}
      </div>
      <div className="item-data-acoes">
        <Link to={`/turmas/${e.turma_id}`} className="btn btn-contorno btn-mini">Ver turma</Link>
        <a className="btn btn-contorno btn-mini" href={linkGoogle(e)} target="_blank" rel="noreferrer" title="Pôr na minha agenda do Google"><Icone nome="agenda" tam={15} />+</a>
      </div>
    </div>
  )
}
