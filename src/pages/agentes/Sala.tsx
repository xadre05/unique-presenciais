// Sala dos agentes: cada especialista com o retrato, o que está fazendo e o que espera de você;
// embaixo, a fila de peças para aprovar e o que os agentes já sabem da marca.
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { EMPRESA_UNIQUE } from '../crm/comum'
import type { Estado } from './Personagem'
import { Retrato } from './Retrato'
import { TIPO_PECA, usd, visualDe, type AgenteSala, type Config } from './comum'
import type { PerfilMarketing } from './MarketingPerfil'

const EMPRESA = EMPRESA_UNIQUE

export function estadoDo(a: AgenteSala): Estado {
  if (!a.disponivel) return 'em_breve'
  if (a.status_agora === 'trabalhando' || a.status_agora === 'na_fila') return 'trabalhando'
  if (a.status_agora === 'erro') return 'erro'
  if (a.aguardando > 0) return 'esperando'
  return 'parado'
}

function situacao(a: AgenteSala, estado: Estado, temChave: boolean): { txt: string; tom: string } {
  if (estado === 'em_breve') return { txt: 'Planejado', tom: 'neutro' }
  if (!temChave) return { txt: 'Configuração pendente', tom: 'alerta' }
  if (!a.ativo) return { txt: 'Desligado', tom: 'neutro' }
  if (estado === 'trabalhando') return { txt: 'Trabalhando…', tom: 'ativo' }
  if (estado === 'erro') return { txt: 'Deu erro: abra para ver', tom: 'erro' }
  if (estado === 'esperando') return { txt: `${a.aguardando} para aprovar`, tom: 'alerta' }
  return { txt: 'Pronto para trabalhar', tom: 'ok' }
}

const MARCA: { rotulo: string; icone: string; ok: (p: PerfilMarketing) => boolean }[] = [
  { rotulo: 'Tom de voz', icone: 'whats', ok: (p) => !!p.tom },
  { rotulo: 'Cursos e ofertas', icone: 'livro', ok: (p) => !!p.o_que_vende },
  { rotulo: 'Público', icone: 'contatos', ok: (p) => !!p.publico },
  { rotulo: 'Regras e limites', icone: 'alerta', ok: (p) => !!p.evitar && !!p.conselho },
]

export default function Sala() {
  const sala = useConsulta<AgenteSala[]>(() => supabase.rpc('agentes_sala', { p_empresa: EMPRESA }))
  const cfg = useConsulta<Config | null>(() => supabase.from('agentes_config').select('*').eq('empresa_id', EMPRESA).maybeSingle())
  const fila = useConsulta<{ id: string; titulo: string; tipo: string; agente_id: string; dia: string | null }[]>(() => supabase.from('agentes_pecas').select('id,titulo,tipo,agente_id,dia').eq('empresa_id', EMPRESA).eq('status', 'rascunho').order('dia').limit(6))
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').maybeSingle())
  const algumTrabalhando = (sala.dados ?? []).some((a) => estadoDo(a) === 'trabalhando')
  useEffect(() => {
    if (!algumTrabalhando) return
    const t = setInterval(() => { sala.recarregar(); fila.recarregar() }, 5000)
    return () => clearInterval(t)
  }, [algumTrabalhando]) // eslint-disable-line react-hooks/exhaustive-deps

  const temChave = !!cfg.dados?.chave_em
  const custoMes = (sala.dados ?? []).reduce((s, a) => s + Number(a.custo_mes_usd ?? 0), 0)
  const p = perfil.dados?.perfil ?? {}
  return (
    <div className="pagina larga sala">
      <header className="sala-topo">
        <div><h1>Sala dos agentes</h1><p className="muted">Especialistas de IA conectados à identidade da Unique. Eles preparam; você aprova.</p></div>
        <div className="sala-consumo">
          <Icone nome="moedas" tam={22} />
          <div><span className="muted pequeno">Consumo do mês</span><b>{usd(custoMes)}</b></div>
          <Link to="/agentes/central" className="btn btn-contorno btn-mini">{cfg.dados?.limite_mes_usd != null ? `Limite ${usd(cfg.dados.limite_mes_usd)}` : 'Definir limite'}</Link>
        </div>
      </header>
      {cfg.dados && !temChave && (
        <div className="sala-aviso"><Icone nome="alerta" tam={18} /><span>Cadastre a chave do Claude para ativar os agentes.</span><Link to="/agentes/central" className="btn btn-ouro btn-mini">Configurar</Link></div>
      )}
      <Erro msg={sala.erro} />

      <div className="sala-grade">
        {(sala.dados ?? []).map((a) => {
          const estado = estadoDo(a)
          const v = visualDe(a.agente_id)
          const st = situacao(a, estado, temChave)
          const destino = a.disponivel && !temChave ? '/agentes/central' : `/agentes/${a.agente_id}`
          return (
            <Link key={a.agente_id} to={destino} className={`sala-card est-${estado}`} style={{ ['--cor-agente' as string]: v.cor }}>
              <div className="sala-card-foto"><Retrato agente={a.agente_id} estado={estado} tam={230} /></div>
              <span className="sala-card-icone"><Icone nome={v.icone} tam={22} /></span>
              <b className="sala-card-nome">{a.nome.replace('Agente de ', '')}</b>
              <span className="sala-card-papel">{a.papel}</span>
              <span className={`sala-pilula tom-${st.tom}`}>{st.txt}</span>
              <span className="sala-card-botao">{a.disponivel ? (temChave ? 'Abrir agente' : 'Configurar agente') : 'Ver agente'} →</span>
            </Link>
          )
        })}
      </div>

      <div className="sala-baixo">
        <section className="bloco">
          <div className="bloco-topo"><h2><Icone nome="documento" className="ouro" /> Fila de aprovações</h2><Link to="/agentes/marketing" className="link pequeno">Ver tudo →</Link></div>
          {(fila.dados ?? []).length === 0
            ? <div className="sala-fila-vazia muted">Os rascunhos dos agentes aparecem aqui para sua revisão.</div>
            : <ul className="sala-fila">{(fila.dados ?? []).map((f) => (
                <li key={f.id}><Link to={`/agentes/${f.agente_id}`}><span className="sala-fila-tipo" style={{ ['--cor-agente' as string]: visualDe(f.agente_id).cor }}>{TIPO_PECA[f.tipo] ?? f.tipo}</span>{f.titulo}</Link></li>
              ))}</ul>}
        </section>
        <section className="bloco">
          <div className="bloco-topo"><h2><Icone nome="livro" className="ouro" /> O que os agentes sabem da marca</h2></div>
          <ul className="sala-marca">{MARCA.map((m) => (
            <li key={m.rotulo}><Link to="/agentes/marketing#perfil"><Icone nome={m.icone} tam={16} /><span>{m.rotulo}</span><span className={`sala-pilula tom-${m.ok(p) ? 'ok' : 'alerta'}`}>{m.ok(p) ? 'Preenchido' : 'Pendente'}</span></Link></li>
          ))}</ul>
        </section>
      </div>
    </div>
  )
}
