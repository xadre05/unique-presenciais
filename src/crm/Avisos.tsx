// CRM — NÚCLEO: avisos que não deixam nada passar despercebido.
// • faixa vermelha quando um número de WhatsApp cai (a reclamação nº 1 nos concorrentes: "o número caiu e ninguém viu")
// • som + aviso na tela (e no computador, se a pessoa permitir) quando chega mensagem ou quando passam uma conversa para ela
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { Icone } from '../components/Icone'
import type { Canal, Conversa } from './tipos'

export function AvisoNumeros({ empresaId, onAbrirConfig }: { empresaId: string; onAbrirConfig?: () => void }) {
  const [caidos, setCaidos] = useState<Pick<Canal, 'id' | 'nome' | 'status' | 'status_info'>[]>([])
  const ver = useCallback(async () => {
    const { data } = await supabase.from('crm_canais').select('id,nome,status,status_info,tipo,ativo').eq('empresa_id', empresaId)
    setCaidos(((data ?? []) as (Canal)[]).filter((k) => k.ativo && k.tipo !== 'teste' && k.status !== 'conectado'))
  }, [empresaId])
  useEffect(() => { ver(); const t = setInterval(ver, 60000); return () => clearInterval(t) }, [ver])
  if (!caidos.length) return null
  return (
    <div className="faixa-numero-caido" role="alert">
      <Icone nome="whats" tam={18} />
      <span><b>{caidos.length === 1 ? `O número "${caidos[0].nome}" está fora do ar` : `${caidos.length} números estão fora do ar: ${caidos.map((k) => k.nome).join(', ')}`}.</b>{' '}
        Mensagens não estão saindo nem chegando por {caidos.length === 1 ? 'ele' : 'eles'}.{caidos[0].status_info ? ` (${caidos[0].status_info})` : ''}</span>
      {onAbrirConfig && <button className="btn btn-mini" onClick={onAbrirConfig}>Ver números</button>}
    </div>
  )
}

type Toast = { id: string; titulo: string; texto: string; chave: string; clicar: () => void }
type Estado = Pick<Conversa, 'id' | 'atendente_id' | 'ultima_em' | 'status'>

// bip curto feito na hora (sem arquivo de som)
function bip() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36); o.onended = () => ctx.close()
  } catch { /* navegador sem som liberado */ }
}

