// CRM — NÚCLEO: a conversa aberta (cabeçalho, aviso de espera, mensagens e notas, agendadas, caixa de escrever).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { horaCurta, servidorWhats, type BaseCRM, type Conversa, type Mensagem, type Nota } from '../tipos'
import { PainelContato } from './Contexto'
import { Escrever } from './Escrever'
import { Cabecalho } from './Cabecalho'
import { ListaAgendadas, type Agendada } from './Ferramentas'
import { MidiaDaMensagem } from './Midia'
import { usePresenca } from './Presenca'
import { aguardandoResposta, foraDaJanela, minutosDesde, tempoLegivel } from './util'

const STATUS_MSG: Record<string, string> = { pendente: 'enviando…', enviada: '✓', entregue: '✓✓', lida: '✓✓', erro: 'não enviada' }
type Props = { conv: Conversa; usuarioId: string; base: BaseCRM; onVoltar: () => void; onMudou: () => void; painelExtra?: (contatoId: string) => ReactNode; rodape?: ReactNode; etiquetas?: string[] }

export function Chat({ conv, usuarioId, base, onVoltar, onMudou, painelExtra, rodape, etiquetas }: Props) {
  const [msgs, setMsgs] = useState<Mensagem[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [agendadas, setAgendadas] = useState<Agendada[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const canal = base.canais.find((k) => k.id === conv.canal_id)
  const presenca = usePresenca(conv.id, usuarioId, base.nomeDe(usuarioId))

  const carregar = useCallback(async () => {
    const [m, n, a] = await Promise.all([
      supabase.from('crm_mensagens').select('*').eq('conversa_id', conv.id).order('criado_em').limit(500),
      supabase.from('crm_notas').select('*').eq('conversa_id', conv.id).order('criado_em').limit(200),
      supabase.from('crm_agendadas').select('id,texto,enviar_em,so_sem_resposta,status,erro').eq('conversa_id', conv.id).eq('status', 'agendada').order('enviar_em'),
    ])
    setMsgs((m.data as Mensagem[]) ?? []); setNotas((n.data as Nota[]) ?? []); setAgendadas((a.data as Agendada[]) ?? [])
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
  const linha = useMemo(() => [
    ...msgs.map((m) => ({ k: 'm' as const, em: m.criado_em, m })),
    ...notas.map((n) => ({ k: 'n' as const, em: n.criado_em, n })),
  ].sort((a, b) => a.em.localeCompare(b.em)), [msgs, notas])

  const assumir = async (para?: string) => {
    const { error } = await supabase.rpc('crm_assumir_conversa', { p_conversa: conv.id, p_atendente: para ?? null })
    if (error) setErro(error.message); else onMudou()
  }
  const alterar = async (campos: Partial<Conversa>) => {
    const { error } = await supabase.from('crm_conversas').update(campos).eq('id', conv.id)
    if (error) setErro(error.message); else onMudou()
  }
  const podeEscrever = conv.atendente_id === usuarioId || !conv.atendente_id || base.souAdmin
  const fora = foraDaJanela(canal, msgs)

  return (<>
    <section className="caixa-chat">
      <Cabecalho conv={conv} base={base} usuarioId={usuarioId} canalNome={canal?.nome} podePedirNota={!fora} outros={presenca.outros}
        onVoltar={onVoltar} abrirContato={() => setPainel(true)} assumir={assumir} alterar={alterar} />
      <AvisoEspera conv={conv} prazoMin={base.config.prazo_primeiro_contato_min ?? 5} />
      <div className="chat-msgs">
        {linha.map((x) => x.k === 'n' ? <NotaInterna key={x.n.id} n={x.n} autor={base.nomeDe(x.n.autor_id)} /> : <Balao key={x.m.id} m={x.m} base={base} aoMudar={carregar} />)}
        <div ref={fim} />
      </div>
      <Erro msg={erro} />
      <ListaAgendadas itens={agendadas} aoMudar={carregar} />
      {podeEscrever
        ? <Escrever conv={conv} base={base} canal={canal} usuarioId={usuarioId} usuarioNome={base.nomeDe(usuarioId)} foraJanela={fora} aoEnviar={() => { carregar(); onMudou() }} aoDigitar={presenca.digitando} />
        : <div className="nota pequeno">Esta conversa é de {base.nomeDe(conv.atendente_id)}.</div>}
      {rodape}
    </section>
    <PainelContato contatoId={conv.contato_id} base={base} aberto={painel} onFechar={() => setPainel(false)} extra={painelExtra} conv={conv} aoMudarConversa={onMudou} etiquetas={etiquetas} />
  </>)
}

// a pessoa escreveu e está esperando: some quando alguém responde
function AvisoEspera({ conv, prazoMin }: { conv: Conversa; prazoMin: number }) {
  const [, tic] = useState(0)
  useEffect(() => { const t = setInterval(() => tic((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  if (!aguardandoResposta(conv) || !conv.ultima_em) return null
  const min = minutosDesde(conv.ultima_em)
  return <div className={`chat-espera${min >= prazoMin ? ' atrasada' : ''}`}><Icone nome="relogio" tam={16} /> Aguardando sua resposta há {tempoLegivel(min)}.</div>
}

function NotaInterna({ n, autor }: { n: Nota; autor: string | null }) {
  return (
    <div className="msg-nota-linha"><div className="msg msg-nota">
      <div className="msg-autor"><Icone nome="documento" tam={13} /> Nota interna · {autor ?? ''} · {horaCurta(n.criado_em)}</div>
      <div className="msg-texto">{n.texto}</div>
    </div></div>
  )
}

function Balao({ m, base, aoMudar }: { m: Mensagem; base: BaseCRM; aoMudar: () => void }) {
  const [tentando, setTentando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (m.autor === 'sistema') return <div className="msg-sistema">{base.nomeDe(m.autor_id) ?? 'Sistema'} {m.texto} · {horaCurta(m.criado_em)}</div>
  const reenviar = async () => {
    setTentando(true); setErro(null)
    try { await servidorWhats({ acao: 'reenviar', mensagem_id: m.id }) } catch (e) { setErro((e as Error).message) }
    setTentando(false); aoMudar()
  }
  const autor = m.autor === 'disparo' ? 'Disparo' : m.autor === 'ia' ? 'IA' : m.autor_id ? base.nomeDe(m.autor_id) : 'Pelo celular'
  return (
    <div className={`msg msg-${m.direcao}${m.status === 'erro' ? ' msg-erro' : ''}`}>
      {m.direcao === 'saida' && <div className="msg-autor">{autor}</div>}
      <MidiaDaMensagem m={m} aoMudar={aoMudar} />
      {m.texto && !(m.midia_url && /^\[.*\]$/.test(m.texto)) && <div className="msg-texto">{m.texto}</div>}
      {m.modelo && <div className="msg-modelo pequeno">Modelo aprovado</div>}
      <div className="msg-rodape" title={new Date(m.criado_em).toLocaleString('pt-BR')}>{horaCurta(m.criado_em)}{m.direcao === 'saida' && <span className={`msg-status st-${m.status}`}> {STATUS_MSG[m.status] ?? ''}</span>}</div>
      {m.status === 'erro' && <div className="msg-falhou"><span className="pequeno">{m.erro ?? 'Não foi enviada.'}</span>
        <button className="btn btn-mini" onClick={reenviar} disabled={tentando}>{tentando ? 'Tentando…' : 'Tentar de novo'}</button></div>}
      {erro && <div className="erro-txt pequeno">{erro}</div>}
    </div>
  )
}
