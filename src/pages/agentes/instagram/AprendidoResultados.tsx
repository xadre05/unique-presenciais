// O que o agente aprendeu com os resultados dos posts: as regras ensinadas a partir das análises, com a análise de
// onde vieram e a data. Tirar daqui tira da memória do agente (deixa de valer nas próximas peças).
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { esquecer, type Lembranca } from '../memoria'

type Props = { empresa: string; memoria: Lembranca[]; aoMudar: () => void }

export function AprendidoResultados({ empresa, memoria, aoMudar }: Props) {
  const [aberto, setAberto] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const daqui = memoria.filter((m) => m.origem === 'resultado').reverse()
  const tirar = async (texto: string) => { setOcupado(texto); await esquecer(empresa, 'marketing', texto); setOcupado(null); aoMudar() }
  return (
    <section className="mk-painel ap-aprendido">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="livro" tam={22} /></span>
        <div><h3>O que o agente aprendeu com os resultados</h3>
          <span className="muted pequeno">{daqui.length ? `${daqui.length} ${daqui.length === 1 ? 'regra vale' : 'regras valem'} em toda peça nova.` : 'Nada ainda. Ensine os aprendizados das análises acima.'}</span></div>
        {daqui.length > 0 && <button type="button" className="btn btn-mini" onClick={() => setAberto((a) => !a)}>{aberto ? 'Esconder' : 'Ver as regras'}</button>}
      </header>
      {aberto && <ul className="ap-memoria">{daqui.map((m) => (
        <li key={m.texto}><span>{m.texto}<small className="muted">{m.fonte ?? 'Análise'} · {new Date(m.em).toLocaleDateString('pt-BR')}</small></span>
          <button type="button" className="btn btn-mini" disabled={ocupado === m.texto} onClick={() => tirar(m.texto)}><Icone nome="fechar" tam={13} /> Tirar</button></li>))}</ul>}
    </section>
  )
}
