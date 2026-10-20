// Filtro do topo das telas do Financeiro: mês (com setas) e conta
import { Icone } from '../../components/Icone'
import { nomeMes, somaMes, useContasFin } from './dados'

type Props = { mes: string; aoMudarMes: (m: string) => void; conta: string; aoMudarConta: (c: string) => void; semMes?: boolean; children?: React.ReactNode }

export function FiltroTopo({ mes, aoMudarMes, conta, aoMudarConta, semMes, children }: Props) {
  const contas = useContasFin()
  return (
    <div className="filtros-lista fin-filtros">
      {!semMes && <div className="fin-mes">
        <button className="btn-icone" onClick={() => aoMudarMes(somaMes(mes, -1))} aria-label="Mês anterior"><Icone nome="esquerda" tam={16} /></button>
        <label className="select-icone"><Icone nome="agenda" tam={16} /><input type="month" value={mes} onChange={(e) => e.target.value && aoMudarMes(e.target.value)} aria-label="Mês" /></label>
        <button className="btn-icone" onClick={() => aoMudarMes(somaMes(mes, 1))} aria-label="Próximo mês"><Icone nome="seta" tam={16} /></button>
        <span className="muted pequeno">{nomeMes(mes)}</span>
      </div>}
      <label className="select-icone"><Icone nome="links" tam={16} /><select value={conta} onChange={(e) => aoMudarConta(e.target.value)} aria-label="Conta">
        <option value="">Todas as contas</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativa ? '' : ' (inativa)'}</option>)}
      </select></label>
      {children}
    </div>
  )
}
