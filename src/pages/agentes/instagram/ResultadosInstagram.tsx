// Agente de Marketing → Resultados do Instagram, em 5 abas: Período (abre aqui: o período escolhido contra o anterior,
// Agente × Fora, os posts e a análise do período), Posts (lista completa com filtros), Seguidores (gráficos), Comparações
// (anos, mesmo recorte em anos diferentes, antes × depois de uma data) e Aprendizados (histórico de análises, ensinar o
// agente, revisão semanal). Atualiza sozinho todo dia às 6h; "Atualizar agora" lê na hora.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { CabecalhoAba } from '../marketing/BarraFiltros'
import { memoriaDe } from '../memoria'
import { acaoInstagram, hojeBR, mediana, n, somaDias, useConexao, usePostsInstagram, useSeguidores, type FiltroAnalise, type PostIG } from './dados'
import { ligarRevisaoSemanal, pendentes, useAnalises } from './analises'
import { useMarcos } from './marcos'
import { AbaPeriodo } from './AbaPeriodo'
import { AbaPosts } from './AbaPosts'
import { AbaSeguidores } from './AbaSeguidores'
import { AbaComparacoes } from './AbaComparacoes'
import { AbaAprendizados } from './AbaAprendizados'
import { RecriarPost } from './RecriarPost'

type Aba = 'periodo' | 'posts' | 'seguidores' | 'comparacoes' | 'aprendizados'
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'periodo', nome: 'Período' }, { id: 'posts', nome: 'Posts' }, { id: 'seguidores', nome: 'Seguidores' }, { id: 'comparacoes', nome: 'Comparações' }, { id: 'aprendizados', nome: 'Aprendizados' },
]
type Props = { empresa: string; aoAbrirPeca: (id: string) => void }

export function ResultadosInstagram({ empresa, aoAbrirPeca }: Props) {
  const conexao = useConexao(empresa)
  const posts = usePostsInstagram(empresa)
  const seguidores = useSeguidores(empresa)
  const analises = useAnalises(empresa)
  const marcos = useMarcos(empresa)
  const perfil = useConsulta<{ perfil: Record<string, unknown> } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresa).eq('agente_id', 'marketing').maybeSingle(), [empresa])
  const [aba, setAba] = useState<Aba>('periodo')
  const [recriar, setRecriar] = useState<PostIG | null>(null)
  const [fazendo, setFazendo] = useState<'analisar' | 'sincronizar' | 'historico' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [noventaDias] = useState(() => somaDias(hojeBR(), -89))
  const todos = useMemo(() => posts.dados ?? [], [posts.dados])
  const historico = useMemo(() => seguidores.dados ?? [], [seguidores.dados])
  const lista = analises.dados ?? []
  const medRef = useMemo(() => mediana(todos.filter((p) => p.publicado_em.slice(0, 10) >= noventaDias).map((p) => n(p, 'alcance'))), [todos, noventaDias])
  const maisAntigo = todos.at(-1)?.publicado_em.slice(0, 10) ?? ''
  const faltam = lista.reduce((s, a) => s + pendentes(a).length, 0)
  const c = conexao.dados

  const recarregarTudo = () => { conexao.recarregar(); posts.recarregar(); seguidores.recarregar(); analises.recarregar(); marcos.recarregar() }
  const agir = async (acao: 'analisar' | 'revisao_semanal' | 'sincronizar' | 'historico', filtro?: FiltroAnalise) => {
    setErro(null); setAviso(null); setFazendo(acao === 'revisao_semanal' ? 'analisar' : acao)
    try {
      await acaoInstagram(empresa, acao, filtro)
      if (acao === 'historico') setAviso('Buscando os posts desde 2024 com as métricas. Leva alguns minutos: volte e recarregue a página.')
      recarregarTudo()
    } catch (e) { setErro((e as Error).message) }
    setFazendo(null)
  }
  const ligarRevisao = async (ligada: boolean) => { setErro(null); try { await ligarRevisaoSemanal(empresa, ligada); conexao.recarregar() } catch (e) { setErro((e as Error).message) } }
  const aposEnsinar = () => { analises.recarregar(); perfil.recarregar() }
  const analisar = (f: FiltroAnalise) => agir('analisar', f)
  const analisando = fazendo === 'analisar'

  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Resultados" sub="O que os posts entregaram, comparado com antes, e o que o agente aprendeu com eles. Hoje: Instagram." />
      {!conexao.carregando && c?.status !== 'conectado' && (
        <div className="mk-vazio-grande"><Icone nome="grafico" tam={30} /><p>O Instagram ainda não está ligado.</p>
          <span className="muted pequeno">Ligue em <Link to="/agentes/central?aba=integracoes">Configurações → Integrações</Link>. Depois disso o agente lê os posts e as métricas todo dia.</span></div>
      )}
      {c?.status === 'conectado' && (<>
        <div className="re-topo">
          <nav className="re-abas" role="tablist">{ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativa' : ''} onClick={() => setAba(a.id)}>
              {a.nome}{a.id === 'aprendizados' && faltam > 0 && <span className="re-selo">{faltam}</span>}</button>))}</nav>
          <div className="ig-atualiza">
            <span className="muted pequeno"><Icone nome="relogio" tam={14} /> Lido às {c.sincronizado_em ? new Date(c.sincronizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'} · sozinho todo dia às 6h</span>
            <button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('sincronizar')}><Icone nome="atualizar" tam={13} /> {fazendo === 'sincronizar' ? 'Lendo…' : 'Atualizar agora'}</button>
            {maisAntigo > '2024-01-31' && <button type="button" className="btn btn-mini" disabled={!!fazendo} onClick={() => agir('historico')}><Icone nome="historico" tam={13} /> Trazer histórico desde 2024</button>}
          </div>
        </div>
        {aviso && <p className="nota pequeno">{aviso}</p>}
        <Erro msg={erro} />
        {aba === 'periodo' && <AbaPeriodo empresa={empresa} posts={todos} seguidores={historico} medRef={medRef} analises={lista} analisando={analisando} aoAnalisar={analisar} aoRecriar={setRecriar} aoMudar={aposEnsinar} />}
        {aba === 'posts' && <AbaPosts posts={todos} aoMudar={posts.recarregar} aoRecriar={setRecriar} />}
        {aba === 'seguidores' && <AbaSeguidores historico={historico} atual={c.seguidores} />}
        {aba === 'comparacoes' && <AbaComparacoes empresa={empresa} posts={todos} seguidores={historico} datas={marcos.dados ?? []} aoMudarDatas={marcos.recarregar} analises={lista} analisando={analisando} aoAnalisar={analisar} aoMudar={aposEnsinar} />}
        {aba === 'aprendizados' && <AbaAprendizados empresa={empresa} analises={lista} memoria={memoriaDe(perfil.dados?.perfil ?? {})} revisaoLigada={!!c.revisao_semanal} aoLigarRevisao={ligarRevisao}
          analisando={analisando} aoRevisarAgora={() => agir('revisao_semanal')} aoMudar={aposEnsinar} />}
        <p className="muted pequeno re-rodape">Os números vêm do Instagram e não separam o que foi impulsionado (anúncio) do orgânico. "Agente" ou "Fora": o post é ligado sozinho à peça do agente quando a legenda bate; dá para corrigir clicando na etiqueta.</p>
        {recriar && <RecriarPost key={recriar.id} post={recriar} med={medRef} aoFechar={() => setRecriar(null)} aoCriada={(id) => { setRecriar(null); aoAbrirPeca(id) }} />}
      </>)}
    </section>
  )
}
