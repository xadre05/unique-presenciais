// Aba "Vídeo" da peça na Produção do Marketing. A peça não é editada aqui: quem edita é o Agente Editor de Vídeo, no
// Estúdio. Aqui aparece o vídeo que ele entregou (com o agendamento no Instagram) ou o caminho para o Estúdio; e, se o
// vídeo já veio editado de fora, dá para agendar direto.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import type { Rascunho } from '../peca/modelo'
import { PublicarVideo } from './PublicarVideo'
import { edicaoDa, mesmoArquivo } from './dados'
import { EscolhaBruto } from './EscolhaBruto'
import { VideoEntregue } from './EntregaVideo'
import { pegarArquivo } from '../../editor/arquivoPendente'

export function AbaEdicao({ peca, r, aoMudar }: { peca: Peca; r?: Rascunho; aoMudar: () => void }) {
  const edicao = edicaoDa(peca.conteudo)
  const [arquivo, setArquivo] = useState<File | null>(() => pegarArquivo(peca.id))
  const agendar = r ? <PublicarVideo peca={peca} r={r} rotulo="Agendar no Instagram" aoMudar={aoMudar} /> : undefined
  const jaEditado = r && arquivo ? <PublicarVideo peca={peca} r={r} arquivo={arquivo} rotulo="Agendar este vídeo no Instagram" aoMudar={aoMudar} /> : null
  return (
    <div className="ev">
      <VideoEntregue peca={peca} emEstudio={false} extra={agendar} />
      {!edicao.concluida && (<>
        <section className="ev-passo">
          <h4><Icone nome="video" tam={16} /> Vídeo deste post</h4>
          <p className="muted pequeno">Quem edita é o Agente Editor de Vídeo. Quando ele concluir, o vídeo editado aparece aqui, pronto para agendar.</p>
          <div className="ia-linha"><Link className="btn btn-ouro" to={`/agentes/editor/video/${peca.id}`}><Icone nome="floco" tam={16} /> Editar no Agente Editor</Link></div>
        </section>
        <EscolhaBruto pecaId={peca.id} arquivo={arquivo} anterior={edicao.arquivo} confere={arquivo ? mesmoArquivo(edicao.arquivo, arquivo) : false} ocupado={false} aoEscolher={setArquivo} jaEditado={jaEditado} />
      </>)}
    </div>
  )
}
