// Uma linha da tabela de pagamentos do presencial: aluno e turma, parcela, vencimento (com atraso ou "em N dias"),
// forma e conta, valor, situação e a ação principal (Ver cobrança · Definir data · Conferir) + o menu "⋮" com o resto.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { brl, dataBR, FORMAS } from '../../lib/format'
import type { ParcelaV } from '../../lib/types'
import { Badge } from '../../components/ui'
import type { Acao } from '../MatriculaDetalhe'
import { turmaCurta } from '../Agenda'
import { SITUACAO, linkCobranca, sobreVencimento } from './regras'

type Props = { p: ParcelaV; isAdmin: boolean; aoAbrir: () => void; aoAcao: (a: Acao) => void }

function Menu({ p, isAdmin, aoAbrir, aoAcao }: Props) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const whats = p.situacao === 'atrasada' ? linkCobranca(p) : null
  const item = (rotulo: string, f: () => void) => <button type="button" role="menuitem" onClick={() => { setAberto(false); f() }}>{rotulo}</button>
  return (
    <div className="menu-linha" ref={caixa}>
      <button type="button" className="btn-icone" aria-label="Mais ações" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>⋮</button>
      {aberto && <div className="menu-linha-lista" role="menu">
        {item('Ver detalhes', aoAbrir)}
        {['a_vencer', 'atrasada', 'sem_vencimento'].includes(p.situacao) && item('Informar pagamento', () => aoAcao({ tipo: 'informar', parcela: p }))}
        {p.situacao === 'aguardando_conferencia' && isAdmin && item('Conferir e confirmar', () => aoAcao({ tipo: 'confirmar', parcela: p }))}
        {whats && item('Cobrar no WhatsApp', () => window.open(whats, '_blank', 'noopener'))}
        {p.status !== 'confirmada' && item('Editar valor ou data', () => aoAcao({ tipo: 'editar', parcela: p }))}
        {item('Abrir matrícula', () => nav(`/matricula/${p.matricula_id}`))}
      </div>}
    </div>
  )
}

function AcaoPrincipal({ p, isAdmin, aoAcao }: Omit<Props, 'aoAbrir'>) {
  if (p.situacao === 'atrasada') return <Link className="btn btn-contorno btn-mini" to={`/cobrancas?busca=${encodeURIComponent(p.aluno_nome)}`}>Ver cobrança</Link>
  if (p.situacao === 'sem_vencimento') return <button type="button" className="btn btn-contorno btn-mini" onClick={() => aoAcao({ tipo: 'editar', parcela: p })}>Definir data</button>
  if (p.situacao === 'aguardando_conferencia') return isAdmin
    ? <button type="button" className="btn btn-contorno-ouro btn-mini" onClick={() => aoAcao({ tipo: 'confirmar', parcela: p })}>Conferir</button>
    : <span className="muted pequeno">Em conferência</span>
  return null
}

export function LinhaParcela({ p, isAdmin, aoAbrir, aoAcao }: Props) {
  const s = SITUACAO[p.situacao]
  const sobre = sobreVencimento(p)
  const recebido = p.situacao === 'recebida' || p.situacao === 'aguardando_conferencia'
  return (
    <tr className="linha-clicavel" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button,[role=menu]')) aoAbrir() }}>
      <td><span className="forte">{p.aluno_nome}</span><div className="muted pequeno">{turmaCurta(p.turma_nome)}{isAdmin && p.vendedora_nome ? ` · ${p.vendedora_nome}` : ''}</div></td>
      <td>{p.eh_matricula ? 'Matrícula' : `${p.numero}/${p.total_parcelas}`}</td>
      <td>{p.vencimento ? dataBR(p.vencimento) : <span className="alerta-txt">Sem data</span>}{sobre && <div className={`pequeno ${sobre.tom}`}>{sobre.texto}</div>}</td>
      <td className="pequeno">{(FORMAS[p.forma] ?? p.forma).replace(/^Hotmart — /, '')}<div className="muted">{p.conta_nome ?? 'Conta não informada'}</div></td>
      <td className="num">{brl(recebido ? p.valor_recebido ?? p.valor : p.valor)}</td>
      <td><Badge tom={s?.tom}>{s?.rotulo ?? p.situacao}</Badge>{p.situacao === 'aguardando_conferencia' && p.comprovante && <div className="info-txt pequeno">Comprovante anexado</div>}</td>
      <td><div className="pg-acoes"><AcaoPrincipal p={p} isAdmin={isAdmin} aoAcao={aoAcao} /><Menu p={p} isAdmin={isAdmin} aoAbrir={aoAbrir} aoAcao={aoAcao} /></div></td>
    </tr>
  )
}
