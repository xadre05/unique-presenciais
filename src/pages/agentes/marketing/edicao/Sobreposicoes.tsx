// O que aparece por cima do vídeo: legenda palavra por palavra (a palavra falada acende) e o texto grande na tela.
import type { GrupoLegenda } from './linhaTempo'

export function Legenda({ grupo, t, caixaAlta, posicao }: { grupo: GrupoLegenda; t: number; caixaAlta: boolean; posicao: 'baixo' | 'meio' }) {
  return (
    <div className={`ev-legenda ${posicao}`}>
      {grupo.palavras.map((w, k) => (
        <span key={k} className={`${t >= w.ini ? 'dita' : ''}${w.destaque ? ' destaque' : ''}`}>{caixaAlta ? w.texto.toUpperCase() : w.texto}</span>
      ))}
    </div>
  )
}

export function TextoNaTela({ texto, posicao }: { texto: string; posicao: 'topo' | 'meio' }) {
  return <div className={`ev-texto ${posicao}`}>{texto}</div>
}
