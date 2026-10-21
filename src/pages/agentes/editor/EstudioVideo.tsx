// Estúdio de edição do Agente Editor de Vídeo (/agentes/editor/video/:id): onde o vídeo é editado, venha de onde vier
// (vídeo solto, reels planejado pelo Marketing ou criativo de anúncio). Três colunas: etapas | prévia (ou a etapa aberta)
// | conversa com o agente, e a barra de baixo com Gerar vídeo final e Concluir. O vídeo fica aqui até "Concluir e
// entregar"; aí vai para o post, para o Marketing (postagem avulsa) ou para o Tráfego. No celular, abas Prévia/Etapas/Ajustes.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { EMPRESA } from '../marketing/useMarketing'
import { useLogos } from '../LogosMarca'
import { PreviaVideo } from '../marketing/edicao/PreviaVideo'
import { VideoEntregue } from '../marketing/edicao/EntregaVideo'
import { alterarPeca } from '../marketing/peca/useEdicao'
import { ehAvulso, destinoDa, NOME_DESTINO } from '../marketing/peca/editor'
import { useEstudio, type Estudio } from './estudio/useEstudio'
import { Etapas } from './estudio/Etapas'
import { PainelEtapa } from './estudio/PainelEtapa'
import { PainelAjustes } from './estudio/PainelAjustes'
import { TrilhaEdicao } from './estudio/TrilhaEdicao'
import { ConcluirEdicao } from './estudio/ConcluirEdicao'

type AbaMovel = 'previa' | 'etapas' | 'ajustes'

function origemDe(p: Peca) {
  if ((p.conteudo.briefing as { finalidade?: string } | undefined)?.finalidade === 'anuncio') return 'Criativo de anúncio'
  return ehAvulso(p) ? 'Vídeo avulso' : 'Post planejado'
}

