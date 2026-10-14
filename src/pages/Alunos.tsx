import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta } from '../lib/dados'
import { brl, SITUACAO_ALUNO, whatsLink } from '../lib/format'
import type { MatriculaV } from '../lib/types'
import { Badge, Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import { turmaCurta } from './Agenda'
import { AlunosOnline } from './Online'

const POR_PAGINA = 25
// Ordem de gravidade para resumir várias matrículas de um mesmo aluno.
const GRAVIDADE = ['atrasado', 'aguardando_conferencia', 'sem_pagamento', 'em_dia', 'considerado_pago', 'quitado', 'transferida', 'cancelada']
const ativa = (m: MatriculaV) => m.status !== 'cancelada' && m.status !== 'transferida'

export function pior(ms: MatriculaV[]) {
  const ss = ms.filter(ativa).map((m) => m.situacao_financeira)
  return GRAVIDADE.find((g) => ss.includes(g)) ?? ms[0]?.situacao_financeira ?? 'em_dia'
}

export function BotaoWhats({ tel }: { tel: string | null }) {
  const l = whatsLink(tel)
  return l ? <a className="btn btn-contorno btn-mini btn-quadrado" href={l} target="_blank" rel="noreferrer" title={`WhatsApp ${tel}`}><Icone nome="whats" tam={16} /></a> : <span className="btn btn-mini btn-quadrado" style={{ opacity: 0.3 }}><Icone nome="whats" tam={16} /></span>
}

export default function Alunos() {
  const { isAdmin } = useAuth()
  const cad = useCadastros()
  const [visao, setVisao] = useState<'alunos' | 'matriculas' | 'online'>('alunos')
  const [busca, setBusca] = useState('')
  const [turma, setTurma] = useState('')
  const [situacao, setSituacao] = useState('')
  const [vendedora, setVendedora] = useState('')
  const [pagina, setPagina] = useState(1)
  const q = useConsulta<MatriculaV[]>(() => supabase.from('v_matriculas').select('*').order('aluno_nome'))

  const termo = busca.trim().toLowerCase()
  const filtradas = useMemo(() => (q.dados ?? []).filter((m) =>
    (!termo || `${m.aluno_nome} ${m.aluno_email ?? ''} ${m.aluno_whatsapp ?? ''} ${m.aluno_cpf ?? ''}`.toLowerCase().includes(termo)) &&
    (!turma || m.turma_id === turma) &&
    (!situacao || m.situacao_financeira === situacao) &&
    (!vendedora || m.vendedora_id === vendedora)), [q.dados, termo, turma, situacao, vendedora])

  const alunos = useMemo(() => {
    const g = new Map<string, MatriculaV[]>()
    for (const m of filtradas) g.set(m.aluno_id, [...(g.get(m.aluno_id) ?? []), m])
    // traz todas as matrículas do aluno (não só as filtradas) para contar cursos
    const todas = q.dados ?? []
    return [...g.entries()].map(([id, ms]) => {
      const dele = todas.filter((m) => m.aluno_id === id)
      const base = dele.some(ativa) ? dele.filter(ativa) : dele
      const ultima = [...base].sort((a, b) => (b.data_inicio ?? b.data_venda).localeCompare(a.data_inicio ?? a.data_venda))[0]
      return {
        id, nome: ms[0].aluno_nome, whatsapp: ms[0].aluno_whatsapp, email: ms[0].aluno_email,
        cursos: dele.filter(ativa).length, ultima, situacao: pior(dele),
        fechado: dele.filter(ativa).reduce((s, m) => s + Number(m.valor_fechado), 0),
        aberto: dele.filter(ativa).reduce((s, m) => s + Number(m.a_receber), 0),
        vendedoras: [...new Set(dele.map((m) => m.vendedora_nome).filter(Boolean))].join(', '),
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [filtradas, q.dados])

  const linhas = visao === 'alunos' ? alunos.length : filtradas.length
  const totalPag = Math.max(1, Math.ceil(linhas / POR_PAGINA))
  const pag = Math.min(pagina, totalPag)
  const fatia = <T,>(xs: T[]) => xs.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  const mudar = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(e.target.value); setPagina(1) }
  const baixas = (q.dados ?? []).filter((m) => m.situacao_financeira === 'considerado_pago')

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Alunos</h1><p className="muted">Cadastro dos alunos e suas matrículas.</p></div>
        <Link to="/matricula/nova" className="btn btn-ouro btn-grande"><Icone nome="mais" /> Nova matrícula</Link>
      </header>

      <nav className="abas">
        <button className={visao === 'alunos' ? 'ativa' : ''} onClick={() => { setVisao('alunos'); setPagina(1) }}><Icone nome="alunos" tam={16} /> Alunos únicos <span className="muted">{new Set((q.dados ?? []).map((m) => m.aluno_id)).size}</span></button>
        <button className={visao === 'matriculas' ? 'ativa' : ''} onClick={() => { setVisao('matriculas'); setPagina(1) }}><Icone nome="documento" tam={16} /> Matrículas <span className="muted">{(q.dados ?? []).length}</span></button>
        {isAdmin && <button className={visao === 'online' ? 'ativa' : ''} onClick={() => setVisao('online')}><Icone nome="links" tam={16} /> Online <span className="muted">Hotmart</span></button>}
      </nav>
      {visao === 'online' ? <AlunosOnline /> : (<>
      <p className="muted">{visao === 'alunos' ? 'Uma linha por pessoa. Abra o aluno para ver todas as turmas, pagamentos e documentos.' : 'Uma linha por matrícula. A mesma pessoa aparece uma vez por turma.'}</p>

      <div className="filtros-alunos">
        <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar por nome, e-mail, WhatsApp ou CPF" value={busca} onChange={mudar(setBusca)} /></label>
        <label className="select-icone"><Icone nome="turmas" tam={16} /><select value={turma} onChange={mudar(setTurma)}><option value="">Todas as turmas</option>{cad.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label className="select-icone"><Icone nome="relogio" tam={16} /><select value={situacao} onChange={mudar(setSituacao)}>
          <option value="">Todas as situações</option>
          {Object.entries(SITUACAO_ALUNO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
        </select></label>
        {isAdmin && <label className="select-icone"><Icone nome="usuario" tam={16} /><select value={vendedora} onChange={mudar(setVendedora)}><option value="">Todas as vendedoras</option>{cad.vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
      </div>

      {baixas.length > 0 && situacao !== 'considerado_pago' && (
        <div className="faixa-alerta">
          <Icone nome="info" tam={20} />
          <span><b>{baixas.length} matrícula(s) “Considerado pago (baixa)”</b>: saldo dado como pago na virada, sem comprovante · {brl(baixas.reduce((s, m) => s + Number(m.considerado_pago), 0))}. A composição de cada uma está no detalhe da matrícula.</span>
          <button className="btn btn-contorno btn-mini" onClick={() => { setSituacao('considerado_pago'); setPagina(1) }}>Ver quais</button>
        </div>
      )}

      <Erro msg={q.erro} />
      {linhas === 0 && !q.carregando ? <Vazio>Nenhum aluno com esses filtros.</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          {visao === 'alunos' ? (
            <table className="tabela tabela-pag">
              <thead><tr><th>Aluno</th><th>Cursos</th><th>Última turma</th>{isAdmin && <th>Vendedora</th>}<th className="num">Fechado</th><th className="num">Em aberto</th><th>Pagamento</th><th>Ações</th></tr></thead>
              <tbody>
                {fatia(alunos).map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/alunos/${a.id}`} className="forte link-ouro">{a.nome}</Link></td>
                    <td>{a.cursos}</td>
                    <td className="pequeno">{a.ultima ? <Link to={`/turmas/${a.ultima.turma_id}`} className="sublinhado">{turmaCurta(a.ultima.turma_nome)}</Link> : '—'}</td>
                    {isAdmin && <td className="pequeno">{a.vendedoras || '—'}</td>}
                    <td className="num">{brl(a.fechado)}</td>
                    <td className="num">{a.aberto > 0 ? brl(a.aberto) : '—'}</td>
                    <td><Badge tom={SITUACAO_ALUNO[a.situacao]?.tom}>{SITUACAO_ALUNO[a.situacao]?.rotulo}</Badge></td>
                    <td className="celula-acao acao-curta"><Link to={`/alunos/${a.id}`} className="btn btn-contorno btn-mini">Abrir</Link> <BotaoWhats tel={a.whatsapp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tabela tabela-pag">
              <thead><tr><th>Aluno</th><th>Turma</th><th>Vendedora</th><th className="num">Fechado</th><th className="num">Recebido</th><th>Pagamento</th><th>Ações</th></tr></thead>
              <tbody>
                {fatia(filtradas).map((m) => {
                  const s = SITUACAO_ALUNO[m.situacao_financeira]
                  return (
                    <tr key={m.id} className={m.status === 'cancelada' ? 'linha-apagada' : ''}>
                      <td><Link to={`/alunos/${m.aluno_id}`} className="forte link-ouro">{m.aluno_nome}</Link></td>
                      <td className="pequeno"><Link to={`/turmas/${m.turma_id}`} className="sublinhado">{turmaCurta(m.turma_nome)}</Link></td>
                      <td className="pequeno">{m.vendedora_nome ?? '—'}</td>
                      <td className="num">{brl(m.valor_fechado)}</td>
                      <td className="num">{brl(m.recebido)}</td>
                      <td><Badge tom={s?.tom}>{s?.rotulo}</Badge>
                        {Number(m.considerado_pago) > 0 && <div className="muted pequeno">baixa de {brl(m.considerado_pago)}</div>}
                        {Number(m.diferenca_taxas) > 0.01 && m.situacao_financeira === 'quitado' && <div className="muted pequeno">taxas Hotmart {brl(m.diferenca_taxas)}</div>}</td>
                      <td className="celula-acao acao-curta"><Link to={`/matricula/${m.id}`} className="btn btn-contorno btn-mini">Abrir</Link> <BotaoWhats tel={m.aluno_whatsapp} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="paginacao" style={{ padding: '0 16px 14px' }}>
            <span className="muted pequeno">{linhas} {visao === 'alunos' ? 'aluno(s)' : 'matrícula(s)'} com os filtros atuais</span>
            {totalPag > 1 && <div className="acoes">
              <button className="btn btn-mini" disabled={pag === 1} onClick={() => setPagina(pag - 1)}><Icone nome="esquerda" tam={14} /> Anterior</button>
              <span className="muted pequeno">{pag} de {totalPag}</span>
              <button className="btn btn-mini" disabled={pag === totalPag} onClick={() => setPagina(pag + 1)}>Próximo <Icone nome="seta" tam={14} /></button>
            </div>}
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}
