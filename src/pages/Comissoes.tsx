import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno, SITUACAO_ALUNO, STATUS_COMISSAO, STATUS_MATRICULA } from '../lib/format'
import { Badge, Campo, enviarArquivo, Erro, InputMoeda, InputNumero, InputPercent, LinkArquivo, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import ComissoesOnline from './ComissoesOnline'
import { turmaCurta } from './Agenda'

export type ComissaoV = {
  id: string; matricula_id: string; vendedora_id: string; valor: number; status: string; competencia: string | null
  liberada_em: string | null; paga_em: string | null; observacao: string | null; vendedora_nome: string | null
  aluno_nome: string; turma_nome: string; curso_nome: string; matricula_status: string; situacao_financeira: string; data_venda: string
  calculo: string; percentual: number | null; regra_texto: string | null; ajuste_motivo: string | null; liberacao_motivo: string | null
  pago_conta: string | null; pago_comprovante: string | null; turma_id: string; aluno_id: string; valor_fechado: number; mes_pagamento: string
}
type Faixa = { a_partir_de: number; fixo: number; percentual: number }
export type Regra = { id: string; curso_id: string | null; vigente_desde: string; calculo: 'simples' | 'progressiva'; fixo: number; percentual: number; faixas: Faixa[] | null; observacao: string | null }
// Regra valendo hoje para um curso (ou a padrão, com curso null).
export const regraAtual = (regras: Regra[], curso: string | null) => regras.filter((r) => r.curso_id === curso && r.vigente_desde <= hojeISO()).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0]

const pctTxt = (v: number) => `${String(Number(v)).replace('.', ',')}%`
const partes = (fixo: number, pct: number) => [Number(fixo) > 0 ? brl(fixo) : '', Number(pct) > 0 ? `${pctTxt(pct)} da venda` : ''].filter(Boolean).join(' + ') || 'R$ 0,00'
export function descreverRegra(r?: Regra | null) {
  if (!r) return 'R$ 250,00 fixo'
  if (r.calculo === 'progressiva' && r.faixas?.length) {
    const fs = [...r.faixas].sort((a, b) => a.a_partir_de - b.a_partir_de)
    return 'Progressiva: ' + fs.map((f, i) => {
      const ate = fs[i + 1] ? fs[i + 1].a_partir_de - 1 : null
      const faixa = ate === null ? `da ${f.a_partir_de}ª em diante` : ate === f.a_partir_de ? `${f.a_partir_de}ª venda` : `${f.a_partir_de}ª a ${ate}ª venda`
      return `${faixa}: ${partes(f.fixo, f.percentual)}`
    }).join(' · ')
  }
  return partes(r.fixo, r.percentual)
}

const mesAtual = () => hojeISO().slice(0, 7)

// Por que a comissão ainda não foi liberada.
export function motivoPendente(c: ComissaoV) {
  if (c.status !== 'pendente') return null
  if (c.matricula_status === 'reservada') return { texto: 'Só a matrícula foi paga: libera quando a inscrição for confirmada.', excecao: true }
  if (c.data_venda.slice(0, 7) >= mesAtual()) return { texto: `Venda deste mês: entra no fechamento e é paga em ${mesAno(c.mes_pagamento)}. Nada em atraso.`, excecao: true }
  return { texto: `Inscrição confirmada: falta o administrador conferir e aprovar (pagamento em ${mesAno(c.mes_pagamento)}).`, excecao: false }
}

