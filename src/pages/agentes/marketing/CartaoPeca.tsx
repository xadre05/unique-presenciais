// Cartão de uma peça (quadro e calendário). Clica para abrir na Produção; arrasta para mudar de etapa ou de dia;
// o menu "⋯" abre, muda a etapa ou tira a peça do planejamento.
import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../../components/Icone'
import { dataLonga, type Peca } from '../comum'
import { REDES, nomeFormato, redeDe } from './redes'
import { LogoRede } from './LogoRede'
import { COR_TIPO, ETAPA, ETAPAS, etapaDe, type Etapa } from './etapas'

type Props = { peca: Peca; aoAbrir: () => void; modo: 'quadro' | 'calendario'; trabalhando?: boolean; aoMover?: (etapa: Etapa) => void; aoTirar?: () => void }

function Menu({ etapa, aoAbrir, aoMover, aoTirar }: { etapa: Etapa | 'descartada'; aoAbrir: () => void; aoMover?: (e: Etapa) => void; aoTirar?: () => void }) {
  // posição na tela: o menu flutua por cima das colunas (que têm rolagem e cortariam o menu)
  const [aberto, setAberto] = useState<{ top: number; left: number } | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(null) }
    const fechar = () => setAberto(null)
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc); window.addEventListener('scroll', fechar, true); window.addEventListener('resize', fechar)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', fechar, true); window.removeEventListener('resize', fechar) }
  }, [aberto])
  const fazer = (f?: () => void) => (ev: React.MouseEvent) => { ev.stopPropagation(); setAberto(null); f?.() }
  return (
    <div className="mk-cartao-menu" ref={caixa} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mk-pontos" aria-label="Opções da peça" aria-expanded={!!aberto} onClick={(ev) => { if (aberto) return setAberto(null); const r = ev.currentTarget.getBoundingClientRect(); setAberto({ top: Math.min(r.bottom + 4, window.innerHeight - 320), left: Math.max(8, Math.min(r.right - 220, window.innerWidth - 228)) }) }}><Icone nome="pontos" tam={16} /></button>
      {aberto && (
        <div className="mk-menu" role="menu" style={{ position: 'fixed', top: aberto.top, left: aberto.left, right: 'auto' }}>
          <button type="button" role="menuitem" onClick={fazer(aoAbrir)}><Icone nome="documento" tam={15} /> Abrir peça</button>
          {aoMover && <><span className="mk-menu-titulo">Mover para</span>
            {ETAPAS.filter((e) => e.id !== etapa).map((e) => <button key={e.id} type="button" role="menuitem" onClick={fazer(() => aoMover(e.id))}><i style={{ background: e.cor }} />{e.nome}</button>)}</>}
          {aoTirar && <button type="button" role="menuitem" className="perigo" onClick={fazer(aoTirar)}><Icone nome="fechar" tam={15} /> Tirar do planejamento</button>}
        </div>
      )}
    </div>
  )
}

export function CartaoPeca({ peca, aoAbrir, modo, trabalhando, aoMover, aoTirar }: Props) {
  const etapa = etapaDe(peca)
  const e = etapa === 'descartada' ? null : ETAPA[etapa]
  const rede = redeDe(peca)
  const livre = !!peca.conteudo.livre
  // o logo já mostra o canal; o texto diz o formato (o nome do canal fica no título do cartão para leitores de tela)
  const formato = livre ? 'Canal a definir' : nomeFormato(peca.tipo, rede)
  return (
    <div
      role="button" tabIndex={0} draggable className={`mk-cartao${trabalhando ? ' trabalhando' : ''}`} style={{ ['--cor-tipo' as string]: COR_TIPO[peca.tipo] ?? '#888' }}
      onClick={aoAbrir} onKeyDown={(ev) => { if (ev.key === 'Enter') aoAbrir() }}
      onDragStart={(ev) => { ev.dataTransfer.setData('text/peca', peca.id); ev.dataTransfer.effectAllowed = 'move' }}
    >
      <div className="mk-cartao-topo">
        <span className="mk-cartao-tipo" title={livre ? undefined : `${REDES[rede].nome} · ${nomeFormato(peca.tipo, rede)}`}>{livre ? <Icone nome="ideia" tam={14} /> : <LogoRede rede={rede} tam={14} />}{formato}</span>
        <Menu etapa={etapa} aoAbrir={aoAbrir} aoMover={aoMover} aoTirar={aoTirar} />
      </div>
      <b className="mk-cartao-titulo">{peca.titulo}</b>
      {peca.conteudo.proposta && etapa === 'ideia' && <span className="mk-cartao-linha mk-agente-escrevendo">Proposta do agente</span>}
      {modo === 'quadro'
        ? peca.dia && <span className="mk-cartao-linha"><Icone nome="agenda" tam={14} />{dataLonga(peca.dia)}{peca.conteudo.horario ? ` · ${peca.conteudo.horario}` : ''}</span>
        : <span className="mk-cartao-linha"><Icone nome="relogio" tam={14} />{peca.conteudo.horario || 'Sem horário'}</span>}
      {peca.conteudo.pendencia && etapa !== 'publicado' && <span className="mk-pendente"><Icone nome="alerta" tam={13} />Pendência na oferta</span>}
      {trabalhando && <span className="mk-cartao-linha mk-agente-escrevendo">O agente está escrevendo…</span>}
      {modo === 'calendario' && e && <span className="mk-ponto" style={{ ['--cor-etapa' as string]: e.cor }}>{e.id === 'ideia' ? 'Ideia' : e.nome}</span>}
    </div>
  )
}
