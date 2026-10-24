// CRM — NÚCLEO: "Minha fila agora". Uma lista em ordem fixa do que fazer:
// 1) quem respondeu e espera você, 2) tarefas de hoje e atrasadas (recuperação primeiro).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { linkWhats, telefoneLegivel } from './nucleo'
import { horaCurta, type BaseCRM } from './tipos'
import { Avatar, KpiAt, interesseDe } from './Pecas'

type Esperando = { conversa_id: string; contato_id: string; nome: string | null; telefone: string | null; ultima_mensagem: string | null; ultima_em: string; novo: boolean }
type Tarefa = { id: string; contato_id: string; nome: string | null; telefone: string | null; titulo: string; tipo: string; vence_em: string; nota: string | null; origem: string; atrasada: boolean; conversa_id: string | null }
type Fila = { esperando: Esperando[]; fila: number; tarefas: Tarefa[]; sem_proxima_acao: number; numeros: { conversas_hoje: number; tarefas_feitas_hoje: number; ganhos_mes: number } }

export const TIPO_TAREFA: Record<string, { rotulo: string; tom: string }> = {
  recuperacao: { rotulo: 'Recuperação', tom: 'erro' }, contato: { rotulo: 'Contato', tom: 'info' }, retorno: { rotulo: 'Retorno', tom: 'ouro' },
  follow_up: { rotulo: 'Follow-up', tom: 'neutro' }, outro: { rotulo: 'Outro', tom: 'neutro' },
}

