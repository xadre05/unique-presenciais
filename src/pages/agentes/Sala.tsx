// Sala dos agentes: cada agente com o bonequinho, o que está fazendo agora e o que espera de você.
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { dataHoraBR } from '../../lib/format'
import { Erro } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Personagem, type Estado } from './Personagem'
import { VISUAL, usd, type AgenteSala, type Config } from './comum'

export function estadoDo(a: AgenteSala): Estado {
  if (!a.disponivel) return 'em_breve'
  if (a.status_agora === 'trabalhando' || a.status_agora === 'na_fila') return 'trabalhando'
  if (a.status_agora === 'erro') return 'erro'
  if (a.aguardando > 0) return 'esperando'
  return 'parado'
}

function frase(a: AgenteSala, estado: Estado) {
  if (estado === 'em_breve') return 'Em breve'
  if (!a.ativo) return 'Desligado na Central'
  if (estado === 'trabalhando') return `Trabalhando: ${VISUAL[a.agente_id]?.trabalhando ?? 'em andamento'}…`
  if (estado === 'erro') return 'O último trabalho deu erro. Abra para ver o motivo.'
  if (estado === 'esperando') return `${a.aguardando} peça(s) esperando sua aprovação`
  return a.trabalho_desde ? `Livre · último trabalho em ${dataHoraBR(a.trabalho_desde)}` : 'Livre · ainda não trabalhou'
}

export default function Sala() {
  const sala = useConsulta<AgenteSala[]>(() => supabase.rpc('agentes_sala', { p_empresa: EMPRESA_UNIQUE }))
  const cfg = useConsulta<Config | null>(() => supabase.from('agentes_config').select('*').eq('empresa_id', EMPRESA_UNIQUE).maybeSingle())
  const algumTrabalhando = (sala.dados ?? []).some((a) => estadoDo(a) === 'trabalhando')
  // enquanto alguém trabalha, a sala se atualiza sozinha
  useEffect(() => {
    if (!algumTrabalhando) return
    const t = setInterval(() => sala.recarregar(), 5000)
    return () => clearInterval(t)
  }, [algumTrabalhando]) // eslint-disable-line react-hooks/exhaustive-deps

  const custoMes = (sala.dados ?? []).reduce((s, a) => s + Number(a.custo_mes_usd ?? 0), 0)
  return (
    <div className="pagina larga">
      <header className="pagina-topo">
        <div><h1>Sala dos agentes</h1><p className="muted">Sua equipe de IA trabalhando para a Unique. Eles preparam; você aprova.</p></div>
        <div className="sala-custo"><span className="muted pequeno">Gasto de IA no mês</span><b>{usd(custoMes)}</b></div>
      </header>
      <Erro msg={sala.erro} />
      {cfg.dados && !cfg.dados.chave_em && (
        <div className="aviso">Falta cadastrar a chave do Claude para os agentes trabalharem. <Link to="/agentes/central" className="link">Abrir a Central de agentes</Link></div>
      )}
      <div className="sala-grade">
        {(sala.dados ?? []).map((a) => {
          const estado = estadoDo(a)
          const cor = VISUAL[a.agente_id]?.cor ?? '#c9a45c'
          const conteudo = (<>
            <div className="sala-palco"><Personagem cor={cor} estado={a.ativo || !a.disponivel ? estado : 'parado'} /></div>
            <div className="sala-info">
              <b>{a.nome}</b>
              <span className="muted pequeno">{a.papel}</span>
              <span className={`sala-status est-${estado}`}>{frase(a, estado)}</span>
              {a.disponivel && <span className="muted pequeno">{a.aprovadas_mes} aprovada(s) no mês · {usd(a.custo_mes_usd)}</span>}
            </div>
          </>)
          return a.disponivel
            ? <Link key={a.agente_id} to={`/agentes/${a.agente_id}`} className={`sala-agente est-${estado}`}>{conteudo}</Link>
            : <div key={a.agente_id} className="sala-agente est-em_breve" title={a.descricao}>{conteudo}<p className="muted pequeno sala-desc">{a.descricao}</p></div>
        })}
      </div>
    </div>
  )
}
