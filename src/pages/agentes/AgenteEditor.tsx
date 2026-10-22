// Agente Editor de Vídeo: a entrada do editor, em três abas. Vídeos (arrastar um vídeo para editar, os vídeos em
// andamento em cartões e os criativos entregues ao Tráfego), Estilos (estilo da casa, estilos salvos e regras
// aprendidas) e Banco de imagens. A edição em si acontece no Estúdio (/agentes/editor/video/:id).
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BotaoAjuda } from './ajuda/BotaoAjuda'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { Voltar } from '../../components/Voltar'
import { Retrato } from './Retrato'
import { visualDe, type Peca } from './comum'
import { EMPRESA } from './marketing/useMarketing'
import { edicaoDa, useTemEditor } from './marketing/edicao/dados'
import { useLogos } from './LogosMarca'
import { BancoImagens, bancoDe } from './BancoImagens'
import { NovoVideo } from './editor/NovoVideo'
import { EstilosEdicao } from './editor/EstilosEdicao'
import { EntreguesTrafego } from './editor/EntreguesTrafego'
import { CartaoVideo, NOME_SITUACAO, situacaoDe, type Situacao } from './editor/CartaoVideo'

type Aba = 'videos' | 'estilo' | 'banco'
const ABAS: { id: Aba; nome: string; icone: string }[] = [{ id: 'videos', nome: 'Vídeos', icone: 'claquete' }, { id: 'estilo', nome: 'Estilos', icone: 'lapis' }, { id: 'banco', nome: 'Banco de imagens', icone: 'imagem' }]

