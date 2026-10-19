// Quadro "Créditos do agente" em Configurar agente: limite próprio do mês (opcional), quanto já gastou, o saldo da
// empresa e quanto custa, em média, cada tipo de pedido (calculado com o que o agente fez nos últimos 90 dias).
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Icone } from '../../components/Icone'
import { textoCreditos, useConsumo } from './creditos'

type Props = { empresa: string; agente: string; limite: string; aoMudarLimite: (v: string) => void }

export function CreditosAgente({ empresa, agente, limite, aoMudarLimite }: Props) {
  const consumo = useConsumo(empresa, agente)
  const cfg = useConsulta<{ limite_mes_creditos: number | null } | null>(() => supabase.from('agentes_config').select('limite_mes_creditos').eq('empresa_id', empresa).maybeSingle(), [empresa])
  const daEmpresa = cfg.dados?.limite_mes_creditos ?? null
  const saldo = daEmpresa != null ? Math.max(0, daEmpresa - consumo.empresaMes) : null
  return (
    <section className="mk-painel mk-cfg-quadro">
      <header className="mk-cfg-cab"><Icone nome="moedas" tam={22} /><h3>Créditos do agente</h3></header>
      <label>Limite deste agente por mês (créditos)<input inputMode="numeric" value={limite} onChange={(e) => aoMudarLimite(e.target.value.replace(/\D/g, ''))} placeholder="Ex.: 50" /></label>
      <p className="muted pequeno">Opcional. Sem limite próprio, ele usa o saldo da empresa até acabar.</p>
      <div className="cred-numeros">
        <span><small className="muted">Usado por este agente no mês</small><b>{textoCreditos(consumo.agenteMes)}</b></span>
        <span><small className="muted">Saldo da empresa no mês</small><b>{saldo != null ? `${textoCreditos(saldo)} de ${daEmpresa}` : 'Sem limite'}</b></span>
      </div>
      <hr />
      <b className="pequeno">Quanto custa, em média</b>
      {consumo.medias.length
        ? <ul className="cred-medias">{consumo.medias.map((m) => <li key={m.tipo}><span>{m.nome}</span><b>{textoCreditos(m.media)}</b></li>)}</ul>
        : <p className="muted pequeno">{consumo.carregando ? 'Calculando…' : 'Ainda sem histórico para calcular.'}</p>}
      <p className="muted pequeno">Média dos últimos 90 dias. Varia com o tamanho do pedido e o modelo de IA.</p>
      <Link to="/agentes/historico" className="link pequeno"><Icone nome="historico" tam={15} /> Ver histórico →</Link>
    </section>
  )
}
