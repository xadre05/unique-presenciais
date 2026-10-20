// Coluna "Cobrança" das telas do Comercial: em que etapa está a cobrança desta pessoa e com quem. O trabalho de cobrar
// acontece na fila do Atendimento (Atendimento → Cobranças).
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui'
import { ETAPAS, type Cobranca } from './dados'

export function CelulaCobranca({ cobranca, responsavel }: { cobranca: Cobranca | null; responsavel: string | null }) {
  if (!cobranca) return <span className="muted pequeno">Fora da fila</span>
  const e = ETAPAS[cobranca.etapa]
  return (
    <div className="cob-celula">
      <Badge tom={e.tom}>{e.rotulo}</Badge>
      <span className="muted pequeno">{responsavel ? `com ${responsavel}` : 'sem responsável'}</span>
      <Link className="link pequeno" to={`/atendimento/cobrancas?busca=${encodeURIComponent(cobranca.email ?? cobranca.aluno_nome ?? '')}`}>Abrir na fila</Link>
    </div>
  )
}
