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
import { etapaDe, nomeSituacao } from './marketing/etapas'
import { foraDoMarketing } from './marketing/peca/editor'
import { situacaoDe } from './editor/CartaoVideo'

type Linha = { agente: string; titulo: string; detalhes: [string, number][]; link: string }

// conta por nome e deixa os mais frequentes primeiro
function contar(nomes: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const n of nomes) m.set(n, (m.get(n) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function linhas(pecas: Peca[]): Linha[] {
  const r: Linha[] = []
  const marketing = pecas.filter((p) => !foraDoMarketing(p) && etapaDe(p) !== 'publicado')
  if (marketing.length) r.push({ agente: 'marketing', titulo: `${marketing.length} peça(s) esperando você`, detalhes: contar(marketing.map(nomeSituacao)), link: '/agentes/marketing' })
  const videos = pecas.filter((p) => (p.tipo === 'reels' || p.tipo === 'video') && p.conteudo.etapa !== 'ideia').map(situacaoDe)
  const previas = videos.filter((s) => s === 'previa').length
  if (previas) r.push({ agente: 'editor', titulo: `${previas} vídeo(s) com prévia pronta para revisar`, detalhes: [], link: '/agentes/editor' })
  return r
}

export default function Aprovacoes() {
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA_UNIQUE).eq('status', 'rascunho').order('dia'))
  const lista = linhas(pecas.dados ?? [])
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Aprovações <BotaoAjuda id="aprovar" /></h1><p className="muted">O que cada agente preparou e espera uma decisão. Clique para decidir dentro do agente.</p></div></header>
      {!pecas.carregando && !lista.length && <Vazio>Nada esperando você.</Vazio>}
      <div className="caixa-lista">{lista.map((l) => {
        const v = visualDe(l.agente)
        return (
          <Link key={l.agente} to={l.link} className="caixa-linha" style={{ ['--cor-agente' as string]: v.cor }}>
            <Retrato agente={l.agente} estado="esperando" alto={56} />
            <span className="caixa-texto">
              <small>Agente de {v.nome}</small>
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
