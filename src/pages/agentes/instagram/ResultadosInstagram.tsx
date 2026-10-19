// Agente de Marketing → Resultados do Instagram, de cima para baixo: filtros (ano, formato, quem fez), seguidores dia a
// dia, marcos (antes × depois), comparação entre os anos, resumo por formato, comparar períodos, pedir análise ao
// agente (um lugar só, com histórico), o que o agente já aprendeu e a lista de posts (com Recriar).
// Atualiza sozinho todo dia de manhã; "Atualizar agora" lê na hora; o histórico desde 2024 é trazido uma vez.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { CabecalhoAba } from '../marketing/BarraFiltros'
import { memoriaDe } from '../memoria'
import { NOME_TIPO, acaoInstagram, mediana, milhar, n, origemDe, useConexao, usePostsInstagram, useSeguidores, type FiltroAnalise, type Origem, type PostIG } from './dados'
import { ligarRevisaoSemanal, useAnalises } from './analises'
import { antesEDepois, useMarcos } from './marcos'
import { AnaliseInstagram } from './AnaliseInstagram'
import { AprendidoResultados } from './AprendidoResultados'
import { ComparaAnos, PorFormato } from './Tabelas'
import { ComparaPeriodos } from './ComparaPeriodos'
import { ListaPosts } from './ListaPosts'
import { Marcos } from './Marcos'
import { RecriarPost } from './RecriarPost'
import { SeguidoresInstagram } from './SeguidoresInstagram'
import type { OpcaoAnalise } from './PedirAnalise'
import type { Periodo } from './TabelaPeriodos'

const NOME_ORIGEM: Record<Origem, string> = { agente: 'Feitos pelo agente', fora: 'Feitos fora' }
const dataBR = (d: string) => d.split('-').reverse().join('/')
// ano, formato e quem fez viram o filtro da análise "posts do filtro"
const filtroDe = (ano: string, tipo: string, origem: string): FiltroAnalise =>
  ({ ...(ano ? { de: `${ano}-01-01`, ate: `${ano}-12-31` } : {}), ...(tipo ? { tipo } : {}), ...(origem ? { origem: origem as Origem } : {}) })

type Props = { empresa: string; aoAbrirPeca: (id: string) => void }

