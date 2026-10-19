// "Ajuda para escrever a orientação": o que uma boa orientação diz neste formato, frases prontas para clicar
// (com as pessoas e imagens da própria peça) e um exemplo completo. Vale para todos os formatos (guiasOrientacao.ts).
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { guiaDe, type Uso } from './guiasOrientacao'

type Props = { uso: Uso; tipo: string; valor: string; mudar: (v: string) => void; pessoas?: string[]; imagens?: string[] }

export function AjudaOrientacao({ uso, tipo, valor, mudar, pessoas = [], imagens = [] }: Props) {
  const [aberta, setAberta] = useState(false)
  const guia = guiaDe(uso)
  const contexto = { pessoas, imagens, tipo }
  const exemplo = guia.exemplo(contexto)
  const usar = (f: string) => mudar(valor.trim() ? `${valor.trim().replace(/[;.]$/, '')}; ${f}` : f.charAt(0).toUpperCase() + f.slice(1))
  const comPessoa = uso === 'arte' || uso === 'tela' || uso === 'capa'
  return (
    <div className="orienta-ajuda">
      <button type="button" className="link pequeno" onClick={() => setAberta(!aberta)}><Icone nome="floco" tam={14} /> {aberta ? 'Fechar a ajuda' : 'Ajuda para escrever a orientação'}</button>
      {aberta && (<>
        <p className="muted pequeno">Uma boa orientação diz: <b>{guia.checklist}</b>. Clique para acrescentar e depois ajuste do seu jeito.</p>
        {guia.grupos(contexto).map((g) => (
          <div key={g.nome} className="orienta-grupo"><span className="muted pequeno">{g.nome}</span>
            <div className="orienta-frases">{g.frases.map((f) => <button key={f} type="button" onClick={() => usar(f)}><Icone nome="mais" tam={12} /> {f}</button>)}</div>
          </div>
        ))}
        {comPessoa && !pessoas.length && <span className="muted pequeno">Para alguém aparecer, escolha em "Quem aparece nesta arte?" (na Direção visual). A IA mantém o rosto das fotos e muda roupa, pose e cenário como você pedir.</span>}
        <div className="orienta-exemplo"><span className="muted pequeno">Exemplo completo</span><p>{exemplo}</p>
          <button type="button" className="btn btn-mini" onClick={() => mudar(exemplo)}>Usar este exemplo</button></div>
      </>)}
    </div>
  )
}

// sugestões rápidas embaixo do "O que deseja ajustar?": um clique preenche o pedido
export function SugestoesAjuste({ sugestoes, usar }: { sugestoes: string[]; usar: (s: string) => void }) {
  return (
    <div className="orienta-frases orienta-sugestoes">
      {sugestoes.map((s) => <button key={s} type="button" onClick={() => usar(s)}><Icone nome="mais" tam={12} /> {s}</button>)}
    </div>
  )
}
