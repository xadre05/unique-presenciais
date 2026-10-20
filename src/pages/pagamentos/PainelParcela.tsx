// Gaveta com os detalhes de uma parcela do presencial: valores, forma, conta, comprovante, ações e histórico
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, FORMAS, SITUACAO_PARCELA } from '../../lib/format'
import type { ParcelaV } from '../../lib/types'
import { Badge, LinkArquivo, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { Historia, type Acao } from '../MatriculaDetalhe'
import { turmaCurta } from '../Agenda'
import { linkCobranca } from './regras'

const ehHotmart = (p: ParcelaV) => p.forma.startsWith('hotmart')
export function PainelParcela({ p, isAdmin, onFechar, onAcao }: { p: ParcelaV; isAdmin: boolean; onFechar: () => void; onAcao: (a: Acao) => void }) {
  const hist = useConsulta<Parameters<typeof Historia>[0]['itens']>(
    () => isAdmin ? supabase.from('historico').select('*').eq('registro_id', p.id).order('em', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }), [p.id])
  const s = SITUACAO_PARCELA[p.situacao]
  const taxas = p.valor_recebido !== null ? Number(p.valor) - Number(p.valor_recebido) : null
  const cobrar = p.situacao === 'atrasada' ? linkCobranca(p) : null
  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <aside className="gaveta" onClick={(e) => e.stopPropagation()}>
        <div className="gaveta-topo">
          <div>
            <div className="muted pequeno">{turmaCurta(p.turma_nome)}</div>
            <h2>{p.aluno_nome}</h2>
            <div>{p.eh_matricula ? 'Matrícula' : `Parcela ${p.numero}/${p.total_parcelas}`} <Badge tom={s?.tom}>{s?.rotulo}</Badge></div>
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {ehHotmart(p) && p.situacao !== 'recebida' && (
          <div className="nota pequeno">
            <b>Pagamento pela Hotmart</b> ({p.conta_nome ?? 'conta não informada'}). O sistema ainda não recebe a atualização da Hotmart sozinho: antes de cobrar, confira no painel da Hotmart (Parcelado Hotmart) se a parcela já foi paga.
          </div>
        )}

        <dl className="gaveta-dados">
          <dt>Valor da parcela</dt><dd>{brl(p.valor)}</dd>
          <dt>Recebido (líquido)</dt><dd className={p.valor_recebido !== null ? 'ok-txt' : ''}>{p.valor_recebido !== null ? brl(p.valor_recebido) : '—'}</dd>
          {taxas !== null && Math.abs(taxas) >= 0.01 && <><dt>{taxas > 0 ? 'Diferença (taxas)' : 'Diferença (juros a mais)'}</dt><dd className="muted">{brl(Math.abs(taxas))}</dd></>}
          <dt>Vencimento</dt><dd>{p.vencimento ? dataBR(p.vencimento) : 'sem data'}{p.situacao === 'atrasada' && <span className="erro-txt"> · {p.dias_atraso} dias em atraso</span>}</dd>
          <dt>Data do recebimento</dt><dd>{dataBR(p.data_recebimento) || '—'}</dd>
          <dt>Forma</dt><dd>{FORMAS[p.forma] ?? p.forma}</dd>
          <dt>Conta</dt><dd>{p.conta_nome ?? 'não informada'}</dd>
          <dt>Vendedora</dt><dd>{p.vendedora_nome ?? '—'}</dd>
          <dt>Comprovante</dt><dd>{p.comprovante ? <LinkArquivo caminho={p.comprovante}>abrir</LinkArquivo> : '—'}</dd>
          {p.hotmart_transacao && <><dt>Transação Hotmart</dt><dd className="num-txt pequeno">{p.hotmart_transacao}</dd></>}
          {p.observacao && <><dt>Observação</dt><dd>{p.observacao}</dd></>}
        </dl>

        <div className="gaveta-acoes">
          {cobrar && <a className="btn btn-ouro" href={cobrar} target="_blank" rel="noreferrer"><Icone nome="whats" tam={16} /> Cobrar no WhatsApp</a>}
          {['a_vencer', 'atrasada', 'sem_vencimento'].includes(p.situacao) && <button className="btn btn-contorno" onClick={() => onAcao({ tipo: 'informar', parcela: p })}>Informar pagamento</button>}
          {p.situacao === 'aguardando_conferencia' && isAdmin && <button className="btn btn-ouro" onClick={() => onAcao({ tipo: 'confirmar', parcela: p })}>Conferir e confirmar</button>}
          {p.status !== 'confirmada' && <button className="btn" onClick={() => onAcao({ tipo: 'editar', parcela: p })}>Editar valor ou data</button>}
          <Link className="btn" to={`/matricula/${p.matricula_id}`}>Abrir matrícula</Link>
        </div>
        <p className="muted pequeno">Informar pagamento não é confirmar: a equipe registra, o administrador confere no extrato ou na Hotmart e confirma.</p>

        {isAdmin && (
          <section>
            <h3>Histórico desta parcela</h3>
            {(hist.dados ?? []).length === 0 ? <Vazio>Sem alterações registradas.</Vazio> : <Historia itens={hist.dados ?? []} />}
          </section>
        )}
      </aside>
    </div>
  )
}
