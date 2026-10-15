// Listas (campanhas): admin vê todas e o andamento de cada vendedora; a vendedora vê só a parte dela.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { dataBR } from '../../lib/format'
import { Badge, Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { useAuth } from '../../auth'
import { descreverFiltro, somar, type Campanha } from './comum'

export function BarraLista({ t }: { t: ReturnType<typeof somar> }) {
  const pct = (n: number) => `${t.total ? (100 * n) / t.total : 0}%`
  const feitos = t.total - t.a_contatar
  return (
    <div className="barra-lista" title={`${feitos} de ${t.total} já contatados`}>
      <div className="bl-comprou" style={{ width: pct(t.compraram) }} />
      <div className="bl-andamento" style={{ width: pct(Math.max(0, feitos - t.compraram)) }} />
    </div>
  )
}

export default function Listas() {
  const { isAdmin } = useAuth()
  const q = useConsulta<Campanha[]>(() => supabase.rpc('resumo_campanhas'))
  const ativas = (q.dados ?? []).filter((c) => c.status === 'ativa')
  const encerradas = (q.dados ?? []).filter((c) => c.status === 'encerrada')

  const card = (c: Campanha) => {
    const t = somar(c.por_vendedora)
    return (
      <Link key={c.id} to={`/atendimento/listas/${c.id}`} className="card-lista">
        <div className="card-lista-topo">
          <h3>{c.nome}</h3>
          {c.status === 'encerrada' && <Badge tom="apagado">Encerrada</Badge>}
        </div>
        {c.objetivo && <p className="muted pequeno">{c.objetivo}</p>}
        <BarraLista t={t} />
        <div className="card-lista-nums">
          <span><b>{t.a_contatar.toLocaleString('pt-BR')}</b> a contatar</span>
          <span><b>{t.andamento.toLocaleString('pt-BR')}</b> em andamento</span>
          <span className="ok-txt"><b>{t.compraram.toLocaleString('pt-BR')}</b> compraram</span>
          {t.retornar_hoje > 0 && <span className="ouro-txt"><b>{t.retornar_hoje}</b> retornar hoje</span>}
        </div>
        {isAdmin && c.por_vendedora.length > 0 && (
          <div className="card-lista-vend">
            {c.por_vendedora.map((v) => <span key={v.vendedora_id ?? '-'}>{v.vendedora_nome}: {v.total - v.a_contatar}/{v.total}</span>)}
          </div>
        )}
        <div className="muted pequeno">{isAdmin ? `${descreverFiltro(c.filtro ?? {})} · ` : ''}criada em {dataBR(c.criado_em)} · {t.total.toLocaleString('pt-BR')} contatos{isAdmin ? '' : ' para você'}</div>
      </Link>
    )
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>{isAdmin ? 'Listas' : 'Minhas listas'}</h1><p className="muted">{isAdmin ? 'Listas de contatos divididas entre as vendedoras. Para criar uma nova, filtre em Contatos.' : 'Os contatos que são seus para chamar no WhatsApp. Abra a lista, mande a mensagem e marque o que aconteceu.'}</p></div>
        {isAdmin && <Link to="/atendimento/contatos" className="btn btn-ouro btn-grande"><Icone nome="mais" /> Nova lista</Link>}
      </header>
      <Erro msg={q.erro} />
      {!q.carregando && ativas.length === 0 && <Vazio>{isAdmin ? 'Nenhuma lista ativa. Vá em Contatos, filtre quem você quer chamar e clique em “Criar lista com esse filtro”.' : 'Nenhuma lista para você ainda.'}</Vazio>}
      <div className="cards">{ativas.map(card)}</div>
      {encerradas.length > 0 && (<>
        <h2 className="titulo-secao" style={{ marginTop: 28 }}>Encerradas</h2>
        <div className="cards">{encerradas.map(card)}</div>
      </>)}
    </div>
  )
}
