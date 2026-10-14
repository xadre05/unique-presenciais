import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { brl, dataBR, SITUACAO_ALUNO, STATUS_MATRICULA, STATUS_TURMA, whatsLink } from '../lib/format'
import type { MatriculaV, Turma } from '../lib/types'
import { Badge, Erro, Kpi, Vazio } from '../components/ui'
import { FormTurma } from './Turmas'
import { Ocupacao } from './Painel'

export default function TurmaDetalhe() {
  const { id } = useParams()
  const turma = useConsulta<Turma>(() => supabase.from('v_turmas').select('*').eq('id', id!).single(), [id])
  const mats = useConsulta<MatriculaV[]>(() => supabase.from('v_matriculas').select('*').eq('turma_id', id!).order('aluno_nome'), [id])
  const [editando, setEditando] = useState<Partial<Turma> | null>(null)
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
          <p className="muted">{t.curso_nome} · {t.data_inicio ? `${dataBR(t.data_inicio)} a ${dataBR(t.data_fim)}` : 'datas a definir'} · {t.local} · <Badge>{STATUS_TURMA[t.status]}</Badge></p>
          {t.observacoes && <p className="nota">{t.observacoes}</p>}
        </div>
        <div className="acoes">
          <button className="btn" onClick={() => setEditando(t)}>Editar turma</button>
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
      <section className="bloco">
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
      </section>
      <FormTurma turma={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); turma.recarregar() }} />
    </div>
  )
}