export default function AgenteEditor() {
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<Aba>(() => { const a = params.get('aba'); return a === 'estilo' || a === 'banco' ? a : 'videos' })
  const trocar = (a: Aba) => { setAba(a); setParams(a === 'videos' ? {} : { aba: a }, { replace: true }); window.scrollTo(0, 0) }
  const a = visualDe('editor')
  const tem = useTemEditor()
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing')
    .in('tipo', ['reels', 'video']).neq('status', 'descartada').order('atualizado_em', { ascending: false }).limit(60))
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Situacao | ''>('')
  const lista = (pecas.dados ?? []).filter((p) => p.conteudo.etapa !== 'ideia' && edicaoDa(p.conteudo).concluida?.destino !== 'trafego')
    .filter((p) => (!filtro || situacaoDe(p) === filtro) && (!busca.trim() || p.titulo.toLowerCase().includes(busca.trim().toLowerCase())))
  const marca = useLogos(EMPRESA)
  const perfilMarca = marca.dados?.perfil ?? {}
  const todasCampanhas = (Array.isArray(perfilMarca.campanhas) ? perfilMarca.campanhas : []) as { id: string; nome: string; encerrada?: boolean }[]
  const campanhas = todasCampanhas.filter((c) => !c.encerrada)
  // em quantos vídeos cada mídia do banco já entrou (para o painel de detalhes)
  const usos = (pecas.dados ?? []).reduce<Record<string, number>>((m, p) => { for (const x of edicaoDa(p.conteudo).midias ?? []) if (x.caminho && (edicaoDa(p.conteudo).receitas?.length)) m[x.caminho] = (m[x.caminho] ?? 0) + 1; return m }, {})
  const nomeCampanha = (p: Peca) => todasCampanhas.find((c) => c.id === p.conteudo.campanha)?.nome

  return (
    <div className="pagina editor-pagina">
      <div className="migalha"><Voltar para="/agentes" texto="Sala dos agentes" /></div>
      <header className="ed-topo">
        <Retrato agente="editor" estado={tem.dados ? 'trabalhando' : 'parado'} alto={110} />
        <div>
          <h1>Agente {a.nome} <BotaoAjuda id={aba === 'videos' ? 'editar-video' : 'estilo-casa'} /></h1>
          <p className="muted">Do vídeo bruto à edição pronta para entregar.</p>
          {tem.dados === false && <p className="nota">Este agente é contratado à parte e ainda não está ligado na empresa. Ligue em <Link to="/agentes/central?aba=agentes" className="link">Configurações → Agentes</Link>.</p>}
        </div>
      </header>
      {tem.dados && <nav className="ed-abas">{ABAS.map((x) => (
        <button key={x.id} type="button" className={aba === x.id ? 'ativa' : ''} onClick={() => trocar(x.id)}><Icone nome={x.icone} tam={17} /> {x.nome}{x.id === 'banco' ? ` · ${bancoDe(perfilMarca).length}` : ''}</button>))}</nav>}

      {/* fica montado ao trocar de aba: o vídeo e o roteiro escolhidos não somem */}
      {tem.dados && <section className="bloco ed-entrada" hidden={aba !== 'videos'}><NovoVideo campanhas={campanhas} />
        <div className="ed-atalhos"><Link to="/agentes/editor/cortes" className="ed-longo"><Icone nome="live" tam={20} /><span><b>Tem um vídeo longo?</b><small className="muted">Aula, live ou podcast: o agente acha os melhores trechos e transforma em vários reels.</small></span><Icone nome="seta_dir" tam={16} /></Link>
        <Link to="/agentes/editor/sem-gravar" className="ed-longo"><Icone nome="microfone" tam={20} /><span><b>Vídeo sem gravar</b><small className="muted">Escreva o texto, escolha a voz e a IA narra. O agente monta o vídeo com cenas animadas e imagens.</small></span><Icone nome="seta_dir" tam={16} /></Link></div>
      </section>}
      {tem.dados && aba === 'videos' && (
        <section className="bloco">
          <div className="ed-lista-topo">
            <div className="ed-lista-titulo"><h2>Em edição</h2><p className="muted pequeno">Seus vídeos e reels em andamento.</p></div>
            <input type="search" className="ed-busca" placeholder="Buscar vídeo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span className="select-icone"><select value={filtro} onChange={(e) => setFiltro(e.target.value as Situacao | '')} aria-label="Situação">
              <option value="">Todas</option>{(Object.keys(NOME_SITUACAO) as Situacao[]).map((s) => <option key={s} value={s}>{NOME_SITUACAO[s]}</option>)}</select></span>
          </div>
          <Erro msg={pecas.erro} />
          {pecas.carregando && !pecas.dados ? <p className="muted">Carregando…</p> : !lista.length ? <Vazio>{busca || filtro ? 'Nenhum vídeo com esse filtro.' : 'Nenhum vídeo em edição ainda.'}</Vazio> : (
            <div className="ed-grade">{lista.map((p) => <CartaoVideo key={p.id} p={p} campanha={nomeCampanha(p)} />)}</div>
          )}
        </section>
      )}
      {tem.dados && aba === 'videos' && <EntreguesTrafego pecas={pecas.dados ?? []} />}
      {tem.dados && aba === 'videos' && (
        <div className="ed-atalhos">
          <button type="button" onClick={() => trocar('estilo')}><Icone nome="lapis" tam={22} /><span><b>Estilos</b><small className="muted">Defina o jeito de editar seus vídeos e reels.</small></span><Icone nome="seta_dir" tam={16} /></button>
          <button type="button" onClick={() => trocar('banco')}><Icone nome="imagem" tam={22} /><span><b>Banco de imagens</b><small className="muted">Mídias de apoio para os seus vídeos.</small></span><Icone nome="seta_dir" tam={16} /></button>
        </div>
      )}
      {tem.dados && aba === 'estilo' && <EstilosEdicao />}
      {tem.dados && marca.dados && aba === 'banco' && (
        <section className="bloco">
          <h2>Mídias de apoio</h2>
          <p className="muted pequeno">Fotos, prints e clipes para complementar a edição.</p>
          <BancoImagens empresaId={EMPRESA} perfil={perfilMarca} aoSalvar={marca.recarregar} usos={usos} />
        </section>
      )}
    </div>
  )
}
