// Duas visões da semana: Quadro (colunas por etapa) e Calendário (colunas por dia).
// Arrastar um cartão muda a etapa (no quadro) ou o dia (no calendário).
import { useState, type DragEvent, type ReactNode } from 'react'
import { Icone } from '../../../components/Icone'
import { somaDias, type Peca } from '../comum'
import { CartaoPeca } from './CartaoPeca'
import { ETAPAS, etapaDe, type Etapa } from './etapas'

type Comum = { pecas: Peca[]; aoAbrir: (p: Peca) => void; ocupadas: Set<string> }

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

function Coluna({ cabeca, aoSoltar, classe, children, cor }: { cabeca: ReactNode; aoSoltar: (id: string) => void; classe: string; children: ReactNode; cor?: string }) {
  const { sobre, props } = useSoltar(aoSoltar)
  return <div className={`${classe}${sobre ? ' sobre' : ''}`} style={cor ? { ['--cor-etapa' as string]: cor } : undefined} {...props}><header>{cabeca}</header><div className="mk-coluna-corpo">{children}</div></div>
}

export function QuadroEtapas({ pecas, aoAbrir, ocupadas, aoMover, aoNova }: Comum & { aoMover: (p: Peca, etapa: Etapa) => void; aoNova: () => void }) {
  return (
    <div className="mk-quadro">
      {ETAPAS.map((e) => {
        const daEtapa = pecas.filter((p) => etapaDe(p) === e.id)
        return (
          <Coluna key={e.id} classe="mk-coluna" cor={e.cor}
            cabeca={<><Icone nome={e.icone} tam={18} /><b>{e.nome}</b><span className="mk-conta">{daEtapa.length}</span>{e.id === 'ideia' && <button className="mk-mais" title="Nova peça" onClick={aoNova}><Icone nome="mais" tam={16} /></button>}</>}
            aoSoltar={(id) => { const p = pecas.find((x) => x.id === id); if (p && etapaDe(p) !== e.id) aoMover(p, e.id) }}>
            {daEtapa.map((p) => <CartaoPeca key={p.id} peca={p} modo="quadro" aoAbrir={() => aoAbrir(p)} trabalhando={ocupadas.has(p.id)} />)}
            {!daEtapa.length && <span className="mk-vazio">Arraste uma peça para cá</span>}
          </Coluna>
        )
      })}
    </div>
  )
}

export function Calendario({ inicio, pecas, aoAbrir, ocupadas, aoMudarDia }: Comum & { inicio: string; aoMudarDia: (p: Peca, dia: string) => void }) {
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(inicio, i))
  const semDia = pecas.filter((p) => !p.dia)
  return (
    <>
      <div className="mk-calendario">
        {dias.map((d) => {
          const doDia = pecas.filter((p) => p.dia === d).sort((a, b) => (a.conteudo.horario ?? '99').localeCompare(b.conteudo.horario ?? '99'))
          const data = new Date(d + 'T12:00:00')
          return (
            <Coluna key={d} classe="mk-dia" aoSoltar={(id) => { const p = pecas.find((x) => x.id === id); if (p && p.dia !== d) aoMudarDia(p, d) }}
              cabeca={<><b>{data.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')}</b><span>{data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span></>}>
              {doDia.map((p) => <CartaoPeca key={p.id} peca={p} modo="calendario" aoAbrir={() => aoAbrir(p)} trabalhando={ocupadas.has(p.id)} />)}
            </Coluna>
          )
        })}
      </div>
      {!!semDia.length && <p className="pequeno muted">Sem dia definido: {semDia.map((p) => <button key={p.id} className="link" onClick={() => aoAbrir(p)}>{p.titulo}</button>)} — abra a peça e escolha o dia.</p>}
      <div className="mk-legenda">{ETAPAS.map((e) => <span key={e.id} className="mk-ponto" style={{ ['--cor-etapa' as string]: e.cor }}>{e.id === 'ideia' ? 'Ideia' : e.nome}</span>)}</div>
    </>
  )
}
