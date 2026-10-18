// Sala dos agentes: os especialistas (corpo inteiro), números do momento, abas Academy/Clinical,
// e embaixo a fila de aprovações e a base da marca.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import { useSala, type AgenteNaSala } from './useSala'
import { TIPO_PECA, usd, visualDe } from './comum'
import type { PerfilMarketing } from './MarketingPerfil'

const ABAS = [{ id: 'todos', nome: 'Todos' }, { id: 'academy', nome: 'Academy' }, { id: 'clinical', nome: 'Clinical' }] as const

function situacao(a: AgenteNaSala, temChave: boolean): { txt: string; tom: string } {
  if (!a.disponivel) return { txt: 'Em breve', tom: 'neutro' }
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

function CartaoAgente({ a, temChave }: { a: AgenteNaSala; temChave: boolean }) {
  const st = situacao(a, temChave)
  const pronto = a.disponivel && temChave
  const destino = a.disponivel && !temChave ? '/agentes/central' : `/agentes/${a.id}`
  return (
    <Link to={destino} className={`sala-card est-${a.estado}`} style={{ ['--cor-agente' as string]: a.cor }}>
      <div className="sala-card-foto"><Retrato agente={a.id} estado={a.estado} alto={250} aguardando={a.dados?.aguardando} /></div>
      <div className="sala-card-info">
        <span className="sala-card-icone"><Icone nome={a.icone} tam={24} /></span>
        <b className="sala-card-nome">{a.nome}</b>
        <span className="sala-card-papel">{a.papel}.</span>
        <span className="sala-card-linha" />
        <span className={`sala-pilula tom-${st.tom}`}>{st.txt}</span>
        <span className={`sala-card-botao${a.disponivel && !temChave ? ' cheio' : ''}`}>{a.disponivel && !temChave ? 'Configurar' : pronto ? 'Abrir' : 'Ver detalhes'}</span>
      </div>
    </Link>
  )
}

export default function Sala() {
  const { agentes, cfg, erro } = useSala()
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('todos')
  const fila = useConsulta<{ id: string; titulo: string; tipo: string; agente_id: string }[]>(() => supabase.from('agentes_pecas').select('id,titulo,tipo,agente_id').eq('empresa_id', EMPRESA_UNIQUE).eq('status', 'rascunho').order('dia').limit(5))
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())

  const temChave = !!cfg?.chave_em
  const visiveis = agentes.filter((a) => aba === 'todos' || a.escopo === aba || a.escopo === 'ambos')
  const ativos = agentes.filter((a) => a.disponivel && a.ativo).length
  const emAprovacao = agentes.reduce((s, a) => s + (a.dados?.aguardando ?? 0), 0)
  const emExecucao = agentes.filter((a) => a.estado === 'trabalhando').length
  const consumo = agentes.reduce((s, a) => s + Number(a.dados?.custo_mes_usd ?? 0), 0)
  const p = perfil.dados?.perfil ?? {}

  return (
    <div className="pagina larga sala">
      <header className="sala-topo">
        <div><h1>Sala dos agentes</h1><p>Sua equipe de inteligência, com a identidade da Unique.</p></div>
        <Link to="/agentes/marca" className="btn btn-contorno-ouro"><Icone nome="livro" /> Base da marca</Link>
      </header>

      <div className="sala-kpis">
        <div><Icone nome="usuario" tam={22} /><span>Agentes ativos<b>{ativos}</b></span></div>
        <div><Icone nome="documento" tam={22} /><span>Em aprovação<b>{emAprovacao}</b></span></div>
        <div><Icone nome="relogio" tam={22} /><span>Em execução<b>{emExecucao}</b></span></div>
        <div><Icone nome="grafico" tam={22} /><span>Consumo do mês<b>{usd(consumo)}</b></span><Link to="/agentes/central" className="link pequeno">{cfg?.limite_mes_usd != null ? `Limite ${usd(cfg.limite_mes_usd)}` : 'Definir limite'} ›</Link></div>
      </div>

      {cfg && !temChave && (
        <div className="sala-aviso"><Icone nome="alerta" tam={20} /><span>Configure a IA para ativar seu primeiro agente.</span><Link to="/agentes/central" className="btn btn-ouro btn-mini">Configurar</Link></div>
      )}
      <Erro msg={erro} />

      <div className="sala-abas">{ABAS.map((x) => (
        <button key={x.id} className={aba === x.id ? 'ativa' : ''} onClick={() => setAba(x.id)}>{x.nome}{x.id === 'todos' && <span>{agentes.length}</span>}</button>
      ))}</div>

      <div className="sala-grade">{visiveis.map((a) => <CartaoAgente key={a.id} a={a} temChave={temChave} />)}</div>

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