const minutosDesde = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
const espera = (iso: string) => { const m = minutosDesde(iso); return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} dia(s)` }
const amanha9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString() }

function agruparPorContato(lista: Tarefa[]) {
  const porContato = new Map<string, Tarefa[]>()
  for (const t of lista) porContato.set(t.contato_id, [...(porContato.get(t.contato_id) ?? []), t])
  return [...porContato.values()].map((ts) => {
    const ordem = [...ts].sort((a, b) => b.vence_em.localeCompare(a.vence_em))
    return { principal: ordem[0], antigas: ordem.slice(1) }
  })
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function MinhaFila({ empresaId, usuarioId, base, abrirConversa, abrirAba, prazoMin = 5, quemInicial }: {
  empresaId: string; usuarioId: string; base: BaseCRM; abrirConversa: (conversaId: string) => void; abrirAba?: (aba: string) => void; prazoMin?: number; quemInicial?: string | null
}) {
  const [quem, setQuem] = useState(quemInicial || usuarioId)
  const [detalhe, setDetalhe] = useState<Record<string, string | null>>({})
  const [f, setF] = useState<Fila | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ meta: number | null } | null>(null)
  useEffect(() => {
    if (quem === usuarioId) supabase.rpc('crm_minha_meta', { p_empresa: empresaId }).then(({ data }) => setMeta(data as { meta: number | null }))
    else supabase.rpc('crm_metas', { p_empresa: empresaId }).then(({ data }) => setMeta(((data ?? []) as { usuario_id: string; meta: number | null }[]).find((x) => x.usuario_id === quem) ?? null))
  }, [empresaId, quem, usuarioId])
  const eu = base.equipe.find((m) => m.usuario_id === quem)
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('crm_minha_fila', { p_empresa: empresaId, p_usuario: quem })
    if (error) return setErro(error.message)
    setErro(null); setF(data as Fila)
    // curso/assunto de interesse de cada pessoa da lista
    const fila = data as Fila
    const ids = [...new Set([...fila.esperando.map((e) => e.contato_id), ...fila.tarefas.map((t) => t.contato_id)])]
    if (ids.length) {
      const { data: cs } = await supabase.from('crm_contatos').select('id,tags,origem').in('id', ids)
      setDetalhe(Object.fromEntries(((cs ?? []) as { id: string; tags: string[]; origem: string | null }[]).map((c) => [c.id, interesseDe(c.tags, c.origem)])))
    }
  }, [empresaId, quem])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30000)
    const ch = supabase.channel(`fila-${empresaId}-${quem}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversas', filter: `empresa_id=eq.${empresaId}` }, () => carregar())
      .subscribe()
    return () => { clearInterval(t); supabase.removeChannel(ch) }
  }, [carregar, empresaId, quem])

  const tarefa = async (id: string | string[], campos: Record<string, unknown>) => {
    const { error } = await supabase.from('crm_tarefas').update(campos).in('id', Array.isArray(id) ? id : [id])
    if (error) setErro(error.message); else carregar()
  }
  const disponivel = async (v: boolean) => { await supabase.rpc('crm_minha_disponibilidade', { p_empresa: empresaId, p_disponivel: v, p_usuario: quem }); base.recarregar() }

  // uma linha por pessoa: a cadência cria uma tarefa por dia (dia 1, 2, 3); vale a mais recente, as antigas ficam juntas
  const grupos = agruparPorContato(f?.tarefas ?? [])
  const tarefas = [...grupos.map((g) => g.principal)].sort((a, b) => Number(b.tipo === 'recuperacao') - Number(a.tipo === 'recuperacao') || Number(b.atrasada) - Number(a.atrasada) || a.vence_em.localeCompare(b.vence_em))
  const nada = f && f.esperando.length === 0 && tarefas.length === 0
  const atrasadas = tarefas.filter((t) => t.atrasada).length
  return (
    <div className="pagina at-pagina">
      <header className="pagina-topo at-titulo-pagina">
        <div><h1>Minha fila agora</h1><p className="muted">Faça de cima para baixo: primeiro quem está esperando você, depois as tarefas de hoje.</p></div>
      </header>
      <div className="at-filtros-linha">
        {base.souAdmin && (
          <select value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Fila de quem">
            {base.equipe.filter((m) => m.ativo).map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.usuario_id === usuarioId ? 'Minha fila' : `Fila de ${m.nome}`}</option>)}
          </select>
        )}
        {eu && <label className={`interruptor${eu.disponivel ? ' ligado' : ''}`}><input type="checkbox" checked={eu.disponivel} onChange={(e) => disponivel(e.target.checked)} />{eu.disponivel ? 'Disponível: recebendo leads' : 'Ausente: fora do rodízio'}</label>}
      </div>

      {f && <section className="at-kpis">
        <KpiAt icone="whats" rotulo="Esperando você" valor={f.esperando.length} tom={f.esperando.length ? 'erro' : undefined} sub="conversas aguardando resposta" />
        <KpiAt icone="lista" rotulo="Tarefas de hoje" valor={tarefas.length} tom="ouro" sub={`${atrasadas} atrasada(s)`} />
        <KpiAt icone="whats" rotulo="Conversas hoje" valor={f.numeros.conversas_hoje} tom="info" sub={`${f.numeros.tarefas_feitas_hoje} tarefa(s) feita(s)`} />
        <KpiAt icone="comissoes" rotulo="Vendas no mês" tom="ok" valor={<>{f.numeros.ganhos_mes}{meta?.meta ? <span className="muted at-kpi-meta"> / {meta.meta}</span> : null}</>}
          sub={meta?.meta ? (f.numeros.ganhos_mes >= meta.meta ? 'Meta batida!' : `faltam ${meta.meta - f.numeros.ganhos_mes} para a meta`) : `${f.numeros.ganhos_mes} venda(s) realizada(s)`}
          extra={meta?.meta ? <div className="barra-meta"><div style={{ width: `${Math.min(100, (100 * f.numeros.ganhos_mes) / meta.meta)}%` }} /></div> : null} />
      </section>}
      {f && f.sem_proxima_acao > 0 && <div className="at-faixa"><Icone nome="alerta" tam={20} /><span><b>{f.sem_proxima_acao} conversa(s) sem próxima ação.</b> Abra e marque o que fazer depois (tarefa com data), ou marque como comprou/perdido.</span>
        {abrirAba && <button className="btn btn-contorno-ouro btn-mini" onClick={() => abrirAba('minhas')}>Revisar <Icone nome="seta_dir" tam={15} /></button>}</div>}
      {f && f.fila > 0 && <div className="faixa-info"><Icone nome="info" tam={18} /><span>{f.fila} conversa(s) sem dona na Fila. <button className="link" onClick={() => abrirConversa('')}>Ver a fila</button></span></div>}
      <Erro msg={erro} />

      {nada && <Vazio>Nada para agora. 👏 Quando alguém responder ou uma tarefa vencer, aparece aqui.</Vazio>}

      {f && !nada && (
        <div className="at-duas">
          <section className="at-painel">
            <div className="at-painel-topo"><Icone nome="whats" tam={22} /><h2>Esperando sua resposta <span className="muted">({f.esperando.length})</span></h2><span className="muted pequeno">Mais tempo esperando primeiro</span></div>
            {f.esperando.length === 0 ? <p className="muted pequeno">Ninguém esperando você agora.</p> : (
              <div className="at-lista">
                {f.esperando.map((e) => {
                  const fora = minutosDesde(e.ultima_em) > prazoMin
                  return (
                    <div key={e.conversa_id} className={`at-espera${fora ? ' fora-prazo' : ''}`}>
                      <Avatar nome={e.nome} />
                      <div className="at-espera-quem"><b>{e.nome || telefoneLegivel(e.telefone)}</b><span className="muted pequeno">{e.novo ? 'Lead novo' : detalhe[e.contato_id] ? `Interesse: ${detalhe[e.contato_id]}` : telefoneLegivel(e.telefone)}</span></div>
                      <div className="at-espera-msg"><span>“{e.ultima_mensagem}”</span><span className={fora ? 'erro-txt' : 'alerta-txt'}><Icone nome="relogio" tam={14} /> esperando há {espera(e.ultima_em)}{fora ? ` · passou do prazo de ${prazoMin} min` : ''}</span></div>
                      <button className="btn btn-ouro" onClick={() => abrirConversa(e.conversa_id)}>Abrir conversa <Icone nome="seta_dir" tam={15} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="at-painel">
            <div className="at-painel-topo"><Icone nome="agenda" tam={22} /><h2>Próximas ações de hoje <span className="muted">({tarefas.length})</span></h2><span className="muted pequeno">Recuperação e atrasadas primeiro</span></div>
            {tarefas.length === 0 ? <p className="muted pequeno">Nenhuma tarefa para hoje.</p> : (
              <div className="at-lista">
                {tarefas.map((t) => {
                  const tt = TIPO_TAREFA[t.tipo] ?? TIPO_TAREFA.outro
                  const antigas = grupos.find((g) => g.principal.id === t.id)?.antigas ?? []
                  const wa = linkWhats(t.telefone)
                  return (
                    <div key={t.id} className={`at-tarefa${t.atrasada ? ' atrasada' : ''}`}>
                      <div className="at-tarefa-hora"><b>{hora(t.vence_em)}</b>{t.atrasada && <span className="erro-txt pequeno">atrasada</span>}</div>
                      <div className="at-tarefa-corpo">
                        <b>{t.nome || telefoneLegivel(t.telefone)}</b>
                        {detalhe[t.contato_id] && <span className="muted pequeno">Interesse: {detalhe[t.contato_id]}</span>}
                        <span className="pequeno"><Icone nome="whats" tam={13} /> {t.titulo} <span className={`at-tipo tipo-${tt.tom}`}>{tt.rotulo}</span></span>
                        {t.nota && <span className="muted pequeno">{t.nota}</span>}
                        {antigas.length > 0 && <span className="muted pequeno">+ {antigas.length} tarefa(s) anterior(es) desta pessoa: {antigas.map((a) => a.titulo.split(':')[0]).join(' · ')}</span>}
                        <span className="at-tarefa-mini">
                          <button className="link pequeno" onClick={() => tarefa([t.id, ...antigas.map((a) => a.id)], { feita_em: new Date().toISOString(), feita_por: usuarioId })}>✓ Feito{antigas.length ? ` (fecha as ${antigas.length + 1})` : ''}</button>
                          <button className="link pequeno" onClick={() => tarefa(t.id, { vence_em: amanha9() })}>Amanhã</button>
                          <span className="muted pequeno">{horaCurta(t.vence_em)}</span>
                        </span>
                      </div>
                      {t.conversa_id ? <button className="btn btn-contorno-ouro btn-mini" onClick={() => abrirConversa(t.conversa_id!)}>Abrir conversa <Icone nome="seta_dir" tam={14} /></button>
                        : wa && <a className="btn btn-contorno-ouro btn-mini" href={wa} target="_blank" rel="noreferrer"><Icone nome="whats" tam={14} /> WhatsApp</a>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
