// CRM — NÚCLEO: "Minha fila agora". Uma lista em ordem fixa do que fazer:
// 1) quem respondeu e espera você, 2) tarefas de hoje e atrasadas (recuperação primeiro).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { linkWhats, telefoneLegivel } from './nucleo'
import { horaCurta, type BaseCRM } from './tipos'

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

export default function MinhaFila({ empresaId, usuarioId, base, abrirConversa, prazoMin = 5 }: {
  empresaId: string; usuarioId: string; base: BaseCRM; abrirConversa: (conversaId: string) => void; prazoMin?: number
}) {
  const [quem, setQuem] = useState(usuarioId)
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
    if (error) setErro(error.message); else { setErro(null); setF(data as Fila) }
  }, [empresaId, quem])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30000)
    const ch = supabase.channel(`fila-${empresaId}-${quem}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversas', filter: `empresa_id=eq.${empresaId}` }, () => carregar())
      .subscribe()
    return () => { clearInterval(t); supabase.removeChannel(ch) }
  }, [carregar, empresaId, quem])

  const tarefa = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from('crm_tarefas').update(campos).eq('id', id)
    if (error) setErro(error.message); else carregar()
  }
  const disponivel = async (v: boolean) => { await supabase.rpc('crm_minha_disponibilidade', { p_empresa: empresaId, p_disponivel: v, p_usuario: quem }); base.recarregar() }

  const tarefas = [...(f?.tarefas ?? [])].sort((a, b) => Number(b.tipo === 'recuperacao') - Number(a.tipo === 'recuperacao') || Number(b.atrasada) - Number(a.atrasada) || a.vence_em.localeCompare(b.vence_em))
  const nada = f && f.esperando.length === 0 && tarefas.length === 0
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Minha fila agora</h1><p className="muted">Faça de cima para baixo: primeiro quem está esperando você, depois as tarefas de hoje.</p></div>
        <div className="acoes">
          {base.souAdmin && (
            <select value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Fila de quem">
              {base.equipe.filter((m) => m.ativo).map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.usuario_id === usuarioId ? 'Minha fila' : `Fila de ${m.nome}`}</option>)}
            </select>
          )}
          {eu && <label className={`interruptor${eu.disponivel ? ' ligado' : ''}`}><input type="checkbox" checked={eu.disponivel} onChange={(e) => disponivel(e.target.checked)} />{eu.disponivel ? 'Disponível: recebendo leads' : 'Ausente: fora do rodízio'}</label>}
        </div>
      </header>

      {f && <section className="kpis">
        <div className="kpi"><div className="kpi-rotulo">Esperando você</div><div className={`kpi-valor${f.esperando.length ? ' erro-txt' : ''}`}>{f.esperando.length}</div></div>
        <div className="kpi"><div className="kpi-rotulo">Tarefas de hoje</div><div className="kpi-valor">{tarefas.length}</div><div className="kpi-sub">{tarefas.filter((t) => t.atrasada).length} atrasada(s)</div></div>
        <div className="kpi"><div className="kpi-rotulo">Conversas hoje</div><div className="kpi-valor">{f.numeros.conversas_hoje}</div><div className="kpi-sub">{f.numeros.tarefas_feitas_hoje} tarefa(s) feita(s)</div></div>
        <div className="kpi"><div className="kpi-rotulo">Vendas no mês</div><div className="kpi-valor ok-txt">{f.numeros.ganhos_mes}{meta?.meta ? <span className="muted"> / {meta.meta}</span> : null}</div>
          {meta?.meta ? <><div className="barra-meta"><div style={{ width: `${Math.min(100, (100 * f.numeros.ganhos_mes) / meta.meta)}%` }} /></div><div className="kpi-sub">{f.numeros.ganhos_mes >= meta.meta ? 'Meta batida!' : `faltam ${meta.meta - f.numeros.ganhos_mes} para a meta`}</div></> : null}</div>
      </section>}
      {f && f.sem_proxima_acao > 0 && <div className="faixa-alerta"><Icone nome="alerta" tam={18} /><span><b>{f.sem_proxima_acao} conversa(s) sem próxima ação.</b> Abra e marque o que fazer depois (tarefa com data), ou marque como comprou/perdido.</span></div>}
      {f && f.fila > 0 && <div className="faixa-info"><Icone nome="info" tam={18} /><span>{f.fila} conversa(s) sem dona na Fila. <button className="link" onClick={() => abrirConversa('')}>Ver a fila</button></span></div>}
      <Erro msg={erro} />

      {nada && <Vazio>Nada para agora. 👏 Quando alguém responder ou uma tarefa vencer, aparece aqui.</Vazio>}

      {f && f.esperando.length > 0 && (<>
        <h2 className="titulo-secao">1. Esperando você responder</h2>
        <div className="itens-lista">
          {f.esperando.map((e) => {
            const fora = minutosDesde(e.ultima_em) > prazoMin
            return (
              <button key={e.conversa_id} className={`item-fila${fora ? ' fora-prazo' : ''}`} onClick={() => abrirConversa(e.conversa_id)}>
                <div className="il-topo"><b>{e.nome || telefoneLegivel(e.telefone)}</b>{e.novo ? <Badge tom="ouro">Lead novo</Badge> : <Badge>Respondeu</Badge>}</div>
                <div className="pequeno muted">“{e.ultima_mensagem}”</div>
                <div className={`pequeno ${fora ? 'erro-txt' : 'muted'}`}><Icone nome="relogio" tam={13} /> esperando há {espera(e.ultima_em)}{fora ? ` · passou do prazo de ${prazoMin} min` : ''}</div>
              </button>
            )
          })}
        </div>
      </>)}

      {tarefas.length > 0 && (<>
        <h2 className="titulo-secao">2. Tarefas de hoje</h2>
        <div className="itens-lista">
          {tarefas.map((t) => {
            const tt = TIPO_TAREFA[t.tipo] ?? TIPO_TAREFA.outro
            const wa = linkWhats(t.telefone)
            return (
              <div key={t.id} className={`item-lista${t.atrasada ? ' atrasada' : ''}`}>
                <div className="il-topo">
                  <div><b>{t.titulo}</b><div className="pequeno">{t.nome || 'Sem nome'} · {telefoneLegivel(t.telefone)}</div></div>
                  <div className="direita"><Badge tom={tt.tom}>{tt.rotulo}</Badge><div className={`pequeno ${t.atrasada ? 'erro-txt' : 'muted'}`}>{t.atrasada ? 'atrasada · ' : ''}{horaCurta(t.vence_em)}</div></div>
                </div>
                {t.nota && <div className="pequeno muted">{t.nota}</div>}
                <div className="il-acoes">
                  {t.conversa_id ? <button className="btn btn-ouro btn-mini" onClick={() => abrirConversa(t.conversa_id!)}><Icone nome="whats" tam={15} /> Abrir conversa</button>
                    : wa && <a className="btn btn-ouro btn-mini" href={wa} target="_blank" rel="noreferrer"><Icone nome="whats" tam={15} /> WhatsApp</a>}
                  <button className="btn btn-mini" onClick={() => tarefa(t.id, { feita_em: new Date().toISOString(), feita_por: usuarioId })}><Icone nome="check" tam={15} /> Feito</button>
                  <button className="btn btn-mini" onClick={() => tarefa(t.id, { vence_em: amanha9() })}>Amanhã</button>
                </div>
              </div>
            )
          })}
        </div>
      </>)}
    </div>
  )
}
