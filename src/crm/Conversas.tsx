// CRM — NÚCLEO: caixa de conversas (WhatsApp) da empresa, em tempo real.
// Nada da Unique aqui: o painel extra do contato vem de fora (prop painelExtra).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Erro, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { telefoneLegivel } from './nucleo'
import { horaCurta, servidorWhats, type BaseCRM, type Conversa, type Mensagem, type Nota } from './tipos'
import ProximasAcoes from './Acoes'

export type Aba = 'minhas' | 'fila' | 'todas' | 'resolvidas'
const STATUS_MSG: Record<string, string> = { pendente: ' · enviando…', enviada: ' · ✓', entregue: ' · ✓✓', lida: ' · ✓✓ lida', erro: ' · não enviada' }

export default function Conversas({ empresaId, usuarioId, base, painelExtra, inicial, abaInicial }: {
  empresaId: string; usuarioId: string; base: BaseCRM; painelExtra?: (contatoId: string) => ReactNode; inicial?: string | null; abaInicial?: Aba | null
}) {
  const [convs, setConvs] = useState<Conversa[]>([])
  const [aba, setAba] = useState<Aba>(abaInicial ?? 'minhas')
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<string | null>(inicial ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const [simular, setSimular] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('crm_conversas')
      .select('*, contato:crm_contatos(id,nome,telefone,etapa_id)')
      .eq('empresa_id', empresaId).order('ultima_em', { ascending: false, nullsFirst: false }).limit(300)
    if (error) setErro(error.message); else setConvs((data as Conversa[]) ?? [])
  }, [empresaId])

  useEffect(() => {
    carregar()
    let t: ReturnType<typeof setTimeout> | undefined
    const canal = supabase.channel(`conversas-${empresaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversas', filter: `empresa_id=eq.${empresaId}` }, () => { clearTimeout(t); t = setTimeout(carregar, 300) })
      .subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(canal) }
  }, [carregar, empresaId])

  const doAba = (c: Conversa, a: Aba) =>
    a === 'resolvidas' ? c.status === 'resolvida'
      : c.status === 'aberta' && (a === 'todas' || (a === 'minhas' ? c.atendente_id === usuarioId : !c.atendente_id))
  const termo = busca.trim().toLowerCase()
  const lista = convs.filter((c) => doAba(c, aba) && (!termo || `${c.contato?.nome ?? ''} ${c.contato?.telefone ?? ''}`.toLowerCase().includes(termo)))
  const conta = (a: Aba) => convs.filter((c) => doAba(c, a)).length
  const naoLidasAba = (a: Aba) => convs.filter((c) => doAba(c, a) && c.nao_lidas > 0).length
  const atual = convs.find((c) => c.id === sel) ?? null
  const temTeste = base.canais.some((k) => k.tipo === 'teste')

  const abas: [Aba, string][] = [['minhas', 'Minhas'], ['fila', 'Fila'], ...(base.souAdmin ? [['todas', 'Todas'] as [Aba, string]] : []), ['resolvidas', 'Resolvidas']]
  return (
    <div className={`caixa${atual ? ' com-conversa' : ''}`}>
      <aside className="caixa-lista">
        <div className="caixa-lista-topo">
          <div className="abas-mini">
            {abas.map(([k, r]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>{r} <span className={naoLidasAba(k) ? 'bolinha' : 'muted'}>{conta(k)}</span></button>)}
          </div>
          <label className="select-icone"><Icone nome="busca" tam={16} /><input placeholder="Buscar conversa" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
          {base.souAdmin && temTeste && <button className="btn btn-mini" onClick={() => setSimular(true)}>Simular mensagem chegando</button>}
        </div>
        <Erro msg={erro} />
        <div className="caixa-itens">
          {lista.length === 0 ? <Vazio>{aba === 'fila' ? 'Ninguém esperando na fila.' : aba === 'minhas' ? 'Nenhuma conversa com você. Pegue uma da fila.' : 'Nada aqui.'}</Vazio> :
            lista.map((c) => (
              <button key={c.id} className={`caixa-item${c.id === sel ? ' sel' : ''}${c.nao_lidas ? ' nova' : ''}`} onClick={() => setSel(c.id)}>
                <div className="ci-linha"><b>{c.contato?.nome || telefoneLegivel(c.contato?.telefone)}</b><span className="muted pequeno">{horaCurta(c.ultima_em)}</span></div>
                <div className="ci-linha"><span className="ci-msg">{c.ultima_direcao === 'saida' ? '✓ ' : ''}{c.ultima_mensagem ?? ''}</span>{c.nao_lidas > 0 && <span className="ci-nao-lidas">{c.nao_lidas}</span>}</div>
                <div className="ci-linha pequeno muted">
                  <span>{c.com_ia ? '🤖 IA atendendo' : c.atendente_id ? base.nomeDe(c.atendente_id) : 'Na fila'}</span>
                  {base.canais.length > 1 && <span>{base.canais.find((k) => k.id === c.canal_id)?.nome}</span>}
                </div>
              </button>
            ))}
        </div>
      </aside>

      {atual ? <Chat key={atual.id} conv={atual} usuarioId={usuarioId} base={base} onVoltar={() => setSel(null)} onMudou={carregar} painelExtra={painelExtra} />
        : <div className="caixa-vazia"><Icone nome="whats" tam={40} /><p className="muted">Escolha uma conversa.</p></div>}

      {simular && <SimularEntrada empresaId={empresaId} base={base} onFechar={() => setSimular(false)} onFeito={(id) => { setSimular(false); carregar(); setSel(id); setAba(base.souAdmin ? 'todas' : 'fila') }} />}
    </div>
  )
}

function Chat({ conv, usuarioId, base, onVoltar, onMudou, painelExtra }: {
  conv: Conversa; usuarioId: string; base: BaseCRM; onVoltar: () => void; onMudou: () => void; painelExtra?: (contatoId: string) => ReactNode
}) {
  const [msgs, setMsgs] = useState<Mensagem[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [modoNota, setModoNota] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const canal = base.canais.find((k) => k.id === conv.canal_id)

  const carregar = useCallback(async () => {
    const [m, n] = await Promise.all([
      supabase.from('crm_mensagens').select('*').eq('conversa_id', conv.id).order('criado_em').limit(500),
      supabase.from('crm_notas').select('*').eq('conversa_id', conv.id).order('criado_em').limit(200),
    ])
    setMsgs((m.data as Mensagem[]) ?? []); setNotas((n.data as Nota[]) ?? [])
  }, [conv.id])

  useEffect(() => {
    carregar()
    if (conv.nao_lidas) supabase.rpc('crm_marcar_lida', { p_conversa: conv.id })
    const ch = supabase.channel(`msgs-${conv.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_mensagens', filter: `conversa_id=eq.${conv.id}` }, (p) => {
        const m = p.new as Mensagem
        setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs.map((x) => (x.id === m.id ? m : x)) : [...xs, m]))
        if (m.direcao === 'entrada') supabase.rpc('crm_marcar_lida', { p_conversa: conv.id })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_notas', filter: `conversa_id=eq.${conv.id}` }, (p) => {
        const n = p.new as Nota
        setNotas((xs) => (xs.some((x) => x.id === n.id) ? xs : [...xs, n]))
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [carregar, conv.id, conv.nao_lidas])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, notas.length])
  // mensagens e notas internas na mesma linha do tempo
  const linha = useMemo(() => [
    ...msgs.map((m) => ({ k: 'm' as const, em: m.criado_em, m })),
    ...notas.map((n) => ({ k: 'n' as const, em: n.criado_em, n })),
  ].sort((a, b) => a.em.localeCompare(b.em)), [msgs, notas])

  const sugestoes = texto.startsWith('/') ? base.respostas.filter((r) => r.atalho.toLowerCase().startsWith(texto.slice(1).toLowerCase())).slice(0, 6) : []

  const enviar = async () => {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true); setErro(null)
    if (modoNota) {
      const { error } = await supabase.rpc('crm_nota_interna', { p_conversa: conv.id, p_texto: t })
      if (error) setErro(error.message); else { setTexto(''); carregar() }
    } else {
      try { await servidorWhats({ acao: 'enviar', conversa_id: conv.id, texto: t }); setTexto(''); onMudou() }
      catch (e) { setErro((e as Error).message) }
    }
    setEnviando(false)
  }
  const [reenviando, setReenviando] = useState<string | null>(null)
  const reenviar = async (id: string) => {
    setReenviando(id); setErro(null)
    try { await servidorWhats({ acao: 'reenviar', mensagem_id: id }) } catch (e) { setErro((e as Error).message) }
    setReenviando(null); carregar()
  }
  const assumir = async (para?: string) => {
    const { error } = await supabase.rpc('crm_assumir_conversa', { p_conversa: conv.id, p_atendente: para ?? null })
    if (error) setErro(error.message); else onMudou()
  }
  const alterar = async (campos: Partial<Conversa>) => {
    const { error } = await supabase.from('crm_conversas').update(campos).eq('id', conv.id)
    if (error) setErro(error.message); else onMudou()
  }
  const minha = conv.atendente_id === usuarioId
  const podeEscrever = minha || !conv.atendente_id || base.souAdmin

  return (<>
    <section className="caixa-chat">
      <header className="chat-topo">
        <button className="btn-icone so-celular" onClick={onVoltar} aria-label="Voltar"><Icone nome="esquerda" /></button>
        <button className="chat-quem" onClick={() => setPainel(!painel)}>
          <b>{conv.contato?.nome || 'Sem nome'}</b>
          <span className="muted pequeno">{telefoneLegivel(conv.contato?.telefone)} · {canal?.nome}{conv.atendente_id ? ` · com ${minha ? 'você' : base.nomeDe(conv.atendente_id)}` : ' · na fila'}</span>
        </button>
        <div className="chat-acoes">
          {!conv.atendente_id && <button className="btn btn-ouro btn-mini" onClick={() => assumir()}>Assumir</button>}
          {base.souAdmin && (
            <select value={conv.atendente_id ?? ''} onChange={(e) => e.target.value && assumir(e.target.value)} aria-label="Passar para">
              <option value="">{conv.atendente_id ? 'Passar para…' : 'Dar para…'}</option>
              {base.equipe.filter((m) => m.ativo && m.usuario_id !== conv.atendente_id).map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nome}</option>)}
            </select>
          )}
          {conv.status === 'aberta'
            ? <button className="btn btn-mini" onClick={() => alterar({ status: 'resolvida' })} title="Tira da caixa; volta sozinha se a pessoa escrever de novo">Resolver</button>
            : <button className="btn btn-mini" onClick={() => alterar({ status: 'aberta' })}>Reabrir</button>}
          <button className="btn btn-mini so-celular" onClick={() => setPainel(true)}>Contato</button>
        </div>
      </header>

      <div className="chat-msgs">
        {linha.map((x) => x.k === 'n'
          ? <div key={x.n.id} className="msg msg-nota"><div className="msg-autor">Nota interna · {base.nomeDe(x.n.autor_id) ?? ''}</div><div className="msg-texto">{x.n.texto}</div><div className="msg-rodape">{horaCurta(x.n.criado_em)} · só a equipe vê</div></div>
          : x.m.autor === 'sistema'
          ? <div key={x.m.id} className="msg-sistema">{base.nomeDe(x.m.autor_id) ?? 'Sistema'} {x.m.texto} · {horaCurta(x.m.criado_em)}</div>
          : (() => { const m = x.m; return (
            <div key={m.id} className={`msg msg-${m.direcao}${m.status === 'erro' ? ' msg-erro' : ''}`}>
              {m.direcao === 'saida' && <div className="msg-autor">{m.autor === 'disparo' ? 'Disparo' : m.autor === 'ia' ? 'IA' : m.autor_id ? base.nomeDe(m.autor_id) : 'Pelo celular'}</div>}
              <div className="msg-texto">{m.texto ?? `[${m.tipo}]`}</div>
              <div className="msg-rodape">{horaCurta(m.criado_em)}{m.direcao === 'saida' && <span className={`msg-status st-${m.status}`}>{STATUS_MSG[m.status] ?? ''}</span>}</div>
              {m.status === 'erro' && <div className="msg-falhou"><span className="pequeno">{m.erro ?? 'Não foi enviada.'}</span>
                <button className="btn btn-mini" onClick={() => reenviar(m.id)} disabled={reenviando === m.id}>{reenviando === m.id ? 'Tentando…' : 'Tentar de novo'}</button></div>}
            </div>) })())}
        <div ref={fim} />
      </div>

      <Erro msg={erro} />
      {podeEscrever ? (
        <div className={`chat-escrever${modoNota ? ' modo-nota' : ''}`}>
          <div className="modo-escrever">
            <button className={!modoNota ? 'ativo' : ''} onClick={() => setModoNota(false)}>Mensagem</button>
            <button className={modoNota ? 'ativo' : ''} onClick={() => setModoNota(true)} title="Só a equipe vê; não vai para o WhatsApp">Nota interna</button>
          </div>
          {!modoNota && sugestoes.length > 0 && <div className="sugestoes">{sugestoes.map((r) => <button key={r.id} onClick={() => setTexto(r.texto)}><b>/{r.atalho}</b> {r.texto.slice(0, 80)}</button>)}</div>}
          <textarea rows={2} value={texto} placeholder={modoNota ? 'Nota para a equipe (a pessoa não vê)…' : `Escreva… (Enter envia, Shift+Enter pula linha${base.respostas.length ? ', / para respostas prontas' : ''})`}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
          <button className="btn btn-ouro" onClick={enviar} disabled={enviando || !texto.trim()}>{enviando ? '…' : modoNota ? 'Anotar' : 'Enviar'}</button>
        </div>
      ) : <div className="nota pequeno">Esta conversa é de {base.nomeDe(conv.atendente_id)}.</div>}
      {canal?.tipo === 'teste' && base.souAdmin && <RespostaSimulada canalId={canal.id} telefone={conv.contato?.telefone ?? ''} />}
    </section>

    <PainelContato contatoId={conv.contato_id} base={base} aberto={painel} onFechar={() => setPainel(false)} extra={painelExtra} />
  </>)
}

