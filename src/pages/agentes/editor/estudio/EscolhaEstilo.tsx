// Etapa "Estilo" do Estúdio: como ESTE vídeo deve ser editado. Três caminhos lado a lado: o estilo da casa (padrão),
// um estilo salvo da marca (canal estudado ou vídeo de referência) ou uma referência nova só para este vídeo (o
// navegador tira 8 fotos do vídeo de referência; o agente copia a forma, nunca as frases).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'
import { guardarEdicao, useReferenciasVideo } from '../../marketing/edicao/dados'
import { quadrosDoBruto } from '../../marketing/edicao/midias'
import { estiloDe, usePerfilEditor } from '../dados'
import type { Estudio } from './useEstudio'
import { AmostraLegenda, ConfigDoEstilo } from './ConfigDoEstilo'

const LEGENDA = { palavras: 'legenda palavra por palavra', chave: 'palavras-chave em caixa' }
const IMAGENS = { muitas: 'muitas imagens de apoio', algumas: 'algumas imagens', poucas: 'poucas imagens' }

function NovaReferencia({ e, pecaId, aoMudar }: { e: Estudio; pecaId: string; aoMudar: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [texto, setTexto] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ref = e.edicao.referencia
  const usar = async () => {
    if (!arquivo || !texto.trim()) return
    setErro(null); setLendo(true)
    try {
      const quadros = await quadrosDoBruto(arquivo, 8)
      if (!quadros.length) throw new Error('Não consegui ler este vídeo de referência.')
      await guardarEdicao(pecaId, (x) => ({ ...x, referencia: { nome: arquivo.name, texto: texto.trim(), quadros } }))
      setArquivo(null); setTexto(''); aoMudar()
    } catch (x) { setErro((x as Error).message) } finally { setLendo(false) }
  }
  if (ref) return (
    <div className="es-ref-pronta">
      <p className="pequeno"><Icone nome="check" tam={14} /> <b>{ref.nome}</b></p>
      <p className="muted pequeno">"{ref.texto}"</p>
      <button type="button" className="link pequeno" onClick={async () => { await guardarEdicao(pecaId, (x) => ({ ...x, referencia: undefined })); aoMudar() }}>Tirar a referência</button>
    </div>
  )
  return (<>
    <label className="btn btn-contorno es-arquivo"><Icone nome="importar" tam={15} /> {arquivo ? arquivo.name : 'Adicionar o vídeo de referência'}
      <input type="file" accept="video/*" hidden disabled={lendo} onChange={(x) => setArquivo(x.target.files?.[0] ?? null)} /></label>
    <span className="muted pequeno">Baixe o reels ou o vídeo e escolha aqui. Ele não sobe para o sistema.</span>
    <label className="campo"><span>O que você quer aproveitar?</span>
      <textarea rows={3} value={texto} disabled={lendo} onChange={(x) => setTexto(x.target.value)} placeholder="Ritmo, legendas, prints entrando por cima…" /></label>
    <button type="button" className="btn btn-ouro btn-mini" disabled={!arquivo || !texto.trim() || lendo} onClick={usar}>{lendo ? 'Lendo o vídeo…' : 'Analisar referência'}</button>
    {erro && <p className="erro-txt pequeno">{erro}</p>}
  </>)
}

export function EscolhaEstilo({ e, pecaId, aoMudar }: { e: Estudio; pecaId: string; aoMudar: () => void }) {
  const refs = useReferenciasVideo()
  const perfil = usePerfilEditor()
  const casa = estiloDe(perfil.dados?.perfil)
  const salvos = refs.dados ?? []
  const comRef = !!e.edicao.referencia
  const atual: 'casa' | 'salvo' | 'nova' = comRef ? 'nova' : e.modeloRef ? 'salvo' : 'casa'
  const [abrirNova, setAbrirNova] = useState(comRef)
  const escolhido = salvos.find((r) => r.id === e.modeloRef)
  const marcar = async (qual: 'casa' | 'salvo') => {
    if (comRef) await guardarEdicao(pecaId, (x) => ({ ...x, referencia: undefined }))
    setAbrirNova(false)
    await e.escolherEstilo(qual === 'casa' ? '' : e.modeloRef || salvos[0]?.id || '')
  }
  return (
    <div className="es-estilo">
      <h2>Como este vídeo deve ser editado?</h2>
      <p className="muted">Escolha um estilo ou use uma referência só para este vídeo.</p>
      <div className="es-estilo-opcoes">
        <section className={`es-opcao${atual === 'casa' && !abrirNova ? ' marcada' : ''}`} onClick={() => void marcar('casa')}>
          <header><h3>Estilo da casa</h3><span className="es-radio" /></header>
          <p className="muted pequeno">{LEGENDA[casa.legenda]} · {IMAGENS[casa.imagens]} · {casa.zoom ? 'zoom nas frases fortes' : 'sem zoom'}</p>
          <AmostraLegenda legenda={casa.legenda} />
          <span className="selo-neutro">Padrão da marca</span>
        </section>
        <section className={`es-opcao${atual === 'salvo' && !abrirNova ? ' marcada' : ''}`} onClick={() => salvos.length && !e.modeloRef && void marcar('salvo')}>
          <header><h3>Estilos salvos</h3><span className="es-radio" /></header>
          {!salvos.length ? <p className="muted pequeno">Nenhum ainda. <Link to="/agentes/editor?aba=estilo" className="link">Estudar um canal</Link></p> : (<>
            <p className="pequeno"><b>{escolhido?.nome ?? 'Escolha um estilo'}</b>{escolhido?.autor ? ` · ${escolhido.autor}` : ''}</p>
            <AmostraLegenda legenda="chave" frase={['Entender o paciente', 'muda tudo']} />
            <span className="select-icone" onClick={(x) => x.stopPropagation()}><select value={e.modeloRef} onChange={(x) => void e.escolherEstilo(x.target.value)} aria-label="Estilo salvo">
              <option value="">Escolher…</option>{salvos.map((r) => <option key={r.id} value={r.id}>{r.nome || 'Referência'}</option>)}</select></span>
          </>)}
        </section>
        <section className={`es-opcao${atual === 'nova' || abrirNova ? ' marcada' : ''}`} onClick={() => setAbrirNova(true)}>
          <header><h3>Nova referência</h3><span className="es-radio" /></header>
          <p className="muted pequeno">Só para este vídeo</p>
          {(abrirNova || comRef) && <div className="es-nova" onClick={(x) => x.stopPropagation()}><NovaReferencia e={e} pecaId={pecaId} aoMudar={aoMudar} /></div>}
        </section>
      </div>
      {!(abrirNova && !comRef) && <ConfigDoEstilo pecaId={pecaId} base={casa} config={e.edicao.config_estilo ?? {}} aoMudar={aoMudar} />}
      <p className="muted pequeno">O padrão de todos os vídeos se muda em <Link to="/agentes/editor?aba=estilo" className="link">Estilos</Link>.</p>
    </div>
  )
}
