// CRM — NÚCLEO: modelos aprovados pela Meta (API oficial). Escolher e preencher um modelo para enviar (conversa fora
// da janela de 24 h ou conversa nova) e, para o administrador, puxar os modelos da conta e mandar novos para aprovação.
import { useState } from 'react'
import { Badge, Campo, Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { primeiroNome } from '../nucleo'
import { servidorWhats, type BaseCRM, type ModeloMeta } from '../tipos'
import { preencherModelo, variaveisDe } from './util'

const STATUS: Record<string, { r: string; tom: string }> = { APPROVED: { r: 'Aprovado', tom: 'ok' }, PENDING: { r: 'Em análise', tom: 'alerta' }, REJECTED: { r: 'Recusado', tom: 'erro' }, PAUSED: { r: 'Pausado', tom: 'alerta' }, DISABLED: { r: 'Desativado', tom: 'erro' } }
export type EnvioModelo = { nome: string; idioma: string; parametros: string[] }

/** Escolher um modelo aprovado e preencher as variáveis. {{1}} começa com o primeiro nome da pessoa. */
export function EscolherModelo({ modelos, nomeContato, enviando, aoEnviar, aoCancelar }: {
  modelos: ModeloMeta[]; nomeContato?: string | null; enviando: boolean; aoEnviar: (m: EnvioModelo) => void; aoCancelar?: () => void
}) {
  const aprovados = modelos.filter((m) => m.status === 'APPROVED')
  const [sel, setSel] = useState<ModeloMeta | null>(aprovados.length === 1 ? aprovados[0] : null)
  const [params, setParams] = useState<string[]>(() => [primeiroNome(nomeContato)])
  if (!aprovados.length) return <p className="nota pequeno">Nenhum modelo aprovado neste número ainda. O administrador cria em Configurações → Modelos da Meta.</p>
  const vars = sel ? variaveisDe(sel.corpo) : []
  const falta = vars.some((n) => !params[n - 1]?.trim())
  return (
    <div className="mo-escolher">
      <select value={sel?.id ?? ''} onChange={(e) => setSel(aprovados.find((m) => m.id === e.target.value) ?? null)} aria-label="Modelo">
        <option value="">Escolha o modelo…</option>{aprovados.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      {sel && <>
        {vars.map((n) => <label key={n} className="campo"><span className="campo-rotulo">Variável {`{{${n}}}`}</span>
          <input value={params[n - 1] ?? ''} onChange={(e) => { const p = [...params]; p[n - 1] = e.target.value; setParams(p) }} /></label>)}
        <div className="rp-texto pequeno">{preencherModelo(sel.corpo, params)}</div>
      </>}
      <div className="rp-acoes">
        {aoCancelar && <button className="btn" onClick={aoCancelar}>Cancelar</button>}
        <button className="btn btn-ouro" disabled={!sel || falta || enviando} onClick={() => sel && aoEnviar({ nome: sel.nome, idioma: sel.idioma, parametros: vars.map((n) => params[n - 1] ?? '') })}>
          <Icone nome="enviar" tam={15} /> {enviando ? 'Enviando…' : 'Enviar modelo'}</button>
      </div>
    </div>
  )
}

/** Configurações → Modelos da Meta (administrador). */
export function ConfigModelos({ base }: { base: BaseCRM }) {
  const oficiais = base.canais.filter((k) => k.tipo === 'whatsapp_oficial')
  const [canal, setCanal] = useState(oficiais[0]?.id ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState({ nome: '', categoria: 'UTILITY', corpo: 'Olá, {{1}}! ', exemplo: ['Maria'] as string[] })
  const [ocupado, setOcupado] = useState(false)
  if (!oficiais.length) return <p className="muted">Modelos só existem em números da API oficial da Meta.</p>
  const lista = base.modelos.filter((m) => m.canal_id === canal)
  const vars = variaveisDe(novo.corpo)
  const chamar = async (corpo: Record<string, unknown>, ok: (r: Record<string, unknown>) => string) => {
    setOcupado(true); setErro(null); setMsg(null)
    try { const r = await servidorWhats(corpo); setMsg(ok(r)); base.recarregar() } catch (e) { setErro((e as Error).message) }
    setOcupado(false)
  }
  return (
    <div className="mo-config">
      <p className="muted pequeno">Pela API oficial, a primeira mensagem para alguém (ou depois de 24 h sem a pessoa escrever) precisa ser um modelo aprovado pela Meta. Use {'{{1}}'}, {'{{2}}'}… no lugar do que muda (o {'{{1}}'} costuma ser o primeiro nome). A aprovação leva de minutos a 1 dia.</p>
      <div className="linha-acoes">
        {oficiais.length > 1 && <select value={canal} onChange={(e) => setCanal(e.target.value)}>{oficiais.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}</select>}
        <button className="btn btn-contorno" disabled={ocupado} onClick={() => chamar({ acao: 'modelos_sincronizar', canal_id: canal }, (r) => `${r.modelos} modelo(s) atualizados da Meta.`)}><Icone nome="atualizar" tam={15} /> Atualizar da Meta</button>
      </div>
      <ul className="mo-lista">
        {lista.length === 0 && <li className="muted pequeno">Nenhum modelo ainda. Clique em "Atualizar da Meta" ou crie um abaixo.</li>}
        {lista.map((m) => <li key={m.id}><div><b>{m.nome}</b> <Badge tom={STATUS[m.status]?.tom}>{STATUS[m.status]?.r ?? m.status}</Badge> <span className="muted pequeno">{m.categoria === 'MARKETING' ? 'Marketing' : m.categoria === 'UTILITY' ? 'Utilidade' : m.categoria}</span></div>
          <p className="pequeno">{m.corpo}</p>{m.motivo && <p className="erro-txt pequeno">Motivo da recusa: {m.motivo}</p>}</li>)}
      </ul>
      <h3>Novo modelo</h3>
      <div className="form-grade">
        <Campo rotulo="Nome (só letras, números e _)"><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="lembrete_pagamento" /></Campo>
        <Campo rotulo="Categoria" dica="Utilidade: sobre algo que a pessoa já tem (pagamento, matrícula). Marketing: oferta e novidade (mais caro).">
          <select value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })}><option value="UTILITY">Utilidade</option><option value="MARKETING">Marketing</option></select></Campo>
      </div>
      <Campo rotulo="Texto"><textarea rows={5} value={novo.corpo} onChange={(e) => setNovo({ ...novo, corpo: e.target.value })} /></Campo>
      {vars.map((n) => <Campo key={n} rotulo={`Exemplo para {{${n}}}`}><input value={novo.exemplo[n - 1] ?? ''} onChange={(e) => { const x = [...novo.exemplo]; x[n - 1] = e.target.value; setNovo({ ...novo, exemplo: x }) }} /></Campo>)}
      <button className="btn btn-ouro" disabled={ocupado || !novo.nome.trim() || !novo.corpo.trim()} onClick={() => chamar({ acao: 'modelo_criar', canal_id: canal, ...novo, exemplo: vars.map((n) => novo.exemplo[n - 1] ?? '') }, (r) => `Modelo "${r.nome}" enviado para a Meta (${STATUS[String(r.status)]?.r ?? r.status}).`)}>Enviar para aprovação</button>
      {msg && <p className="ok-txt pequeno">{msg}</p>}
      <Erro msg={erro} />
    </div>
  )
}