function RespostaSimulada({ canalId, telefone }: { canalId: string; telefone: string }) {
  const [t, setT] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const mandar = async (doCelular = false) => {
    if (!t.trim()) return
    try { await servidorWhats({ acao: 'simular_entrada', canal_id: canalId, telefone, texto: t, do_celular: doCelular }); setT('') } catch (e) { setErro((e as Error).message) }
  }
  return (
    <div className="simulador">
      <span className="muted pequeno">Número de teste — simular:</span>
      <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && mandar()} placeholder="Ex.: Oi! Quero saber mais" />
      <button className="btn btn-mini" onClick={() => mandar()}>A pessoa respondeu</button>
      <button className="btn btn-mini" onClick={() => mandar(true)} title="Como se a vendedora tivesse mandado pelo WhatsApp do celular">Vendedora mandou pelo celular</button>
      <Erro msg={erro} />
    </div>
  )
}

function SimularEntrada({ empresaId, base, onFechar, onFeito }: { empresaId: string; base: BaseCRM; onFechar: () => void; onFeito: (conversaId: string) => void }) {
  const teste = base.canais.find((k) => k.tipo === 'teste' && k.empresa_id === empresaId)
  const [tel, setTel] = useState('55119')
  const [nome, setNome] = useState('')
  const [texto, setTexto] = useState('Oi! Vi o anúncio e queria saber mais sobre o curso.')
  const [erro, setErro] = useState<string | null>(null)
  const ir = async () => {
    try {
      const r = await servidorWhats<{ conversa: string }>({ acao: 'simular_entrada', canal_id: teste?.id, telefone: tel, nome, texto })
      onFeito(r.conversa)
    } catch (e) { setErro((e as Error).message) }
  }
  return (
    <Modal titulo="Simular mensagem chegando (número de teste)" aberto onFechar={onFechar}>
      <p className="muted pequeno">Faz de conta que uma pessoa mandou mensagem para o número de teste. Nada é enviado de verdade.</p>
      <label className="campo"><span className="campo-rotulo">WhatsApp de quem manda (com 55 e DDD)</span><input value={tel} onChange={(e) => setTel(e.target.value)} /></label>
      <label className="campo"><span className="campo-rotulo">Nome que aparece no WhatsApp</span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Mariana Teste" /></label>
      <label className="campo"><span className="campo-rotulo">Mensagem</span><textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={ir}>Simular</button></div>
    </Modal>
  )
}

