import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { minhaVendedoraId, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno, STATUS_TURMA, whatsLink } from '../lib/format'
import type { ParcelaV, Turma } from '../lib/types'
import { Badge, KpiIcone, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { PainelOnline } from './Online'
import { ResumoCobranca } from './cobranca/ResumoCobranca'
import { useAuth } from '../auth'

export default function Painel() {
  const { isAdmin, perfil } = useAuth()
  const cad = useCadastros()
  const minha = minhaVendedoraId(cad.vendedoras, isAdmin ? null : perfil?.id)
  const turmas = useConsulta<Turma[]>(() => supabase.from('v_turmas').select('*').neq('status', 'cancelada').order('data_inicio', { ascending: true, nullsFirst: false }))
  const pendentes = useConsulta<ParcelaV[]>(() => supabase.from('v_parcelas').select('*').in('situacao', ['atrasada', 'aguardando_conferencia', 'sem_vencimento', 'a_vencer']).order('vencimento', { ascending: true, nullsFirst: true }))
  const pendentesAcesso = useConsulta<{ id: string }[]>(() => supabase.from('perfis').select('id').eq('papel', 'pendente'))
  const comissoes = useConsulta<{ vendedora_nome: string; valor: number; status: string; competencia: string | null }[]>(() => supabase.from('v_comissoes').select('vendedora_nome,valor,status,competencia').in('status', ['pendente', 'liberada']))

  const [escopo, setEscopo] = useState<'andamento' | 'todas'>('andamento')
  const [curso, setCurso] = useState('')
  const todasTurmas = turmas.dados ?? []
  const cursos = [...new Set(todasTurmas.map((t) => t.curso_nome))]
  const ts = todasTurmas.filter((t) =>
    (!curso || t.curso_nome === curso) &&
    (escopo === 'todas' || t.status === 'confirmada' || t.status === 'planejada' || Number(t.a_receber) > 0 || Number(t.aguardando_conferencia) > 0))
  const idsTurmas = new Set(ts.map((t) => t.id))
  const ps = (pendentes.dados ?? []).filter((p) => idsTurmas.has(p.turma_id) && (isAdmin || p.vendedora_id === minha))
  const hoje = hojeISO()
  const em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const atrasadas = ps.filter((p) => p.situacao === 'atrasada')
  const conferir = ps.filter((p) => p.situacao === 'aguardando_conferencia')
  const semVenc = ps.filter((p) => p.situacao === 'sem_vencimento')
  const proximas = ps.filter((p) => p.situacao === 'a_vencer' && p.vencimento && p.vencimento >= hoje && p.vencimento <= em7)
  const soma = (k: keyof Turma) => ts.reduce((s, t) => s + Number(t[k] || 0), 0)
  const cs = comissoes.dados ?? []
  const liberadas = cs.filter((c) => c.status === 'liberada')

  const cursosResumo = cursos.filter((c) => !curso || c === curso).map((c) => {
    const tc = ts.filter((t) => t.curso_nome === c)
    return { nome: c, turmas: tc.length, alunos: tc.reduce((s, t) => s + Number(t.inscritos || 0), 0), id: tc.length === 1 ? tc[0].id : null }
  }).filter((c) => c.turmas > 0)
  const pendentesCom = cs.filter((c) => c.status === 'pendente').length
  const [verDetalhe, setVerDetalhe] = useState(false)
  const [area, setArea] = useState<'presencial' | 'online'>(() => { try { return sessionStorage.getItem('unique.painelArea') === 'online' ? 'online' : 'presencial' } catch { return 'presencial' } })
  const mudarArea = (a: 'presencial' | 'online') => { setArea(a); try { sessionStorage.setItem('unique.painelArea', a) } catch { /* sem armazenamento */ } }
  const verOnline = isAdmin && area === 'online'

  return (
    <div className="pagina painel">
      <header className="pagina-topo">
        <div>
          <h1>Painel</h1>
          <p className="muted">Situação de hoje, {dataBR(hoje)}. Recebimentos confirmados no extrato ou pela Hotmart.</p>
        </div>
        <Link to="/matricula/nova" className="btn btn-ouro btn-grande"><Icone nome="mais" /> Nova matrícula</Link>
      </header>

      {isAdmin && <nav className="abas painel-areas" role="tablist">
        <button type="button" role="tab" aria-selected={area === 'presencial'} className={area === 'presencial' ? 'ativa' : ''} onClick={() => mudarArea('presencial')}><Icone nome="turmas" tam={16} /> Presencial</button>
        <button type="button" role="tab" aria-selected={area === 'online'} className={area === 'online' ? 'ativa' : ''} onClick={() => mudarArea('online')}><Icone nome="links" tam={16} /> Online (Hotmart)</button>
      </nav>}

      {verOnline ? <PainelOnline /> : (<>

      <div className="filtros-painel">
        <label className="select-icone"><Icone nome="turmas" />
          <select value={escopo} onChange={(e) => setEscopo(e.target.value as 'andamento' | 'todas')}>
            <option value="andamento">Turmas em andamento (planejadas, confirmadas ou com dinheiro a receber)</option>
            <option value="todas">Todas as turmas, incluindo histórico</option>
          </select>
        </label>
        <label className="select-icone"><Icone nome="livro" />
          <select value={curso} onChange={(e) => setCurso(e.target.value)}>
            <option value="">Todos os cursos</option>
            {cursos.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {isAdmin && (pendentesAcesso.dados?.length ?? 0) > 0 && (
        <div className="nota">{pendentesAcesso.dados!.length} pessoa(s) criaram conta e estão esperando você liberar o acesso. <Link to="/configuracoes/equipe" className="link">Liberar agora</Link></div>
      )}

      <h2 className="titulo-secao">Presencial <span className="muted pequeno">· {isAdmin ? 'turmas do filtro acima, valores da turma inteira' : 'só as suas vendas, nas turmas do filtro acima'} (desde a venda, sem recorte de mês) · <Link to="/pagamentos" className="link">ver pagamentos</Link></span></h2>
      <section className="kpis kpis-5">
        <KpiIcone icone="sacola" rotulo="Valor fechado" valor={brl(soma('valor_fechado'))} sub={isAdmin ? `${soma('inscritos')} alunos em ${ts.length} turmas` : `${soma('inscritos_meus')} aluno(s) seus em ${ts.filter((t) => Number(t.inscritos_meus) > 0).length} turma(s)`} destaque />
        <KpiIcone icone="moedas" rotulo="Recebido (conferido)" valor={brl(soma('recebido'))} tom="ok" sub="líquido recebido nas contas" />
        <KpiIcone icone="relogio" rotulo="Aguardando conferência" valor={brl(soma('aguardando_conferencia'))} tom="info" sub={conferir.length ? `${conferir.length} pagamento(s) para conferir` : 'nenhum pagamento pendente'} />
        <KpiIcone icone="documento" rotulo="A receber" valor={brl(soma('a_receber'))} sub="parcelas ainda não pagas" />
        <KpiIcone icone="alerta" rotulo="Em atraso" valor={brl(soma('atrasado'))} tom="erro" sub={`${atrasadas.length} parcela(s) vencida(s)`} subTom={atrasadas.length ? 'erro' : undefined} />
      </section>


      <div className="painel-grade">
        <div className="painel-col">
          <section className="bloco">
            <h2><Icone nome="sacola" className="ouro" /> Parcelas atrasadas do presencial <Badge tom="erro">{atrasadas.length}</Badge></h2>
            {atrasadas.length === 0 ? <Vazio>Nenhuma parcela atrasada.</Vazio> : (
              <ul className="lista">
                {atrasadas.map((p) => (
                  <li key={p.id}>
                    <div>
                      <Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link>
                      <div className="muted pequeno">{p.turma_nome} · Parcela {p.numero}/{p.total_parcelas}</div>
                    </div>
                    <div className="linha-fim">
                      <div className="direita">
                        <div className="forte num-txt">{brl(p.valor)}</div>
                        <div className="erro-txt pequeno">Venceu em {dataBR(p.vencimento)}</div>
                        <div className="erro-txt pequeno">{p.dias_atraso} {p.dias_atraso === 1 ? 'dia' : 'dias'} em atraso</div>
                      </div>
                      {whatsLink(p.aluno_whatsapp) && <a className="btn btn-contorno btn-mini" href={whatsLink(p.aluno_whatsapp)!} target="_blank" rel="noreferrer"><Icone nome="whats" tam={16} /> WhatsApp</a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bloco">
            <h2><Icone nome="documento" className="ouro" /> Próximos 7 dias <Badge>{proximas.length}</Badge></h2>
            {proximas.length === 0 ? <Vazio>Nada vencendo nesta semana.</Vazio> : (
              <ul className="lista">
                {proximas.map((p) => (
                  <li key={p.id}>
                    <div><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.turma_nome} · Parcela {p.numero}/{p.total_parcelas}</div></div>
                    <div className="direita"><div className="forte num-txt">{brl(p.valor)}</div><div className="muted pequeno">Vence em {dataBR(p.vencimento)}</div></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {semVenc.length > 0 && (
            <section className="bloco">
              <h2><Icone nome="agenda" className="ouro" /> Sem vencimento definido <Badge tom="alerta">{semVenc.length}</Badge></h2>
              <ul className="lista">
                {semVenc.map((p) => (
                  <li key={p.id}>
                    <div><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.turma_nome}</div></div>
                    <div className="direita"><div className="forte num-txt">{brl(p.valor)}</div><Link to={`/matricula/${p.matricula_id}`} className="link pequeno">definir data</Link></div>
                  </li>
                ))}
              </ul>
              <p className="muted pequeno">Sem data, o sistema não avisa quando cobrar. Abra o aluno e coloque o vencimento combinado.</p>
            </section>
          )}
        </div>

        <div className="painel-col">
          <ResumoCobranca origem="presencial" />

          <section className="bloco">
            <h2><Icone nome="check" className={conferir.length ? 'info' : 'ok'} /> Conferência {conferir.length > 0 && <Badge tom="info">{conferir.length}</Badge>}</h2>
            {conferir.length === 0 ? (
              <div className="tudo-ok"><Icone nome="check" tam={22} className="ok" /><div><div className="forte">Tudo conferido</div><div className="muted pequeno">Nenhum pagamento aguardando conferência.</div></div></div>
            ) : (<>
              <p className="muted pequeno">Pagamentos que a equipe informou. {isAdmin ? 'Confira no extrato e confirme.' : 'O administrador confere e confirma.'}</p>
              <ul className="lista">
                {conferir.map((p) => (
                  <li key={p.id}>
                    <div><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.conta_nome ?? 'conta não informada'}</div></div>
                    <div className="direita"><div className="forte num-txt">{brl(p.valor_recebido ?? p.valor)}</div><div className="muted pequeno">em {dataBR(p.data_recebimento)}</div></div>
                  </li>
                ))}
              </ul>
            </>)}
            <Link to="/pagamentos" className="btn btn-contorno btn-bloco"><Icone nome="documento" tam={16} /> Ver pagamentos</Link>
          </section>

          <section className="bloco">
            <h2><Icone nome="moedas" className="ouro" /> {isAdmin ? 'Comissões' : 'Minhas comissões'}</h2>
            <dl className="resumo">
              <dt>Em apuração</dt><dd>{pendentesCom}</dd>
              <dt>Aprovadas para pagar</dt><dd>{liberadas.length}</dd>
              <dt>Valor aprovado</dt><dd><b>{brl(liberadas.reduce((s, c) => s + Number(c.valor), 0))}</b>{liberadas[0]?.competencia && <div className="muted pequeno">{mesAno(liberadas[0].competencia)}</div>}</dd>
            </dl>
            <Link to="/comissoes" className="btn btn-contorno btn-bloco"><Icone nome="dinheiro" tam={16} /> Ver comissões</Link>
          </section>

          <section className="bloco">
            <h2><Icone nome="turmas" className="ouro" /> Turmas</h2>
            <p className="muted pequeno">{ts.length} turma(s) {escopo === 'andamento' ? 'em andamento' : 'no total'} · {soma('inscritos')} alunos matriculados</p>
            <ul className="lista lista-links">
              {cursosResumo.map((c) => (
                <li key={c.nome}>
                  <Link to={c.id ? `/turmas/${c.id}` : '/turmas'}><Icone nome="livro" tam={16} /> <span>{c.nome}</span><span className="muted pequeno">{c.turmas} turma(s) · {c.alunos} alunos</span><Icone nome="seta" tam={16} /></Link>
                </li>
              ))}
            </ul>
            <Link to="/turmas" className="btn btn-contorno btn-bloco"><Icone nome="turmas" tam={16} /> Ver todas as turmas</Link>
          </section>
        </div>
      </div>

      <section className="bloco">
        <div className="bloco-topo">
          <h2><Icone nome="grafico" className="ouro" /> Detalhamento por turma</h2>
          <button className="btn btn-contorno btn-mini" onClick={() => setVerDetalhe((v) => !v)}><Icone nome="comissoes" tam={15} /> {verDetalhe ? 'Esconder' : 'Ver detalhamento'}</button>
        </div>
        {verDetalhe && (ts.length === 0 ? <Vazio>Nenhuma turma cadastrada.</Vazio> : (
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
        ))}
      </section>
      </>)}
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
