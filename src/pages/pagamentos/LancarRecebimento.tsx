// "Lançar recebimento": acha o aluno, escolhe a parcela em aberto e abre o informar pagamento dela
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR } from '../../lib/format'
import type { ParcelaV } from '../../lib/types'
import { Badge, Modal, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { turmaCurta } from '../Agenda'
import { SITUACAO } from './regras'

export function LancarRecebimento({ aoEscolher, aoFechar }: { aoEscolher: (p: ParcelaV) => void; aoFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const abertas = useConsulta<ParcelaV[]>(() => supabase.from('v_parcelas').select('*').in('situacao', ['atrasada', 'a_vencer', 'sem_vencimento']).order('vencimento', { ascending: true, nullsFirst: true }).limit(2000), [])
  const t = busca.trim().toLowerCase()
  const lista = t.length < 2 ? [] : (abertas.dados ?? []).filter((p) => `${p.aluno_nome} ${p.turma_nome}`.toLowerCase().includes(t)).slice(0, 30)
  return (
    <Modal titulo="Lançar recebimento" aberto onFechar={aoFechar}>
      <p className="muted pequeno">Procure o aluno e escolha a parcela que ele pagou. Depois é só informar o valor, a data, a conta e o comprovante.</p>
      <label className="select-icone"><Icone nome="busca" /><input autoFocus placeholder="Nome do aluno ou da turma" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      {t.length >= 2 && !lista.length ? <Vazio>Nenhuma parcela em aberto para “{busca}”.</Vazio> : (
        <ul className="lista pg-escolher">{lista.map((p) => (
          <li key={p.id}><button type="button" onClick={() => aoEscolher(p)}>
            <span><b>{p.aluno_nome}</b><small className="muted">{turmaCurta(p.turma_nome)} · {p.eh_matricula ? 'Matrícula' : `Parcela ${p.numero}/${p.total_parcelas}`} · {p.vencimento ? `vence ${dataBR(p.vencimento)}` : 'sem data'}</small></span>
            <span className="direita"><b className="num-txt">{brl(p.valor)}</b><Badge tom={SITUACAO[p.situacao]?.tom}>{SITUACAO[p.situacao]?.rotulo}</Badge></span>
          </button></li>))}</ul>
      )}
    </Modal>
  )
}