// slotControles: id de um elemento da tela onde ficam os botões de som/aviso (ex.: rodapé do menu lateral)
// urlDe: endereço que o aviso do sistema abre (chave = id da conversa, ou "t-…" para lead/recuperação)
export function AvisosConversas({ empresaId, usuarioId, abrir, abrirFila, urlDe, slotControles }: { empresaId: string; usuarioId: string; abrir: (conversaId: string) => void; abrirFila?: () => void; urlDe?: (chave: string) => string; slotControles?: string }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [permissao, setPermissao] = useState<NotificationPermission | 'sem'>(() => (typeof Notification === 'undefined' ? 'sem' : Notification.permission))
  const [somLigado, setSomLigado] = useState(() => { try { return localStorage.getItem('crm-som') !== 'nao' } catch { return true } })
  const estado = useRef(new Map<string, Estado>())
  const naoLidas = useRef(new Map<string, number>())
  const somRef = useRef(somLigado)
  somRef.current = somLigado

  const mostrar = useCallback((titulo: string, texto: string, chave: string, clicar: () => void) => {
    const t: Toast = { id: `${chave}-${Date.now()}`, titulo, texto, chave, clicar }
    setToasts((xs) => [...xs.filter((x) => x.chave !== chave), t].slice(-4))
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== t.id)), 9000)
    if (somRef.current) bip()
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      // pelo service worker funciona também no celular (Android) e com o app instalado
      navigator.serviceWorker?.getRegistration().then((reg) => {
        if (reg) return reg.showNotification(titulo, { body: texto, tag: chave, icon: '/icone-192.png', data: { url: urlDe?.(chave) ?? '/atendimento' } })
        const n = new Notification(titulo, { body: texto, tag: chave }); n.onclick = () => { window.focus(); clicar(); n.close() }
      }).catch(() => { /* sem suporte */ })
    }
  }, [urlDe])
  const nomeContato = async (id: string) => {
    const { data } = await supabase.from('crm_contatos').select('nome,telefone').eq('id', id).maybeSingle()
    return data?.nome || data?.telefone || 'Contato'
  }
  const avisar = useCallback(async (c: Conversa, titulo: string) => {
    const quem = await nomeContato(c.contato_id)
    mostrar(titulo, `${quem}${c.ultima_mensagem && c.ultima_direcao === 'entrada' ? `: ${c.ultima_mensagem.slice(0, 120)}` : ''}`, c.id, () => abrir(c.id))
  }, [abrir, mostrar])
  // lead novo (formulário) ou recuperação (Hotmart) que caiu na minha fila
  const avisarTarefa = useCallback(async (t: { contato_id: string; titulo: string; origem: string; tipo: string }) => {
    if (t.origem !== 'captura' && t.tipo !== 'recuperacao') return
    const quem = await nomeContato(t.contato_id)
    mostrar(t.origem === 'captura' ? 'Lead novo para você' : 'Recuperação de venda', `${quem} · ${t.titulo}`, `t-${t.contato_id}`, () => abrirFila?.())
  }, [abrirFila, mostrar])

  useEffect(() => {
    let vivo = true
    supabase.from('crm_conversas').select('id,atendente_id,ultima_em,status,nao_lidas').eq('empresa_id', empresaId).limit(1000).then(({ data }) => {
      if (!vivo) return
      for (const c of (data ?? []) as (Estado & { nao_lidas: number })[]) { estado.current.set(c.id, c); if (c.atendente_id === usuarioId) naoLidas.current.set(c.id, c.nao_lidas) }
      atualizarTitulo()
    })
    const ch = supabase.channel(`avisos-${empresaId}-${usuarioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_conversas', filter: `empresa_id=eq.${empresaId}` }, (p) => {
        const c = p.new as Conversa
        if (!c?.id) return
        const antes = estado.current.get(c.id)
        estado.current.set(c.id, c)
        if (c.atendente_id === usuarioId) naoLidas.current.set(c.id, c.nao_lidas); else naoLidas.current.delete(c.id)
        atualizarTitulo()
        if (c.atendente_id === usuarioId && antes && antes.atendente_id !== usuarioId) { avisar(c, 'Passaram uma conversa para você'); return }
        const novaEntrada = c.ultima_direcao === 'entrada' && c.status === 'aberta' && (!antes || (c.ultima_em ?? '') > (antes.ultima_em ?? ''))
        if (novaEntrada && c.atendente_id === usuarioId) avisar(c, 'Nova mensagem')
        else if (novaEntrada && !c.atendente_id) avisar(c, 'Mensagem na fila, sem dona')
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_tarefas', filter: `responsavel_id=eq.${usuarioId}` }, (p) => {
        avisarTarefa(p.new as { contato_id: string; titulo: string; origem: string; tipo: string })
      }).subscribe()
    return () => { vivo = false; supabase.removeChannel(ch); document.title = document.title.replace(/^\(\d+\) /, '') }
  }, [empresaId, usuarioId, avisar, avisarTarefa])

  function atualizarTitulo() {
    const n = [...naoLidas.current.values()].reduce((s, x) => s + (x > 0 ? 1 : 0), 0)
    const base = document.title.replace(/^\(\d+\) /, '')
    document.title = n ? `(${n}) ${base}` : base
  }

  const pedir = async () => { if (typeof Notification === 'undefined') return; setPermissao(await Notification.requestPermission()) }
  const alternarSom = () => { const v = !somLigado; setSomLigado(v); try { localStorage.setItem('crm-som', v ? 'sim' : 'nao') } catch { /* sem armazenamento */ } if (v) bip() }

  // "Instalar o app": o navegador avisa quando dá para instalar
  const [instalar, setInstalar] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)
  useEffect(() => {
    const f = (e: Event) => { e.preventDefault(); setInstalar(e as Event & { prompt: () => Promise<void> }) }
    window.addEventListener('beforeinstallprompt', f)
    return () => window.removeEventListener('beforeinstallprompt', f)
  }, [])
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { if (slotControles) setSlot(document.getElementById(slotControles)) }, [slotControles])
  const controles = (
    <div className="avisos-config">
      <button className="link pequeno" onClick={alternarSom} title="Som quando chega mensagem">{somLigado ? '🔔 Som ligado' : '🔕 Som desligado'}</button>
      {permissao === 'default' && <button className="link pequeno" onClick={pedir}>Avisar fora da tela</button>}
      {instalar && <button className="link pequeno" onClick={async () => { await instalar.prompt(); setInstalar(null) }}>📲 Instalar o app</button>}
    </div>
  )
  return (<>
    {slot ? createPortal(controles, slot) : null}
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className="toast" onClick={() => { t.clicar(); setToasts((xs) => xs.filter((x) => x.id !== t.id)) }}>
          <b>{t.titulo}</b><span>{t.texto}</span>
        </button>
      ))}
    </div>
  </>)
}
