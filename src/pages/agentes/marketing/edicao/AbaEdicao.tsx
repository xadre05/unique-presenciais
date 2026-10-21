// Aba "Vídeo" da peça de vídeo: a pessoa escolhe o vídeo gravado (fica no computador) e decide: publicar como veio
// (já editado) ou editar com o Agente Editor de Vídeo, que transcreve, decide cortes, legenda, textos na tela, zooms
// e onde entram as imagens e clipes de apoio, mostra a prévia, ajusta por conversa e monta o vídeo final.
// Sem o Editor, aparece o convite.
import { useEffect, useMemo, useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import type { Rascunho } from '../peca/modelo'
import { PublicarVideo } from './PublicarVideo'
import { audioDoVideo } from './audio'
import { edicaoDa, guardarEdicao, mesmoArquivo, pedirEdicao, transcrever, useReferenciasVideo, useTemEditor, type Edicao, type Receita } from './dados'
import { Link } from 'react-router-dom'
import { deixarArquivo, pegarArquivo } from '../../editor/arquivoPendente'
import { quadrosDoBruto } from './midias'
import { ConviteEditor } from './ConviteEditor'
import { ApoioEdicao } from './ApoioEdicao'
import { usarApoio } from './usarApoio'
import { bancoDe, bancoParaCampanha } from '../../BancoImagens'
import { useLogos } from '../../LogosMarca'
import { EMPRESA } from '../useMarketing'
import { montarLinhaTempo } from './linhaTempo'
import { PreviaVideo } from './PreviaVideo'
import { montarVideo } from './montagem'

const MAX_RECEITAS = 6
const segundos = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
const comReceita = (e: Edicao, r: Receita): Edicao => ({ ...e, receitas: [...(e.receitas ?? []), r].slice(-MAX_RECEITAS) })

export function AbaEdicao({ peca, r, aoMudar }: { peca: Peca; r: Rascunho; aoMudar: () => void }) {
  const edicao = edicaoDa(peca.conteudo)
  const temEditor = useTemEditor()
  // banco de imagens da marca (perfil do Marketing): o que é de todas as campanhas e o da campanha desta peça
  const marca = useLogos(EMPRESA)
  const banco = useMemo(() => bancoParaCampanha(bancoDe(marca.dados?.perfil), typeof peca.conteudo.campanha === 'string' ? peca.conteudo.campanha : undefined), [marca.dados, peca.conteudo.campanha])
  const apoio = usarApoio(peca.id, edicao, banco, aoMudar)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duracao, setDuracao] = useState(0)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pedido, setPedido] = useState('')
  const [lembrar, setLembrar] = useState(false)
  const [progresso, setProgresso] = useState<number | null>(null)
  const [final, setFinal] = useState<{ url: string; nome: string; arquivo: File } | null>(null)
  const [querEditar, setQuerEditar] = useState(false)
  const [jaEditado, setJaEditado] = useState(false)
  const refs = useReferenciasVideo()
  const [modeloRef, setModeloRef] = useState('')
  const receitas = edicao.receitas ?? []
  const [versao, setVersao] = useState(receitas.length - 1)
  useEffect(() => { setVersao((edicao.receitas ?? []).length - 1) }, [edicao.receitas?.length])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { if (final) URL.revokeObjectURL(final.url) }, [final])

  const confere = arquivo ? mesmoArquivo(edicao.arquivo, arquivo) : false
  const receita = receitas[versao]
  const duracaoBruto = duracao || edicao.arquivo?.duracao || 0
  const linha = useMemo(() => (receita && edicao.palavras?.length ? montarLinhaTempo(edicao.palavras, receita.plano, duracaoBruto, apoio.midias.length) : null), [receita, edicao.palavras, duracaoBruto, apoio.midias.length])

  const escolher = (f: File | undefined) => {
    if (!f) return
    setErro(null); setArquivo(f); setUrl(URL.createObjectURL(f)); deixarArquivo(peca.id, f)
  }
  // vídeo já escolhido antes (na página do Agente Editor ou nesta aba, antes de trocar de aba): volta escolhido
  useEffect(() => { const f = pegarArquivo(peca.id); if (f) escolher(f) }, [peca.id]) // eslint-disable-line react-hooks/exhaustive-deps
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
    await guardarEdicao(peca.id, (e) => ({ ...e, arquivo: { nome: arquivo.name, tamanho: arquivo.size, duracao: d }, palavras, receitas: [] }))
    setOcupado('O agente está editando…')
    const { plano } = await pedirEdicao(peca.id, palavras, d, await apoio.paraAgente(), { modeloRef, quadros: await quadrosDoBruto(arquivo) })
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, em: new Date().toISOString() }))
  })
  const ajustar = () => executar('O agente está ajustando…', async () => {
    if (!edicao.palavras || !pedido.trim()) return
    const { plano } = await pedirEdicao(peca.id, edicao.palavras, duracaoBruto, await apoio.paraAgente(), { pedido: pedido.trim(), lembrar: lembrar ? pedido.trim() : '', anterior: receita?.plano, modeloRef, quadros: arquivo ? await quadrosDoBruto(arquivo) : undefined })
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, pedido: pedido.trim(), em: new Date().toISOString() }))
    setPedido(''); setLembrar(false)
  })

  const gerarFinal = async () => {
    if (!arquivo || !linha) return
    setErro(null); setFinal(null); setProgresso(0)
    try {
      const blob = await montarVideo(arquivo, linha, peca.tipo !== 'video', setProgresso, apoio.apoio, apoio.musica)
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const nome = `${peca.titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - editado.${ext}`
      setFinal({ url: URL.createObjectURL(blob), nome, arquivo: new File([blob], nome, { type: blob.type }) })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui montar o vídeo.') } finally { setProgresso(null) }
  }
  const pedirEditor = () => (temEditor.dados ? editarDoZero() : setQuerEditar(true))

  return (
    <div className="ev">
      <section className="ev-passo">
        <h4><span>1</span> Vídeo gravado</h4>
        <p className="muted pequeno">Escolha o vídeo gravado. Ele fica no seu computador (não sobe para o sistema) e continua escolhido ao trocar de aba. Se recarregar ou fechar a página, escolha o mesmo arquivo de novo.</p>
        <label className="btn btn-contorno-ouro ev-arquivo"><Icone nome="importar" tam={16} /> {arquivo ? 'Trocar vídeo' : 'Escolher o vídeo'}
          <input type="file" accept="video/*" hidden onChange={(e) => escolher(e.target.files?.[0])} /></label>
        {arquivo && <span className="pequeno">{arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(0)} MB</span>}
        {!arquivo && edicao.arquivo && <p className="pequeno">Último vídeo editado: <b>{edicao.arquivo.nome}</b> ({segundos(edicao.arquivo.duracao)}). Escolha o mesmo arquivo para ver a prévia.</p>}
        {arquivo && edicao.arquivo && !confere && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> Este não é o vídeo da última edição. Editar este substitui a edição anterior.</p>}
        {arquivo && !ocupado && !jaEditado && <button type="button" className="link pequeno" onClick={() => setJaEditado(true)}>Este vídeo já veio editado? Pular a edição</button>}
        {arquivo && !ocupado && jaEditado && <div className="ev-escolha"><PublicarVideo peca={peca} r={r} arquivo={arquivo} rotulo="Agendar este vídeo no Instagram" aoMudar={aoMudar} />
          <button type="button" className="link pequeno" onClick={() => setJaEditado(false)}>Não, quero editar</button></div>}
      </section>

      <ApoioEdicao midias={apoio.midias} novasDoBanco={apoio.novasDoBanco.length} arquivos={apoio.arquivos} musica={edicao.musica ? { ...edicao.musica, volume: apoio.volume } : undefined} arquivoMusica={apoio.arquivoMusica}
        aoAdicionar={apoio.adicionar} aoRemover={apoio.remover} aoDescrever={apoio.descrever} aoMusica={apoio.escolherMusica} aoVolume={apoio.mudarVolume} />

      <section className="ev-passo">
        <h4><span>3</span> Estilo (opcional)</h4>
        <p className="muted pequeno">Sem escolher, o agente segue o estilo da casa. Para editar no estilo de um vídeo que você viu (concorrente, outro nicho), guarde o vídeo em <Link to="/agentes/marca" className="link">Base da marca → Referências</Link> e escolha aqui.</p>
        <span className="select-icone"><select value={modeloRef} onChange={(e) => setModeloRef(e.target.value)} aria-label="Referência de estilo">
          <option value="">Estilo da casa</option>
          {(refs.dados ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome || 'Referência'}{x.autor ? ` · ${x.autor}` : ''}</option>)}
        </select></span>
        {!peca.conteudo.roteiro && <p className="muted pequeno">Esta peça não tem roteiro: o agente procura nos roteiros que estão nos materiais da campanha (ex.: o PDF com todos os criativos) qual foi gravado. Sem nenhum, edita pelo que foi falado.</p>}
      </section>
      {arquivo && !ocupado && (!confere || !receitas.length) && (
        <button type="button" className="btn btn-ouro" onClick={pedirEditor}><Icone nome="floco" tam={16} /> Editar com o Editor de Vídeo</button>)}
      {querEditar && temEditor.dados === false && <ConviteEditor />}
      {ocupado && <div className="progresso"><div className="indeterminado" /><span>{ocupado}</span></div>}
      <Erro msg={erro} />

      {receita && (
        <section className="ev-passo">
          <h4><span>4</span> Edição do agente</h4>
          {receitas.length > 1 && (
            <div className="abas-mini">{receitas.map((x, k) => (
              <button key={x.em} type="button" className={k === versao ? 'ativa' : ''} onClick={() => setVersao(k)} title={x.pedido ?? 'Primeira edição'}>Versão {k + 1}</button>))}</div>)}
          {receita.plano.resumo && <p>{receita.plano.resumo}</p>}
          {receita.plano.roteiro_identificado && receita.plano.roteiro_identificado !== 'nenhum' && <p className="pequeno"><b>Roteiro reconhecido:</b> {receita.plano.roteiro_identificado}</p>}
          {receita.plano.faltou && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> {receita.plano.faltou}</p>}
          {linha && confere && url ? <PreviaVideo url={url} linha={linha} vertical={peca.tipo !== 'video'} apoio={apoio.apoio} musica={apoio.musica} />
            : <p className="muted pequeno">Escolha o vídeo bruto acima para assistir à prévia.</p>}
          {linha && <p className="muted pequeno">Vídeo final: {segundos(linha.duracao)} (o bruto tinha {segundos(duracaoBruto)}){linha.coberturas.length ? ` · ${linha.coberturas.length} momento(s) com imagem de apoio` : ''}.</p>}
          <div className="ev-ajuste">
            <textarea rows={2} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder='O que mudar? Ex.: "começa direto na pergunta", "usa a foto da sala cheia no começo", "legenda de palavra-chave", "tela dividida quando falar da plataforma"' />
            <label className="pequeno"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> Vale para as próximas edições</label>
            <button type="button" className="btn btn-ouro btn-mini" disabled={!pedido.trim() || !!ocupado} onClick={ajustar}>Pedir ajuste</button>
          </div>
        </section>
      )}

      {receita && (
        <section className="ev-passo">
          <h4><span>5</span> Vídeo final</h4>
          <p className="muted pequeno">A montagem é feita aqui no seu computador e leva o tempo do vídeo final. Deixe esta aba aberta e na frente até terminar. Depois você baixa ou agenda direto no Instagram; nada fica guardado no sistema.</p>
          {progresso !== null ? (
            <div className="ev-montando"><div className="ev-barra"><span style={{ width: `${Math.round(progresso * 100)}%` }} /></div><span className="pequeno">Montando… {Math.round(progresso * 100)}%</span></div>
          ) : (
            <button type="button" className="btn btn-ouro" disabled={!confere || !linha || !!ocupado} onClick={gerarFinal} title={!confere ? 'Escolha o vídeo bruto acima' : ''}><Icone nome="exportar" tam={16} /> Gerar vídeo final</button>
          )}
          {final && <a className="btn btn-contorno-ouro" href={final.url} download={final.nome}><Icone nome="importar" tam={16} /> Baixar {final.nome}</a>}
          {final && <video className="ev-resultado" src={final.url} controls playsInline />}
          {final && <PublicarVideo peca={peca} r={r} arquivo={final.arquivo} rotulo="Agendar no Instagram com o vídeo editado" aoMudar={aoMudar} />}
        </section>
      )}
    </div>
  )
}
