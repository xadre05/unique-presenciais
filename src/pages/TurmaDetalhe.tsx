import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { brl, dataBR, SITUACAO_ALUNO, SITUACAO_PARCELA, STATUS_MATRICULA, FORMAS, whatsLink } from '../lib/format'
import type { MatriculaV, ParcelaV, Turma } from '../lib/types'
import { Badge, Erro, Kpi, Vazio } from '../components/ui'
import { FormTurma, selosTurma } from './Turmas'
import { Ocupacao } from './Painel'
import { useAuth } from '../auth'
import { Encontros } from '../components/Encontros'
import { Icone } from '../components/Icone'

export default function TurmaDetalhe() {
  const { id } = useParams()
  const turma = useConsulta<Turma>(() => supabase.from('v_turmas').select('*').eq('id', id!).single(), [id])
  const mats = useConsulta<MatriculaV[]>(() => supabase.from('v_matriculas').select('*').eq('turma_id', id!).order('aluno_nome'), [id])
  const [editando, setEditando] = useState<Partial<Turma> | null>(null)
  const [aba, setAba] = useState<'alunos' | 'financeiro' | 'organizacao'>('alunos')
  const parcelas = useConsulta<ParcelaV[]>(() => supabase.from('v_parcelas').select('*').eq('turma_id', id!).neq('situacao', 'cancelada').order('vencimento', { ascending: true, nullsFirst: false }), [id])
  const { isAdmin } = useAuth()
  const t = turma.dados
  if (turma.erro) return <div className="pagina"><Erro msg={turma.erro} /></div>
  if (!t) return <div className="pagina muted">Carregando…</div>
  const ms = mats.dados ?? []
  const ativos = ms.filter((m) => m.status !== 'cancelada' && m.status !== 'transferida')

  return (
    <div className="pagina">
      <div className="migalha"><Link to="/turmas">Turmas</Link> / {t.nome}</div>
      <header className="pagina-topo">
        <div>
          <h1>{t.nome}</h1>
          <p className="muted">{t.curso_nome} · {t.data_inicio ? `${dataBR(t.data_inicio)} a ${dataBR(t.data_fim)}` : 'datas a definir'} · {t.local} {selosTurma(t).map((x) => <Badge key={x.rotulo} tom={x.tom}>{x.rotulo}</Badge>)}</p>
          {t.observacoes && <p className="nota">{t.observacoes}</p>}
        </div>
        <div className="acoes">
          {isAdmin && <button className="btn" onClick={() => setEditando(t)}>Editar turma</button>}
          <Link className="btn btn-ouro" to={`/matricula/nova?turma=${t.id}`}>+ Matricular aluno</Link>
        </div>
      </header>
      <section className="kpis">
        <div className="kpi"><div className="kpi-rotulo">Vagas</div><Ocupacao inscritos={t.inscritos} vagas={t.vagas} /><div className="kpi-sub">{Math.max(0, t.vagas - t.inscritos)} livres</div></div>
        <Kpi rotulo="Valor fechado" valor={brl(t.valor_fechado)} />
        <Kpi rotulo="Recebido" valor={brl(t.recebido)} tom="ok" />
        <Kpi rotulo="Aguardando conferência" valor={brl(t.aguardando_conferencia)} tom="info" />
        <Kpi rotulo="A receber" valor={brl(t.a_receber)} />
        <Kpi rotulo="Atrasado" valor={brl(t.atrasado)} tom="erro" />
      </section>
      <nav className="abas">
        <button className={aba === 'alunos' ? 'ativa' : ''} onClick={() => setAba('alunos')}><Icone nome="alunos" tam={16} /> Alunos <span className="muted">{ativos.length}</span></button>
        <button className={aba === 'financeiro' ? 'ativa' : ''} onClick={() => setAba('financeiro')}><Icone nome="pagamentos" tam={16} /> Financeiro {t.alunos_atrasados > 0 && <Badge tom="erro">{t.alunos_atrasados}</Badge>}</button>
        <button className={aba === 'organizacao' ? 'ativa' : ''} onClick={() => setAba('organizacao')}><Icone nome="agenda" tam={16} /> Organização {(!t.data_inicio || t.sem_contrato > 0) && <Badge tom="alerta">!</Badge>}</button>
      </nav>
      {aba === 'financeiro' && <Financeiro ps={parcelas.dados ?? []} />}
      {aba === 'organizacao' && (<>
        <Encontros turma={t} onMudou={() => turma.recarregar()} />
        <section className="bloco">
          <h2><Icone nome="documento" className="ouro" /> Contratos {t.sem_contrato > 0 ? <Badge tom="alerta">{t.sem_contrato} pendente(s)</Badge> : <Badge tom="ok">todos assinados</Badge>}</h2>
          {ativos.filter((m) => !m.contrato_assinado).length === 0 ? <Vazio>Todos os alunos ativos estão com contrato assinado.</Vazio> : (
            <ul className="lista">
              {ativos.filter((m) => !m.contrato_assinado).map((m) => (
                <li key={m.id}><Link to={`/matricula/${m.id}`} className="forte">{m.aluno_nome}</Link><Link to={`/matricula/${m.id}`} className="link pequeno">anexar contrato</Link></li>
              ))}
            </ul>
          )}
        </section>
      </>)}
      {aba === 'alunos' && <section className="bloco">
        <h2>Alunos ({ativos.length})</h2>
        {ms.length === 0 ? <Vazio>Nenhum aluno matriculado ainda.</Vazio> : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Aluno</th><th>Vendeu</th><th>Inscrição</th><th>Contrato</th><th className="num">Fechado</th><th className="num">Recebido</th><th className="num">Falta</th><th>Pagamento</th><th>Próximo venc.</th></tr></thead>
              <tbody>
                {ms.map((m) => {
                  const s = SITUACAO_ALUNO[m.situacao_financeira]
                  return (
                    <tr key={m.id} className={m.status === 'cancelada' ? 'linha-apagada' : ''}>
                      <td><Link to={`/matricula/${m.id}`} className="forte">{m.aluno_nome}</Link>
                        {whatsLink(m.aluno_whatsapp) && <div><a className="link pequeno" href={whatsLink(m.aluno_whatsapp)!} target="_blank" rel="noreferrer">{m.aluno_whatsapp}</a></div>}</td>
                      <td>{m.vendedora_nome ?? '—'}</td>
                      <td className="pequeno">{STATUS_MATRICULA[m.status]}</td>
                      <td>{m.contrato_assinado ? <Badge tom="ok">assinado</Badge> : <Badge tom="alerta">pendente</Badge>}</td>
                      <td className="num">{brl(m.valor_fechado)}</td>
                      <td className="num ok-txt">{brl(m.recebido)}</td>
                      <td className="num">{brl(Number(m.a_receber) + Number(m.aguardando_conferencia))}</td>
                      <td><Badge tom={s?.tom}>{s?.rotulo}</Badge><div className="muted pequeno">{m.parcelas_pagas}/{m.parcelas_total} parcelas</div></td>
                      <td>{dataBR(m.proximo_vencimento)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>}
      <FormTurma turma={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); turma.recarregar() }} />
    </div>
  )
}

function Financeiro({ ps }: { ps: ParcelaV[] }) {
  const ordem: Record<string, number> = { atrasada: 0, aguardando_conferencia: 1, sem_vencimento: 2, a_vencer: 3, recebida: 4 }
  const lista = [...ps].sort((a, b) => (ordem[a.situacao] ?? 9) - (ordem[b.situacao] ?? 9) || (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
  if (lista.length === 0) return <section className="bloco"><Vazio>Nenhuma parcela nesta turma.</Vazio></section>
  return (
    <section className="bloco">
      <h2><Icone nome="pagamentos" className="ouro" /> Parcelas da turma</h2>
      <p className="muted pequeno">Primeiro o que está atrasado, depois o que falta conferir, o que está sem data e o que vai vencer.</p>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Aluno</th><th>Parcela</th><th>Forma</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link></td>
                <td>{p.eh_matricula ? 'Matrícula' : `${p.numero}/${p.total_parcelas}`}</td>
                <td className="pequeno">{FORMAS[p.forma] ?? p.forma}</td>
                <td>{dataBR(p.vencimento)}{p.situacao === 'atrasada' && <div className="erro-txt pequeno">{p.dias_atraso} dias</div>}</td>
                <td className="num">{brl(p.valor_recebido ?? p.valor)}</td>
                <td><Badge tom={SITUACAO_PARCELA[p.situacao]?.tom}>{SITUACAO_PARCELA[p.situacao]?.rotulo}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
