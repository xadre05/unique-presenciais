// Controle → Serviços: tudo o que a empresa paga para funcionar, com o que vence, o crédito que está acabando e o custo do mês.
import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, dataHoraBR, hojeISO, somaMeses } from '../../lib/format'
import { Badge, Erro, Kpi, Modal, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { FormServico } from './FormServico'
import { CATEGORIAS, NOME_CICLO, NOME_SITUACAO, ORDEM_SITUACAO, TOM_SITUACAO, custoMes, dinheiro, situacaoServico, textoVencimento, type Servico } from './dados'

const ATENCAO = ['vencido', 'saldo_baixo', 'vence_logo', 'cancelar']

function LinhaServico({ s, hoje, aoEditar, aoRenovar, aoExcluir }: { s: Servico; hoje: string; aoEditar: () => void; aoRenovar: () => void; aoExcluir: () => void }) {
  const st = situacaoServico(s, hoje)
  const renova = (s.ciclo === 'mensal' || s.ciclo === 'anual') && s.proximo_vencimento && s.situacao === 'ativo'
  return (
    <tr className={st === 'cancelado' ? 'apagada' : ''}>
      <td><b>{s.nome}</b><div className="muted pequeno">{s.para_que ?? s.categoria}</div></td>
      <td className="pequeno">{NOME_CICLO[s.ciclo]}{s.forma_pagamento && <div className="muted">{s.forma_pagamento}</div>}</td>
      <td className="num">{dinheiro(s.valor, s.moeda)}{s.ciclo === 'anual' && s.valor != null && <div className="muted pequeno">por ano</div>}</td>
      <td className="pequeno">{s.proximo_vencimento ? dataBR(s.proximo_vencimento) : '—'}<div className="muted">{textoVencimento(s, hoje)}</div></td>
      <td className="pequeno">{s.saldo != null ? <><b>{dinheiro(s.saldo, s.moeda)}</b><div className="muted">em {dataHoraBR(s.saldo_em)}</div></> : <span className="muted">—</span>}</td>
      <td><Badge tom={TOM_SITUACAO[st]}>{NOME_SITUACAO[st]}</Badge></td>
      <td className="celula-acao"><div className="pg-acoes">
        {s.painel_url && <a className="btn btn-mini" href={s.painel_url} target="_blank" rel="noreferrer"><Icone nome="globo" tam={14} /> Painel</a>}
        {renova && <button className="btn btn-mini btn-contorno-ouro" onClick={aoRenovar}>Renovou</button>}
        <button className="btn btn-mini" onClick={aoEditar}>Editar</button>
        <button className="btn-icone" onClick={aoExcluir} aria-label="Excluir"><Icone nome="lixeira" tam={16} /></button>
      </div></td>
    </tr>
  )
}

export default function PaginaServicos() {
  const hoje = hojeISO()
  const [categoria, setCategoria] = useState('')
  const [editar, setEditar] = useState<Servico | null | undefined>(undefined)
  const [apagar, setApagar] = useState<Servico | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const q = useConsulta<Servico[]>(() => supabase.from('controle_servicos').select('*').order('ordem').order('nome'), [])

  const linhas = useMemo(() => (q.dados ?? []).filter((s) => !categoria || s.categoria === categoria)
    .sort((a, b) => ORDEM_SITUACAO.indexOf(situacaoServico(a, hoje)) - ORDEM_SITUACAO.indexOf(situacaoServico(b, hoje))), [q.dados, categoria, hoje])
  const ativos = linhas.filter((s) => s.situacao !== 'cancelado')
  const atencao = ativos.filter((s) => ATENCAO.includes(situacaoServico(s, hoje)))
  const faltam = ativos.filter((s) => situacaoServico(s, hoje) === 'sem_data')
  const somaMes = (moeda: 'BRL' | 'USD') => ativos.filter((s) => s.moeda === moeda).reduce((t, s) => t + custoMes(s), 0)

  const atualizar = async (id: string, dados: Partial<Servico>) => {
    setErro(null)
    const { error } = await supabase.from('controle_servicos').update({ ...dados, atualizado_em: new Date().toISOString() }).eq('id', id)
    if (error) setErro(error.message); else q.recarregar()
  }
  const renovar = (s: Servico) => atualizar(s.id!, { proximo_vencimento: somaMeses(s.proximo_vencimento!, s.ciclo === 'anual' ? 12 : 1) })
  const excluir = async (s: Servico) => {
    setApagar(null)
    const { error } = await supabase.from('controle_servicos').delete().eq('id', s.id!)
    if (error) setErro(error.message); else q.recarregar()
  }

  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Serviços pagos</h1><p className="muted">Tudo o que a empresa paga para funcionar: o que vence, o crédito que está acabando e quanto custa por mês. Senhas não ficam aqui.</p></div>
        <div className="acoes"><button className="btn btn-ouro" onClick={() => setEditar(null)}><Icone nome="mais" /> Novo serviço</button></div></header>
      <div className="fin-filtros"><label className="select-icone"><select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <Erro msg={q.erro || erro} />
      <section className="kpis">
        <Kpi rotulo="Precisa de atenção" valor={String(atencao.length)} tom={atencao.length ? 'erro' : 'ok'} sub={atencao.length ? atencao.map((s) => s.nome).join(', ') : 'Nada vencendo'} />
        <Kpi rotulo="Custo por mês (R$)" valor={brl(somaMes('BRL'))} sub="Anual dividido por 12" />
        <Kpi rotulo="Custo por mês (US$)" valor={dinheiro(somaMes('USD'), 'USD')} sub="Cobrado no cartão em dólar" />
        <Kpi rotulo="Falta preencher" valor={String(faltam.length)} tom={faltam.length ? 'alerta' : undefined} sub="Sem valor ou vencimento" />
      </section>
      {q.carregando && !q.dados ? <Vazio>Carregando…</Vazio> : !linhas.length ? <Vazio>Nenhum serviço cadastrado. Use “Novo serviço”.</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          <table className="tabela">
            <thead><tr><th>Serviço</th><th>Cobrança</th><th className="num">Valor</th><th>Vencimento</th><th>Crédito</th><th>Situação</th><th></th></tr></thead>
            <tbody>{linhas.map((s) => <LinhaServico key={s.id} s={s} hoje={hoje} aoEditar={() => setEditar(s)} aoRenovar={() => renovar(s)} aoExcluir={() => setApagar(s)} />)}</tbody>
          </table>
        </div>
      )}
      {editar !== undefined && <FormServico inicial={editar} aoFechar={() => setEditar(undefined)} aoSalvar={() => { setEditar(undefined); q.recarregar() }} />}
      {apagar && <Modal titulo="Excluir serviço" aberto onFechar={() => setApagar(null)}>
        <p>Excluir <b>{apagar.nome}</b> do controle? Se só parou de usar, prefira marcar como “Cancelado” em Editar.</p>
        <div className="modal-acoes"><button className="btn" onClick={() => setApagar(null)}>Voltar</button><button className="btn btn-perigo" onClick={() => excluir(apagar)}>Excluir</button></div>
      </Modal>}
    </div>
  )
}
