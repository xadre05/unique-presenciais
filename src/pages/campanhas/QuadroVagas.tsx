// Vagas da campanha por data: 12 lugares − alunos já matriculados na turma − compradores da Black naquela data.
import { Badge } from '../../components/ui'
import { dataBR } from '../../lib/format'
import { nomeModulo, type Vaga } from './dados'

export function QuadroVagas({ vagas }: { vagas: Vaga[] }) {
  return (
    <section className="bloco"><h2>Vagas por data</h2>
      <ul className="blk-vagas">{vagas.map((v) => (
        <li key={v.codigo} className={v.livres === 0 ? 'lotada' : ''} title={`Código da página: ${v.codigo}`}>
          <b>{nomeModulo(v.modulo)}</b>
          <span className="muted pequeno">{dataBR(v.data_inicio)}</span>
          <span className="pequeno">{v.matriculados} matriculados · {v.compraram} da Black</span>
          {v.livres === 0 ? <Badge tom="erro">Lotado</Badge> : <Badge tom={v.livres <= 3 ? 'alerta' : 'ok'}>{v.livres} livre{v.livres > 1 ? 's' : ''}</Badge>}
        </li>
      ))}</ul>
      <p className="muted pequeno">Lugares = 12 − alunos já matriculados na turma − compradores da campanha naquela data. Data lotada (ou de turma fechada) não deveria estar à venda na página.</p>
    </section>
  )
}
