// Filtro por conta da Hotmart ('' = todas)
import { Icone } from '../../components/Icone'
import { nomeCurtoConta, useContasHotmart } from './dados'

export function SeletorConta({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  const contas = useContasHotmart()
  return (
    <label className="select-icone cob-conta"><Icone nome="links" />
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} aria-label="Conta da Hotmart">
        <option value="">Todas as contas da Hotmart</option>
        {(contas.dados ?? []).map((c) => <option key={c.id} value={c.id}>{nomeCurtoConta(c.nome)}</option>)}
      </select></label>
  )
}
