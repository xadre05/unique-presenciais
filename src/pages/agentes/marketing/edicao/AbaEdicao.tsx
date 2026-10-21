// Aba "Edição do vídeo" da peça de vídeo: escolher o vídeo bruto (fica no computador), o agente transcreve, decide
// os cortes, a legenda, os textos na tela e os zooms pelo roteiro, e a prévia mostra na hora. Ajustes por conversa.
import { useEffect, useMemo, useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { audioDoVideo } from './audio'
import { edicaoDa, guardarEdicao, mesmoArquivo, pedirEdicao, transcrever, type Edicao, type Receita } from './dados'
import { montarLinhaTempo } from './linhaTempo'
import { PreviaVideo } from './PreviaVideo'
import { montarVideo } from './montagem'

const MAX_RECEITAS = 6
const segundos = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
const comReceita = (e: Edicao, r: Receita): Edicao => ({ ...e, receitas: [...(e.receitas ?? []), r].slice(-MAX_RECEITAS) })

export function AbaEdicao({ peca, aoMudar }: { peca: Peca; aoMudar: () => void }) {
  const edicao = edicaoDa(peca.conteudo)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duracao, setDuracao] = useState(0)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pedido, setPedido] = useState('')
  const [lembrar, setLembrar] = useState(false)
  const [progresso, setProgresso] = useState<number | null>(null)
  const [final, setFinal] = useState<{ url: string; nome: string } | null>(null)
  const receitas = edicao.receitas ?? []
  const [versao, setVersao] = useState(receitas.length - 1)
  useEffect(() => { setVersao((edicao.receitas ?? []).length - 1) }, [edicao.receitas?.length])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { if (final) URL.revokeObjectURL(final.url) }, [final])

  const confere = arquivo ? mesmoArquivo(edicao.arquivo, arquivo) : false
  const receita = receitas[versao]
  const duracaoBruto = duracao || edicao.arquivo?.duracao || 0
  const linha = useMemo(() => (receita && edicao.palavras?.length ? montarLinhaTempo(edicao.palavras, receita.plano, duracaoBruto) : null), [receita, edicao.palavras, duracaoBruto])

  const escolher = (f: File | undefined) => {
    if (!f) return
    setErro(null); setArquivo(f); setUrl(URL.createObjectURL(f))
  }
  const executar = async (rotulo: string, fazer: () => Promise<void>) => {
    setErro(null); setOcupado(rotulo)
    try { await fazer(); aoMudar() } catch (e) { setErro(e instanceof Error ? e.message : 'Algo deu errado.') } finally { setOcupado(null) }
  }
  const editarDoZero = () => executar('Lendo o áudio do vídeo…', async () => {
    if (!arquivo) return
    const { wav, duracao: d } = await audioDoVideo(arquivo)
    setDuracao(d); setOcupado('Transcrevendo a fala…')
    const { palavras } = await transcrever(peca.id, wav)
    if (!palavras.length) throw new Error('Não encontrei fala neste vídeo.')
    await guardarEdicao(peca.id, () => ({ arquivo: { nome: arquivo.name, tamanho: arquivo.size, duracao: d }, palavras, receitas: [] }))
    setOcupado('O agente está editando…')
    const { plano } = await pedirEdicao(peca.id, palavras, d)
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, em: new Date().toISOString() }))
  })
  const ajustar = () => executar('O agente está ajustando…', async () => {
    if (!edicao.palavras || !pedido.trim()) return
    const { plano } = await pedirEdicao(peca.id, edicao.palavras, duracaoBruto, pedido.trim(), lembrar ? pedido.trim() : '', receita?.plano)
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, pedido: pedido.trim(), em: new Date().toISOString() }))
    setPedido(''); setLembrar(false)
  })

  const gerarFinal = async () => {
    if (!arquivo || !linha) return
    setErro(null); setFinal(null); setProgresso(0)
    try {
      const blob = await montarVideo(arquivo, linha, peca.tipo !== 'video', setProgresso)
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const nome = `${peca.titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - editado.${ext}`
      setFinal({ url: URL.createObjectURL(blob), nome })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui montar o vídeo.') } finally { setProgresso(null) }
  }

  return (
    <div className="ev">
      <section className="ev-passo">
        <h4><span>1</span> Vídeo gravado</h4>
        <p className="muted pequeno">O vídeo fica no seu computador: só o áudio vai para a transcrição. Nada de vídeo é guardado no sistema.</p>
        <label className="btn btn-contorno-ouro ev-arquivo"><Icone nome="importar" tam={16} /> {arquivo ? 'Trocar vídeo' : 'Escolher o vídeo bruto'}
          <input type="file" accept="video/*" hidden onChange={(e) => escolher(e.target.files?.[0])} /></label>
        {arquivo && <span className="pequeno">{arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(0)} MB</span>}
        {!arquivo && edicao.arquivo && <p className="pequeno">Último vídeo editado: <b>{edicao.arquivo.nome}</b> ({segundos(edicao.arquivo.duracao)}). Escolha o mesmo arquivo para ver a prévia.</p>}
        {arquivo && edicao.arquivo && !confere && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> Este não é o vídeo da última edição. Editar este substitui a edição anterior.</p>}
        {arquivo && (!confere || !receitas.length) && !ocupado && (
          <button type="button" className="btn btn-ouro" onClick={editarDoZero}><Icone nome="floco" tam={16} /> Editar com o agente</button>)}
      </section>

      {ocupado && <div className="progresso"><div className="indeterminado" /><span>{ocupado}</span></div>}
      <Erro msg={erro} />

      {receita && (
        <section className="ev-passo">
          <h4><span>2</span> Edição do agente</h4>
          {receitas.length > 1 && (
            <div className="abas-mini">{receitas.map((r, k) => (
              <button key={r.em} type="button" className={k === versao ? 'ativa' : ''} onClick={() => setVersao(k)} title={r.pedido ?? 'Primeira edição'}>Versão {k + 1}</button>))}</div>)}
          {receita.plano.resumo && <p>{receita.plano.resumo}</p>}
          {receita.plano.faltou && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> {receita.plano.faltou}</p>}
          {linha && confere && url ? <PreviaVideo url={url} linha={linha} vertical={peca.tipo !== 'video'} />
            : <p className="muted pequeno">Escolha o vídeo bruto acima para assistir à prévia.</p>}
          {linha && <p className="muted pequeno">Vídeo final: {segundos(linha.duracao)} (o bruto tinha {segundos(duracaoBruto)}).</p>}
          <div className="ev-ajuste">
            <textarea rows={2} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder='O que mudar? Ex.: "começa direto na pergunta", "legenda de 2 palavras", "tira o zoom do final"' />
            <label className="pequeno"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> Vale para as próximas edições</label>
            <button type="button" className="btn btn-ouro btn-mini" disabled={!pedido.trim() || !!ocupado} onClick={ajustar}>Pedir ajuste</button>
          </div>
        </section>
      )}

      {receita && (
        <section className="ev-passo">
          <h4><span>3</span> Vídeo final</h4>
          <p className="muted pequeno">A montagem é feita aqui no seu computador e leva o tempo do vídeo final. Deixe esta aba aberta e na frente até terminar. O arquivo vai para os seus downloads; nada fica guardado no sistema.</p>
          {progresso !== null ? (
            <div className="ev-montando"><div className="ev-barra"><span style={{ width: `${Math.round(progresso * 100)}%` }} /></div><span className="pequeno">Montando… {Math.round(progresso * 100)}%</span></div>
          ) : (
            <button type="button" className="btn btn-ouro" disabled={!confere || !linha || !!ocupado} onClick={gerarFinal} title={!confere ? 'Escolha o vídeo bruto acima' : ''}><Icone nome="exportar" tam={16} /> Gerar vídeo final</button>
          )}
          {final && <a className="btn btn-contorno-ouro" href={final.url} download={final.nome}><Icone nome="importar" tam={16} /> Baixar {final.nome}</a>}
          {final && <video className="ev-resultado" src={final.url} controls playsInline />}
        </section>
      )}
    </div>
  )
}