function Finalidade({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const atual = (peca.conteudo.briefing as { finalidade?: string } | undefined)?.finalidade === 'anuncio' ? 'anuncio' : 'organico'
  const mudar = async (finalidade: string) => {
    await alterarPeca(peca.id, (p) => ({ conteudo: { ...p.conteudo, briefing: { ...((p.conteudo as { briefing?: object }).briefing ?? {}), finalidade } } }))
    aoMudar()
  }
  return (
    <span className="select-icone es-finalidade"><select value={atual} onChange={(e) => void mudar(e.target.value)} aria-label="Para que é">
      <option value="anuncio">Criativo de anúncio (vai para o Tráfego)</option><option value="organico">Post no perfil (vai para o Marketing)</option></select></span>
  )
}

function Previa({ e, peca, aoTempo }: { e: Estudio; peca: Peca; aoTempo: (t: number) => void }) {
  if (!e.receita) return (
    <div className="es-vazio"><Icone nome="video" tam={30} /><p>{e.ocupado ?? 'A prévia aparece aqui depois que o agente editar.'}</p>
      {!e.ocupado && <button type="button" className="btn btn-ouro btn-mini" onClick={() => e.setPasso(e.arquivo ? 'imagens' : 'video')}>{e.arquivo ? 'Revisar as etapas e editar' : 'Escolher o vídeo'}</button>}</div>
  )
  if (!e.linha || !e.url || !e.confere) return (
    <div className="es-vazio"><Icone nome="video" tam={30} /><p>Para ver a prévia, escolha neste computador o mesmo vídeo bruto{e.edicao.arquivo ? ` (${e.edicao.arquivo.nome})` : ''}.</p>
      <button type="button" className="btn btn-ouro btn-mini" onClick={() => e.setPasso('video')}>Escolher o vídeo</button></div>
  )
  return <PreviaVideo url={e.url} linha={e.linha} vertical={peca.tipo !== 'video'} apoio={e.apoio.apoio} musica={e.apoio.musica} cor={e.cor} aoTempo={aoTempo} />
}

function Barra({ e, aoConcluir }: { e: Estudio; aoConcluir: () => void }) {
  const status = e.ocupado ? e.ocupado : e.progresso !== null ? `Montando o vídeo final… ${Math.round(e.progresso * 100)}%` : e.final ? 'Vídeo final pronto' : e.receita ? 'Prévia pronta' : 'Aguardando edição'
  return (
    <footer className="es-barra">
      {e.receitas.length > 0 && <span className="es-barra-versao">V{e.versao + 1}</span>}
      <span className={`es-barra-status${e.final || e.receita ? ' ok' : ''}`}>{status}</span>
      <span className="muted pequeno es-barra-dica">{e.final ? 'Confira e entregue.' : e.receita ? 'Revise a prévia antes de gerar.' : ''}</span>
      {e.progresso !== null && <span className="es-barra-progresso"><span style={{ width: `${Math.round(e.progresso * 100)}%` }} /></span>}
      <span className="es-barra-acoes">
        {e.final && <a className="btn btn-contorno" href={e.final.url} download={e.final.nome}><Icone nome="importar" tam={15} /> Baixar</a>}
        <button type="button" className="btn btn-contorno" disabled={!e.final} onClick={aoConcluir}><Icone nome="check" tam={15} /> Concluir edição</button>
        {!e.final && <button type="button" className="btn btn-ouro" disabled={!e.linha || !e.confere || !!e.ocupado || e.progresso !== null} onClick={() => void e.gerarFinal()}
          title={!e.confere ? 'Escolha o vídeo bruto' : 'Monta o vídeo aqui no computador; deixe a aba aberta'}><Icone nome="floco" tam={15} /> Gerar vídeo final</button>}
      </span>
    </footer>
  )
}

function TelaEstudio({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const e = useEstudio(peca, aoMudar)
  const [agora, setAgora] = useState(0)
  const [concluir, setConcluir] = useState(false)
  const [aba, setAba] = useState<AbaMovel>('previa')
  const campanhas = ((useLogos(EMPRESA).dados?.perfil?.campanhas ?? []) as { id: string; nome: string }[])
  const campanha = campanhas.find((c) => c.id === peca.conteudo.campanha)?.nome
  const entregue = !!e.edicao.concluida

  return (
    <div className="pagina estudio">
      <header className="es-topo">
        <Link to="/agentes/editor" className="btn btn-quadrado" aria-label="Voltar ao Agente Editor"><Icone nome="esquerda" tam={18} /></Link>
        <div>
          <h1><span className="muted">Estúdio de edição /</span> {peca.titulo}</h1>
          <p className="muted pequeno">{origemDe(peca)}{campanha ? ` · ${campanha}` : ''} · ao concluir, vai para {NOME_DESTINO[destinoDa(peca)]}
            {!ehAvulso(peca) && <> · <Link className="link" to={`/agentes/marketing?peca=${peca.id}`}>Ver peça de origem</Link></>}</p>
        </div>
        {ehAvulso(peca) && !entregue && <Finalidade peca={peca} aoMudar={aoMudar} />}
        <span className={`es-pilula${entregue ? ' ok' : e.receita ? ' ok' : ''}`}>{entregue ? 'Entregue' : e.final ? 'Vídeo final pronto' : e.receita ? 'Prévia pronta' : 'Em edição'}</span>
      </header>
      <Erro msg={e.erro} />
      {entregue && <VideoEntregue peca={peca} emEstudio />}
      {concluir && e.final ? <ConcluirEdicao e={e} peca={peca} aoVoltar={() => setConcluir(false)} aoMudar={() => { setConcluir(false); aoMudar() }} /> : (<>
        <nav className="es-abas-movel">{(['previa', 'etapas', 'ajustes'] as AbaMovel[]).map((a) => (
          <button key={a} type="button" className={aba === a ? 'ativa' : ''} onClick={() => setAba(a)}>{a === 'previa' ? 'Prévia' : a === 'etapas' ? 'Etapas' : 'Ajustes'}</button>))}</nav>
        <div className={`es-grade mostra-${e.passo && aba === 'previa' ? 'previa' : aba}`}>
          <Etapas e={e} />
          <main className="es-centro">
            {e.passo ? <PainelEtapa e={e} peca={peca} aoMudar={aoMudar} /> : (<>
              <div className="es-centro-topo"><h3>Prévia do vídeo</h3></div>
              <Previa e={e} peca={peca} aoTempo={setAgora} />
              {e.linha && e.confere && <TrilhaEdicao linha={e.linha} agora={agora} />}
            </>)}
          </main>
          <PainelAjustes e={e} />
        </div>
        <Barra e={e} aoConcluir={() => setConcluir(true)} />
      </>)}
    </div>
  )
}

export default function EstudioVideo() {
  const { id = '' } = useParams()
  const peca = useConsulta<Peca | null>(() => supabase.from('agentes_pecas').select('*').eq('id', id).eq('empresa_id', EMPRESA).maybeSingle(), [id])
  if (peca.carregando && !peca.dados) return <div className="pagina"><p className="muted">Carregando…</p></div>
  if (!peca.dados) return <div className="pagina"><Erro msg={peca.erro} /><p className="muted">Vídeo não encontrado.</p></div>
  return <TelaEstudio peca={peca.dados} aoMudar={peca.recarregar} />
}
