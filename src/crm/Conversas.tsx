// CRM — NÚCLEO: caixa de conversas (WhatsApp) da empresa, em tempo real. Três colunas: a lista (conversas/Lista),
// a conversa aberta (conversas/Chat) e o contexto do contato (conversas/Contexto). Nada da Unique aqui: o painel extra
// do contato vem de fora (prop painelExtra).
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Erro, Modal } from '../components/ui'
import { Icone } from '../components/Icone'
import { servidorWhats, type BaseCRM, type Conversa } from './tipos'
import { ListaConversas, type Aba, type Filtros } from './conversas/Lista'
import { Chat } from './conversas/Chat'
import { aguardandoResposta } from './conversas/util'

export type { Aba } from './conversas/Lista'
export { PainelContato } from './conversas/Contexto'

export default function Conversas({ empresaId, usuarioId, base, painelExtra, inicial, abaInicial }: {
  empresaId: string; usuarioId: string; base: BaseCRM; painelExtra?: (contatoId: string) => ReactNode; inicial?: string | null; abaInicial?: Aba | null
}) {
  const [convs, setConvs] = useState<Conversa[]>([])
  const [aba, setAba] = useState<Aba>(abaInicial ?? 'minhas')
  const [f, setF] = useState<Filtros>({ busca: '', canal: '', naoLidas: false, aguardando: false })
  const [achados, setAchados] = useState<Map<string, string | null> | null>(null)   // busca dentro das mensagens
  const [sel, setSel] = useState<string | null>(inicial ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const [simular, setSimular] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('crm_conversas')
      .select('*, contato:crm_contatos(id,nome,telefone,etapa_id,tags,origem)')
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
  const termo = f.busca.trim().toLowerCase()
  // busca no servidor (dentro das mensagens e notas) só depois que a pessoa para de digitar
  useEffect(() => {
    if (termo.length < 2) { setAchados(null); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('crm_buscar_conversas', { p_empresa: empresaId, p_termo: termo })
      setAchados(new Map(((data ?? []) as { conversa_id: string; trecho: string | null }[]).map((x) => [x.conversa_id, x.trecho])))
    }, 350)
    return () => clearTimeout(t)
  }, [termo, empresaId])
  const lista = convs.filter((c) => doAba(c, aba) && (!f.naoLidas || c.nao_lidas > 0) && (!f.aguardando || aguardandoResposta(c)) && (!f.canal || c.canal_id === f.canal)
    && (!termo || `${c.contato?.nome ?? ''} ${c.contato?.telefone ?? ''}`.toLowerCase().includes(termo) || !!achados?.has(c.id)))
  const atual = convs.find((c) => c.id === sel) ?? null
  const teste = base.canais.find((k) => k.tipo === 'teste')
  const canalAtual = atual ? base.canais.find((k) => k.id === atual.canal_id) : undefined

  return (
    <div className={`caixa${atual ? ' com-conversa' : ''}`}>
      <ListaConversas base={base} convs={convs} lista={lista} aba={aba} setAba={setAba} doAba={doAba} f={f} setF={setF} achados={achados} sel={sel} abrir={setSel} erro={erro}
        aoSimular={base.souAdmin && teste ? () => setSimular(true) : null} />
      {atual ? <Chat key={atual.id} conv={atual} usuarioId={usuarioId} base={base} onVoltar={() => setSel(null)} onMudou={carregar} painelExtra={painelExtra}
          rodape={canalAtual?.tipo === 'teste' && base.souAdmin ? <RespostaSimulada canalId={canalAtual.id} telefone={atual.contato?.telefone ?? ''} /> : null} />
        : <div className="caixa-vazia"><Icone nome="whats" tam={40} /><p className="muted">Escolha uma conversa.</p></div>}
      {simular && <SimularEntrada empresaId={empresaId} base={base} onFechar={() => setSimular(false)} onFeito={(id) => { setSimular(false); carregar(); setSel(id); setAba(base.souAdmin ? 'todas' : 'fila') }} />}
    </div>
  )
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
