import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useConsulta } from '../lib/dados'
import { brl, dataBR, mesAno, SITUACAO_ALUNO, STATUS_COMISSAO, STATUS_MATRICULA } from '../lib/format'
import { Badge, Erro, Kpi, Vazio } from '../components/ui'
import { useAuth } from '../auth'

type C = { id: string; matricula_id: string; vendedora_nome: string | null; valor: number; status: string; competencia: string | null; liberada_em: string | null; paga_em: string | null; observacao: string | null
  aluno_nome: string; turma_nome: string; matricula_status: string; parcelas_pagas: number; situacao_financeira: string; data_venda: string }

export default function Comissoes() {
  const { isAdmin } = useAuth()
  const [status, setStatus] = useState('abertas')
  const q = useConsulta<C[]>(() => {
    let x = supabase.from('v_comissoes').select('*').order('data_venda', { ascending: false })
    if (status === 'abertas') x = x.in('status', ['pendente', 'liberada'])
    else if (status) x = x.eq('status', status)
    return x
  }, [status])
  const [erro, setErro] = useState<string | null>(null)
  const lista = useMemo(() => q.dados ?? [], [q.dados])
  const porVendedora = useMemo(() => {
    const r: Record<string, { pendente: number; liberada: number; paga: number; n: number }> = {}
    lista.forEach((c) => {
      const k = c.vendedora_nome ?? '—'
      r[k] ??= { pendente: 0, liberada: 0, paga: 0, n: 0 }
      if (c.status in r[k]) (r[k] as Record<string, number>)[c.status] += Number(c.valor)
      r[k].n++
    })
    return r
  }, [lista])

  const mudar = async (ids: string[], novo: string) => {
    setErro(null)
    for (const id of ids) {
      const { error } = await supabase.from('comissoes').update({ status: novo }).eq('id', id)
      if (error) { setErro(msgErro(error)); break }
    }
    q.recarregar()
  }
  const prontas = lista.filter((c) => c.status === 'pendente' && c.matricula_status === 'confirmada')
  const liberadas = lista.filter((c) => c.status === 'liberada')

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Comissões</h1><p className="muted">R$ 250 por aluno, para quem vendeu. A comissão é liberada quando a inscrição é confirmada e paga no mês seguinte. Se só a matrícula foi paga, fica pendente (o administrador pode liberar mesmo assim).</p></div>
        <div className="acoes">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="abertas">Pendentes e liberadas</option>
            <option value="pendente">Pendentes</option>
            <option value="liberada">Liberadas</option>
            <option value="paga">Pagas</option>
            <option value="cancelada">Canceladas</option>
            <option value="">Todas</option>
          </select>
        </div>
      </header>
      <section className="kpis">
        {Object.entries(porVendedora).map(([v, r]) => (
          <Kpi key={v} rotulo={v} valor={brl(r.liberada)} sub={`liberada para pagar · ${brl(r.pendente)} pendente · ${brl(r.paga)} paga`} tom="info" />
        ))}
      </section>
      {isAdmin && (prontas.length > 0 || liberadas.length > 0) && (
        <div className="faixa">
          {prontas.length > 0 && <button className="btn btn-ouro" onClick={() => mudar(prontas.map((c) => c.id), 'liberada')}>Liberar {prontas.length} comissões com inscrição confirmada</button>}
          {liberadas.length > 0 && <button className="btn" onClick={() => mudar(liberadas.map((c) => c.id), 'paga')}>Marcar {liberadas.length} liberadas como pagas ({brl(liberadas.reduce((s, c) => s + Number(c.valor), 0))})</button>}
        </div>
      )}
      <Erro msg={erro ?? q.erro} />
      {lista.length === 0 && !q.carregando ? <Vazio>Nenhuma comissão.</Vazio> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Vendedora</th><th>Aluno</th><th>Turma</th><th>Venda</th><th>Inscrição</th><th>Pagamento do aluno</th><th className="num">Valor</th><th>Comissão</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>{c.vendedora_nome}</td>
                  <td><Link className="forte" to={`/matricula/${c.matricula_id}`}>{c.aluno_nome}</Link>{c.observacao && <div className="muted pequeno">{c.observacao}</div>}</td>
                  <td className="pequeno">{c.turma_nome}</td>
                  <td>{dataBR(c.data_venda)}</td>
                  <td className="pequeno">{STATUS_MATRICULA[c.matricula_status]}</td>
                  <td><Badge tom={SITUACAO_ALUNO[c.situacao_financeira]?.tom}>{SITUACAO_ALUNO[c.situacao_financeira]?.rotulo}</Badge></td>
                  <td className="num">{brl(c.valor)}</td>
                  <td><Badge tom={STATUS_COMISSAO[c.status]?.tom}>{STATUS_COMISSAO[c.status]?.rotulo}</Badge>
                    <div className="muted pequeno">{c.status === 'liberada' && c.competencia ? `pagar em ${mesAno(c.competencia)}` : c.status === 'paga' ? `paga em ${dataBR(c.paga_em)}` : ''}</div></td>
                  {isAdmin && <td><div className="acoes-linha">
                    {c.status === 'pendente' && <button className="btn btn-mini" onClick={() => mudar([c.id], 'liberada')}>Liberar</button>}
                    {c.status === 'liberada' && <button className="btn btn-mini btn-ouro" onClick={() => mudar([c.id], 'paga')}>Paga</button>}
                  </div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
