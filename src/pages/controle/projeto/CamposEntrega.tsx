// Partes do detalhe da entrega que gravam na hora: prioridade e prazo, o que está travando (bloqueio ou decisão
// pendente, quem resolve e o impacto) e a conferência "antes de publicar".
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Campo } from '../../../components/ui'
import { NOME_RESOLVE, PASSOS_PUBLICAR, PRIORIDADE, type Entrega, type Prioridade, type QuemResolve, type UsoProjeto } from './dados'

type Props = { entrega: Entrega; uso: UsoProjeto }
const gravarEm = (uso: UsoProjeto, id: string, c: Partial<Entrega>) => uso.gravar(() => supabase.from('proj_entregas').update(c).eq('id', id))

export function PrioridadePrazo({ entrega, uso }: Props) {
  return (
    <div className="form-grade">
      <Campo rotulo="Prioridade">
        <select value={entrega.prioridade} onChange={(e) => gravarEm(uso, entrega.id, { prioridade: e.target.value as Prioridade })}>
          {(Object.keys(PRIORIDADE) as Prioridade[]).map((p) => <option key={p} value={p}>{PRIORIDADE[p].rotulo}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Prazo">
        <input type="date" value={entrega.prazo ?? ''} onChange={(e) => gravarEm(uso, entrega.id, { prazo: e.target.value || null })} />
      </Campo>
    </div>
  )
}

// texto que grava quando sai do campo (não a cada letra)
function TextoGravado({ rotulo, valor, dica, aoGravar }: { rotulo: string; valor: string | null; dica?: string; aoGravar: (v: string | null) => void }) {
  const [t, setT] = useState(valor ?? '')
  return <Campo rotulo={rotulo} dica={dica}><input value={t} onChange={(e) => setT(e.target.value)} onBlur={() => t !== (valor ?? '') && aoGravar(t.trim() || null)} /></Campo>
}

export function Travas({ entrega, uso }: Props) {
  const g = (c: Partial<Entrega>) => gravarEm(uso, entrega.id, c)
  return (
    <div className="prj-travas">
      <TextoGravado rotulo="Bloqueio (o que impede de andar)" valor={entrega.bloqueio} dica="Deixe vazio se nada trava." aoGravar={(v) => g({ bloqueio: v })} />
      <TextoGravado rotulo="Decisão pendente" valor={entrega.decisao} dica="Uma pergunta que alguém precisa responder." aoGravar={(v) => g({ decisao: v })} />
      {(entrega.bloqueio || entrega.decisao) && (
        <div className="form-grade">
          <Campo rotulo="Quem resolve">
            <select value={entrega.quem_resolve ?? ''} onChange={(e) => g({ quem_resolve: (e.target.value || null) as QuemResolve | null })}>
              <option value="">—</option>{(Object.keys(NOME_RESOLVE) as QuemResolve[]).map((q) => <option key={q} value={q}>{NOME_RESOLVE[q]}</option>)}
            </select>
          </Campo>
          <TextoGravado rotulo="Impacto" valor={entrega.impacto} aoGravar={(v) => g({ impacto: v })} />
        </div>
      )}
    </div>
  )
}

export function AntesDePublicar({ entrega, uso }: Props) {
  return (
    <ol className="prj-checklist">
      {PASSOS_PUBLICAR.map((p) => (
        <li key={p.campo}><label className="check"><input type="checkbox" checked={entrega[p.campo]} onChange={(e) => gravarEm(uso, entrega.id, { [p.campo]: e.target.checked })} /> {p.rotulo}</label></li>
      ))}
      <li className={entrega.status === 'publicado' ? 'ok-txt' : 'muted'}>{entrega.status === 'publicado' ? 'Publicado' : 'Publicado (quando passar para a coluna Publicado)'}</li>
    </ol>
  )
}
