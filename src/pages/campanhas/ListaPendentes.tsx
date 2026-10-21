// Quem foi ao pagamento na página da campanha e ainda não comprou: a lista para o time chamar.
import { Link } from 'react-router-dom'
import { Badge, Vazio } from '../../components/ui'
import { dataHoraBR } from '../../lib/format'
import { linkWhats, telefoneLegivel } from '../../crm/nucleo'
import { nomeOrigem, type Pendente } from './dados'

export function ListaPendentes({ pendentes }: { pendentes: Pendente[] }) {
  return (
    <section className="bloco"><h2>Foram ao pagamento e ainda não compraram</h2>
      {!pendentes.length ? <Vazio>Ninguém pendente agora.</Vazio> : (
        <table className="tabela compacta"><thead><tr><th>Pessoa</th><th>Origem</th><th>Quando</th><th>Quem cuida</th><th></th></tr></thead>
          <tbody>{pendentes.map((p) => (
            <tr key={p.id}>
              <td><Link className="link" to={`/atendimento/contatos?abrir=${p.id}`}>{p.nome ?? 'Sem nome'}</Link>{p.gerou_pix && <> <Badge tom="alerta">gerou Pix/boleto</Badge></>}<div className="muted pequeno">{telefoneLegivel(p.telefone)}</div></td>
              <td className="pequeno">{nomeOrigem(p.origem)}</td>
              <td className="pequeno">{dataHoraBR(p.quando)}</td>
              <td className="pequeno">{p.dona ?? <span className="muted">rodízio</span>}</td>
              <td className="celula-acao">{p.telefone && <a className="btn btn-mini" href={linkWhats(p.telefone) ?? undefined} target="_blank" rel="noreferrer">WhatsApp</a>}</td>
            </tr>
          ))}</tbody></table>)}
      <p className="muted pequeno">A tarefa "Foi ao pagamento e ainda não comprou" aparece para a vendedora depois do tempo de espera do formulário; quem compra sai da lista sozinho.</p>
    </section>
  )
}
