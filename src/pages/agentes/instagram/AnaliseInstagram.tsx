// A análise do agente sobre os posts do Instagram: resumo, o que funcionou e o que não (com o porquê),
// recomendações e aprendizados. Cada aprendizado pode ir para a memória do agente (vale em toda peça nova).
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { lembrar } from '../memoria'
import { EMPRESA } from '../marketing/useMarketing'
import type { Analise } from './dados'

type Props = { empresa: string; analise: Analise | null; analisando: boolean; podeAnalisar: boolean; aoAnalisar: () => void }

function Padroes({ titulo, itens, classe }: { titulo: string; itens: Analise['funcionou']; classe: string }) {
  if (!itens?.length) return null
  return (
    <div className={`ig-padroes ${classe}`}><h5>{titulo}</h5>
      <ul>{itens.map((x, i) => <li key={i}><b>{x.padrao}</b><span>{x.porque}</span>{!!x.exemplos?.length && <small className="muted">Ex.: {x.exemplos.join(' · ')}</small>}</li>)}</ul>
    </div>
  )
}

export function AnaliseInstagram({ empresa, analise, analisando, podeAnalisar, aoAnalisar }: Props) {
  const [guardados, setGuardados] = useState<string[]>([])
  const guardar = async (t: string) => { const r = await lembrar(empresa || EMPRESA, 'marketing', t, 'manual'); if (!r.error) setGuardados((g) => [...g, t]) }
  return (
    <section className="mk-painel ig-analise">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="ideia" tam={22} /></span>
        <div><h3>O que funcionou e por quê</h3><span className="muted pequeno">{analise ? `Análise de ${new Date(analise.em).toLocaleDateString('pt-BR')}, com ${analise.posts} posts (alcance mediano ${analise.mediana}).` : 'O agente compara cada post com a mediana da conta e aponta os padrões.'}</span></div>
        <button type="button" className="btn btn-contorno-ouro" disabled={analisando || !podeAnalisar} onClick={aoAnalisar}><Icone nome="floco" tam={16} /> {analisando ? 'Analisando… (até 1 minuto)' : analise ? 'Analisar de novo' : 'Pedir análise ao agente'}</button>
      </header>
      {!podeAnalisar && <p className="muted pequeno">A análise libera com pelo menos 5 posts lidos.</p>}
      {analise && (<>
        <p>{analise.resumo}</p>
        <div className="ig-padroes-grade">
          <Padroes titulo="Funcionou" itens={analise.funcionou} classe="bom" />
          <Padroes titulo="Não funcionou" itens={analise.nao_funcionou} classe="ruim" />
        </div>
        {!!analise.recomendacoes?.length && <><h5 className="reu-subtitulo">Recomendações</h5><ul className="ig-recom">{analise.recomendacoes.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
        {!!analise.aprendizados?.length && <><h5 className="reu-subtitulo">Aprendizados para o agente</h5>
          <ul className="ig-aprendizados">{analise.aprendizados.map((a) => (
            <li key={a}><span>{a}</span>{guardados.includes(a)
              ? <span className="muted pequeno"><Icone nome="check" tam={14} /> Na memória</span>
              : <button type="button" className="btn btn-mini" onClick={() => guardar(a)}><Icone nome="mais" tam={13} /> Guardar na memória</button>}</li>))}</ul>
          <span className="muted pequeno">O que vai para a memória vale em toda peça nova e aparece em Configurar agente, onde dá para tirar.</span></>}
      </>)}
    </section>
  )
}
