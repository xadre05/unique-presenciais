// Uma peça de conteúdo que o agente preparou: ler, ajustar a legenda, copiar e decidir (aprovar, descartar, postada).
import { useState } from 'react'
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

async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto) } catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
  }
}

export function PecaCartao({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false)
  const [legenda, setLegenda] = useState(peca.conteudo.legenda ?? '')
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const c = peca.conteudo

  const atualizar = async (campos: Record<string, unknown>) => {
    setErro(null)
    const { error } = await supabase.from('agentes_pecas').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', peca.id)
    if (error) return setErro(msgErro(error))
    aoMudar()
  }
  const salvarLegenda = async () => { await atualizar({ conteudo: { ...c, legenda } }); setEditando(false) }
  const decidir = (status: Peca['status']) => supabase.auth.getUser().then(({ data }) => atualizar({ status, decidido_por: data.user?.id ?? null }))

  return (
    <article className={`peca peca-${peca.status}`}>
      <header className="peca-topo">
        <Badge tom="ouro">{TIPO_PECA[peca.tipo] ?? peca.tipo}</Badge>
        <b>{peca.titulo}</b>
        <span className="peca-st"><Badge tom={STATUS[peca.status].tom}>{STATUS[peca.status].rotulo}</Badge></span>
      </header>
      {c.objetivo && <p className="muted pequeno">Objetivo: {c.objetivo}{peca.dia ? ` · ${dataBR(peca.dia)}` : ''}</p>}
      {c.texto_arte && <div className="peca-arte">“{c.texto_arte}”</div>}
      {!!c.roteiro?.length && (
        <ol className="peca-roteiro">{c.roteiro.map((r, i) => <li key={i}>{r}</li>)}</ol>
      )}
      {editando
        ? <textarea className="peca-legenda-edit" rows={8} value={legenda} onChange={(e) => setLegenda(e.target.value)} />
        : c.legenda && <div className="peca-legenda">{c.legenda}</div>}
      {c.cta && <p className="pequeno"><b>Chamada:</b> {c.cta}</p>}
      {!!c.hashtags?.length && <p className="muted pequeno">{c.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>}
      {c.observacao && <p className="nota pequeno">{c.observacao}</p>}
      <Erro msg={erro} />
      <footer className="peca-acoes">
        <button className="btn btn-contorno btn-mini" onClick={async () => { await copiar(textoDaPeca({ ...peca, conteudo: { ...c, legenda } })); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }}>{copiado ? 'Copiado ✓' : 'Copiar tudo'}</button>
        {editando
          ? <><button className="btn btn-mini" onClick={() => { setLegenda(c.legenda ?? ''); setEditando(false) }}>Cancelar</button><button className="btn btn-ouro btn-mini" onClick={salvarLegenda}>Salvar legenda</button></>
          : <button className="btn btn-mini" onClick={() => setEditando(true)}>Ajustar legenda</button>}
        <span className="peca-espaco" />
        {peca.status !== 'aprovada' && peca.status !== 'postada' && <button className="btn btn-ouro btn-mini" onClick={() => decidir('aprovada')}>Aprovar</button>}
        {peca.status === 'aprovada' && <button className="btn btn-contorno btn-mini" onClick={() => decidir('postada')}>Marcar como postada</button>}
        {peca.status !== 'descartada' && peca.status !== 'postada' && <button className="btn btn-mini" onClick={() => decidir('descartada')}>Descartar</button>}
        {peca.status === 'descartada' && <button className="btn btn-mini" onClick={() => decidir('rascunho')}>Voltar para análise</button>}
      </footer>
    </article>
  )
}
