// Um lugar só para pedir análise ao agente: a equipe escolhe O QUE ele analisa (os posts do filtro, a comparação de
// períodos, um marco ou a última semana) e pede. Cada escolha gera um tipo de análise diferente, guardada no histórico.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import type { FiltroAnalise } from './dados'

export type OpcaoAnalise = { id: string; titulo: string; explica: string; motivo?: string; filtro?: FiltroAnalise; semanal?: boolean }
type Props = {
  opcoes: OpcaoAnalise[]; analisando: boolean; aoPedir: (o: OpcaoAnalise) => void
  revisaoLigada: boolean; aoLigarRevisao: (ligada: boolean) => void
}

export function PedirAnalise({ opcoes, analisando, aoPedir, revisaoLigada, aoLigarRevisao }: Props) {
  const [escolhida, setEscolhida] = useState(opcoes.find((o) => !o.motivo)?.id ?? '')
  const atual = opcoes.find((o) => o.id === escolhida && !o.motivo)
  return (
    <div className="pa-bloco">
      <h5 className="reu-subtitulo">O que o agente deve analisar?</h5>
      <ul className="pa-opcoes">{opcoes.map((o) => (
        <li key={o.id}>
          <label className={`pa-opcao${escolhida === o.id ? ' ativa' : ''}${o.motivo ? ' fora' : ''}`}>
            <input type="radio" name="pa-opcao" checked={escolhida === o.id} disabled={!!o.motivo} onChange={() => setEscolhida(o.id)} />
            <span><b>{o.titulo}</b><small className="muted">{o.motivo ?? o.explica}</small></span>
          </label>
          {o.semanal && <label className="pa-sozinho"><input type="checkbox" checked={revisaoLigada} onChange={(e) => aoLigarRevisao(e.target.checked)} />
            <span className="pequeno">Fazer sozinho toda segunda às 7h <span className="muted">(cerca de 10 créditos por semana)</span></span></label>}
        </li>))}</ul>
      <div className="ia-linha"><button type="button" className="btn btn-ouro" disabled={analisando || !atual} onClick={() => atual && aoPedir(atual)}>
        <Icone nome="floco" tam={16} /> {analisando ? 'Analisando… (até 1 minuto)' : 'Pedir análise'}</button>
        <span className="muted pequeno">Cada análise usa cerca de 10 créditos e fica guardada no histórico abaixo.</span></div>
    </div>
  )
}
