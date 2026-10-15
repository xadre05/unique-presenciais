import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { dataBR } from '../lib/format'
import { Badge, Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'

type Linha = { comprador_nome: string; produto_nome: string; primeira_data: string; pagas: number; restantes: number; proxima_data: string | null; situacao: string; vendedora_nome: string | null; minha: boolean }
const SIT: Record<string, { rotulo: string; tom: string }> = { em_dia: { rotulo: 'Em dia', tom: 'ok' }, atrasado: { rotulo: 'Atrasado', tom: 'erro' }, quitado: { rotulo: 'Quitado', tom: 'neutro' } }

// Visão do online para a vendedora: quem comprou, de quem é, e se está em dia. Sem valores.
export default function OnlineEquipe() {
  const q = useConsulta<Linha[]>(() => supabase.rpc('online_equipe'))
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState<'todas' | 'minhas' | 'sem'>('todas')
  const [sit, setSit] = useState('')
  const t = busca.trim().toLowerCase()
  const lista = useMemo(() => (q.dados ?? []).filter((l) =>
    (!t || `${l.comprador_nome} ${l.produto_nome}`.toLowerCase().includes(t)) &&
    (de === 'todas' || (de === 'minhas' ? l.minha : !l.vendedora_nome)) &&
    (!sit || l.situacao === sit)), [q.dados, t, de, sit])

  return (<>
    <div className="faixa-info"><Icone nome="info" tam={18} /> <span>Quem comprou no online (Hotmart), de quem é a venda e se está pagando em dia. Achou alguém que você vendeu e está <b>sem vendedora</b>? Vá em <Link to="/comissoes?area=online" className="link">Minhas comissões → Online</Link> e clique em <b>Esse aluno é meu</b>.</span></div>
    <div className="filtros-alunos">
      <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar por nome ou produto" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      <label className="select-icone"><select value={de} onChange={(e) => setDe(e.target.value as typeof de)}><option value="todas">Toda a equipe</option><option value="minhas">Minhas vendas</option><option value="sem">Sem vendedora</option></select></label>
      <label className="select-icone"><select value={sit} onChange={(e) => setSit(e.target.value)}><option value="">Todas as situações</option>{Object.entries(SIT).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}</select></label>
    </div>
    <Erro msg={q.erro} />
    {lista.length === 0 && !q.carregando ? <Vazio>Nenhuma compra com esses filtros.</Vazio> : (
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela">
          <thead><tr><th>Aluno</th><th>Produto</th><th>Comprou em</th><th>Parcelas</th><th>Próxima</th><th>Situação</th><th>Vendedora</th></tr></thead>
          <tbody>{lista.map((l, i) => (
            <tr key={i}>
              <td className="forte">{l.comprador_nome}</td>
              <td className="pequeno">{l.produto_nome}</td>
              <td className="pequeno">{dataBR(l.primeira_data)}</td>
              <td className="pequeno">{l.pagas} paga(s){l.restantes > 0 ? ` · faltam ${l.restantes}` : ''}</td>
              <td className="pequeno">{l.proxima_data ? dataBR(l.proxima_data) : '—'}</td>
              <td><Badge tom={SIT[l.situacao]?.tom}>{SIT[l.situacao]?.rotulo ?? l.situacao}</Badge></td>
              <td className="pequeno">{l.vendedora_nome ? (l.minha ? <b className="ok-txt">Você</b> : l.vendedora_nome) : <span className="muted">sem vendedora</span>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    )}
  </>)
}
