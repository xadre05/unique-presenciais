// Coluna da direita do Planejar: "Retomar de onde parou" (as conversas e propostas recentes, com o que falta em cada
// uma) e "Neste planejamento" (o resumo do que está escolhido: período, campanha e canais).
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import { REDES, type Rede } from '../redes'
import type { Reuniao } from './dados'

const SITUACAO: Record<Reuniao['status'], { nome: string; acao: string; classe: string }> = {
  aberta: { nome: 'Em reunião', acao: 'Retomar', classe: 'azul' },
  plano: { nome: 'Proposta para revisar', acao: 'Revisar', classe: 'ouro' },
  fechada: { nome: 'Plano aprovado', acao: 'Ver', classe: 'verde' },
}

export function Retomar({ recentes, aoAbrir }: { recentes: Reuniao[]; aoAbrir: (id: string) => void }) {
  const [todas, setTodas] = useState(false)
  if (!recentes.length) return null
  const lista = todas ? recentes : recentes.slice(0, 3)
  return (
    <section className="mk-painel pl-lado-bloco">
      <h3 className="pl-lado-titulo"><Icone nome="relogio" tam={20} /> Retomar de onde parou</h3>
      <ul className="pl-retomar">{lista.map((r) => {
        const s = SITUACAO[r.status]
        const sub = r.ata?.objetivo || (r.ata?.assuntos?.length ? `${r.ata.assuntos.length} ${r.ata.assuntos.length === 1 ? 'assunto sugerido' : 'assuntos sugeridos'}` : 'Conversa iniciada')
        return (
          <li key={r.id}><Icone nome={r.status === 'aberta' ? 'mensagem' : 'documento'} tam={20} />
            <div><span className="pl-retomar-topo"><b>{r.titulo}</b><span className={`pl-selo ${s.classe}`}>{s.nome}</span></span>
              <small className="muted">{sub}</small></div>
            <button type="button" className="link pl-retomar-acao" onClick={() => aoAbrir(r.id)}>{s.acao} <Icone nome="seta_dir" tam={13} /></button></li>
        )
      })}</ul>
      {recentes.length > 3 && <button type="button" className="btn btn-mini" onClick={() => setTodas(!todas)}>{todas ? 'Ver menos' : `Ver todas (${recentes.length})`}</button>}
    </section>
  )
}

type Resumo = { periodo: string; campanha?: { nome: string; ativa: boolean }; canais: string[]; agenteDefine: boolean }

export function NestePlanejamento({ periodo, campanha, canais, agenteDefine }: Resumo) {
  return (
    <section className="mk-painel pl-lado-bloco">
      <h3 className="pl-lado-titulo"><Icone nome="agenda" tam={20} /> Neste planejamento</h3>
      <dl className="pl-resumo">
        <div><dt>Período</dt><dd>{periodo}</dd></div>
        <div><dt>Campanha</dt><dd>{campanha ? <>{campanha.nome} {campanha.ativa && <span className="pl-ativa"><i /> Ativa</span>}</> : 'Sem campanha'}</dd></div>
        <div><dt>Canais</dt><dd>{agenteDefine || !canais.length ? 'A confirmar na reunião' : canais.map((c) => REDES[c as Rede]?.nome ?? c).join(', ')}</dd></div>
      </dl>
    </section>
  )
}
