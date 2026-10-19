// Uma análise do agente aberta: título e data, resumo, o que mudou entre os períodos, o que funcionou e o que não
// (com o porquê), recomendações e os aprendizados para ensinar (cartões).
import type { Analise } from './dados'
import { NOME_TIPO_ANALISE, quando, type AnaliseGuardada } from './analises'
import { Aprendizados } from './Aprendizados'

function Padroes({ titulo, itens, classe }: { titulo: string; itens: Analise['funcionou']; classe: string }) {
  if (!itens?.length) return null
  return (
    <div className={`ig-padroes ${classe}`}><h5>{titulo}</h5>
      <ul>{itens.map((x, i) => <li key={i}><b>{x.padrao}</b><span>{x.porque}</span>{!!x.exemplos?.length && <small className="muted">Ex.: {x.exemplos.join(' · ')}</small>}</li>)}</ul>
    </div>
  )
}

export function VerAnalise({ empresa, analise, aoMudar }: { empresa: string; analise: AnaliseGuardada; aoMudar: () => void }) {
  const r = analise.resultado
  return (
    <div className="va-analise">
      <p className="ig-titulo-analise"><b>{analise.titulo ?? NOME_TIPO_ANALISE[analise.tipo]}</b> <span className="muted pequeno">· {quando(analise.criado_em)} · {r.posts} posts · alcance mediano {r.mediana}</span></p>
      <p>{r.resumo}</p>
      {!!r.comparacao?.length && <><h5 className="reu-subtitulo">O que mudou</h5><ul className="ig-recom">{r.comparacao.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
      <div className="ig-padroes-grade">
        <Padroes titulo="Funcionou" itens={r.funcionou} classe="bom" />
        <Padroes titulo="Não funcionou" itens={r.nao_funcionou} classe="ruim" />
      </div>
      {!!r.recomendacoes?.length && <><h5 className="reu-subtitulo">Recomendações</h5><ul className="ig-recom">{r.recomendacoes.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
      <Aprendizados key={analise.id} empresa={empresa} analise={analise} aoMudar={aoMudar} />
    </div>
  )
}
