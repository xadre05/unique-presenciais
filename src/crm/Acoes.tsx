// CRM — NÚCLEO: próxima ação do contato (tarefas), follow-up automático e resultado (comprou / perdido com motivo).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Erro } from '../components/ui'
import { TIPO_TAREFA } from './MinhaFila'
import { horaCurta, type BaseCRM } from './tipos'

type Tarefa = { id: string; titulo: string; tipo: string; vence_em: string; responsavel_id: string | null; origem: string }
type Inscricao = { id: string; cadencia_id: string; passo: number; proximo_em: string; status: string }
type Estado = { ganho_em: string | null; perdido_em: string | null; motivo_perda: string | null; empresa_id: string }

const paraInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export default function ProximasAcoes({ contatoId, base }: { contatoId: string; base: BaseCRM }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [insc, setInsc] = useState<Inscricao[]>([])
  const [est, setEst] = useState<Estado | null>(null)
  const [titulo, setTitulo] = useState('')
  const [quando, setQuando] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return paraInput(d) })
  const [cad, setCad] = useState('')
  const [perder, setPerder] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [t, i, c] = await Promise.all([
      supabase.from('crm_tarefas').select('id,titulo,tipo,vence_em,responsavel_id,origem').eq('contato_id', contatoId).is('feita_em', null).is('cancelada_em', null).order('vence_em'),
      supabase.from('crm_cadencia_inscricoes').select('id,cadencia_id,passo,proximo_em,status').eq('contato_id', contatoId).eq('status', 'ativa'),
      supabase.from('crm_contatos').select('ganho_em,perdido_em,motivo_perda,empresa_id').eq('id', contatoId).single(),
    ])
    setTarefas((t.data as Tarefa[]) ?? []); setInsc((i.data as Inscricao[]) ?? []); setEst(c.data as Estado)
  }, [contatoId])
  useEffect(() => { carregar() }, [carregar])

  const nova = async () => {
    if (!titulo.trim() || !est) return
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('crm_tarefas').insert({ empresa_id: est.empresa_id, contato_id: contatoId, responsavel_id: u.user?.id, titulo: titulo.trim(), tipo: 'retorno', vence_em: new Date(quando).toISOString() })
    if (error) return setErro(error.message)
    setTitulo(''); carregar()
  }
  const feita = async (id: string) => {
    const { data: u } = await supabase.auth.getUser()
    await supabase.from('crm_tarefas').update({ feita_em: new Date().toISOString(), feita_por: u.user?.id }).eq('id', id); carregar()
  }
  const seguir = async () => {
    if (!cad) return
    const { error } = await supabase.rpc('crm_seguir', { p_cadencia: cad, p_contato: contatoId })
    if (error) return setErro(error.message)
    setCad(''); carregar()
  }
  const resultado = async (r: 'ganho' | 'perdido') => {
    const { error } = await supabase.rpc('crm_marcar_resultado', { p_contato: contatoId, p_resultado: r, p_motivo: r === 'perdido' ? motivo : null })
    if (error) return setErro(error.message)
    setPerder(false); setMotivo(''); carregar()
  }
  const nomeCad = (id: string) => base.cadencias.find((c) => c.id === id)?.nome ?? 'Follow-up'

  return (
    <div className="acoes-contato">
      <h3>Próxima ação</h3>
      {est?.ganho_em && <div><Badge tom="ok">Comprou</Badge> <span className="muted pequeno">{horaCurta(est.ganho_em)}</span></div>}
      {est?.perdido_em && <div><Badge tom="apagado">Perdido</Badge> <span className="muted pequeno">{est.motivo_perda}</span></div>}
      {tarefas.length === 0 && insc.length === 0 && !est?.ganho_em && !est?.perdido_em && <div className="aviso-txt pequeno">Sem próxima ação. Marque o que fazer depois.</div>}
      {tarefas.map((t) => (
        <div key={t.id} className="tarefa-linha">
          <button className="check-redondo" onClick={() => feita(t.id)} title="Marcar como feita" aria-label="Feita" />
          <div><div className="pequeno">{t.titulo}</div><div className="muted pequeno">{TIPO_TAREFA[t.tipo]?.rotulo} · {horaCurta(t.vence_em)}{t.responsavel_id ? ` · ${base.nomeDe(t.responsavel_id)}` : ' · fila'}</div></div>
        </div>
      ))}
      {insc.map((i) => <div key={i.id} className="muted pequeno">🔁 {nomeCad(i.cadencia_id)} · passo {i.passo + 1} em {horaCurta(i.proximo_em)}</div>)}

      <div className="nova-tarefa">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Retornar com o valor da turma" />
        <div className="nova-tarefa-linha">
          <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          <button className="btn btn-mini" onClick={nova} disabled={!titulo.trim()}>Agendar</button>
        </div>
      </div>
      {base.cadencias.some((c) => c.ativa) && (
        <div className="nova-tarefa-linha">
          <select value={cad} onChange={(e) => setCad(e.target.value)}><option value="">Seguir com follow-up…</option>{base.cadencias.filter((c) => c.ativa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <button className="btn btn-mini" onClick={seguir} disabled={!cad}>Começar</button>
        </div>
      )}
      {!est?.ganho_em && !est?.perdido_em && (perder ? (
        <div className="nova-tarefa-linha">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus><option value="">Motivo da perda…</option>{base.motivos.map((m) => <option key={m}>{m}</option>)}</select>
          <button className="btn btn-mini" onClick={() => resultado('perdido')} disabled={!motivo}>Confirmar</button>
          <button className="link pequeno" onClick={() => setPerder(false)}>voltar</button>
        </div>
      ) : (
        <div className="nova-tarefa-linha">
          <button className="btn btn-mini" onClick={() => resultado('ganho')}>✓ Comprou</button>
          <button className="btn btn-mini" onClick={() => setPerder(true)}>Perdido</button>
        </div>
      ))}
      <Erro msg={erro} />
    </div>
  )
}
