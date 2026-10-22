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
import { useAuth } from '../../../../auth'
import { brutoDe } from '../fluxo'
import { enviarBruto } from './brutoNuvem'

// o vídeo gravado sobe daqui (ou da lista "Para gravar") e cai na fila do Editor
function EnvioBruto({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const { perfil } = useAuth()
  const [progresso, setProgresso] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const b = brutoDe(peca)
  const enviar = async (f?: File) => {
    if (!f) return
    setErro(null); setProgresso(0)
    try { await enviarBruto(peca.id, f, setProgresso, perfil?.nome); aoMudar() } catch (e) { setErro((e as Error).message) } finally { setProgresso(null) }
  }
  return (
    <section className="ev-passo">
      <h4><Icone nome="enviar" tam={16} /> Vídeo gravado</h4>
      {b ? <p className="pequeno"><Icone nome="check" tam={14} /> Enviado{b.por ? ` por ${b.por}` : ''} em {new Date(b.em).toLocaleDateString('pt-BR')} ({b.nome}). Está na fila do Editor.</p>
        : <p className="muted pequeno">Gravou? Envie o vídeo aqui (do celular ou do computador). Ele vai para a fila de edição e qualquer pessoa da equipe abre no Estúdio.</p>}
      {progresso != null ? <p className="pequeno">Enviando… {Math.round(progresso * 100)}%</p>
        : <label className="btn btn-contorno-ouro btn-mini"><Icone nome="enviar" tam={14} /> {b ? 'Enviar outro vídeo' : 'Enviar o vídeo gravado'}<input type="file" accept="video/*" hidden onChange={(e) => { void enviar(e.target.files?.[0]); e.target.value = '' }} /></label>}
      {erro && <p className="erro-txt pequeno">{erro}</p>}
    </section>
  )
}

export function AbaEdicao({ peca, r, aoMudar }: { peca: Peca; r?: Rascunho; aoMudar: () => void }) {
  const edicao = edicaoDa(peca.conteudo)
  const [arquivo, setArquivo] = useState<File | null>(() => pegarArquivo(peca.id))
  const agendar = r ? <PublicarVideo peca={peca} r={r} rotulo="Agendar no Instagram" aoMudar={aoMudar} /> : undefined
  const jaEditado = r && arquivo ? <PublicarVideo peca={peca} r={r} arquivo={arquivo} rotulo="Agendar este vídeo no Instagram" aoMudar={aoMudar} /> : null
  return (
    <div className="ev">
      <VideoEntregue peca={peca} emEstudio={false} extra={agendar} />
      {!edicao.concluida && (<>
        <EnvioBruto peca={peca} aoMudar={aoMudar} />
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
