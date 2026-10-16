// CRM — NÚCLEO: funil em colunas (uma por etapa). Arraste o cartão para mudar de etapa.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Erro } from '../components/ui'
import { telefoneLegivel } from './nucleo'
import { PainelContato } from './Conversas'
import { type BaseCRM, type Etapa } from './tipos'
import { Icone } from '../components/Icone'
import { Avatar, interesseDe } from './Pecas'

type Cartao = { id: string; nome: string | null; telefone: string | null; etapa_id: string; etapa_em: string | null; responsavel_id: string | null; tags: string[]; origem: string | null }
type Proxima = { titulo: string; vence_em: string }
const ha = (iso: string | null) => {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `há ${Math.floor(m / 1440)} dia(s)`
}
const iconeEtapa = (e: Etapa, i: number) => e.final === 'ganho' ? 'check' : e.final === 'perdido' ? 'fechar' : /pag/i.test(e.nome) ? 'relogio' : /interess/i.test(e.nome) ? 'turmas' : i === 0 ? 'whats' : 'whats'
const POR_COLUNA = 150

export default function Funil({ empresaId, base, painelExtra }: { empresaId: string; base: BaseCRM; painelExtra?: (contatoId: string) => ReactNode }) {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [resp, setResp] = useState('')
  const [interesse, setInteresse] = useState('')
  const [verPerdidos, setVerPerdidos] = useState(false)
  const [proximas, setProximas] = useState<Record<string, Proxima>>({})

  const carregar = useCallback(async () => {
    const res = await Promise.all(base.etapas.map((e) => supabase.from('crm_contatos').select('id,nome,telefone,etapa_id,etapa_em,responsavel_id,tags,origem')
      .eq('empresa_id', empresaId).eq('etapa_id', e.id).order('etapa_em', { ascending: false, nullsFirst: false }).limit(POR_COLUNA)))
    const err = res.find((r) => r.error)
    if (err?.error) setErro(err.error.message)
    const todos = res.flatMap((r) => (r.data as Cartao[]) ?? [])
    setCartoes(todos)
    // próxima ação (tarefa aberta mais próxima) de cada cartão
    const ids = todos.map((c) => c.id), mapa: Record<string, Proxima> = {}
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from('crm_tarefas').select('contato_id,titulo,vence_em').in('contato_id', ids.slice(i, i + 200))
        .is('feita_em', null).is('cancelada_em', null).order('vence_em')
      for (const t of (data ?? []) as (Proxima & { contato_id: string })[]) if (!mapa[t.contato_id]) mapa[t.contato_id] = t
    }
    setProximas(mapa)
  }, [base.etapas, empresaId])
  useEffect(() => { if (base.etapas.length) carregar() }, [carregar, base.etapas.length])

  const mover = async (id: string, etapa: string) => {
    setCartoes((xs) => xs.map((c) => (c.id === id ? { ...c, etapa_id: etapa, etapa_em: new Date().toISOString() } : c)))
    const { error } = await supabase.from('crm_contatos').update({ etapa_id: etapa, etapa_em: new Date().toISOString() }).eq('id', id)
    if (error) { setErro(error.message); carregar() }
  }

  const t = busca.trim().toLowerCase()
  const interesses = [...new Set(cartoes.map((c) => interesseDe(c.tags, c.origem)).filter(Boolean) as string[])].sort()
  const etapas = [...base.etapas].sort((a, b) => a.ordem - b.ordem).filter((e) => verPerdidos || e.final !== 'perdido')
  const agora = Date.now()
  return (
    <div className="funil-pagina">
      <div className="funil-topo">
        <label className="select-icone funil-busca"><Icone nome="busca" tam={16} /><input placeholder="Buscar no funil" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <label className="funil-filtro"><span className="muted pequeno">Responsável</span><select value={resp} onChange={(e) => setResp(e.target.value)}><option value="">Todos</option><option value="-">Sem responsável</option>{base.equipe.filter((m) => m.ativo).map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nome}</option>)}</select></label>
        <label className="check pequeno"><input type="checkbox" checked={verPerdidos} onChange={(e) => setVerPerdidos(e.target.checked)} /> Mostrar perdidos</label>
        <label className="funil-filtro"><span className="muted pequeno">Interesse</span><select value={interesse} onChange={(e) => setInteresse(e.target.value)}><option value="">Todos</option>{interesses.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <p className="muted pequeno funil-dica">Quem responde uma mensagem entra sozinho na primeira etapa. Arraste o cartão para mudar de etapa.</p>
      <Erro msg={erro} />
      <div className="funil">
        {etapas.map((e, i) => {
          const col = cartoes.filter((c) => c.etapa_id === e.id && (!t || `${c.nome ?? ''} ${c.telefone ?? ''}`.toLowerCase().includes(t))
            && (!resp || (resp === '-' ? !c.responsavel_id : c.responsavel_id === resp)) && (!interesse || interesseDe(c.tags, c.origem) === interesse))
          return (
            <section key={e.id} className={`funil-col${sobre === e.id ? ' sobre' : ''}`} style={{ ['--cor-etapa' as string]: e.cor ?? 'var(--borda)' }}
              onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id) }} onDragLeave={() => setSobre(null)}
              onDrop={(ev) => { ev.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, e.id); setArrastando(null) }}>
              <header><Icone nome={iconeEtapa(e, i)} tam={20} /><b>{e.nome}</b><span>{col.length}{col.length >= POR_COLUNA ? '+' : ''}</span></header>
              <div className="funil-cartoes">
                {col.length === 0 && <p className="muted pequeno funil-vazia">Ninguém nesta etapa.</p>}
                {col.map((c) => {
                  const p = proximas[c.id]
                  const atrasada = p && new Date(p.vence_em).getTime() < agora
                  const int = interesseDe(c.tags, c.origem)
                  return (
                    <div key={c.id} className={`funil-cartao${atrasada ? ' atrasado' : ''}`} draggable onDragStart={() => setArrastando(c.id)} onDragEnd={() => setArrastando(null)} onClick={() => setAberto(c.id)}>
                      <div className="fc-topo"><Avatar nome={c.nome || c.telefone} /><div className="fc-quem"><b>{c.nome || telefoneLegivel(c.telefone)}</b>
                        {int && <span className="muted pequeno">{int}</span>}
                        <span className="pequeno fc-resp"><Icone nome="usuario" tam={13} /> {c.responsavel_id ? `Resp.: ${base.nomeDe(c.responsavel_id)}` : 'Sem responsável'}</span></div></div>
                      {p ? <span className={`pequeno fc-linha${atrasada ? ' erro-txt' : ''}`}><Icone nome={atrasada ? 'alerta' : 'documento'} tam={14} /> {atrasada ? 'Atrasada: ' : ''}{p.titulo}</span>
                        : !e.final && <span className="pequeno fc-linha alerta-txt"><Icone nome="alerta" tam={14} /> Sem próxima ação</span>}
                      <span className={`pequeno fc-linha ${atrasada ? 'erro-txt' : 'muted'}`}><Icone nome="relogio" tam={14} /> {ha(c.etapa_em)} nesta etapa</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {aberto && (
        <div className="gaveta-fundo" onClick={() => { setAberto(null); carregar() }}>
          <div className="gaveta" onClick={(ev) => ev.stopPropagation()}>
            <PainelContato contatoId={aberto} base={base} aberto onFechar={() => { setAberto(null); carregar() }} extra={painelExtra} />
          </div>
        </div>
      )}
    </div>
  )
}
