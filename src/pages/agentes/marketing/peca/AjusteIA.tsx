// "O que deseja ajustar?": pedido ao agente com alcance escolhido (só esta lâmina, a legenda, a peça inteira…).
// "Sugerir como preferência do agente" guarda o gosto na memória para as próximas peças.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { esquecer } from '../../memoria'
import type { Peca, Trabalho } from '../../comum'
import { pedirAjuste } from '../ajuste'
import { EMPRESA } from '../useMarketing'

export type Alcance = { id: string; nome: string; instrucao: (pedido: string) => string }

type Props = {
  peca: Peca; rodando: Trabalho | null; ultimo: Trabalho | null; titulo: string; placeholder: string
  alcances: Alcance[]; antes: () => Promise<unknown>; aoPedir: () => void
}

export function AjusteIA({ peca, rodando, ultimo, titulo, placeholder, alcances, antes, aoPedir }: Props) {
  const [texto, setTexto] = useState('')
  const [alcance, setAlcance] = useState(alcances[0]?.id ?? '')
  const [guardar, setGuardar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [esquecido, setEsquecido] = useState<string | null>(null)
  const aprendeu = ultimo?.status === 'pronto' ? String(ultimo.pedido.aprendizado ?? '') : ''
  const recente = ultimo?.terminado_em && Date.now() - new Date(ultimo.terminado_em).getTime() < 30 * 60 * 1000
  const escolhido = alcances.find((a) => a.id === alcance) ?? alcances[0]

  const pedir = async () => {
    const pedido = texto.trim()
    if (!pedido || !escolhido) return
    setErro(null)
    await antes()
    const m = await pedirAjuste(peca, escolhido.instrucao(pedido), { lembrar: guardar, nota: `${escolhido.nome}: ${pedido}`.slice(0, 160) })
    if (m) return setErro(m)
    setTexto(''); aoPedir()
  }

  if (rodando) return <div className="pp-ajuste"><div className="progresso"><div className="indeterminado" /><span>O agente está fazendo o ajuste…</span></div></div>
  return (
    <div className="pp-ajuste">
      {ultimo?.status === 'erro' && recente && <Erro msg={ultimo.erro} />}
      {aprendeu && recente && esquecido !== aprendeu && (
        <div className="peca-aprendeu"><span>O agente aprendeu: <b>{aprendeu}</b></span><span className="muted pequeno">Vale para as próximas peças.</span>
          <button className="btn btn-mini" onClick={async () => { await esquecer(EMPRESA, 'marketing', aprendeu); setEsquecido(aprendeu) }}>Não guardar</button></div>
      )}
      <label className="pp-rotulo" htmlFor={`ajuste-${peca.id}`}>{titulo}</label>
      <textarea id={`ajuste-${peca.id}`} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) pedir() }} />
      <div className="pp-ajuste-linha">
        {alcances.length > 1 && (
          <label className="pp-ajuste-alcance"><span className="muted">Aplicar ajuste em:</span>
            <span className="select-icone"><select value={alcance} onChange={(e) => setAlcance(e.target.value)}>{alcances.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></span></label>
        )}
        <label className="pp-check"><input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} /> Sugerir como preferência do agente</label>
        <button className="btn btn-contorno-ouro" disabled={!texto.trim()} onClick={pedir}><Icone nome="floco" tam={16} /> Pedir ajuste à IA</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
