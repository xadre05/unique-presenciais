// Duas visões do Planejamento: Quadro (colunas por etapa) e Calendário (colunas por dia, uma semana por vez).
// Arrastar um cartão muda a etapa (no quadro) ou o dia (no calendário). O "+" de cada coluna cria uma peça.
import { useState, type DragEvent, type ReactNode } from 'react'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { CartaoPeca } from './CartaoPeca'
import { ETAPAS, etapaDe, type Etapa } from './etapas'

type Comum = { pecas: Peca[]; aoAbrir: (p: Peca) => void; ocupadas: Set<string>; aoMover: (p: Peca, etapa: Etapa) => void; aoTirar: (p: Peca) => void }

function useSoltar(aoSoltar: (id: string) => void) {
  const [sobre, setSobre] = useState(false)
  return {
    sobre,
    props: {
      onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes('text/peca')) { e.preventDefault(); setSobre(true) } },
      onDragLeave: () => setSobre(false),
      onDrop: (e: DragEvent) => { e.preventDefault(); setSobre(false); const id = e.dataTransfer.getData('text/peca'); if (id) aoSoltar(id) },
    },
  }
}

function Coluna({ cabeca, aoSoltar, classe, children, cor }: { cabeca: ReactNode; aoSoltar?: (id: string) => void; classe: string; children: ReactNode; cor?: string }) {
  const { sobre, props } = useSoltar(aoSoltar ?? (() => undefined))
  return <div className={`${classe}${sobre ? ' sobre' : ''}`} style={cor ? { ['--cor-etapa' as string]: cor } : undefined} {...(aoSoltar ? props : {})}><header>{cabeca}</header><div className="mk-coluna-corpo">{children}</div></div>
}

const Mais = ({ titulo, aoClicar }: { titulo: string; aoClicar: () => void }) => <button type="button" className="mk-mais" title={titulo} aria-label={titulo} onClick={aoClicar}><Icone nome="mais" tam={16} /></button>

export function QuadroEtapas({ pecas, aoAbrir, ocupadas, aoMover, aoTirar, aoNova }: Comum & { aoNova: () => void }) {
  return (
    <div className="mk-quadro">
      {ETAPAS.map((e) => {
        const daEtapa = pecas.filter((p) => etapaDe(p) === e.id)
        return (
          <Coluna key={e.id} classe="mk-coluna" cor={e.cor}
            cabeca={<><Icone nome={e.icone} tam={20} /><b>{e.nome}</b><span className="mk-conta">{daEtapa.length}</span><Mais titulo="Nova peça" aoClicar={aoNova} /></>}
            aoSoltar={(id) => { const p = pecas.find((x) => x.id === id); if (p && etapaDe(p) !== e.id) aoMover(p, e.id) }}>
            {daEtapa.map((p) => <CartaoPeca key={p.id} peca={p} modo="quadro" aoAbrir={() => aoAbrir(p)} trabalhando={ocupadas.has(p.id)} aoMover={(et) => aoMover(p, et)} aoTirar={() => aoTirar(p)} />)}
            {!daEtapa.length && (
              <div className="mk-coluna-vazia"><Icone nome={e.icone} tam={26} /><b>Nenhuma peça</b><span>Arraste uma peça para cá ou clique em + para criar.</span></div>
            )}
          </Coluna>
        )
      })}
    </div>
  )
}

// colunas = os dias mostrados (uma semana, ou um dia só); dias fora do período aparecem apagados
export function Calendario({ colunas, dentro, pecas, aoAbrir, ocupadas, aoMover, aoTirar, aoMudarDia, aoAbrirDia, aoCriarNoDia }: Comum & {
  colunas: string[]; dentro: (dia: string) => boolean; aoMudarDia: (p: Peca, dia: string) => void; aoAbrirDia?: (dia: string) => void; aoCriarNoDia: (dia: string) => void
}) {
  const umDia = colunas.length === 1
  return (
    <div className={`mk-calendario${umDia ? ' um-dia' : ''}`}>
      {colunas.map((d) => {
        const data = new Date(d + 'T12:00:00')
        const semana = data.toLocaleDateString('pt-BR', { weekday: umDia ? 'long' : 'short' }).replace('.', '')
        const rotulo = `${semana.charAt(0).toUpperCase()}${semana.slice(1)}`
        const curta = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        if (!dentro(d)) return <div key={d} className="mk-dia fora"><header><span className="mk-dia-cab"><b>{rotulo}</b><span>{curta}</span></span></header></div>
        const doDia = pecas.filter((p) => p.dia === d).sort((a, b) => (a.conteudo.horario ?? '99').localeCompare(b.conteudo.horario ?? '99'))
        return (
          <Coluna key={d} classe="mk-dia" aoSoltar={(id) => { const p = pecas.find((x) => x.id === id); if (p && p.dia !== d) aoMudarDia(p, d) }}
            cabeca={<>
              <button type="button" className="mk-dia-cab" title={aoAbrirDia ? 'Ver só este dia' : undefined} onClick={() => aoAbrirDia?.(d)}><b>{rotulo}</b><span>{curta}</span></button>
              <Mais titulo="Criar neste dia" aoClicar={() => aoCriarNoDia(d)} />
            </>}>
            {doDia.map((p) => <CartaoPeca key={p.id} peca={p} modo="calendario" aoAbrir={() => aoAbrir(p)} trabalhando={ocupadas.has(p.id)} aoMover={(et) => aoMover(p, et)} aoTirar={() => aoTirar(p)} />)}
            {!doDia.length && <button type="button" className="mk-criar-dia" onClick={() => aoCriarNoDia(d)}><Icone nome="mais" tam={18} /><span>Criar neste dia</span></button>}
          </Coluna>
        )
      })}
    </div>
  )
}
