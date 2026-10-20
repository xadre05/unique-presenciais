// Resumo da fila de cobrança para o Painel do Comercial (do presencial ou do online, de uma conta da Hotmart ou de todas)
import { Link } from 'react-router-dom'
import { brl } from '../../lib/format'
import { Icone } from '../../components/Icone'
import { aberta, useCobrancas, useRecebimentos } from './dados'
import { somaVencido } from './filtros'

export function ResumoCobranca({ origem, conta = '' }: { origem: 'online' | 'presencial'; conta?: string }) {
  const cobrancas = useCobrancas(), rec = useRecebimentos()
  const daqui = (cobrancas.dados ?? []).filter((c) => c.origem === origem && (!conta || c.integracao_id === conta))
  const abertas = daqui.filter(aberta)
  const ids = new Set(daqui.map((c) => c.id))
  const recuperado = (rec.dados ?? []).filter((r) => r.conferido && ids.has(r.cobranca_id)).reduce((s, r) => s + Number(r.valor), 0)
  const linha = (rotulo: string, valor: string | number, tom = '') => <><dt>{rotulo}</dt><dd className={tom}>{valor}</dd></>
  return (
    <section className="bloco">
      <h2><Icone nome="sacola" className="ouro" /> Cobrança {origem === 'online' ? 'do online' : 'do presencial'}</h2>
      <dl className="resumo">
        {linha('Em aberto', `${abertas.length} · ${brl(somaVencido(abertas))} vencido`, 'erro-txt')}
        {linha('Ainda não contatados', abertas.filter((c) => c.etapa === 'a_contatar').length)}
        {linha('Aguardando resposta', abertas.filter((c) => c.etapa === 'aguardando').length)}
        {linha('Negociando ou em acordo', abertas.filter((c) => c.etapa === 'negociando' || c.etapa === 'acordo').length)}
        {linha('Recuperado (acordos conferidos)', brl(recuperado), 'ok-txt')}
        {linha('Voltaram a pagar sozinhos', daqui.filter((c) => c.etapa === 'paga').length)}
      </dl>
      <Link to="/cobrancas" className="btn btn-contorno btn-bloco"><Icone nome="moedas" tam={16} /> Abrir a fila de cobrança</Link>
    </section>
  )
}
