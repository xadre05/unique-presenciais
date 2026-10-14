import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, FORMAS, SITUACAO_PARCELA } from '../lib/format'
import type { ParcelaV } from '../lib/types'
import { Badge, Erro, LinkArquivo, Vazio } from '../components/ui'

export default function Pagamentos() {
  const cad = useCadastros()
  const [situacao, setSituacao] = useState('pendentes')
  const [turma, setTurma] = useState('')
  const [conta, setConta] = useState('')
  const [vendedora, setVendedora] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')

  const q = useConsulta<ParcelaV[]>(() => {
    let x = supabase.from('v_parcelas').select('*').order('vencimento', { ascending: true, nullsFirst: true }).limit(2000)
    if (situacao === 'pendentes') x = x.in('situacao', ['atrasada', 'aguardando_conferencia', 'a_vencer', 'sem_vencimento'])
    else if (situacao) x = x.eq('situacao', situacao)
    if (turma) x = x.eq('turma_id', turma)
    if (conta) x = x.eq('conta_id', conta)
    if (vendedora) x = x.eq('vendedora_id', vendedora)
    if (de) x = x.gte('vencimento', de)
    if (ate) x = x.lte('vencimento', ate)
    return x
  }, [situacao, turma, conta, vendedora, de, ate])

  const lista = useMemo(() => (q.dados ?? []).filter((p) => !busca || p.aluno_nome.toLowerCase().includes(busca.toLowerCase())), [q.dados, busca])
  const tot = (f: (p: ParcelaV) => boolean, campo: 'valor' | 'valor_recebido' = 'valor') => lista.filter(f).reduce((s, p) => s + Number(p[campo] ?? 0), 0)

  const exportar = () => {
    const cab = ['Aluno', 'Turma', 'Vendedora', 'Parcela', 'Forma', 'Conta', 'Vencimento', 'Valor', 'Recebido', 'Data recebimento', 'Situação', 'Dias de atraso', 'Observação']
    const linhas = lista.map((p) => [p.aluno_nome, p.turma_nome, p.vendedora_nome ?? '', `${p.numero}/${p.total_parcelas}`, FORMAS[p.forma], p.conta_nome ?? '', dataBR(p.vencimento), String(p.valor).replace('.', ','), p.valor_recebido !== null ? String(p.valor_recebido).replace('.', ',') : '', dataBR(p.data_recebimento), SITUACAO_PARCELA[p.situacao]?.rotulo, String(p.dias_atraso), p.observacao ?? ''])
    const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `pagamentos-presenciais.csv`
    a.click()
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Pagamentos</h1><p className="muted">Todas as parcelas de todas as turmas. Filtre para cobrar, conferir extrato ou fechar o mês.</p></div>
        <div className="acoes"><button className="btn" onClick={exportar}>Baixar planilha (CSV)</button></div>
      </header>
      <div className="filtros">
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
          <option value="pendentes">Em aberto (tudo que falta)</option>
          <option value="atrasada">Atrasadas</option>
          <option value="aguardando_conferencia">Aguardando conferência</option>
          <option value="a_vencer">A vencer</option>
          <option value="sem_vencimento">Sem vencimento</option>
          <option value="recebida">Recebidas</option>
          <option value="cancelada">Canceladas</option>
          <option value="">Todas</option>
        </select>
        <select value={turma} onChange={(e) => setTurma(e.target.value)}><option value="">Todas as turmas</option>{cad.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
        <select value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todas as contas</option>{cad.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select value={vendedora} onChange={(e) => setVendedora(e.target.value)}><option value="">Todas as vendedoras</option>{cad.vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select>
        <label className="pequeno muted">vence de <input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label className="pequeno muted">até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <input placeholder="Procurar aluno…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="resumo-linha">
        <span>{lista.length} parcelas</span>
        <span>Valor: <b>{brl(tot(() => true))}</b></span>
        <span className="ok-txt">Recebido: <b>{brl(tot((p) => p.status === 'confirmada', 'valor_recebido'))}</b></span>
        <span className="erro-txt">Atrasado: <b>{brl(tot((p) => p.situacao === 'atrasada'))}</b></span>
      </div>
      <Erro msg={q.erro} />
      {lista.length === 0 && !q.carregando ? <Vazio>Nenhuma parcela com esses filtros.</Vazio> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Aluno</th><th>Turma</th><th>#</th><th>Forma / conta</th><th>Vencimento</th><th className="num">Valor</th><th className="num">Recebido</th><th>Situação</th><th>Compr.</th></tr></thead>
            <tbody>
              {lista.map((p) => {
                const s = SITUACAO_PARCELA[p.situacao]
                return (
                  <tr key={p.id}>
                    <td><Link to={`/matricula/${p.matricula_id}`} className="forte">{p.aluno_nome}</Link><div className="muted pequeno">{p.vendedora_nome ?? ''}</div></td>
                    <td className="pequeno">{p.turma_nome}</td>
                    <td>{p.numero}/{p.total_parcelas}</td>
                    <td className="pequeno">{FORMAS[p.forma]}<div className="muted">{p.conta_nome ?? '—'}</div></td>
                    <td>{dataBR(p.vencimento)}{p.dias_atraso > 0 && <div className="erro-txt pequeno">{p.dias_atraso} dias</div>}</td>
                    <td className="num">{brl(p.valor)}</td>
                    <td className="num">{p.valor_recebido !== null ? brl(p.valor_recebido) : '—'}</td>
                    <td><Badge tom={s?.tom}>{s?.rotulo}</Badge></td>
                    <td>{p.comprovante ? <LinkArquivo caminho={p.comprovante}>ver</LinkArquivo> : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
