// A ficha que o agente escreveu sobre uma referência: o formato decomposto e como trazer para a marca.
import type { Ficha } from './dados'

const CAMPOS: [keyof Ficha, string][] = [
  ['edicao', 'Como editar neste estilo'], ['variacoes', 'Tipos de vídeo do canal'], ['gancho', 'Gancho'], ['argumento', 'Argumento'], ['prova', 'Prova'], ['oferta', 'Oferta'], ['visual', 'Visual'], ['texto_na_tela', 'Texto na tela'], ['ritmo', 'Ritmo e edição'],
  ['linguagem', 'Linguagem'], ['por_que_funciona', 'Por que funciona'], ['como_usar', 'Como usar na marca'], ['nao_copiar', 'O que não copiar'],
]

export function FichaReferencia({ ficha }: { ficha: Ficha }) {
  return (
    <dl className="ref-ficha">
      {!!ficha.estrutura?.length && <><dt>Estrutura</dt><dd><ol>{ficha.estrutura.map((p, i) => <li key={i}>{p}</li>)}</ol></dd></>}
      {CAMPOS.map(([k, nome]) => ficha[k] ? <div key={k} className="ref-ficha-item"><dt>{nome}</dt><dd>{String(ficha[k])}</dd></div> : null)}
    </dl>
  )
}