export function ResultadosInstagram({ empresa, aoAbrirPeca }: Props) {
  const conexao = useConexao(empresa)
  const posts = usePostsInstagram(empresa)
  const seguidores = useSeguidores(empresa)
  const analises = useAnalises(empresa)
  const marcos = useMarcos(empresa)
  const perfil = useConsulta<{ perfil: Record<string, unknown> } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle(), [empresa])
  const [ano, setAno] = useState('')
  const [tipo, setTipo] = useState('')
  const [origem, setOrigem] = useState('')
  const [comparacao, setComparacao] = useState<{ periodos: Periodo[]; rotulo: string }>({ periodos: [], rotulo: '' })
  const [recriar, setRecriar] = useState<PostIG | null>(null)
  const [fazendo, setFazendo] = useState<'analisar' | 'sincronizar' | 'historico' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const todos = useMemo(() => posts.dados ?? [], [posts.dados])
  const historico = useMemo(() => seguidores.dados ?? [], [seguidores.dados])
  const anos = useMemo(() => [...new Set(todos.map((p) => p.publicado_em.slice(0, 4)))].sort().reverse(), [todos])
  const tipos = useMemo(() => [...new Set(todos.map((p) => p.tipo))], [todos])
  const doFormato = useMemo(() => todos.filter((p) => (!tipo || p.tipo === tipo) && (!origem || origemDe(p) === origem)), [todos, tipo, origem])
  const lista = useMemo(() => doFormato.filter((p) => !ano || p.publicado_em.startsWith(ano)), [doFormato, ano])
  const med = useMemo(() => mediana(lista.map((p) => n(p, 'alcance'))), [lista])
  const maisAntigo = todos.at(-1)?.publicado_em.slice(0, 10) ?? ''
  const c = conexao.dados
  const rotuloFiltro = [ano || 'todos os anos', tipo && (NOME_TIPO[tipo] ?? tipo), origem && NOME_ORIGEM[origem as Origem].toLowerCase()].filter(Boolean).join(' · ')

  // o que dá para pedir ao agente (um botão só); o que ainda não dá aparece com o motivo
  const opcoes: OpcaoAnalise[] = [
    { id: 'filtro', titulo: `Os posts do filtro (${rotuloFiltro})`, explica: 'O que funcionou e o que não, post a post, comparado com a mediana. Com mais de um ano, compara os anos.', filtro: filtroDe(ano, tipo, origem), motivo: lista.length < 5 ? 'Precisa de pelo menos 5 posts no filtro.' : undefined },
    { id: 'periodos', titulo: `A comparação de períodos${comparacao.periodos.length ? ` (${comparacao.rotulo}: ${comparacao.periodos.map((p) => p.nome).join(' × ')})` : ''}`, explica: 'O que fez a diferença entre os períodos escolhidos em "Comparar períodos".', filtro: { periodos: comparacao.periodos, ...(tipo ? { tipo } : {}) }, motivo: comparacao.periodos.length < 2 ? 'Escolha dois anos ou mais em "Comparar períodos".' : undefined },
    ...(marcos.dados ?? []).map((m) => {
      const ad = antesEDepois(m)
      return { id: `marco:${m.id}`, titulo: `O marco "${m.nome}" (${dataBR(m.dia)}): antes × depois`, explica: `Se a mudança funcionou: ${ad.dias} ${ad.dias === 1 ? 'dia' : 'dias'} depois contra os ${ad.dias} dias antes.`, filtro: { periodos: ad.periodos, marco: { nome: m.nome, dia: m.dia, descricao: m.descricao } }, motivo: ad.dias < 1 ? `Começa em ${dataBR(m.dia)}.` : undefined }
    }),
    { id: 'semanal', titulo: 'A última semana × as 4 semanas antes', explica: 'Revisão da semana: o que ficou bom, o que não ficou e o que ensinar.', semanal: true },
  ]

  const recarregarTudo = () => { conexao.recarregar(); posts.recarregar(); seguidores.recarregar(); analises.recarregar(); marcos.recarregar() }
  const agir = async (acao: 'analisar' | 'sincronizar' | 'historico', o?: OpcaoAnalise) => {
    setErro(null); setAviso(null); setFazendo(acao)
    try {
      if (acao === 'analisar') await acaoInstagram(empresa, o?.semanal ? 'revisao_semanal' : 'analisar', o?.filtro)
      else await acaoInstagram(empresa, acao)
      if (acao === 'analisar') document.querySelector('.ig-hist-titulo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (acao === 'historico') setAviso('Buscando os posts desde 2024 com as métricas. Leva alguns minutos: volte e recarregue a página.')
      recarregarTudo()
    } catch (e) { setErro((e as Error).message) }
    setFazendo(null)
  }
  const ligarRevisao = async (ligada: boolean) => { setErro(null); try { await ligarRevisaoSemanal(empresa, ligada); conexao.recarregar() } catch (e) { setErro((e as Error).message) } }

  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Resultados" sub="O que os posts publicados entregaram e o que o agente aprendeu com eles. Hoje: Instagram." />
      {!conexao.carregando && c?.status !== 'conectado' && (
        <div className="mk-vazio-grande"><Icone nome="grafico" tam={30} /><p>O Instagram ainda não está ligado.</p>
          <span className="muted pequeno">Ligue em <Link to="/agentes/central?aba=integracoes">Configurações → Integrações</Link>. Depois disso o agente lê os posts e as métricas todo dia.</span></div>
      )}
      {c?.status === 'conectado' && (<>
        <div className="ig-barra">
          <div className="ia-linha">
            <button type="button" className={`mk-chip${!ano ? ' ativo' : ''}`} onClick={() => setAno('')}>Todos os anos</button>
            {anos.map((a) => <button key={a} type="button" className={`mk-chip${ano === a ? ' ativo' : ''}`} onClick={() => setAno(a)}>{a}</button>)}
            <span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Formato">
              <option value="">Todos os formatos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span>
            <span className="select-icone"><select value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label="Quem fez">
              <option value="">Agente e fora</option>{(Object.keys(NOME_ORIGEM) as Origem[]).map((o) => <option key={o} value={o}>{NOME_ORIGEM[o]}</option>)}</select></span>
          </div>
          <div className="ig-atualiza">
            <span className="muted pequeno"><Icone nome="relogio" tam={14} /> Atualiza sozinho todo dia às 6h. Última leitura: {c.sincronizado_em ? new Date(c.sincronizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('sincronizar')}><Icone nome="atualizar" tam={13} /> {fazendo === 'sincronizar' ? 'Lendo…' : 'Atualizar agora'}</button>
            {maisAntigo > '2024-01-31' && <button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('historico')}><Icone nome="historico" tam={13} /> Trazer histórico desde 2024</button>}
          </div>
        </div>
        {aviso && <p className="nota pequeno">{aviso}</p>}
        <div className="ig-cartoes">
          <div><small>Posts no filtro</small><b>{lista.length}</b></div>
          <div><small>Alcance mediano por post</small><b>{milhar(med)}</b></div>
          <div><small>Feitos pelo agente</small><b>{lista.filter((p) => origemDe(p) === 'agente').length}</b></div>
          <div><small>Desde</small><b>{maisAntigo ? new Date(maisAntigo + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—'}</b></div>
        </div>
        <SeguidoresInstagram historico={historico} atual={c.seguidores} />
        <Marcos key={(marcos.dados ?? []).map((m) => m.id).join()} empresa={empresa} marcos={marcos.dados ?? []} posts={doFormato} seguidores={historico} aoMudar={marcos.recarregar} />
        {!ano && anos.length > 1 && <><h4 className="reu-subtitulo">Comparação entre os anos{tipo ? ` · ${NOME_TIPO[tipo] ?? tipo}` : ''}</h4><ComparaAnos posts={lista} /></>}
        {lista.length > 0 && <><h4 className="reu-subtitulo">Por formato{ano ? ` · ${ano}` : ''}</h4><PorFormato posts={lista} /></>}
        {anos.length > 1 && <ComparaPeriodos key={anos.join()} posts={doFormato} seguidores={historico} anos={anos} tipo={tipo} aoMudar={(periodos, rotulo) => setComparacao({ periodos, rotulo })} />}
        <AnaliseInstagram key={analises.dados?.[0]?.id ?? 'nenhuma'} empresa={empresa} analises={analises.dados ?? []} opcoes={opcoes} analisando={fazendo === 'analisar'} aoPedir={(o) => agir('analisar', o)}
          revisaoLigada={!!c.revisao_semanal} aoLigarRevisao={ligarRevisao} aoMudar={() => { analises.recarregar(); perfil.recarregar() }} />
        <Erro msg={erro} />
        <AprendidoResultados empresa={empresa} memoria={memoriaDe(perfil.dados?.perfil ?? {})} aoMudar={perfil.recarregar} />
        {lista.length > 0 ? <ListaPosts posts={lista} med={med} aoMudar={posts.recarregar} aoRecriar={setRecriar} /> : <p className="muted pequeno">Nenhum post neste filtro.</p>}
        <p className="muted pequeno">Os números vêm do Instagram e não separam o que foi impulsionado (anúncio) do orgânico. "Quem fez": o post é ligado sozinho à peça do agente quando a legenda bate; dá para corrigir clicando na etiqueta.</p>
        {recriar && <RecriarPost key={recriar.id} post={recriar} med={med} aoFechar={() => setRecriar(null)} aoCriada={(id) => { setRecriar(null); aoAbrirPeca(id) }} />}
      </>)}
    </section>
  )
}
