// Caixa de entrada: uma linha por agente com o que espera uma decisão sua, sem repetir as peças. Cada linha leva
// para a tela do próprio agente, onde está o contexto. Com mais agentes, a caixa ganha uma linha por agente.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import { visualDe, type Peca } from './comum'
import { BotaoAjuda } from './ajuda/BotaoAjuda'
import { foraDoMarketing } from './marketing/peca/editor'
import { atrasado, fluxoDe, NOME_PASSO, passoDe, type Fluxo } from './marketing/fluxo'

type Linha = { agente: string; quem: string; titulo: string; detalhes: [string, number][]; link: string; alerta?: boolean }

// conta por nome e deixa os mais frequentes primeiro
function contar(nomes: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const n of nomes) m.set(n, (m.get(n) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function linhas(pecas: Peca[], f: Fluxo): Linha[] {
  const r: Linha[] = []
  const social = `${f.apelido} · Social media`
  const decidir = pecas.filter((p) => !foraDoMarketing(p) && ['pauta', 'final', 'ideia', 'producao'].includes(passoDe(p)))
  if (decidir.length) r.push({ agente: 'marketing', quem: social, titulo: `${decidir.length} peça(s) esperando você`, detalhes: contar(decidir.map((p) => NOME_PASSO[passoDe(p)])), link: '/agentes/marketing' })
  const gravar = pecas.filter((p) => passoDe(p) === 'gravar')
  const tarde = gravar.filter((p) => atrasado(p, f)).length
  if (gravar.length) r.push({ agente: 'marketing', quem: `${f.apelido} · Gravações`, titulo: `${gravar.length} vídeo(s) para gravar${tarde ? ` · ${tarde} atrasado(s)` : ''}`, detalhes: [], link: '/agentes/gravar', alerta: tarde > 0 })
  const fila = pecas.filter((p) => passoDe(p) === 'edicao').length
  const previas = pecas.filter((p) => passoDe(p) === 'aprovar_edicao').length
  if (fila || previas) r.push({ agente: 'editor', quem: 'Agente Editor de Vídeo', titulo: previas ? `${previas} edição(ões) para aprovar` : `${fila} vídeo(s) na fila de edição`, detalhes: previas && fila ? [['Na fila de edição', fila]] : [], link: '/agentes/editor' })
  return r
}

export default function Aprovacoes() {
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA_UNIQUE).eq('status', 'rascunho').order('dia'))
  const perfil = useConsulta<{ perfil: Record<string, unknown> } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())
  const lista = linhas(pecas.dados ?? [], fluxoDe(perfil.dados?.perfil))
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Aprovações <BotaoAjuda id="aprovar" /></h1><p className="muted">O que cada agente preparou e espera uma decisão. Clique para decidir dentro do agente.</p></div></header>
      {!pecas.carregando && !lista.length && <Vazio>Nada esperando você.</Vazio>}
      <div className="caixa-lista">{lista.map((l) => {
        const v = visualDe(l.agente)
        return (
          <Link key={l.link} to={l.link} className={`caixa-linha${l.alerta ? ' alerta' : ''}`} style={{ ['--cor-agente' as string]: v.cor }}>
            <Retrato agente={l.agente} estado="esperando" alto={56} />
            <span className="caixa-texto">
              <small>{l.quem}</small>
              <b>{l.titulo}</b>
              {l.detalhes.length > 0 && <span className="caixa-chips">{l.detalhes.slice(0, 4).map(([n, q]) => <span key={n}>{n} · {q}</span>)}</span>}
            </span>
            <Icone nome="seta_dir" tam={18} />
          </Link>
        )
      })}</div>
    </div>
  )
}
