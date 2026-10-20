// Controle → Serviços pagos: o que a empresa paga para funcionar. O "está no ar?" vem do monitor automático;
// valor, vencimento e crédito são opcionais (servem para o aviso de renovação).
import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, hojeISO, somaMeses } from '../../lib/format'
import { Badge, Erro, Kpi, Modal, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { FormServico } from './FormServico'
import { NOME_NIVEL, TOM_NIVEL, piorNivel, useMonitores, type Monitor } from './monitores'
import { CATEGORIAS, NOME_CICLO, NOME_SITUACAO, TOM_SITUACAO, custoMes, dinheiro, situacaoServico, textoVencimento, type Servico } from './dados'

const ALERTAS_MANUAIS = ['vencido', 'saldo_baixo', 'vence_logo', 'cancelar']
type Estado = { tom: string; rotulo: string; detalhe: string; peso: number }

// junta o que foi preenchido (vencimento, crédito) com o que o monitor conferiu sozinho
function estadoDo(s: Servico, hoje: string, monitores: Monitor[]): Estado {
  const st = situacaoServico(s, hoje)
  if (st === 'cancelado') return { tom: 'apagado', rotulo: 'Cancelado', detalhe: '', peso: 0 }
  const nivel = piorNivel(monitores)
  const pior = monitores.find((m) => m.nivel === nivel)
  const doMonitor = pior?.detalhe ? `${pior.nome}: ${pior.detalhe}` : ''
  if (ALERTAS_MANUAIS.includes(st)) {
    const manual = st === 'saldo_baixo' ? 'O crédito está abaixo do mínimo' : st === 'cancelar' ? 'Marcado para cancelar' : textoVencimento(s, hoje)
    return { tom: TOM_SITUACAO[st], rotulo: NOME_SITUACAO[st], detalhe: [manual, nivel && nivel !== 'ok' ? doMonitor : ''].filter(Boolean).join(' · '), peso: 3 }
  }
  if (nivel) return { tom: TOM_NIVEL[nivel], rotulo: NOME_NIVEL[nivel], detalhe: doMonitor, peso: nivel === 'erro' ? 4 : nivel === 'alerta' ? 2 : 1 }
  return { tom: 'neutro', rotulo: 'Ativo', detalhe: 'Este não tem como ser conferido sozinho', peso: 1 }
}

function resumoCobranca(s: Servico, hoje: string) {
  const partes: string[] = [NOME_CICLO[s.ciclo]]
  if (s.valor != null) partes.push(s.valor === 0 ? 'plano gratuito' : `${dinheiro(s.valor, s.moeda)}${s.ciclo === 'anual' ? '/ano' : s.ciclo === 'mensal' ? '/mês' : ''}`)
  if (s.saldo != null) partes.push(`crédito ${dinheiro(s.saldo, s.moeda)}`)
  if (s.proximo_vencimento) partes.push(`${s.ciclo === 'credito' ? 'atenção em' : 'vence'} ${dataBR(s.proximo_vencimento)} (${textoVencimento(s, hoje).toLowerCase()})`)
  if (s.forma_pagamento) partes.push(s.forma_pagamento)
  return partes.join(' · ')
}

type Props = { s: Servico; hoje: string; monitores: Monitor[]; aoEditar: () => void; aoRenovar: () => void; aoExcluir: () => void }
function CartaoServico({ s, hoje, monitores, aoEditar, aoRenovar, aoExcluir }: Props) {
  const e = estadoDo(s, hoje, monitores)
  const renova = (s.ciclo === 'mensal' || s.ciclo === 'anual') && s.proximo_vencimento && s.situacao === 'ativo'
  return (
    <li className={`ctl-serv ctl-serv-${e.tom}`}>
      <div className="ctl-serv-info">
        <div className="ctl-serv-titulo"><b>{s.nome}</b><Badge tom={e.tom}>{e.rotulo}</Badge></div>
        <p className="muted pequeno">{s.para_que ?? s.categoria}</p>
        {e.detalhe && <p className="pequeno ctl-serv-detalhe">{e.detalhe}</p>}
        <p className="muted pequeno">{resumoCobranca(s, hoje)}</p>
        {s.observacao && <p className="muted pequeno ctl-serv-obs">{s.observacao}</p>}
      </div>
      <div className="ctl-serv-acoes">
        {s.painel_url && <a className="btn btn-mini" href={s.painel_url} target="_blank" rel="noreferrer"><Icone nome="globo" tam={14} /> Painel</a>}
        {renova && <button className="btn btn-mini btn-contorno-ouro" onClick={aoRenovar}>Renovou</button>}
        <button className="btn btn-mini" onClick={aoEditar}>Editar</button>
        <button className="btn-icone" onClick={aoExcluir} aria-label="Excluir"><Icone nome="lixeira" tam={16} /></button>
      </div>
    </li>
  )
}

export default function PaginaServicos() {
  const hoje = hojeISO()
  const [categoria, setCategoria] = useState('')
  const [editar, setEditar] = useState<Servico | null | undefined>(undefined)
  const [apagar, setApagar] = useState<Servico | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const q = useConsulta<Servico[]>(() => supabase.from('controle_servicos').select('*').order('ordem').order('nome'), [])
  const mon = useMonitores()

  const itens = useMemo(() => (q.dados ?? []).filter((s) => !categoria || s.categoria === categoria)
    .map((s) => { const m = (mon.dados ?? []).filter((x) => x.servico === s.nome); return { s, m, e: estadoDo(s, hoje, m) } })
    .sort((a, b) => b.e.peso - a.e.peso), [q.dados, mon.dados, categoria, hoje])
  const ativos = itens.filter((i) => i.s.situacao !== 'cancelado')
  const atencao = ativos.filter((i) => i.e.peso >= 2)
  const somaMes = (moeda: 'BRL' | 'USD') => ativos.filter((i) => i.s.moeda === moeda).reduce((t, i) => t + custoMes(i.s), 0)

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
      <header className="pagina-topo"><div><h1>Serviços pagos</h1><p className="muted">O que a empresa paga para funcionar. O sistema confere sozinho se cada um está no ar. Senhas não ficam aqui.</p></div>
        <div className="acoes"><button className="btn btn-ouro" onClick={() => setEditar(null)}><Icone nome="mais" /> Novo serviço</button></div></header>
      <div className="fin-filtros"><label className="select-icone"><select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label></div>
      <Erro msg={q.erro || mon.erro || erro} />
      <section className="kpis">
        <Kpi rotulo="Precisa de atenção" valor={String(atencao.length)} tom={atencao.length ? 'erro' : 'ok'} sub={atencao.length ? atencao.map((i) => i.s.nome).join(', ') : 'Tudo em ordem'} />
        <Kpi rotulo="Funcionando agora" valor={`${ativos.filter((i) => i.e.rotulo === 'Funcionando').length} de ${ativos.filter((i) => i.m.length).length}`} sub="Conferidos sozinhos" />
        <Kpi rotulo="Custo por mês (R$)" valor={brl(somaMes('BRL'))} sub="Anual dividido por 12" />
        <Kpi rotulo="Custo por mês (US$)" valor={dinheiro(somaMes('USD'), 'USD')} sub="Cobrado no cartão em dólar" />
      </section>
      {q.carregando && !q.dados ? <Vazio>Carregando…</Vazio> : !itens.length ? <Vazio>Nenhum serviço cadastrado. Use “Novo serviço”.</Vazio> : (
        <ul className="ctl-servicos">{itens.map(({ s, m }) => <CartaoServico key={s.id} s={s} hoje={hoje} monitores={m} aoEditar={() => setEditar(s)} aoRenovar={() => renovar(s)} aoExcluir={() => setApagar(s)} />)}</ul>
      )}
      {editar !== undefined && <FormServico inicial={editar} aoFechar={() => setEditar(undefined)} aoSalvar={() => { setEditar(undefined); q.recarregar() }} />}
      {apagar && <Modal titulo="Excluir serviço" aberto onFechar={() => setApagar(null)}>
        <p>Excluir <b>{apagar.nome}</b> do controle? Se só parou de usar, prefira marcar como “Cancelado” em Editar.</p>
        <div className="modal-acoes"><button className="btn" onClick={() => setApagar(null)}>Voltar</button><button className="btn btn-perigo" onClick={() => excluir(apagar)}>Excluir</button></div>
      </Modal>}
    </div>
  )
}
