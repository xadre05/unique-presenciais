// Sala dos agentes: os especialistas (corpo inteiro), números do momento (só os agentes da Unique/Academy),
// e embaixo a fila de aprovações e a base da marca.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import { useSala, type AgenteNaSala } from './useSala'
import { TIPO_PECA, visualDe } from './comum'
import { creditosDe } from './creditos'
import type { PerfilMarketing } from './marca/dados'
import { BotaoAjuda } from './ajuda/BotaoAjuda'
import { RecadoSocial } from './RecadoSocial'
import { fluxoDe } from './marketing/fluxo'

function situacao(a: AgenteNaSala, temChave: boolean): { txt: string; tom: string } {
  if (!a.disponivel) return { txt: a.escopo === 'clinical' ? 'Para clínicas · Em breve' : 'Em breve', tom: 'neutro' }
  if (!temChave) return { txt: 'Configuração pendente', tom: 'alerta' }
  if (!a.ativo) return { txt: 'Desligado', tom: 'neutro' }
  if (a.estado === 'trabalhando') return { txt: 'Trabalhando…', tom: 'ativo' }
  if (a.estado === 'erro') return { txt: 'Deu erro', tom: 'erro' }
  if (a.estado === 'esperando') return { txt: `${a.dados?.aguardando} para aprovar`, tom: 'alerta' }
  return { txt: 'Pronto', tom: 'ok' }
}

export const BASE_MARCA: { rotulo: string; icone: string; ok: (p: PerfilMarketing) => boolean }[] = [
  { rotulo: 'Tom de voz', icone: 'whats', ok: (p) => !!p.tom },
  { rotulo: 'Cursos e ofertas', icone: 'livro', ok: (p) => !!p.o_que_vende },
  { rotulo: 'Público', icone: 'contatos', ok: (p) => !!p.publico },
  { rotulo: 'Ofertas e materiais', icone: 'documento', ok: (p) => !!p.materiais },
  { rotulo: 'Regras e limites', icone: 'alerta', ok: (p) => !!p.evitar && !!p.conselho },
]

function CartaoAgente({ a, temChave, apelido }: { a: AgenteNaSala; temChave: boolean; apelido?: string }) {
  const st = situacao(a, temChave)
  const pronto = a.disponivel && temChave
  const destino = a.disponivel && !temChave ? '/agentes/central' : `/agentes/${a.id}`
  return (
    <Link to={destino} className={`sala-card est-${a.estado}`} style={{ ['--cor-agente' as string]: a.cor }}>
      <div className="sala-card-foto"><Retrato agente={a.id} estado={a.estado} alto={250} aguardando={a.dados?.aguardando} /></div>
      <div className="sala-card-info">
        <span className="sala-card-icone"><Icone nome={a.icone} tam={24} /></span>
        <b className="sala-card-nome">{apelido ?? a.nome}</b>
        <span className="sala-card-papel">{apelido ? `Social media · ${a.papel}` : a.papel}.</span>
        <span className="sala-card-linha" />
        <span className={`sala-pilula tom-${st.tom}`}>{st.txt}</span>
        <span className={`sala-card-botao${a.disponivel && !temChave ? ' cheio' : ''}`}>{a.disponivel && !temChave ? 'Configurar' : pronto ? 'Abrir' : 'Ver detalhes'}</span>
      </div>
    </Link>
  )
}

// créditos do mês: o número grande é o que ainda dá para usar; a barra mostra quanto já foi
function KpiCreditos({ usados, limite }: { usados: number; limite: number | null }) {
  const n = (x: number) => x.toLocaleString('pt-BR')
  const parte = limite ? Math.min(100, Math.round((usados / limite) * 100)) : 0
  return (
    <Link to="/agentes/central" className="sala-kpi-cred" title="Ver créditos em Configurações">
      <Icone nome="moedas" tam={22} />
      <span>Créditos do mês
        <b>{limite != null ? n(Math.max(0, limite - usados)) : n(usados)}<small>{limite != null ? ' disponíveis' : ' usados'}</small></b>
        {limite != null && <i className="sala-barra" aria-hidden><i style={{ width: `${parte}%` }} /></i>}
        <small>{limite != null ? `${n(usados)} usados de ${n(limite)}` : 'Sem limite definido'}</small>
      </span>
    </Link>
  )
}

