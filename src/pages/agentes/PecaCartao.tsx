// Uma peça de conteúdo que o agente preparou: ler, editar (legenda e telas), pedir ajuste ao agente,
// copiar e decidir (aprovar, descartar, postada).
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { dataBR } from '../../lib/format'
import { Badge, Erro } from '../../components/ui'
import { TIPO_PECA, textoDaPeca, type Peca } from './comum'

const STATUS: Record<Peca['status'], { rotulo: string; tom: string }> = {
  rascunho: { rotulo: 'Esperando aprovação', tom: 'alerta' },
  aprovada: { rotulo: 'Aprovada', tom: 'ok' },
  descartada: { rotulo: 'Descartada', tom: 'apagado' },
  postada: { rotulo: 'Postada', tom: 'info' },
}
const NOME_ROTEIRO: Record<string, string> = { reels: 'Roteiro (uma cena por linha)', carrossel: 'Lâminas (uma por linha)', stories: 'Telas (uma por linha)' }

async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto) } catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
  }
}

// pede ao agente para reescrever a peça e acompanha até ficar pronta
function usePedirAjuste(peca: Peca, aoMudar: () => void) {
  const [trabalho, setTrabalho] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!trabalho) return
    const t = setInterval(async () => {
      const { data } = await supabase.from('agentes_trabalhos').select('status,erro').eq('id', trabalho).maybeSingle()
      if (data?.status === 'pronto') { setTrabalho(null); aoMudar() }
      if (data?.status === 'erro') { setTrabalho(null); setErro(data.erro) }
    }, 3000)
    return () => clearInterval(t)
  }, [trabalho]) // eslint-disable-line react-hooks/exhaustive-deps
  const pedir = async (instrucao: string) => {
    setErro(null)
    const { data: emp } = await supabase.from('agentes_pecas').select('empresa_id').eq('id', peca.id).single()
    const { data, error } = await supabase.from('agentes_trabalhos').insert({ empresa_id: emp?.empresa_id, agente_id: 'marketing', tipo: 'ajuste', pedido: { peca_id: peca.id, instrucao } }).select('id').single()
    if (error) return setErro(msgErro(error))
    setTrabalho(data.id)
    const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
    if (r.error) { setTrabalho(null); setErro('O agente não conseguiu começar. Tente de novo.') }
  }
  return { ajustando: !!trabalho, erroAjuste: erro, pedir }
}

