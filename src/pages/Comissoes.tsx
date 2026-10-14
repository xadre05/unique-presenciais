import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno, SITUACAO_ALUNO, STATUS_COMISSAO, STATUS_MATRICULA } from '../lib/format'
import { Badge, Campo, enviarArquivo, Erro, InputMoeda, LinkArquivo, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import { turmaCurta } from './Agenda'

export type ComissaoV = {
  id: string; matricula_id: string; vendedora_id: string; valor: number; status: string; competencia: string | null
  liberada_em: string | null; paga_em: string | null; observacao: string | null; vendedora_nome: string | null
  aluno_nome: string; turma_nome: string; curso_nome: string; matricula_status: string; situacao_financeira: string; data_venda: string
  calculo: string; percentual: number | null; regra_texto: string | null; ajuste_motivo: string | null; liberacao_motivo: string | null
  pago_conta: string | null; pago_comprovante: string | null; turma_id: string; aluno_id: string; valor_fechado: number; mes_pagamento: string
}
type Regra = { id: string; curso_id: string | null; calculo: 'fixo' | 'percentual'; valor: number; observacao: string | null }

const mesAtual = () => hojeISO().slice(0, 7)

// Por que a comissão ainda não foi liberada.
export function motivoPendente(c: ComissaoV) {
  if (c.status !== 'pendente') return null
  if (c.matricula_status === 'reservada') return { texto: 'Só a matrícula foi paga: libera quando a inscrição for confirmada.', excecao: true }
  if (c.data_venda.slice(0, 7) >= mesAtual()) return { texto: `Venda deste mês: entra no fechamento e é paga em ${mesAno(c.mes_pagamento)}.`, excecao: true }
  return { texto: 'Inscrição confirmada: falta o administrador liberar.', excecao: false }
}

export default function Comissoes() {
  const { isAdmin } = useAuth()
  const cad = useCadastros()
  const lista = useConsulta<ComissaoV[]>(() => supabase.from('v_comissoes').select('*').order('data_venda', { ascending: false }))
  const regras = useConsulta<Regra[]>(() => supabase.from('comissao_regras').select('*'))
  const [vendedora, setVendedora] = useState('')
  const [turma, setTurma] = useState('')
  const [situacao, setSituacao] = useState('abertas')
  const [mes, setMes] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [verRegra, setVerRegra] = useState(false)
  const [modal, setModal] = useState<null | { tipo: 'liberar' | 'pagar' | 'ajustar'; itens: ComissaoV[] }>(null)

  const todas = lista.dados ?? []
  const meses = [...new Set(todas.map((c) => c.mes_pagamento.slice(0, 7)))].sort().reverse()
  const base = todas.filter((c) => (!vendedora || c.vendedora_id === vendedora) && (!turma || c.turma_id === turma) && (!mes || c.mes_pagamento.startsWith(mes)))
  const filtradas = base.filter((c) => situacao === 'abertas' ? ['pendente', 'liberada'].includes(c.status) : !situacao || c.status === situacao)
  const total = (st: string) => base.filter((c) => c.status === st)
  const soma = (xs: ComissaoV[]) => xs.reduce((s, c) => s + Number(c.valor), 0)
  const porVendedora = useMemo(() => {
    const g = new Map<string, { nome: string; pend: number; lib: number; paga: number }>()
    for (const c of base) {
      const k = c.vendedora_nome ?? '—'
      const v = g.get(k) ?? { nome: k, pend: 0, lib: 0, paga: 0 }
      if (c.status === 'pendente') v.pend += Number(c.valor)
      if (c.status === 'liberada') v.lib += Number(c.valor)
      if (c.status === 'paga' && (!mes ? c.mes_pagamento.startsWith(mesAtual()) : true)) v.paga += Number(c.valor)
      g.set(k, v)
    }
    return [...g.values()].filter((v) => v.pend + v.lib + v.paga > 0)
  }, [base, mes])
  const selecionadas = filtradas.filter((c) => sel.has(c.id))
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const recarregar = () => { setSel(new Set()); setModal(null); lista.recarregar() }

  const exportar = () => {
    const cab = ['Vendedora', 'Aluno', 'Turma', 'Venda', 'Mês de pagamento', 'Inscrição', 'Regra', 'Comissão', 'Situação', 'Paga em', 'Conta de saída', 'Motivo de ajuste', 'Motivo de liberação']
    const linhas = filtradas.map((c) => [c.vendedora_nome ?? '', c.aluno_nome, c.turma_nome, dataBR(c.data_venda), mesAno(c.mes_pagamento), STATUS_MATRICULA[c.matricula_status] ?? c.matricula_status, c.regra_texto ?? '', String(c.valor).replace('.', ','), STATUS_COMISSAO[c.status]?.rotulo, dataBR(c.paga_em), c.pago_conta ?? '', c.ajuste_motivo ?? '', c.liberacao_motivo ?? ''])
    const csv = [cab, ...linhas].map((l) => l.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'comissoes.csv'; a.click()
  }

  const padrao = (regras.dados ?? []).find((r) => !r.curso_id)
  const textoRegra = (r?: Regra) => !r ? 'R$ 250 fixo' : r.calculo === 'fixo' ? `${brl(r.valor)} fixo` : `${String(r.valor).replace('.', ',')}% do valor fechado`

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>{isAdmin ? 'Comissões' : 'Minhas comissões'}</h1><p className="muted">Liberação e controle dos pagamentos da equipe.</p></div>
        <div className="acoes">
          <button className="btn btn-contorno btn-grande" onClick={() => setVerRegra(true)}><Icone nome="documento" /> {isAdmin ? 'Regras de comissão' : 'Ver regra'}</button>
          <button className="btn btn-ouro btn-grande" onClick={exportar}><Icone nome="exportar" /> Exportar</button>
        </div>
      </header>

      <div className="faixa-info"><Icone nome="info" tam={18} /> <span><b>{textoRegra(padrao)} por matrícula vendida</b> · libera quando a inscrição é confirmada · paga no mês seguinte à venda.{(regras.dados ?? []).some((r) => r.curso_id) && ' Alguns cursos têm regra própria.'}</span></div>

      <div className="filtros-comissoes">
        {isAdmin && <label className="select-icone"><select value={vendedora} onChange={(e) => setVendedora(e.target.value)}><option value="">Todas as vendedoras</option>{cad.vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
        <label className="select-icone"><select value={turma} onChange={(e) => setTurma(e.target.value)}><option value="">Todas as turmas</option>{cad.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label className="select-icone"><select value={situacao} onChange={(e) => { setSituacao(e.target.value); setSel(new Set()) }}>
          <option value="abertas">Pendentes e liberadas</option><option value="pendente">Pendentes</option><option value="liberada">Liberadas</option><option value="paga">Pagas</option><option value="cancelada">Canceladas</option><option value="">Todas</option>
        </select></label>
        <label className="select-icone"><select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos os meses de pagamento</option>{meses.map((m) => <option key={m} value={m}>{mesAno(m + '-01')}</option>)}</select></label>
      </div>

      <h2 className="titulo-secao">Resumo do filtro atual</h2>
      <section className="resumo-com">
        <button className={`resumo-card rc-pend${situacao === 'pendente' ? ' ativo' : ''}`} onClick={() => setSituacao('pendente')}><span className="resumo-icone"><Icone nome="relogio" tam={22} /></span><div><div>Pendente</div><b>{brl(soma(total('pendente')))}</b><small>{total('pendente').length} comissão(ões)</small></div><Icone nome="seta" /></button>
        <button className={`resumo-card rc-lib${situacao === 'liberada' ? ' ativo' : ''}`} onClick={() => setSituacao('liberada')}><span className="resumo-icone"><Icone nome="documento" tam={22} /></span><div><div>Liberado para pagar</div><b>{brl(soma(total('liberada')))}</b><small>{total('liberada').length} comissão(ões)</small></div><Icone nome="seta" /></button>
        <button className={`resumo-card rc-paga${situacao === 'paga' ? ' ativo' : ''}`} onClick={() => setSituacao('paga')}><span className="resumo-icone"><Icone nome="check" tam={22} /></span><div><div>Pago</div><b>{brl(soma(total('paga')))}</b><small>{total('paga').length} comissão(ões)</small></div><Icone nome="seta" /></button>
      </section>

      {isAdmin && porVendedora.length > 0 && (<>
        <h2 className="titulo-secao">Por vendedora <span className="muted">(no filtro atual)</span></h2>
        <section className="por-vendedora">
          {porVendedora.map((v) => (
            <div key={v.nome} className="pv-card"><span className="avatar"><Icone nome="usuario" /></span><div><b>{v.nome}</b><div className="pequeno"><span className="info-txt">{brl(v.lib)} liberados</span>{v.pend > 0 && <> · <span className="alerta-txt">{brl(v.pend)} pendentes</span></>}</div></div></div>
          ))}
        </section>
      </>)}

      <Erro msg={lista.erro} />
      {filtradas.length === 0 && !lista.carregando ? <Vazio>Nenhuma comissão com esses filtros.</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          <table className="tabela tabela-com">
            <thead><tr>
              {isAdmin && <th><input type="checkbox" checked={filtradas.length > 0 && filtradas.every((c) => sel.has(c.id) || ['paga', 'cancelada'].includes(c.status))} onChange={(e) => setSel(e.target.checked ? new Set(filtradas.filter((c) => !['paga', 'cancelada'].includes(c.status)).map((c) => c.id)) : new Set())} /></th>}
              {isAdmin && <th>Vendedora</th>}<th>Aluno e turma</th><th>Venda</th><th>Mês de pagamento</th><th>Inscrição</th><th>Pagamento do aluno</th><th className="num">Comissão</th><th>Situação</th>{isAdmin && <th>Ações</th>}
            </tr></thead>
            <tbody>
              {filtradas.map((c) => {
                const mot = motivoPendente(c)
                const sa = SITUACAO_ALUNO[c.situacao_financeira]
                return (
                  <tr key={c.id} className={c.status === 'cancelada' ? 'linha-apagada' : ''}>
                    {isAdmin && <td>{!['paga', 'cancelada'].includes(c.status) && <input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)} />}</td>}
                    {isAdmin && <td className="forte">{c.vendedora_nome ?? '—'}</td>}
                    <td><Link to={`/matricula/${c.matricula_id}`} className="forte link-ouro">{c.aluno_nome}</Link><div className="muted pequeno">{turmaCurta(c.turma_nome)}</div></td>
                    <td>{dataBR(c.data_venda)}</td>
                    <td>{mesAno(c.mes_pagamento)}</td>
                    <td className="pequeno">{c.matricula_status === 'reservada' ? <span className="alerta-txt">Só matrícula</span> : c.matricula_status === 'confirmada' || c.matricula_status === 'concluida' ? 'Confirmada' : STATUS_MATRICULA[c.matricula_status]}</td>
                    <td><Badge tom={sa?.tom}>{sa?.rotulo}</Badge></td>
                    <td className="num">{brl(c.valor)}<div className="muted pequeno" title={c.regra_texto ?? ''}>{c.ajuste_motivo ? 'ajustada' : c.calculo === 'percentual' ? `${String(c.percentual).replace('.', ',')}%` : 'fixo'}</div></td>
                    <td><Badge tom={STATUS_COMISSAO[c.status]?.tom}>{STATUS_COMISSAO[c.status]?.rotulo}</Badge>
                      {mot && <div className="pequeno motivo">{mot.texto}</div>}
                      {c.status === 'paga' && <div className="muted pequeno">em {dataBR(c.paga_em)}{c.pago_conta && ` · ${c.pago_conta}`} {c.pago_comprovante && <LinkArquivo caminho={c.pago_comprovante}>comprovante</LinkArquivo>}</div>}
                      {c.ajuste_motivo && <div className="muted pequeno">Ajuste: {c.ajuste_motivo}</div>}
                      {c.liberacao_motivo && <div className="muted pequeno">Liberada por exceção: {c.liberacao_motivo}</div>}
                    </td>
                    {isAdmin && <td className="celula-acao acao-curta">
                      {c.status === 'pendente' && <button className="btn btn-contorno btn-mini" onClick={() => setModal({ tipo: 'liberar', itens: [c] })}>{mot?.excecao ? 'Liberar exceção' : 'Liberar'}</button>}
                      {c.status === 'liberada' && <button className="btn btn-ouro btn-mini" onClick={() => setModal({ tipo: 'pagar', itens: [c] })}>Registrar pagamento</button>}
                      {['pendente', 'liberada'].includes(c.status) && <button className="btn btn-mini" title="Ajustar valor" onClick={() => setModal({ tipo: 'ajustar', itens: [c] })}>Ajustar</button>}
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (
        <div className="barra-lote">
          <span>{selecionadas.length === 0 ? 'Selecione comissões para liberar ou registrar pagamento em lote.' : <><b>{selecionadas.length}</b> selecionada(s) · <b>{brl(soma(selecionadas))}</b> · {[...new Set(selecionadas.map((c) => c.vendedora_nome))].join(', ')}</>}</span>
          <button className="btn" disabled={!selecionadas.some((c) => c.status === 'pendente')} onClick={() => setModal({ tipo: 'liberar', itens: selecionadas.filter((c) => c.status === 'pendente') })}>Liberar selecionadas</button>
          <button className="btn btn-ouro" disabled={!selecionadas.some((c) => c.status === 'liberada')} onClick={() => setModal({ tipo: 'pagar', itens: selecionadas.filter((c) => c.status === 'liberada') })}>Registrar pagamento das selecionadas</button>
        </div>
      )}
      <p className="muted pequeno"><Icone nome="info" tam={13} /> Liberações, ajustes e pagamentos ficam registrados no histórico, com quem fez e quando.</p>

      {modal?.tipo === 'liberar' && <Liberar itens={modal.itens} onFechar={() => setModal(null)} onSalvo={recarregar} />}
      {modal?.tipo === 'pagar' && <RegistrarPagamento itens={modal.itens} contas={cad.contas} onFechar={() => setModal(null)} onSalvo={recarregar} />}
      {modal?.tipo === 'ajustar' && <Ajustar c={modal.itens[0]} onFechar={() => setModal(null)} onSalvo={recarregar} />}
      {verRegra && <Regras regras={regras.dados ?? []} cursos={cad.cursos} isAdmin={isAdmin} onFechar={() => setVerRegra(false)} onSalvo={() => { regras.recarregar(); lista.recarregar() }} />}
    </div>
  )
}

function Resumo({ itens }: { itens: ComissaoV[] }) {
  const g = new Map<string, number>()
  for (const c of itens) g.set(c.vendedora_nome ?? '—', (g.get(c.vendedora_nome ?? '—') ?? 0) + Number(c.valor))
  return (
    <div className="resumo-modal">
      {[...g.entries()].map(([n, v]) => <div key={n}><span>{n}</span><b>{brl(v)}</b></div>)}
      <div className="muted pequeno">{itens.length} comissão(ões) · total {brl(itens.reduce((s, c) => s + Number(c.valor), 0))}</div>
    </div>
  )
}

function Liberar({ itens, onFechar, onSalvo }: { itens: ComissaoV[]; onFechar: () => void; onSalvo: () => void }) {
  const excecoes = itens.filter((c) => motivoPendente(c)?.excecao)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async () => {
    if (excecoes.length && motivo.trim().length < 5) return setErro('Escreva por que está liberando antes da regra (fica registrado).')
    for (const c of itens) {
      const ex = excecoes.includes(c)
      const { error } = await supabase.from('comissoes').update({ status: 'liberada', liberacao_motivo: ex ? motivo.trim() : null }).eq('id', c.id)
      if (error) return setErro(msgErro(error))
    }
    onSalvo()
  }
  return (
    <Modal titulo="Liberar comissões" aberto onFechar={onFechar}>
      <Resumo itens={itens} />
      <p className="muted pequeno">Liberada quer dizer: pode pagar no mês de pagamento. O pagamento em si você registra depois.</p>
      {excecoes.length > 0 && (<>
        <div className="nota pequeno"><b>{excecoes.length} delas ainda não cumprem a regra:</b> {excecoes.map((c) => `${c.aluno_nome} (${motivoPendente(c)?.texto.split(':')[0]})`).join('; ')}.</div>
        <Campo rotulo="Motivo da exceção"><textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: combinado com a Patrícia, aluna vai pagar à vista na semana que vem" /></Campo>
      </>)}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Liberar {itens.length}</button></div>
    </Modal>
  )
}

function RegistrarPagamento({ itens, contas, onFechar, onSalvo }: { itens: ComissaoV[]; contas: { id: string; nome: string; ativa: boolean }[]; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(hojeISO())
  const [conta, setConta] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const vendedoras = [...new Set(itens.map((c) => c.vendedora_id))]
  const salvar = async () => {
    setErro(null)
    if (vendedoras.length > 1) return setErro('Uma transferência é para uma pessoa só. Selecione as comissões de uma vendedora por vez.')
    if (!conta) return setErro('Diga de qual conta saiu o pagamento.')
    setSalvando(true)
    try {
      const comp = arquivo ? await enviarArquivo(`comissoes/${vendedoras[0]}`, arquivo) : null
      for (const c of itens) {
        const { error } = await supabase.from('comissoes').update({ status: 'paga', paga_em: data, pago_conta: conta, pago_comprovante: comp, observacao: obs.trim() || c.observacao }).eq('id', c.id)
        if (error) throw error
      }
      onSalvo()
    } catch (e) { setErro(msgErro(e)) } finally { setSalvando(false) }
  }
  return (
    <Modal titulo="Registrar pagamento de comissão" aberto onFechar={onFechar}>
      <Resumo itens={itens} />
      <p className="muted pequeno">Registre uma transferência que já foi feita. Isso não envia dinheiro.</p>
      <div className="form-grade">
        <Campo rotulo="Data da transferência"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <Campo rotulo="Conta de saída"><select value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Escolha…</option>{contas.filter((c) => c.ativa).map((c) => <option key={c.id}>{c.nome}</option>)}<option>Outra conta</option></select></Campo>
      </div>
      <Campo rotulo="Comprovante (recomendado)"><input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
      <Campo rotulo="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>Registrar pagamento</button></div>
    </Modal>
  )
}

function Ajustar({ c, onFechar, onSalvo }: { c: ComissaoV; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<'fixo' | 'percentual'>('fixo')
  const [valor, setValor] = useState<number | null>(Number(c.valor))
  const [pct, setPct] = useState('10')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const p = Number(pct.replace(',', '.'))
  const final = tipo === 'fixo' ? (valor ?? 0) : Math.round(Number(c.valor_fechado) * p) / 100
  const salvar = async () => {
    if (motivo.trim().length < 5) return setErro('Escreva o motivo do ajuste (fica registrado).')
    if (tipo === 'percentual' && !(p > 0 && p <= 100)) return setErro('Percentual inválido.')
    const { error } = await supabase.from('comissoes').update({
      valor: final, calculo: tipo === 'fixo' ? 'manual' : 'percentual', percentual: tipo === 'percentual' ? p : null,
      ajuste_motivo: motivo.trim(), regra_texto: tipo === 'fixo' ? `Ajuste manual: ${brl(final)}` : `Ajuste manual: ${pct}% de ${brl(c.valor_fechado)}`,
    }).eq('id', c.id)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo={`Ajustar comissão — ${c.aluno_nome}`} aberto onFechar={onFechar}>
      <p className="muted pequeno">Hoje: {brl(c.valor)} ({c.regra_texto}). Venda de {brl(c.valor_fechado)}, vendedora {c.vendedora_nome}.</p>
      <div className="alternar" style={{ marginBottom: 12 }}>
        <button className={tipo === 'fixo' ? 'ativo' : ''} onClick={() => setTipo('fixo')}>Valor fixo</button>
        <button className={tipo === 'percentual' ? 'ativo' : ''} onClick={() => setTipo('percentual')}>Percentual da venda</button>
      </div>
      {tipo === 'fixo'
        ? <Campo rotulo="Novo valor"><InputMoeda valor={valor} onChange={setValor} passo={50} /></Campo>
        : <Campo rotulo="Percentual sobre o valor fechado" dica={`= ${brl(final)}`}><input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" /></Campo>}
      <Campo rotulo="Motivo do ajuste"><textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: venda difícil, autorizei R$ 500" /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar {brl(final)}</button></div>
    </Modal>
  )
}

function Regras({ regras, cursos, isAdmin, onFechar, onSalvo }: { regras: Regra[]; cursos: { id: string; nome: string }[]; isAdmin: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [editando, setEditando] = useState<{ curso_id: string | null; calculo: 'fixo' | 'percentual'; valor: number | null; id?: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const linhas = [{ curso_id: null as string | null, nome: 'Padrão (todos os cursos)' }, ...cursos.map((c) => ({ curso_id: c.id, nome: c.nome }))]
  const regraDe = (id: string | null) => regras.find((r) => r.curso_id === id)
  const padrao = regraDe(null)
  const texto = (r?: Regra) => !r ? 'segue o padrão' : r.calculo === 'fixo' ? `${brl(r.valor)} fixo` : `${String(r.valor).replace('.', ',')}% do valor fechado`
  const salvar = async () => {
    if (!editando || editando.valor === null || editando.valor < 0) return setErro('Informe o valor.')
    const reg = { curso_id: editando.curso_id, calculo: editando.calculo, valor: editando.valor, atualizado_em: new Date().toISOString() }
    const { error } = editando.id ? await supabase.from('comissao_regras').update(reg).eq('id', editando.id) : await supabase.from('comissao_regras').insert(reg)
    if (error) return setErro(msgErro(error))
    setEditando(null); setErro(null); onSalvo()
  }
  return (
    <Modal titulo="Regras de comissão" aberto onFechar={onFechar} largo>
      <ul className="lista-regras">
        <li>A comissão é de quem vendeu e é <b>por matrícula vendida</b>: um aluno que compra duas turmas gera duas comissões.</li>
        <li>Nasce <b>pendente</b> quando a matrícula é criada.</li>
        <li>É <b>liberada</b> quando a inscrição está confirmada. Se só a matrícula foi paga, normalmente espera.</li>
        <li>É <b>paga no mês seguinte à venda</b>. O administrador registra a transferência com data, conta e comprovante.</li>
        <li>Matrícula cancelada cancela a comissão que ainda não foi paga.</li>
        <li>O administrador pode liberar antes (exceção) ou ajustar o valor de uma comissão. Os dois pedem motivo e ficam no histórico.</li>
      </ul>
      <h3>Valores</h3>
      <table className="tabela compacta">
        <thead><tr><th>Curso</th><th>Regra</th>{isAdmin && <th></th>}</tr></thead>
        <tbody>
          {linhas.map((l) => {
            const r = regraDe(l.curso_id)
            return (
              <tr key={l.curso_id ?? 'padrao'}>
                <td className="forte">{l.nome}</td>
                <td>{l.curso_id && !r ? <span className="muted">segue o padrão ({texto(padrao)})</span> : texto(r)}</td>
                {isAdmin && <td className="direita"><button className="btn btn-mini" onClick={() => { setErro(null); setEditando({ curso_id: l.curso_id, calculo: r?.calculo ?? 'fixo', valor: r?.valor ?? padrao?.valor ?? 250, id: r?.id }) }}>{r ? 'Alterar' : 'Criar regra própria'}</button></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      {isAdmin && <p className="muted pequeno">Mudar uma regra recalcula as comissões pendentes e liberadas desse curso, menos as que tiveram ajuste manual. Comissões pagas não mudam.</p>}
      {editando && (
        <div className="bloco" style={{ marginTop: 12 }}>
          <div className="alternar" style={{ marginBottom: 12 }}>
            <button className={editando.calculo === 'fixo' ? 'ativo' : ''} onClick={() => setEditando({ ...editando, calculo: 'fixo' })}>Valor fixo</button>
            <button className={editando.calculo === 'percentual' ? 'ativo' : ''} onClick={() => setEditando({ ...editando, calculo: 'percentual' })}>Percentual da venda</button>
          </div>
          {editando.calculo === 'fixo'
            ? <Campo rotulo="Valor por matrícula"><InputMoeda valor={editando.valor} onChange={(v) => setEditando({ ...editando, valor: v })} passo={50} /></Campo>
            : <Campo rotulo="Percentual sobre o valor fechado"><input inputMode="decimal" value={editando.valor ?? ''} onChange={(e) => setEditando({ ...editando, valor: Number(e.target.value.replace(',', '.')) || null })} /></Campo>}
          <Erro msg={erro} />
          <div className="modal-acoes"><button className="btn" onClick={() => setEditando(null)}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar regra</button></div>
        </div>
      )}
      {!isAdmin && <p className="muted pequeno">Dúvidas sobre a sua comissão: fale com o administrador.</p>}
    </Modal>
  )
}
