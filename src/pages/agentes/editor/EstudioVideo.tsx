// Estúdio de edição do Agente Editor de Vídeo (/agentes/editor/video/:id): onde o vídeo é editado, venha de onde vier
// (vídeo solto, reels planejado pelo Marketing ou criativo de anúncio). O vídeo fica aqui até "Concluir edição"; aí é
// entregue ao post, ao Marketing (postagem avulsa) ou ao Tráfego. Telas definitivas em desenho; esta é a mecânica.
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Voltar } from '../../../components/Voltar'
import type { Peca } from '../comum'
import { EMPRESA } from '../marketing/useMarketing'
import { AbaEdicao } from '../marketing/edicao/AbaEdicao'
import { edicaoDa } from '../marketing/edicao/dados'
import { alterarPeca } from '../marketing/peca/useEdicao'
import { destinoDa, ehAvulso, NOME_DESTINO } from '../marketing/peca/editor'

function Finalidade({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const atual = (peca.conteudo.briefing as { finalidade?: string } | undefined)?.finalidade === 'anuncio' ? 'anuncio' : 'organico'
  const mudar = async (finalidade: string) => {
    await alterarPeca(peca.id, (p) => ({ conteudo: { ...p.conteudo, briefing: { ...((p.conteudo as { briefing?: object }).briefing ?? {}), finalidade } } }))
    aoMudar()
  }
  return (
    <label className="campo estudio-finalidade"><span>Para que é</span>
      <span className="select-icone"><select value={atual} onChange={(e) => void mudar(e.target.value)} disabled={!!edicaoDa(peca.conteudo).concluida}>
        <option value="anuncio">Criativo de anúncio (vai para o Tráfego)</option><option value="organico">Post no perfil (vai para o Marketing)</option></select></span>
    </label>
  )
}

export default function EstudioVideo() {
  const { id = '' } = useParams()
  const peca = useConsulta<Peca | null>(() => supabase.from('agentes_pecas').select('*').eq('id', id).eq('empresa_id', EMPRESA).maybeSingle(), [id])
  const p = peca.dados
  return (
    <div className="pagina estudio">
      <div className="migalha"><Voltar para="/agentes/editor" texto="Agente Editor de Vídeo" /></div>
      <Erro msg={peca.erro} />
      {peca.carregando && !p ? <p className="muted">Carregando…</p> : !p ? <p className="muted">Vídeo não encontrado.</p> : (<>
        <header className="estudio-topo">
          <div>
            <h1>{p.titulo}</h1>
            <p className="muted pequeno">{p.tipo === 'video' ? 'Vídeo longo' : 'Reels'} · {ehAvulso(p) ? 'vídeo trazido para editar' : 'post planejado pelo Marketing'} · ao concluir, vai para {NOME_DESTINO[destinoDa(p)]}</p>
          </div>
          {ehAvulso(p) && <Finalidade peca={p} aoMudar={peca.recarregar} />}
        </header>
        <AbaEdicao peca={p} aoMudar={peca.recarregar} estudio />
      </>)}
    </div>
  )
}