type ContatoFicha = { id: string; nome: string | null; telefone: string | null; emails: string[]; tags: string[]; cidade: string | null; uf: string | null; etapa_id: string | null; observacoes: string | null; nao_contatar: boolean }

export function PainelContato({ contatoId, base, aberto, onFechar, extra }: { contatoId: string; base: BaseCRM; aberto: boolean; onFechar: () => void; extra?: (contatoId: string) => ReactNode }) {
  const [c, setC] = useState<ContatoFicha | null>(null)
  const [obs, setObs] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('crm_contatos').select('id,nome,telefone,emails,tags,cidade,uf,etapa_id,observacoes,nao_contatar').eq('id', contatoId).single()
      .then(({ data }) => { setC(data as ContatoFicha); setObs((data as ContatoFicha)?.observacoes ?? ''); setNome((data as ContatoFicha)?.nome ?? '') })
  }, [contatoId])
  const alterar = async (campos: Partial<ContatoFicha> & { etapa_em?: string }) => {
    const { error } = await supabase.from('crm_contatos').update(campos).eq('id', contatoId)
    if (error) return setErro(error.message)
    setC((x) => (x ? { ...x, ...campos } : x))
  }
  const etapasOrdem = useMemo(() => [...base.etapas].sort((a, b) => a.ordem - b.ordem), [base.etapas])
  if (!c) return <aside className={`caixa-contato${aberto ? ' aberto' : ''}`} />
  return (
    <aside className={`caixa-contato${aberto ? ' aberto' : ''}`}>
      <div className="gaveta-topo"><h3>Contato</h3><button className="btn-icone so-celular" onClick={onFechar} aria-label="Fechar">×</button></div>
      <input className="cc-nome" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => nome !== (c.nome ?? '') && alterar({ nome })} placeholder="Nome" />
      <div className="pequeno">{telefoneLegivel(c.telefone)}</div>
      {c.emails.length > 0 && <div className="pequeno muted">{c.emails.join(', ')}</div>}
      {c.cidade && <div className="pequeno muted">{c.cidade}{c.uf ? '/' + c.uf : ''}</div>}
      <label className="campo"><span className="campo-rotulo">Etapa no funil</span>
        <select value={c.etapa_id ?? ''} onChange={(e) => alterar({ etapa_id: e.target.value || null, etapa_em: new Date().toISOString() })}>
          <option value="">Fora do funil</option>{etapasOrdem.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>
      {c.tags.length > 0 && <div className="tags">{c.tags.slice(0, 12).map((t) => <Badge key={t}>{t}</Badge>)}</div>}
      <label className="campo"><span className="campo-rotulo">Anotações</span>
        <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => obs !== (c.observacoes ?? '') && alterar({ observacoes: obs || null })} placeholder="O que é importante saber dessa pessoa" />
      </label>
      {c.nao_contatar && <div className="erro-txt pequeno">Pediu para não receber mensagens.</div>}
      <Erro msg={erro} />
      <ProximasAcoes contatoId={contatoId} base={base} />
      {extra?.(contatoId)}
    </aside>
  )
}
