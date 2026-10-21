// Passo 3 da edição: o estilo deste vídeo. Estilo da casa (padrão), um estilo salvo da marca (canais estudados e
// vídeos de referência) ou uma referência nova só para este vídeo: a pessoa escolhe o vídeo de referência e diz o que
// quer dele; o navegador tira 8 fotos do vídeo e o agente edita naquele estilo. A referência fica guardada na peça.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import { guardarEdicao, useReferenciasVideo, type ReferenciaVideo } from './dados'
import { quadrosDoBruto } from './midias'

type Props = { pecaId: string; modeloRef: string; aoModelo: (id: string) => void; referencia?: ReferenciaVideo; aoMudar: () => void; semRoteiro: boolean }

export function EstiloDoVideo({ pecaId, modeloRef, aoModelo, referencia, aoMudar, semRoteiro }: Props) {
  const refs = useReferenciasVideo()
  const [nova, setNova] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [texto, setTexto] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const guardar = async () => {
    if (!arquivo || !texto.trim()) return
    setErro(null); setLendo(true)
    try {
      const quadros = await quadrosDoBruto(arquivo, 8)
      if (!quadros.length) throw new Error('Não consegui ler este vídeo de referência.')
      await guardarEdicao(pecaId, (e) => ({ ...e, referencia: { nome: arquivo.name, texto: texto.trim(), quadros } }))
      aoModelo(''); setNova(false); setArquivo(null); setTexto(''); aoMudar()
    } catch (e) { setErro((e as Error).message) } finally { setLendo(false) }
  }
  const tirar = async () => { await guardarEdicao(pecaId, (e) => ({ ...e, referencia: undefined })); aoMudar() }

  return (
    <section className="ev-passo">
      <h4><span>3</span> Estilo deste vídeo</h4>
      {referencia ? (
        <div className="ev-ref">
          <p className="pequeno"><Icone nome="video" tam={14} /> <b>Referência só para este vídeo:</b> {referencia.nome}</p>
          <p className="muted pequeno">"{referencia.texto}"</p>
          <button type="button" className="link pequeno" onClick={tirar}>Tirar a referência (volta ao estilo escolhido abaixo)</button>
        </div>
      ) : (<>
        <span className="select-icone"><select value={modeloRef} onChange={(e) => aoModelo(e.target.value)} aria-label="Estilo">
          <option value="">Estilo da casa</option>
          {(refs.dados ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome || 'Referência'}{x.autor ? ` · ${x.autor}` : ''}</option>)}
        </select></span>
        {!nova && <button type="button" className="link pequeno" onClick={() => setNova(true)}>Quero que este vídeo fique igual a outro (referência só para ele)</button>}
        {nova && (
          <div className="ev-ref">
            <label className="campo"><span>Vídeo de referência <small className="muted">(baixe o reels ou o vídeo e escolha aqui; não sobe para o sistema)</small></span>
              <input type="file" accept="video/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} disabled={lendo} /></label>
            <label className="campo"><span>O que você quer dele</span>
              <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={lendo} placeholder='Ex.: "o ritmo e os prints de notícia entrando por cima", "a legenda grande no meio da tela"' /></label>
            <div className="ia-linha">
              <button type="button" className="btn btn-ouro btn-mini" disabled={!arquivo || !texto.trim() || lendo} onClick={guardar}>{lendo ? 'Lendo o vídeo…' : 'Usar esta referência'}</button>
              <button type="button" className="btn btn-mini" disabled={lendo} onClick={() => setNova(false)}>Cancelar</button>
            </div>
            {erro && <p className="erro-txt pequeno">{erro}</p>}
          </div>
        )}
        <p className="muted pequeno">Estilos que valem para outros vídeos se ensinam em <Link to="/agentes/editor?aba=estilo" className="link">Estilos</Link>.</p>
      </>)}
      {semRoteiro && <p className="muted pequeno">Sem roteiro: o agente procura nos materiais da campanha (ex.: o PDF dos criativos) qual foi gravado. Sem nenhum, edita pelo que foi falado.</p>}
    </section>
  )
}