export default function Comissoes() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const area = params.get('area') === 'online' ? 'online' : 'presencial'
  const cad = useCadastros()
  const lista = useConsulta<ComissaoV[]>(() => supabase.from('v_comissoes').select('*').order('data_venda', { ascending: false }))
  const regras = useConsulta<Regra[]>(() => supabase.from('comissao_regra_versoes').select('*').order('vigente_desde', { ascending: false }))
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

  const padrao = regraAtual(regras.dados ?? [], null)

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>{isAdmin ? 'Comissões' : 'Minhas comissões'}</h1><p className="muted">Liberação e controle dos pagamentos da equipe.</p></div>
        {area === 'presencial' && <div className="acoes">
          <button className="btn btn-contorno btn-grande" onClick={() => setVerRegra(true)}><Icone nome="documento" /> {isAdmin ? 'Regras de comissão' : 'Ver regra'}</button>
          <button className="btn btn-ouro btn-grande" onClick={exportar}><Icone nome="exportar" /> Exportar</button>
        </div>}
      </header>

      <nav className="abas">
        <button className={area === 'presencial' ? 'ativa' : ''} onClick={() => setParams({})}><Icone nome="turmas" tam={16} /> Presencial <span className="muted">por matrícula</span></button>
        <button className={area === 'online' ? 'ativa' : ''} onClick={() => setParams({ area: 'online' })}><Icone nome="links" tam={16} /> Online <span className="muted">por pagamento na Hotmart</span></button>
      </nav>
      {area === 'online' ? <ComissoesOnline /> : (<>

      <div className="faixa-info"><Icone nome="info" tam={18} /> <span><b>{descreverRegra(padrao)} por matrícula vendida</b> · libera quando a inscrição é confirmada · paga no mês seguinte à venda.{(regras.dados ?? []).some((r) => r.curso_id) && ' Alguns cursos têm regra própria.'}</span></div>

      <div className="filtros-comissoes">
        {isAdmin && <label className="select-icone"><select value={vendedora} onChange={(e) => setVendedora(e.target.value)}><option value="">Todas as vendedoras</option>{cad.vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
        <label className="select-icone"><select value={turma} onChange={(e) => setTurma(e.target.value)}><option value="">Todas as turmas</option>{cad.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label className="select-icone"><select value={situacao} onChange={(e) => { setSituacao(e.target.value); setSel(new Set()) }}>
          <option value="abertas">Em apuração e aprovadas</option><option value="pendente">Em apuração</option><option value="liberada">Aprovadas para pagar</option><option value="paga">Pagas</option><option value="cancelada">Canceladas</option><option value="">Todas</option>
        </select></label>
        <label className="select-icone"><select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos os meses de pagamento</option>{meses.map((m) => <option key={m} value={m}>{mesAno(m + '-01')}</option>)}</select></label>
      </div>

      <h2 className="titulo-secao">Resumo do filtro atual</h2>
      <section className="resumo-com">
        <button className={`resumo-card rc-pend${situacao === 'pendente' ? ' ativo' : ''}`} onClick={() => setSituacao('pendente')}><span className="resumo-icone"><Icone nome="relogio" tam={22} /></span><div><div>Em apuração</div><b>{brl(soma(total('pendente')))}</b><small>{total('pendente').length} venda(s) que entram nos próximos fechamentos</small></div><Icone nome="seta" /></button>
        <button className={`resumo-card rc-lib${situacao === 'liberada' ? ' ativo' : ''}`} onClick={() => setSituacao('liberada')}><span className="resumo-icone"><Icone nome="documento" tam={22} /></span><div><div>Aprovado para pagar</div><b>{brl(soma(total('liberada')))}</b><small>{total('liberada').length} comissão(ões) conferida(s)</small></div><Icone nome="seta" /></button>
        <button className={`resumo-card rc-paga${situacao === 'paga' ? ' ativo' : ''}`} onClick={() => setSituacao('paga')}><span className="resumo-icone"><Icone nome="check" tam={22} /></span><div><div>Pago</div><b>{brl(soma(total('paga')))}</b><small>{total('paga').length} comissão(ões)</small></div><Icone nome="seta" /></button>
      </section>

      {isAdmin && porVendedora.length > 0 && (<>
        <h2 className="titulo-secao">Por vendedora <span className="muted">(no filtro atual)</span></h2>
        <section className="por-vendedora">
          {porVendedora.map((v) => (
            <div key={v.nome} className="pv-card"><span className="avatar"><Icone nome="usuario" /></span><div><b>{v.nome}</b><div className="pequeno"><span className="info-txt">{brl(v.lib)} aprovados</span>{v.pend > 0 && <> · <span className="muted">{brl(v.pend)} em apuração</span></>}</div></div></div>
          ))}
        </section>
      </>)}

      <Erro msg={lista.erro} />
      {filtradas.length === 0 && !lista.carregando ? <Vazio>Nenhuma comissão com esses filtros.</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          <table className="tabela tabela-com">
            <thead><tr>
              {isAdmin && <th><input type="checkbox" checked={filtradas.length > 0 && filtradas.every((c) => sel.has(c.id) || ['paga', 'cancelada'].includes(c.status))} onChange={(e) => setSel(e.target.checked ? new Set(filtradas.filter((c) => !['paga', 'cancelada'].includes(c.status)).map((c) => c.id)) : new Set())} /></th>}
              {isAdmin && <th>Vendedora</th>}<th>Aluno e turma</th><th>Pagar em</th><th>Pagamento do aluno</th><th className="num">Comissão</th><th>Situação</th>
            </tr></thead>
            <tbody>
              {filtradas.map((c) => {
                const mot = motivoPendente(c)
                const sa = SITUACAO_ALUNO[c.situacao_financeira]
                return (
                  <tr key={c.id} className={c.status === 'cancelada' ? 'linha-apagada' : ''}>
                    {isAdmin && <td>{!['paga', 'cancelada'].includes(c.status) && <input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)} />}</td>}
                    {isAdmin && <td className="forte">{c.vendedora_nome ?? '—'}</td>}
                    <td><Link to={`/matricula/${c.matricula_id}`} className="forte link-ouro">{c.aluno_nome}</Link><div className="muted pequeno">{turmaCurta(c.turma_nome)}</div>{c.matricula_status === 'reservada' && <div className="alerta-txt pequeno">Inscrição: só matrícula paga</div>}</td>
                    <td><b>{mesAno(c.mes_pagamento)}</b><div className="muted pequeno">venda {dataBR(c.data_venda)}</div></td>
                    <td><Badge tom={sa?.tom}>{sa?.rotulo}</Badge></td>
                    <td className="num">{brl(c.valor)}<div className="muted pequeno" title={c.regra_texto ?? ''}>{c.ajuste_motivo ? 'ajustada' : ({ fixo: 'fixo', percentual: '%', fixo_percentual: 'fixo + %', progressiva: 'progressiva', manual: 'manual' } as Record<string, string>)[c.calculo] ?? c.calculo}</div></td>
                    <td><Badge tom={STATUS_COMISSAO[c.status]?.tom}>{STATUS_COMISSAO[c.status]?.rotulo}</Badge>
                      {mot && <div className="pequeno motivo">{mot.texto}</div>}
                      {c.status === 'paga' && <div className="muted pequeno">em {dataBR(c.paga_em)}{c.pago_conta && ` · ${c.pago_conta}`} {c.pago_comprovante && <LinkArquivo caminho={c.pago_comprovante}>comprovante</LinkArquivo>}</div>}
                      {c.ajuste_motivo && <div className="muted pequeno">Ajuste: {c.ajuste_motivo}</div>}
                      {c.liberacao_motivo && <div className="muted pequeno">Liberada por exceção: {c.liberacao_motivo}</div>}
                    {isAdmin && <div className="acoes-com">
                      {c.status === 'pendente' && <button className="btn btn-contorno btn-mini" onClick={() => setModal({ tipo: 'liberar', itens: [c] })}>{mot?.excecao ? 'Liberar exceção' : 'Liberar'}</button>}
                      {c.status === 'liberada' && <button className="btn btn-ouro btn-mini" onClick={() => setModal({ tipo: 'pagar', itens: [c] })}>Registrar pagamento</button>}
                      {['pendente', 'liberada'].includes(c.status) && <button className="btn btn-mini" title="Ajustar valor" onClick={() => setModal({ tipo: 'ajustar', itens: [c] })}>Ajustar</button>}
                    </div>}
                    </td>
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
      </>)}
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
      <p className="muted pequeno">Aprovar quer dizer: você conferiu e pode pagar no mês de pagamento. O pagamento em si você registra depois.</p>
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
  const [fixo, setFixo] = useState<number | null>(Number(c.valor))
  const [pct, setPct] = useState<number | null>(0)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const final = (fixo ?? 0) + Math.round(Number(c.valor_fechado) * (pct ?? 0)) / 100
  const salvar = async () => {
    if (motivo.trim().length < 5) return setErro('Escreva o motivo do ajuste (fica registrado).')
    const { error } = await supabase.from('comissoes').update({
      valor: final, calculo: 'manual', percentual: pct || null, ajuste_motivo: motivo.trim(),
      regra_texto: `Ajuste manual: ${partes(fixo ?? 0, pct ?? 0)}`,
    }).eq('id', c.id)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo={`Ajustar comissão — ${c.aluno_nome}`} aberto onFechar={onFechar}>
      <p className="muted pequeno">Hoje: {brl(c.valor)} ({c.regra_texto}). Venda de {brl(c.valor_fechado)}, vendedora {c.vendedora_nome}.</p>
      <div className="form-grade">
        <Campo rotulo="Valor fixo"><InputMoeda valor={fixo} onChange={setFixo} passo={50} /></Campo>
        <Campo rotulo="+ Percentual da venda"><InputPercent valor={pct} onChange={setPct} /></Campo>
      </div>
      <p>Comissão desta venda: <b className="ouro-txt">{brl(final)}</b> <span className="muted pequeno">({partes(fixo ?? 0, pct ?? 0)})</span></p>
      <Campo rotulo="Motivo do ajuste"><textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: venda difícil, autorizei R$ 500" /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar {brl(final)}</button></div>
    </Modal>
  )
}

type Edicao = { id?: string; curso_id: string | null; vigente_desde: string; calculo: 'simples' | 'progressiva'; fixo: number | null; percentual: number | null; faixas: Faixa[] }

function Regras({ regras, cursos, isAdmin, onFechar, onSalvo }: { regras: Regra[]; cursos: { id: string; nome: string }[]; isAdmin: boolean; onFechar: () => void; onSalvo: () => void }) {
  return (
    <Modal titulo="Regras de comissão" aberto onFechar={onFechar} largo>
      <RegrasConteudo regras={regras} cursos={cursos} isAdmin={isAdmin} onSalvo={onSalvo} />
    </Modal>
  )
}

export function RegrasConteudo({ regras, cursos, isAdmin, onSalvo }: { regras: Regra[]; cursos: { id: string; nome: string }[]; isAdmin: boolean; onSalvo: () => void }) {
  const [ed, setEd] = useState<Edicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [verVersoes, setVerVersoes] = useState<string | null>(null)
  const hoje = hojeISO()
  const linhas = [{ curso_id: null as string | null, nome: 'Padrão (todos os cursos)' }, ...cursos.map((c) => ({ curso_id: c.id, nome: c.nome }))]
  const versoesDe = (id: string | null) => regras.filter((r) => r.curso_id === id).sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))
  const padrao = regraAtual(regras, null)
  const abrir = (curso_id: string | null) => {
    const r = regraAtual(regras, curso_id) ?? (curso_id ? padrao : undefined)
    setErro(null)
    setEd({ curso_id, vigente_desde: hoje, calculo: r?.calculo ?? 'simples', fixo: r?.fixo ?? 250, percentual: r?.percentual ?? 0,
      faixas: r?.faixas?.length ? r.faixas : [{ a_partir_de: 1, fixo: r?.fixo ?? 250, percentual: r?.percentual ?? 0 }, { a_partir_de: 4, fixo: 300, percentual: 0 }] })
  }
  const mudaFaixa = (i: number, k: keyof Faixa, v: number | null) => setEd((e) => e && ({ ...e, faixas: e.faixas.map((f, j) => j === i ? { ...f, [k]: v ?? 0 } : f) }))
  const salvar = async () => {
    if (!ed) return
    const fs = [...ed.faixas].sort((a, b) => a.a_partir_de - b.a_partir_de)
    if (!ed.vigente_desde) return setErro('Informe a partir de quando a regra vale.')
    if (ed.calculo === 'progressiva') {
      if (fs[0].a_partir_de !== 1) return setErro('A primeira faixa precisa começar na 1ª venda.')
      if (new Set(fs.map((f) => f.a_partir_de)).size !== fs.length) return setErro('Duas faixas começam na mesma venda.')
    } else if (!(ed.fixo ?? 0) && !(ed.percentual ?? 0)) return setErro('Informe um valor fixo, um percentual ou os dois.')
    const reg = { curso_id: ed.curso_id, vigente_desde: ed.vigente_desde, calculo: ed.calculo, fixo: ed.fixo ?? 0, percentual: ed.percentual ?? 0, faixas: ed.calculo === 'progressiva' ? fs : null }
    const mesmaData = regras.find((r) => r.curso_id === ed.curso_id && r.vigente_desde === ed.vigente_desde)
    const { error } = mesmaData ? await supabase.from('comissao_regra_versoes').update(reg).eq('id', mesmaData.id) : await supabase.from('comissao_regra_versoes').insert(reg)
    if (error) return setErro(msgErro(error))
    setEd(null); onSalvo()
  }
  return (<>
      <ul className="lista-regras">
        <li>A comissão é de quem vendeu e é <b>por matrícula vendida</b>: um aluno que compra duas turmas gera duas comissões.</li>
        <li>Pode ser <b>valor fixo</b>, <b>percentual da venda</b> ou <b>fixo + percentual</b>. Também pode ser <b>progressiva</b>: o valor sobe conforme o número de vendas da vendedora no mês (1ª, 2ª, 3ª venda…).</li>
        <li>Toda regra tem <b>data de início</b>: cada venda usa a regra que valia no dia da venda. Mudar a regra não mexe nas vendas anteriores.</li>
        <li>Nasce <b>em apuração</b> (entra no fechamento do mês seguinte, não é atraso), fica <b>aprovada para pagar</b> quando a inscrição está confirmada e você confere, e é <b>paga no mês seguinte à venda</b>. Valor único por matrícula, mesmo que o aluno pague parcelado.</li>
        <li>O administrador pode liberar antes (exceção) ou ajustar uma comissão específica. Os dois pedem motivo e ficam no histórico.</li>
      </ul>
      <h3>Valores por curso</h3>
      <table className="tabela compacta">
        <thead><tr><th>Curso</th><th>Regra valendo hoje</th><th>Desde</th>{isAdmin && <th></th>}</tr></thead>
        <tbody>
          {linhas.map((l) => {
            const r = regraAtual(regras, l.curso_id)
            const vs = versoesDe(l.curso_id)
            const futura = vs.find((v) => v.vigente_desde > hoje)
            const chave = l.curso_id ?? 'padrao'
            return (<Fragment key={chave}>
              <tr>
                <td className="forte">{l.nome}</td>
                <td>{l.curso_id && !r ? <span className="muted">segue o padrão</span> : descreverRegra(r)}{futura && <div className="alerta-txt pequeno">Muda em {dataBR(futura.vigente_desde)}: {descreverRegra(futura)}</div>}</td>
                <td className="pequeno">{r ? (r.vigente_desde <= '2020-01-01' ? 'início' : dataBR(r.vigente_desde)) : '—'}{vs.length > 1 && <> · <button className="link pequeno" onClick={() => setVerVersoes(verVersoes === chave ? null : chave)}>{vs.length} versões</button></>}</td>
                {isAdmin && <td className="direita"><button className="btn btn-mini" onClick={() => abrir(l.curso_id)}>{vs.length ? 'Mudar regra' : 'Criar regra própria'}</button></td>}
              </tr>
              {verVersoes === chave && vs.map((v) => (
                <tr key={v.id} className="linha-versao"><td className="muted pequeno">↳ versão</td><td className="pequeno">{descreverRegra(v)}</td><td className="pequeno">{v.vigente_desde <= '2020-01-01' ? 'início' : `desde ${dataBR(v.vigente_desde)}`}</td>{isAdmin && <td />}</tr>
              ))}
            </Fragment>)
          })}
        </tbody>
      </table>
      {isAdmin && <p className="muted pequeno">Comissões em apuração e aprovadas de vendas a partir da data da regra são recalculadas, menos as que tiveram ajuste manual. Comissões pagas não mudam.</p>}
      {ed && (
        <div className="bloco editor-regra">
          <h3>{ed.curso_id ? cursos.find((c) => c.id === ed.curso_id)?.nome : 'Regra padrão'}</h3>
          <div className="form-grade">
            <Campo rotulo="Vale para vendas a partir de" dica="As vendas antes dessa data continuam com a regra anterior."><input type="date" value={ed.vigente_desde} onChange={(e) => setEd({ ...ed, vigente_desde: e.target.value })} /></Campo>
          </div>
          <div className="alternar" style={{ marginBottom: 14 }}>
            <button className={ed.calculo === 'simples' ? 'ativo' : ''} onClick={() => setEd({ ...ed, calculo: 'simples' })}>Fixo e/ou percentual</button>
            <button className={ed.calculo === 'progressiva' ? 'ativo' : ''} onClick={() => setEd({ ...ed, calculo: 'progressiva' })}>Tabela progressiva</button>
          </div>
          {ed.calculo === 'simples' ? (<>
            <div className="form-grade">
              <Campo rotulo="Valor fixo por matrícula" dica="Deixe 0 para só percentual"><InputMoeda valor={ed.fixo} onChange={(v) => setEd({ ...ed, fixo: v })} passo={50} /></Campo>
              <Campo rotulo="+ Percentual da venda" dica="Deixe 0 para só valor fixo"><InputPercent valor={ed.percentual} onChange={(v) => setEd({ ...ed, percentual: v })} /></Campo>
            </div>
            <p className="pequeno">Exemplo numa venda de R$ 9.800,00: <b className="ouro-txt">{brl((ed.fixo ?? 0) + 9800 * (ed.percentual ?? 0) / 100)}</b></p>
          </>) : (<>
            <p className="muted pequeno">Cada linha vale a partir da venda indicada, contando as vendas da vendedora no mês. Exemplo: 1ª a 3ª venda R$ 250; da 4ª em diante R$ 300 + 1%.</p>
            <table className="tabela compacta tabela-faixas">
              <thead><tr><th>A partir da</th><th>Valor fixo</th><th>+ Percentual</th><th></th></tr></thead>
              <tbody>
                {ed.faixas.map((f, i) => (
                  <tr key={i}>
                    <td>{i === 0 ? <b>1ª venda</b> : <InputNumero valor={f.a_partir_de} min={2} max={60} sufixo="ª venda" onChange={(v) => mudaFaixa(i, 'a_partir_de', v)} />}</td>
                    <td><InputMoeda valor={f.fixo} onChange={(v) => mudaFaixa(i, 'fixo', v)} passo={50} /></td>
                    <td><InputPercent valor={f.percentual} onChange={(v) => mudaFaixa(i, 'percentual', v)} /></td>
                    <td>{i > 0 && <button className="btn btn-mini" onClick={() => setEd({ ...ed, faixas: ed.faixas.filter((_, j) => j !== i) })}>Remover</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-mini" onClick={() => setEd({ ...ed, faixas: [...ed.faixas, { a_partir_de: Math.max(...ed.faixas.map((f) => f.a_partir_de)) + 3, fixo: 0, percentual: 0 }] })}><Icone nome="mais" tam={14} /> Adicionar faixa</button>
          </>)}
          <Erro msg={erro} />
          <div className="modal-acoes"><button className="btn" onClick={() => setEd(null)}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar regra</button></div>
        </div>
      )}
      {!isAdmin && <p className="muted pequeno">Dúvidas sobre a sua comissão: fale com o administrador.</p>}
  </>)
}
