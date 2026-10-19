// Voz da marca: o tom em poucas palavras e o perfil completo de como a marca fala (antes eram dois lugares).
// "Gerar a partir da biblioteca" traz uma proposta separada: a equipe lê e decide se usa no lugar do texto atual.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Campo, Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'

type Props = { empresa: string; tom: string; voz: string; aoMudar: (c: { tom?: string; voz?: string }) => void }

export function VozMarca({ empresa, tom, voz, aoMudar }: Props) {
  const [proposta, setProposta] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const gerar = async () => {
    setErro(null); setGerando(true)
    const { data, error } = await supabase.functions.invoke('agentes', { body: { voz: true, empresa } })
    setGerando(false)
    if (error || data?.erro) return setErro(data?.erro ?? 'O agente não conseguiu gerar agora. Tente de novo.')
    setProposta(String(data.perfil ?? ''))
  }
  return (
    <div className="bm-campos">
      <Campo rotulo="O tom, em poucas palavras" dica="Ex.: premium, próximo e técnico na medida">
        <input value={tom} maxLength={200} onChange={(e) => aoMudar({ tom: e.target.value })} />
      </Campo>
      <Campo rotulo="Como a marca fala" dica="Como explica, os termos que usa, as expressões que repete, no que acredita, e exemplos de como escrever e de como não escrever.">
        <textarea rows={12} value={voz} onChange={(e) => aoMudar({ voz: e.target.value })} />
      </Campo>
      {proposta !== null ? (
        <div className="bm-proposta">
          <b><Icone nome="floco" tam={16} /> Proposta do agente, lida da biblioteca</b>
          <p className="muted pequeno">Ainda não está valendo. Leia e decida: usar no lugar do texto atual, ou descartar.</p>
          <pre>{proposta}</pre>
          <div className="ia-linha">
            <button type="button" className="btn btn-contorno-ouro" onClick={() => { aoMudar({ voz: proposta }); setProposta(null) }}>Usar esta proposta</button>
            <button type="button" className="btn btn-mini" onClick={() => setProposta(null)}>Descartar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-contorno bm-gerar" disabled={gerando} onClick={gerar}><Icone nome="floco" tam={16} /> {gerando ? 'Lendo a biblioteca… (até 1 minuto)' : 'Gerar uma proposta a partir da biblioteca'}</button>
      )}
      <Erro msg={erro} />
    </div>
  )
}
