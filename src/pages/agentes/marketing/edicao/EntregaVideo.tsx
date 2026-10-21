// Fim da edição: "Concluir edição" sobe o vídeo editado e entrega conforme a origem (post planejado, Marketing para
// postagem avulsa ou Tráfego). Depois de concluída, mostra o vídeo entregue, o link para baixar e para onde foi.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { destinoDa, NOME_DESTINO, type Destino } from '../peca/editor'
import { concluirEdicao, edicaoDa, linkDoFinal } from './dados'

const ROTULO: Record<Destino, string> = { trafego: 'Concluir e entregar ao Tráfego', avulso: 'Concluir e entregar ao Marketing', post: 'Concluir e colocar no post' }
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// botão de concluir; usado no fim da edição e em "já veio editado"
export function BotaoConcluir({ peca, video, aoMudar, rotulo }: { peca: Peca; video: File | null; aoMudar: () => void; rotulo?: string }) {
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const destino = destinoDa(peca)
  const concluir = async () => {
    if (!video) return
    setErro(null)
    try { await concluirEdicao(peca, video, setEtapa); aoMudar() } catch (e) { setErro((e as Error).message) } finally { setEtapa(null) }
  }
  return (<>
    <button type="button" className="btn btn-ouro" disabled={!video || !!etapa} onClick={concluir}><Icone nome="check" tam={16} /> {rotulo ?? ROTULO[destino]}</button>
    {etapa && <span className="muted pequeno">{etapa}</span>}
    {erro && <p className="erro-txt pequeno">{erro}</p>}
  </>)
}

export function VideoEntregue({ peca, emEstudio, extra }: { peca: Peca; emEstudio: boolean; extra?: React.ReactNode }) {
  const e = edicaoDa(peca.conteudo)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { if (e.final) void linkDoFinal(e.final).then(setUrl).catch(() => setUrl(null)) }, [e.final?.caminho]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!e.concluida || !e.final) return null
  const destino = e.concluida.destino
  return (
    <section className="ev-passo ev-entregue">
      <h4><Icone nome="check" tam={16} /> Edição concluída</h4>
      <p className="pequeno">Entregue a <b>{NOME_DESTINO[destino]}</b> em {dataHora(e.concluida.em)}.</p>
      {url && <video className="ev-resultado" src={url} controls playsInline />}
      <div className="ia-linha">
        {url && <a className="btn btn-contorno-ouro btn-mini" href={url} download={e.final.nome}><Icone nome="importar" tam={14} /> Baixar o vídeo editado</a>}
        {emEstudio && destino !== 'trafego' && <Link className="btn btn-mini" to={`/agentes/marketing?peca=${peca.id}`}>Abrir no Marketing</Link>}
        {extra}
      </div>
      {destino === 'trafego' && <p className="muted pequeno">O criativo fica na lista "Entregues ao Tráfego" do Agente Editor, pronto para subir na campanha de anúncios.</p>}
      {emEstudio && <p className="muted pequeno">Precisa mudar? Edite de novo abaixo e conclua outra vez: o vídeo entregue é substituído.</p>}
    </section>
  )
}