export function PecaCartao({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const c = peca.conteudo
  const [editando, setEditando] = useState(false)
  const [legenda, setLegenda] = useState(c.legenda ?? '')
  const [roteiro, setRoteiro] = useState((c.roteiro ?? []).join('\n'))
  const [instrucao, setInstrucao] = useState('')
  const [pedindo, setPedindo] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const { ajustando, erroAjuste, pedir } = usePedirAjuste(peca, aoMudar)
  useEffect(() => { setLegenda(c.legenda ?? ''); setRoteiro((c.roteiro ?? []).join('\n')) }, [c.legenda, c.roteiro])

  const atualizar = async (campos: Record<string, unknown>) => {
    setErro(null)
    const { error } = await supabase.from('agentes_pecas').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', peca.id)
    if (error) return setErro(msgErro(error))
    aoMudar()
  }
  const linhas = roteiro.split('\n').map((l) => l.trim()).filter(Boolean)
  const salvar = async () => { await atualizar({ conteudo: { ...c, legenda, roteiro: linhas } }); setEditando(false) }
  const decidir = (status: Peca['status']) => supabase.auth.getUser().then(({ data }) => atualizar({ status, decidido_por: data.user?.id ?? null }))
  const enviarAjuste = async () => { if (!instrucao.trim()) return; await pedir(instrucao.trim()); setInstrucao(''); setPedindo(false) }

  return (
    <article className={`peca peca-${peca.status}${ajustando ? ' peca-ajustando' : ''}`}>
      <header className="peca-topo">
        <Badge tom="ouro">{TIPO_PECA[peca.tipo] ?? peca.tipo}{c.roteiro?.length && peca.tipo === 'stories' ? ` · ${c.roteiro.length} telas` : ''}</Badge>
        <b>{peca.titulo}</b>
        <span className="peca-st"><Badge tom={STATUS[peca.status].tom}>{STATUS[peca.status].rotulo}</Badge></span>
      </header>
      {c.objetivo && <p className="muted pequeno">Objetivo: {c.objetivo}{peca.dia ? ` · ${dataBR(peca.dia)}` : ''}</p>}
      {c.texto_arte && <div className="peca-arte">“{c.texto_arte}”</div>}
      {editando ? (<>
        {(c.roteiro?.length || peca.tipo !== 'post') && <label className="peca-edit-rotulo">{NOME_ROTEIRO[peca.tipo] ?? 'Roteiro'} · {linhas.length}<textarea rows={Math.min(14, Math.max(4, linhas.length + 1))} value={roteiro} onChange={(e) => setRoteiro(e.target.value)} /></label>}
        <label className="peca-edit-rotulo">Legenda<textarea rows={8} value={legenda} onChange={(e) => setLegenda(e.target.value)} /></label>
      </>) : (<>
        {!!c.roteiro?.length && <ol className="peca-roteiro">{c.roteiro.map((r, i) => <li key={i}>{r}</li>)}</ol>}
        {c.legenda && <div className="peca-legenda">{c.legenda}</div>}
      </>)}
      {c.cta && <p className="pequeno"><b>Chamada:</b> {c.cta}</p>}
      {!!c.hashtags?.length && <p className="muted pequeno">{c.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>}
      {c.observacao && <p className="nota pequeno">{c.observacao}</p>}
      {ajustando && <div className="progresso"><div className="indeterminado" /><span>O agente está ajustando esta peça…</span></div>}
      {pedindo && !ajustando && (
        <div className="peca-ajuste">
          <input autoFocus value={instrucao} onChange={(e) => setInstrucao(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviarAjuste()} placeholder={peca.tipo === 'stories' ? 'Ex.: aumente para 8 telas e termine com caixinha de pergunta' : 'Ex.: deixe mais curta e fale da turma de novembro'} />
          <button className="btn btn-ouro btn-mini" disabled={!instrucao.trim()} onClick={enviarAjuste}>Pedir</button>
          <button className="btn btn-mini" onClick={() => setPedindo(false)}>Cancelar</button>
        </div>
      )}
      <Erro msg={erro ?? erroAjuste} />
      <footer className="peca-acoes">
        <button className="btn btn-contorno btn-mini" onClick={async () => { await copiar(textoDaPeca(peca)); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }}>{copiado ? 'Copiado ✓' : 'Copiar tudo'}</button>
        {editando
          ? <><button className="btn btn-mini" onClick={() => { setLegenda(c.legenda ?? ''); setRoteiro((c.roteiro ?? []).join('\n')); setEditando(false) }}>Cancelar</button><button className="btn btn-ouro btn-mini" onClick={salvar}>Salvar</button></>
          : <><button className="btn btn-mini" onClick={() => setEditando(true)}>Editar</button><button className="btn btn-mini" disabled={ajustando} onClick={() => setPedindo(true)}>Pedir ajuste ao agente</button></>}
        <span className="peca-espaco" />
        {peca.status !== 'aprovada' && peca.status !== 'postada' && <button className="btn btn-ouro btn-mini" onClick={() => decidir('aprovada')}>Aprovar</button>}
        {peca.status === 'aprovada' && <button className="btn btn-contorno btn-mini" onClick={() => decidir('postada')}>Marcar como postada</button>}
        {peca.status !== 'descartada' && peca.status !== 'postada' && <button className="btn btn-mini" onClick={() => decidir('descartada')}>Descartar</button>}
        {peca.status === 'descartada' && <button className="btn btn-mini" onClick={() => decidir('rascunho')}>Voltar para análise</button>}
      </footer>
    </article>
  )
}
