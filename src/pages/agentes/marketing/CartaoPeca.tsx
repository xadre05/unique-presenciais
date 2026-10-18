// Cartão pequeno de uma peça (quadro e calendário). Clica para abrir na Produção; arrasta para mudar de etapa ou de dia.
import { Icone } from '../../../components/Icone'
import { dataLonga, type Peca } from '../comum'
import { rotuloPeca } from './redes'
import { COR_TIPO, ETAPA, etapaDe, tamanho } from './etapas'

const ICONE_TIPO: Record<string, string> = { post: 'imagem', carrossel: 'quadro', reels: 'video', stories: 'celular', video: 'video' }

export function CartaoPeca({ peca, aoAbrir, modo, trabalhando }: { peca: Peca; aoAbrir: () => void; modo: 'quadro' | 'calendario'; trabalhando?: boolean }) {
  const etapa = etapaDe(peca)
  const e = etapa === 'descartada' ? null : ETAPA[etapa]
  return (
    <button
      type="button" draggable className={`mk-cartao${trabalhando ? ' trabalhando' : ''}`} style={{ ['--cor-tipo' as string]: COR_TIPO[peca.tipo] ?? '#888' }}
      onClick={aoAbrir} onDragStart={(ev) => { ev.dataTransfer.setData('text/peca', peca.id); ev.dataTransfer.effectAllowed = 'move' }}
    >
      <span className="mk-cartao-tipo"><Icone nome={ICONE_TIPO[peca.tipo] ?? 'documento'} tam={14} />{rotuloPeca(peca)}{tamanho(peca) && <i>· {tamanho(peca)}</i>}</span>
      <b className="mk-cartao-titulo">{peca.titulo}</b>
      {modo === 'quadro'
        ? peca.dia && <span className="mk-cartao-linha"><Icone nome="agenda" tam={14} />{dataLonga(peca.dia)}{peca.conteudo.horario ? ` · ${peca.conteudo.horario}` : ''}</span>
        : <span className="mk-cartao-linha"><Icone nome="relogio" tam={14} />{peca.conteudo.horario || 'sem horário'}</span>}
      {peca.conteudo.pendencia && etapa !== 'publicado' && <span className="mk-pendente"><Icone nome="alerta" tam={13} />Pendência na oferta</span>}
      {trabalhando && <span className="mk-cartao-linha mk-agente-escrevendo">O agente está escrevendo…</span>}
      {modo === 'calendario' && e && <span className="mk-ponto" style={{ ['--cor-etapa' as string]: e.cor }}>{e.nome === 'Ideias' ? 'Ideia' : e.nome}</span>}
    </button>
  )
}
