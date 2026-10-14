import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { brl, SITUACAO_ALUNO, whatsLink } from '../lib/format'
import type { MatriculaV } from '../lib/types'
import { Badge, Erro, Vazio } from '../components/ui'

export default function Alunos() {
  const [busca, setBusca] = useState('')
  const q = useConsulta<MatriculaV[]>(() => supabase.from('v_matriculas').select('*').order('aluno_nome'))
  const lista = (q.dados ?? []).filter((m) => !busca || `${m.aluno_nome} ${m.aluno_email ?? ''} ${m.aluno_whatsapp ?? ''}`.toLowerCase().includes(busca.toLowerCase()))
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Alunos</h1><p className="muted">Cada linha é uma matrícula. Um aluno em duas turmas aparece duas vezes.</p></div>
        <input className="busca" placeholder="Procurar por nome, e-mail ou WhatsApp…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </header>
      <Erro msg={q.erro} />
      {lista.length === 0 && !q.carregando ? <Vazio>Nenhum aluno encontrado.</Vazio> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Aluno</th><th>Turma</th><th>Vendeu</th><th className="num">Fechado</th><th className="num">Recebido</th><th>Pagamento</th></tr></thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.id} className={m.status === 'cancelada' ? 'linha-apagada' : ''}>
                  <td><Link to={`/matricula/${m.id}`} className="forte">{m.aluno_nome}</Link><div className="pequeno">{whatsLink(m.aluno_whatsapp) ? <a className="link" href={whatsLink(m.aluno_whatsapp)!} target="_blank" rel="noreferrer">{m.aluno_whatsapp}</a> : null} <span className="muted">{m.aluno_email}</span></div></td>
                  <td className="pequeno"><Link to={`/turmas/${m.turma_id}`}>{m.turma_nome}</Link></td>
                  <td>{m.vendedora_nome ?? '—'}</td>
                  <td className="num">{brl(m.valor_fechado)}</td>
                  <td className="num">{brl(m.recebido)}</td>
                  <td><Badge tom={SITUACAO_ALUNO[m.situacao_financeira]?.tom}>{SITUACAO_ALUNO[m.situacao_financeira]?.rotulo}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
