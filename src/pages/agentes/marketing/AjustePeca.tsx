// Pedir ajuste ao agente dentro da Produção: o pedido, a opção de lembrar o gosto nas próximas peças,
// o andamento e o que ele aprendeu (com "Não guardar").
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { esquecer } from '../memoria'
import type { Peca, Trabalho } from '../comum'
import { pedirAjuste } from './ajuste'
import { EMPRESA } from './useMarketing'

export function AjustePeca({ peca, rodando, ultimo, aoPedir }: { peca: Peca; rodando: Trabalho | null; ultimo: Trabalho | null; aoPedir: () => void }) {
  const [texto, setTexto] = useState('')
  const [guardar, setGuardar] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [esquecido, setEsquecido] = useState<string | null>(null)
  const aprendeu = ultimo?.status === 'pronto' ? String(ultimo.pedido.aprendizado ?? '') : ''
  // só mostra o aprendizado do último ajuste feito há pouco (nesta conversa com a peça)
  const recente = ultimo?.terminado_em && Date.now() - new Date(ultimo.terminado_em).getTime() < 30 * 60 * 1000

  const pedir = async () => {
    if (!texto.trim()) return
    setErro(null)
    const m = await pedirAjuste(peca, texto.trim(), { lembrar: guardar })
    if (m) return setErro(m)
    setTexto(''); aoPedir()
  }
  const naoGuardar = async () => { await esquecer(EMPRESA, 'marketing', aprendeu); setEsquecido(aprendeu) }

  if (rodando) return <div className="progresso"><div className="indeterminado" /><span>O agente está reescrevendo esta peça…</span></div>
  return (
    <div className="mk-ajuste">
      {ultimo?.status === 'erro' && recente && <Erro msg={ultimo.erro} />}
      {aprendeu && recente && esquecido !== aprendeu && (
        <div className="peca-aprendeu"><span>O agente aprendeu: <b>{aprendeu}</b></span><span className="muted pequeno">Vale para as próximas peças.</span><button className="btn btn-mini" onClick={naoGuardar}>Não guardar</button></div>
      )}
      <div className="mk-ajuste-linha">
        <span className="mk-ajuste-campo"><Icone nome="floco" tam={16} /><input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pedir()} placeholder={peca.tipo === 'reels' ? 'Ex.: o gancho está fraco; comece com uma pergunta sobre o medo de intercorrência' : 'Descreva o ajuste desejado…'} /></span>
        <button className="btn btn-ouro" disabled={!texto.trim()} onClick={pedir}>Pedir ajuste</button>
      </div>
      <label className="peca-lembrar"><input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} /> Lembrar disso nas próximas peças (o agente guarda o gosto na memória)</label>
      <Erro msg={erro} />
    </div>
  )
}