export default function Sala() {
  const { agentes, cfg, erro } = useSala()
  const fila = useConsulta<{ id: string; titulo: string; tipo: string; agente_id: string }[]>(() => supabase.from('agentes_pecas').select('id,titulo,tipo,agente_id').eq('empresa_id', EMPRESA_UNIQUE).eq('status', 'rascunho').order('dia').limit(5))
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())

  const temChave = !!cfg?.chave_em
  const visiveis = agentes
  const ativos = agentes.filter((a) => a.disponivel && a.ativo).length
  const emAprovacao = agentes.reduce((s, a) => s + (a.dados?.aguardando ?? 0), 0)
  const emExecucao = agentes.filter((a) => a.estado === 'trabalhando').length
  const consumo = agentes.reduce((s, a) => s + Number(a.dados?.custo_mes_usd ?? 0), 0)
  const p = perfil.dados?.perfil ?? {}

  return (
    <div className="pagina larga sala">
      <header className="sala-topo">
        <div><h1>Sala dos agentes <BotaoAjuda id="visao-geral" /></h1><p>Sua equipe de inteligência, com a identidade da Unique.</p></div>
        <Link to="/agentes/marca" className="btn btn-contorno-ouro"><Icone nome="livro" /> Base da marca</Link>
      </header>

      <div className="sala-kpis">
        <div><Icone nome="usuario" tam={22} /><span>Agentes ativos<b>{ativos}</b></span></div>
        <div><Icone nome="documento" tam={22} /><span>Em aprovação<b>{emAprovacao}</b></span></div>
        <div><Icone nome="relogio" tam={22} /><span>Em execução<b>{emExecucao}</b></span></div>
        <KpiCreditos usados={creditosDe(consumo)} limite={cfg?.limite_mes_creditos ?? null} />
      </div>

      {cfg && !temChave && (
        <div className="sala-aviso"><Icone nome="alerta" tam={20} /><span>Configure a IA para ativar seu primeiro agente.</span><Link to="/agentes/central" className="btn btn-ouro btn-mini">Configurar</Link></div>
      )}
      <Erro msg={erro} />
      <RecadoSocial perfilMarketing={perfil.dados?.perfil as Record<string, unknown> | undefined} />


      <div className="sala-grade">{visiveis.map((a) => <CartaoAgente key={a.id} a={a} temChave={temChave} apelido={a.id === 'marketing' ? fluxoDe(p as Record<string, unknown>).apelido : undefined} />)}</div>

      <div className="sala-baixo">
        <section className="bloco">
          <div className="bloco-topo"><h2><Icone nome="documento" className="ouro" /> Fila de aprovações</h2><Link to="/agentes/historico" className="link pequeno">Ver histórico ›</Link></div>
          {(fila.dados ?? []).length === 0
            ? <div className="sala-fila-vazia muted"><Icone nome="documento" tam={30} /><span>Os rascunhos aparecerão aqui para sua revisão.<br />Quando um agente gerar conteúdo, ele aparecerá aqui.</span></div>
            : <ul className="sala-fila">{(fila.dados ?? []).map((f) => (
                <li key={f.id}><Link to="/agentes/aprovacoes"><span className="sala-fila-tipo" style={{ ['--cor-agente' as string]: visualDe(f.agente_id).cor }}>{TIPO_PECA[f.tipo] ?? f.tipo}</span>{f.titulo}</Link></li>
              ))}</ul>}
        </section>
        <section className="bloco">
          <div className="bloco-topo"><h2><Icone nome="livro" className="ouro" /> Base da marca</h2><Link to="/agentes/marca" className="link pequeno">Completar base ›</Link></div>
          <ul className="sala-marca">{BASE_MARCA.map((m) => (
            <li key={m.rotulo}><Link to="/agentes/marca"><Icone nome={m.icone} tam={16} /><span>{m.rotulo}</span><span className={`sala-ponto ${m.ok(p) ? 'ok' : 'pendente'}`}>{m.ok(p) ? 'Preenchido' : 'Pendente'}</span></Link></li>
          ))}</ul>
        </section>
      </div>
    </div>
  )
}
