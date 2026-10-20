// Pagamentos: parcelas, recebimentos e conferência em um só lugar. Presencial (parcelas das matrículas) e Online (Hotmart).
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta, minhaVendedoraId } from '../lib/dados'
import { dataBR, FORMAS, hojeISO } from '../lib/format'
import type { ParcelaV } from '../lib/types'
import { Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import { AcaoParcela, type Acao } from './MatriculaDetalhe'
import { PagamentosOnline } from './Online'
import { ATALHOS, PERIODOS, POR_PAGINA, SITUACAO, SITUACOES, intervalo, ordenar, type Periodo } from './pagamentos/regras'
import { ResumoPagamentos } from './pagamentos/ResumoPagamentos'
import { LinhaParcela } from './pagamentos/LinhaParcela'
import { PainelParcela } from './pagamentos/PainelParcela'
import { LancarRecebimento } from './pagamentos/LancarRecebimento'

function exportar(lista: ParcelaV[]) {
  const cab = ['Aluno', 'Turma', 'Vendedora', 'Parcela', 'Forma', 'Conta', 'Vencimento', 'Valor da parcela', 'Recebido (líquido)', 'Data recebimento', 'Situação', 'Dias de atraso', 'Observação']
  const linhas = lista.map((p) => [p.aluno_nome, p.turma_nome, p.vendedora_nome ?? '', `${p.numero}/${p.total_parcelas}`, FORMAS[p.forma], p.conta_nome ?? '', dataBR(p.vencimento), String(p.valor).replace('.', ','), p.valor_recebido !== null ? String(p.valor_recebido).replace('.', ',') : '', dataBR(p.data_recebimento), SITUACAO[p.situacao]?.rotulo, String(p.dias_atraso), p.observacao ?? ''])
  const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = 'pagamentos-presenciais.csv'
  a.click()
}

function Paginacao({ pag, total, aoIr }: { pag: number; total: number; aoIr: (n: number) => void }) {
  if (total <= 1) return null
  const nums = Array.from({ length: total }, (_, i) => i + 1).filter((n) => n === 1 || n === total || Math.abs(n - pag) <= 1)
  return (
    <div className="pg-paginas">
      <button type="button" className="btn btn-mini" disabled={pag === 1} onClick={() => aoIr(pag - 1)}><Icone nome="esquerda" tam={14} /> Anterior</button>
      {nums.map((n, i) => <span key={n}>{i > 0 && nums[i - 1] !== n - 1 && <span className="muted"> … </span>}<button type="button" className={`pg-num${n === pag ? ' ativo' : ''}`} onClick={() => aoIr(n)}>{n}</button></span>)}
      <button type="button" className="btn btn-mini" disabled={pag === total} onClick={() => aoIr(pag + 1)}>Próxima <Icone nome="seta" tam={14} /></button>
    </div>
  )
}

export default function Pagamentos() {
  const { isAdmin, perfil } = useAuth()
  const [params, setParams] = useSearchParams()
  const area = isAdmin && params.get('area') === 'online' ? 'online' : 'presencial'
  const cad = useCadastros()
  const minha = minhaVendedoraId(cad.vendedoras, isAdmin ? null : perfil?.id)
  const padraoVend = isAdmin ? '' : 'minhas'
  const [situacao, setSituacao] = useState('pendentes')
  const [turma, setTurma] = useState('')
  const [conta, setConta] = useState('')
  const [vendedora, setVendedora] = useState(padraoVend)
  const [periodo, setPeriodo] = useState<Periodo>('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aberta, setAberta] = useState<ParcelaV | null>(null)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [lancar, setLancar] = useState(false)
  const [vIni, vFim] = intervalo(periodo, de, ate)

  const q = useConsulta<ParcelaV[]>(() => {
    let x = supabase.from('v_parcelas').select('*').order('vencimento', { ascending: true, nullsFirst: true }).limit(3000)
    if (situacao === 'pendentes') x = x.in('situacao', ['atrasada', 'aguardando_conferencia', 'a_vencer', 'sem_vencimento'])
    else if (situacao === 'hoje') x = x.in('situacao', ['a_vencer', 'atrasada']).eq('vencimento', hojeISO())
    else if (situacao) x = x.eq('situacao', situacao)
    if (turma) x = x.eq('turma_id', turma)
    if (conta) x = x.eq('conta_id', conta)
    const vid = vendedora === 'minhas' ? minha : vendedora
    if (vendedora === 'minhas' && !minha) x = x.eq('vendedora_id', '00000000-0000-0000-0000-000000000000')
    else if (vid) x = x.eq('vendedora_id', vid)
    if (vIni) x = x.gte('vencimento', vIni)
    if (vFim) x = x.lte('vencimento', vFim)
    return x
  }, [situacao, turma, conta, vendedora, vIni, vFim, minha])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return ordenar((q.dados ?? []).filter((p) => !t || `${p.aluno_nome} ${p.turma_nome}`.toLowerCase().includes(t)))
  }, [q.dados, busca])
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pag = Math.min(pagina, totalPaginas)
  const visiveis = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  // vendedora vendo a equipe: os totais em dinheiro continuam só das vendas dela
  const baseResumo = isAdmin ? lista : lista.filter((p) => p.vendedora_id === minha)
  const filtrosAtivos = situacao !== 'pendentes' || turma || conta || vendedora !== padraoVend || periodo || busca
  const limpar = () => { setSituacao('pendentes'); setTurma(''); setConta(''); setVendedora(padraoVend); setPeriodo(''); setDe(''); setAte(''); setBusca(''); setPagina(1) }
  const com = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPagina(1) }
  const filtrarSituacao = com(setSituacao)

  return (
    <div className="pagina pg-pagina">
      <header className="pagina-topo">
        <div><h1>Pagamentos</h1><p className="muted">Parcelas, recebimentos e conferência em um só lugar.</p></div>
        {area === 'presencial' && <div className="acoes">
          <button type="button" className="btn btn-contorno" onClick={() => exportar(lista)}><Icone nome="exportar" /> Exportar CSV</button>
          <button type="button" className="btn btn-ouro" onClick={() => setLancar(true)}><Icone nome="mais" /> Lançar recebimento</button>
        </div>}
      </header>
      {isAdmin && <nav className="abas">
        <button type="button" className={area === 'presencial' ? 'ativa' : ''} onClick={() => setParams({})}><Icone nome="alunos" tam={16} /> Presencial</button>
        <button type="button" className={area === 'online' ? 'ativa' : ''} onClick={() => setParams({ area: 'online' })}><Icone nome="links" tam={16} /> Online · Hotmart</button>
      </nav>}

      {area === 'online' ? <PagamentosOnline /> : (<>
        <ResumoPagamentos base={baseResumo} soMinhas={!isAdmin && vendedora !== 'minhas'} aoFiltrar={filtrarSituacao} />

        <div className="pg-filtros">
          <label className="select-icone pg-busca"><Icone nome="busca" /><input placeholder="Buscar por aluno ou turma…" value={busca} onChange={(e) => com(setBusca)(e.target.value)} /></label>
          <label className="select-icone pg-rotulado"><span>Situação:</span><select value={situacao} onChange={(e) => filtrarSituacao(e.target.value)}>{SITUACOES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
          <div className="pg-atalhos">{ATALHOS.map(([k, r]) => <button key={k} type="button" className={`pg-atalho${situacao === k ? ' ativo' : ''}`} onClick={() => filtrarSituacao(situacao === k ? 'pendentes' : k)}>{r}</button>)}</div>
        </div>
        <div className="pg-filtros pg-filtros-2">
          <label className="select-icone pg-rotulado"><span>Turma:</span><select value={turma} onChange={(e) => com(setTurma)(e.target.value)}><option value="">Todas</option>{cad.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
          <label className="select-icone pg-rotulado"><span>Conta:</span><select value={conta} onChange={(e) => com(setConta)(e.target.value)}><option value="">Todas</option>{cad.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label className="select-icone pg-rotulado"><span>Vendedora:</span><select value={vendedora} onChange={(e) => com(setVendedora)(e.target.value)}>{!isAdmin && <option value="minhas">Minhas vendas</option>}<option value="">{isAdmin ? 'Todas' : 'Toda a equipe'}</option>{cad.vendedoras.filter((v) => isAdmin || (v.ativa && v.id !== minha)).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>
          <label className="select-icone pg-rotulado"><Icone nome="agenda" tam={16} /><span>Vencimento:</span><select value={periodo} onChange={(e) => com(setPeriodo)(e.target.value as Periodo)}>{PERIODOS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></label>
          {filtrosAtivos && <button type="button" className="link" onClick={limpar}>Limpar filtros</button>}
        </div>
        {periodo === 'periodo' && <div className="pg-periodo">
          <label className="select-icone"><span className="muted">De</span><input type="date" value={de} onChange={(e) => com(setDe)(e.target.value)} /></label>
          <label className="select-icone"><span className="muted">Até</span><input type="date" value={ate} onChange={(e) => com(setAte)(e.target.value)} /></label>
        </div>}
        <p className="muted pequeno">Ordenado por prioridade: vencidas, sem data, a conferir e depois os próximos vencimentos.</p>

        <Erro msg={q.erro} />
        {lista.length === 0 && !q.carregando ? <Vazio>Nenhuma parcela com esses filtros.</Vazio> : (<>
          <div className="tabela-wrap">
            <table className="tabela tabela-pag">
              <thead><tr><th>Aluno / turma</th><th>Parcela</th><th>Vencimento</th><th>Forma / conta</th><th className="num">Valor</th><th>Situação</th><th className="direita">Ações</th></tr></thead>
              <tbody>{visiveis.map((p) => <LinhaParcela key={p.id} p={p} isAdmin={isAdmin} aoAbrir={() => setAberta(p)} aoAcao={setAcao} />)}</tbody>
            </table>
          </div>
          <div className="paginacao">
            <span className="muted pequeno">{(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, lista.length)} de {lista.length} parcelas</span>
            <Paginacao pag={pag} total={totalPaginas} aoIr={setPagina} />
          </div>
        </>)}
      </>)}

      {lancar && <LancarRecebimento aoFechar={() => setLancar(false)} aoEscolher={(p) => { setLancar(false); setAcao({ tipo: 'informar', parcela: p }) }} />}
      {aberta && <PainelParcela p={aberta} isAdmin={isAdmin} onFechar={() => setAberta(null)} onAcao={(a) => { setAcao(a) }} />}
      {acao?.parcela && (
        <AcaoParcela acao={acao} matriculaId={acao.parcela.matricula_id} totalParcelas={acao.parcela.total_parcelas} contas={cad.contas} isAdmin={isAdmin}
          onFechar={() => setAcao(null)} onSalvo={() => { setAcao(null); setAberta(null); q.recarregar() }} />
      )}
    </div>
  )
}
