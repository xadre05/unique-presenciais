import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno, STATUS_TURMA, whatsLink } from '../lib/format'
import type { ParcelaV, Turma } from '../lib/types'
import { Badge, Kpi, Vazio } from '../components/ui'
import { useAuth } from '../auth'

export default function Painel() {
  const { isAdmin } = useAuth()
  const turmas = useConsulta<Turma[]>(() => supabase.from('v_turmas').select('*').neq('status', 'cancelada').order('data_inicio', { ascending: true, nullsFirst: false }))
  const pendentes = useConsulta<ParcelaV[]>(() => supabase.from('v_parcelas').select('*').in('situacao', ['atrasada', 'aguardando_conferencia', 'sem_vencimento', 'a_vencer']).order('vencimento', { ascending: true, nullsFirst: true }))
  const comissoes = useConsulta<{ vendedora_nome: string; valor: number; status: string; competencia: string | null }[]>(() => supabase.from('v_comissoes').select('vendedora_nome,valor,status,competencia').in('status', ['pendente', 'liberada']))

  const ts = turmas.dados ?? []
  const ps = pendentes.dados ?? []
  const hoje = hojeISO()
  const em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const atrasadas = ps.filter((p) => p.situacao === 'atrasada')
  const conferir = ps.filter((p) => p.situacao === 'aguardando_conferencia')
  const semVenc = ps.filter((p) => p.situacao === 'sem_vencimento')
  const proximas = ps.filter((p) => p.situacao === 'a_vencer' && p.vencimento && p.vencimento >= hoje && p.vencimento <= em7)
  const soma = (k: keyof Turma) => ts.reduce((s, t) => s + Number(t[k] || 0), 0)
  const cs = comissoes.dados ?? []
  const liberadas = cs.filter((c) => c.status === 'liberada')

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Painel</h1>
          <p className="muted">Situação de hoje, {dataBR(hoje)}. Só conta como recebido o que foi conferido no extrato ou veio da Hotmart.</p>
        </div>
      </header>

      <section className="kpis">
        <Kpi rotulo="Valor fechado" valor={brl(soma('valor_fechado'))} sub={`${soma('inscritos')} alunos em ${ts.length} turmas`} />
        <Kpi rotulo="Recebido (conferido)" valor={brl(soma('recebido'))} tom="ok" sub="líquido que entrou nas contas" />
        <Kpi rotulo="Aguardando conferência" valor={brl(soma('aguardando_conferencia'))} tom="info" sub={`${conferir.length} pagamentos informados e não conferidos`} />
        <Kpi rotulo="A receber" valor={brl(soma('a_receber'))} sub="parcelas ainda não pagas" />
        <Kpi rotulo="Atrasado" valor={brl(soma('atrasado'))} tom="erro" sub={`${atrasadas.length} parcelas vencidas`} />
      </section>

      <div className="grade-2">
        <section className="bloco">
          <h2>Cobrar agora <Badge tom="erro">{atrasadas.length}</Badge></h2>
          {atrasadas.length === 0 ? <Vazio>Nenhuma parcela atrasada.</Vazio> : (
            <ul className="lista">
              {atrasadas.map((p) => (
                <li key={p.id}>
                  <div>
                    <Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link>
                    <div className="muted pequeno">{p.turma_nome} · parcela {p.numero}/{p.total_parcelas} · {p.conta_nome ?? '—'}</div>
                  </div>
                  <div className="direita">
                    <div className="forte">{brl(p.valor)}</div>
                    <div className="erro-txt pequeno">venceu {dataBR(p.vencimento)} · {p.dias_atraso} dias</div>
                    {whatsLink(p.aluno_whatsapp) && <a className="link pequeno" href={whatsLink(p.aluno_whatsapp)!} target="_blank" rel="noreferrer">WhatsApp</a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt">Vencem nos próximos 7 dias <Badge>{proximas.length}</Badge></h2>
          {proximas.length === 0 ? <Vazio>Nada vencendo nesta semana.</Vazio> : (
            <ul className="lista">
              {proximas.map((p) => (
                <li key={p.id}>
                  <div><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.turma_nome} · parcela {p.numero}/{p.total_parcelas}</div></div>
                  <div className="direita"><div className="forte">{brl(p.valor)}</div><div className="muted pequeno">vence {dataBR(p.vencimento)}</div></div>
                </li>
              ))}
            </ul>
          )}
          {semVenc.length > 0 && (<>
            <h2 className="mt">Sem data de vencimento <Badge tom="alerta">{semVenc.length}</Badge></h2>
            <ul className="lista">
              {semVenc.map((p) => (
                <li key={p.id}><div><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.turma_nome}</div></div><div className="direita forte">{brl(p.valor)}</div></li>
              ))}
            </ul>
          </>)}
        </section>

        <section className="bloco">
          <h2>Conferir no extrato <Badge tom="info">{conferir.length}</Badge></h2>
          <p className="muted pequeno">Pagamentos que a equipe informou (Pix, dinheiro, cartão). {isAdmin ? 'Confira no extrato e confirme.' : 'O administrador confere e confirma.'}</p>
          {conferir.length === 0 ? <Vazio>Nada aguardando conferência.</Vazio> : (
            <ul className="lista">
              {conferir.map((p) => (
                <li key={p.id}>
                  <div><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.turma_nome} · {p.conta_nome ?? 'conta não informada'}</div></div>
                  <div className="direita"><div className="forte">{brl(p.valor_recebido ?? p.valor)}</div><div className="muted pequeno">em {dataBR(p.data_recebimento)}</div></div>
                </li>
              ))}
            </ul>
          )}
          {isAdmin && (<>
            <h2 className="mt">Comissões</h2>
            <p className="muted pequeno">{cs.filter((c) => c.status === 'pendente').length} pendentes · {liberadas.length} liberadas para pagar ({brl(liberadas.reduce((s, c) => s + Number(c.valor), 0))})
              {liberadas[0]?.competencia && <> em {mesAno(liberadas[0].competencia)}</>}. <Link to="/comissoes" className="link">Ver comissões</Link></p>
          </>)}
        </section>
      </div>

      <section className="bloco">
        <h2>Turmas</h2>
        {ts.length === 0 ? <Vazio>Nenhuma turma cadastrada.</Vazio> : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Turma</th><th>Datas</th><th>Vagas</th><th className="num">Fechado</th><th className="num">Recebido</th><th className="num">A receber</th><th className="num">Atrasado</th><th>Alertas</th></tr></thead>
              <tbody>
                {ts.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/turmas/${t.id}`} className="forte">{t.nome}</Link><div className="muted pequeno">{STATUS_TURMA[t.status]}</div></td>
                    <td>{t.data_inicio ? `${dataBR(t.data_inicio)} a ${dataBR(t.data_fim)}` : <Badge tom="alerta">sem data</Badge>}</td>
                    <td><Ocupacao inscritos={t.inscritos} vagas={t.vagas} /></td>
                    <td className="num">{brl(t.valor_fechado)}</td>
                    <td className="num ok-txt">{brl(t.recebido)}</td>
                    <td className="num">{brl(t.a_receber)}</td>
                    <td className="num erro-txt">{Number(t.atrasado) > 0 ? brl(t.atrasado) : '—'}</td>
                    <td>
                      {t.alunos_atrasados > 0 && <Badge tom="erro">{t.alunos_atrasados} atrasado(s)</Badge>}{' '}
                      {t.sem_contrato > 0 && <Badge tom="alerta">{t.sem_contrato} sem contrato</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export function Ocupacao({ inscritos, vagas }: { inscritos: number; vagas: number }) {
  const pct = Math.min(100, Math.round((inscritos / vagas) * 100))
  return (
    <div className="ocupacao" title={`${inscritos} de ${vagas} vagas`}>
      <div className="ocupacao-barra"><div style={{ width: pct + '%' }} className={inscritos >= vagas ? 'cheia' : ''} /></div>
      <span className="pequeno">{inscritos}/{vagas}</span>
    </div>
  )
}
