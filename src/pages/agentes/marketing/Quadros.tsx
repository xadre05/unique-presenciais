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

export function Calendario({ inicio, quantos = 7, pecas, aoAbrir, ocupadas, aoMudarDia, aoAbrirDia, aoCriarNoDia }: Comum & {
  inicio: string; quantos?: number; aoMudarDia: (p: Peca, dia: string) => void; aoAbrirDia?: (dia: string) => void; aoCriarNoDia: (dia: string) => void
}) {
  const dias = Array.from({ length: quantos }, (_, i) => somaDias(inicio, i))
  // mês e período: espaços vazios antes do 1º dia, para cada coluna ser sempre o mesmo dia da semana
  const vazios = quantos > 7 ? (new Date(inicio + 'T12:00:00').getDay() + 6) % 7 : 0
  const semDia = pecas.filter((p) => !p.dia)
  return (
    <>
      <div className={`mk-calendario${quantos === 1 ? ' um-dia' : ''}${quantos > 7 ? ' mes' : ''}`} style={{ ['--dias' as string]: quantos }}>
        {Array.from({ length: vazios }, (_, i) => <div key={`v${i}`} className="mk-dia-vazio" />)}
        {dias.map((d) => {
          const doDia = pecas.filter((p) => p.dia === d).sort((a, b) => (a.conteudo.horario ?? '99').localeCompare(b.conteudo.horario ?? '99'))
          const data = new Date(d + 'T12:00:00')
          const semana = data.toLocaleDateString('pt-BR', { weekday: 'long' })
          return (
            <Coluna key={d} classe="mk-dia" aoSoltar={(id) => { const p = pecas.find((x) => x.id === id); if (p && p.dia !== d) aoMudarDia(p, d) }}
              cabeca={<>
                <button type="button" className="mk-dia-cab" title={aoAbrirDia ? 'Ver só este dia' : undefined} onClick={() => aoAbrirDia?.(d)}>
                  <b>{quantos > 7 ? semana.slice(0, 3) : semana.charAt(0).toUpperCase() + semana.slice(1)}</b><span>{data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</span>
                </button>
                <button type="button" className="mk-mais" title="Criar neste dia" onClick={() => aoCriarNoDia(d)}><Icone nome="mais" tam={16} /></button>
              </>}>
              {doDia.map((p) => <CartaoPeca key={p.id} peca={p} modo="calendario" aoAbrir={() => aoAbrir(p)} trabalhando={ocupadas.has(p.id)} />)}
              {!doDia.length && quantos <= 7 && <button type="button" className="mk-criar-dia" onClick={() => aoCriarNoDia(d)}><Icone nome="mais" tam={22} /><span>Criar neste dia</span></button>}
            </Coluna>
          )
        })}
      </div>
      {!!semDia.length && <p className="pequeno muted">Sem dia definido: {semDia.map((p) => <button key={p.id} className="link" onClick={() => aoAbrir(p)}>{p.titulo}</button>)} — abra a peça e escolha o dia.</p>}
      <div className="mk-legenda">{ETAPAS.map((e) => <span key={e.id} className="mk-ponto" style={{ ['--cor-etapa' as string]: e.cor }}>{e.id === 'ideia' ? 'Ideia' : e.nome}</span>)}</div>
    </>
  )
}
