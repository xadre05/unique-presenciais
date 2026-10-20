// Resumo do filtro atual (4 cartões que também filtram) e o aviso de parcelas sem vencimento
import { brl } from '../../lib/format'
import type { ParcelaV } from '../../lib/types'
import { Icone } from '../../components/Icone'
import { somaValor } from './regras'

type Props = { base: ParcelaV[]; aoFiltrar: (situacao: string) => void; soMinhas: boolean }

function Cartao({ icone, tom, rotulo, valor, sub, onClick }: { icone: string; tom: string; rotulo: string; valor: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" className={`pg-cartao pg-${tom}`} onClick={onClick}>
      <span className={`resumo-icone ic-${tom}`}><Icone nome={icone} tam={22} /></span>
      <span className="pg-cartao-texto"><span className="pg-rotulo">{rotulo}</span><b className="pg-valor">{valor}</b>{sub && <small>{sub}</small>}</span>
      <Icone nome="seta" tam={16} />
    </button>
  )
}

export function ResumoPagamentos({ base, aoFiltrar, soMinhas }: Props) {
  const emAberto = base.filter((p) => ['atrasada', 'a_vencer', 'sem_vencimento'].includes(p.situacao))
  const vencidas = base.filter((p) => p.situacao === 'atrasada')
  const conferir = base.filter((p) => p.situacao === 'aguardando_conferencia')
  const semVenc = base.filter((p) => p.situacao === 'sem_vencimento')
  return (<>
    <h2 className="titulo-secao">Resumo do filtro atual{soMinhas && <span className="muted pequeno"> · os valores somam só as suas vendas</span>}</h2>
    <section className="pg-resumo">
      <Cartao icone="documento" tom="neutro" rotulo="Parcelas em aberto" valor={String(emAberto.length)} onClick={() => aoFiltrar('pendentes')} />
      <Cartao icone="dinheiro" tom="ouro" rotulo="Saldo em aberto" valor={brl(somaValor(emAberto))} sub="Inclui as vencidas" onClick={() => aoFiltrar('pendentes')} />
      <Cartao icone="alerta" tom="erro" rotulo="Vencidas" valor={brl(somaValor(vencidas))} sub={`${vencidas.length} parcela(s) · parte do saldo em aberto`} onClick={() => aoFiltrar('atrasada')} />
      <Cartao icone="relogio" tom="info" rotulo="A conferir" valor={brl(somaValor(conferir, true))} sub={`${conferir.length} pagamento(s) informado(s) · fora do saldo`} onClick={() => aoFiltrar('aguardando_conferencia')} />
    </section>
    {semVenc.length > 0 && (
      <div className="faixa-alerta">
        <Icone nome="alerta" tam={20} />
        <span><b>{semVenc.length} parcela(s) sem vencimento</b> · {brl(somaValor(semVenc))}</span>
        <button type="button" className="btn btn-contorno btn-mini" onClick={() => aoFiltrar('sem_vencimento')}>Definir datas</button>
      </div>
    )}
  </>)
}
