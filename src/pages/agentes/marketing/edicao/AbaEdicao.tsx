// Aba "Vídeo" da peça de vídeo: a pessoa escolhe o vídeo gravado (fica no computador) e decide: publicar como veio
// (já editado) ou editar com o Agente Editor de Vídeo, que transcreve, decide cortes, legenda, textos na tela, zooms
// e onde entram as imagens e clipes de apoio, mostra a prévia, ajusta por conversa e monta o vídeo final.
// Sem o Editor, aparece o convite.
import { useEffect, useMemo, useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { Link } from 'react-router-dom'
import type { Peca } from '../../comum'
import type { Rascunho } from '../peca/modelo'
import { PublicarVideo } from './PublicarVideo'
import { audioDoVideo } from './audio'
import { edicaoDa, guardarEdicao, mesmoArquivo, pedirEdicao, transcrever, useTemEditor, type Edicao, type Receita } from './dados'
import { EscolhaBruto } from './EscolhaBruto'
import { EstiloDoVideo } from './EstiloDoVideo'
import { BotaoConcluir, VideoEntregue } from './EntregaVideo'
import { destinoDa, NOME_DESTINO } from '../peca/editor'
import { pegarArquivo } from '../../editor/arquivoPendente'
import { CORRECAO_HDR, ehHdr, quadrosDoBruto } from './midias'
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

// estudio = aberta no Agente Editor (a edição é dele até concluir); sem estudio = aba da peça na Produção do Marketing
export function AbaEdicao({ peca, r, aoMudar, estudio = false }: { peca: Peca; r?: Rascunho; aoMudar: () => void; estudio?: boolean }) {
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
  const [hdr, setHdr] = useState(false)
  const [corrigirHdr, setCorrigirHdr] = useState(true)
  const cor = hdr && corrigirHdr ? CORRECAO_HDR : undefined
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
    setErro(null); setArquivo(f); setUrl(URL.createObjectURL(f)); setHdr(false); void ehHdr(f).then(setHdr)
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
    const { plano } = await pedirEdicao(peca.id, palavras, d, await apoio.paraAgente(), { modeloRef, quadros: await quadrosDoBruto(arquivo), referencia: edicao.referencia })
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, em: new Date().toISOString() }))
  })
  const ajustar = () => executar('O agente está ajustando…', async () => {
    if (!edicao.palavras || !pedido.trim()) return
    const { plano } = await pedirEdicao(peca.id, edicao.palavras, duracaoBruto, await apoio.paraAgente(), { pedido: pedido.trim(), lembrar: lembrar ? pedido.trim() : '', anterior: receita?.plano, modeloRef, quadros: arquivo ? await quadrosDoBruto(arquivo) : undefined, referencia: edicao.referencia })
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, pedido: pedido.trim(), em: new Date().toISOString() }))
    setPedido(''); setLembrar(false)
  })

  const gerarFinal = async () => {
    if (!arquivo || !linha) return
    setErro(null); setFinal(null); setProgresso(0)
    try {
      const blob = await montarVideo(arquivo, linha, peca.tipo !== 'video', setProgresso, apoio.apoio, apoio.musica, cor)
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const nome = `${peca.titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - editado.${ext}`
      setFinal({ url: URL.createObjectURL(blob), nome, arquivo: new File([blob], nome, { type: blob.type }) })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui montar o vídeo.') } finally { setProgresso(null) }
  }
  const pedirEditor = () => (temEditor.dados ? editarDoZero() : setQuerEditar(true))

  // "já veio editado": no Agente Editor conclui com o vídeo como está; na peça do Marketing, agenda direto
  const jaEditado = estudio ? <BotaoConcluir peca={peca} video={arquivo} aoMudar={aoMudar} rotulo="Concluir com este vídeo como está" />
    : r && arquivo ? <PublicarVideo peca={peca} r={r} arquivo={arquivo} rotulo="Agendar este vídeo no Instagram" aoMudar={aoMudar} /> : null
  const agendarEntregue = !estudio && r ? <PublicarVideo peca={peca} r={r} rotulo="Agendar no Instagram" aoMudar={aoMudar} /> : undefined

  // na Produção do Marketing a peça não é editada: mostra o vídeo entregue ou leva ao Agente Editor
  if (!estudio) return (
    <div className="ev">
      <VideoEntregue peca={peca} emEstudio={false} extra={agendarEntregue} />
      {!edicao.concluida && (
        <section className="ev-passo">
          <h4><Icone nome="video" tam={16} /> Vídeo deste post</h4>
          <p className="muted pequeno">Quem edita é o Agente Editor de Vídeo. Quando ele concluir, o vídeo editado aparece aqui, pronto para agendar.</p>
          <div className="ia-linha"><Link className="btn btn-ouro" to={`/agentes/editor/video/${peca.id}`}><Icone nome="floco" tam={16} /> Editar no Agente Editor</Link></div>
        </section>
      )}
      {!edicao.concluida && <EscolhaBruto pecaId={peca.id} arquivo={arquivo} anterior={edicao.arquivo} confere={confere} ocupado={!!ocupado} aoEscolher={escolher} jaEditado={jaEditado} />}
    </div>
  )
  return (
    <div className="ev">
      <VideoEntregue peca={peca} emEstudio={estudio} extra={agendarEntregue} />
      <EscolhaBruto pecaId={peca.id} arquivo={arquivo} anterior={edicao.arquivo} confere={confere} ocupado={!!ocupado} aoEscolher={escolher} jaEditado={jaEditado} />

      <ApoioEdicao midias={apoio.midias} novasDoBanco={apoio.novasDoBanco.length} arquivos={apoio.arquivos} musica={edicao.musica ? { ...edicao.musica, volume: apoio.volume } : undefined} arquivoMusica={apoio.arquivoMusica}
        aoAdicionar={apoio.adicionar} aoRemover={apoio.remover} aoDescrever={apoio.descrever} aoMusica={apoio.escolherMusica} aoVolume={apoio.mudarVolume} />

      <EstiloDoVideo pecaId={peca.id} modeloRef={modeloRef} aoModelo={setModeloRef} referencia={edicao.referencia} aoMudar={aoMudar} semRoteiro={!peca.conteudo.roteiro} />
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
          {receita.plano.checagem && <details className="pequeno"><summary>Conferência de qualidade do agente</summary><p className="muted" style={{ whiteSpace: 'pre-line' }}>{receita.plano.checagem}</p></details>}
          {linha && confere && url ? <PreviaVideo url={url} linha={linha} vertical={peca.tipo !== 'video'} apoio={apoio.apoio} musica={apoio.musica} cor={cor} />
            : <p className="muted pequeno">Escolha o vídeo bruto acima para assistir à prévia.</p>}
          {hdr && <label className="pequeno"><input type="checkbox" checked={corrigirHdr} onChange={(e) => setCorrigirHdr(e.target.checked)} /> Vídeo gravado em HDR (celular): corrigir o brilho e a cor</label>}
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
          <p className="muted pequeno">A montagem é feita aqui no seu computador e leva o tempo do vídeo final. Deixe esta aba aberta e na frente até terminar. Depois, "Concluir" entrega o vídeo editado a {NOME_DESTINO[destinoDa(peca)]}.</p>
          {progresso !== null ? (
            <div className="ev-montando"><div className="ev-barra"><span style={{ width: `${Math.round(progresso * 100)}%` }} /></div><span className="pequeno">Montando… {Math.round(progresso * 100)}%</span></div>
          ) : (
            <button type="button" className="btn btn-ouro" disabled={!confere || !linha || !!ocupado} onClick={gerarFinal} title={!confere ? 'Escolha o vídeo bruto acima' : ''}><Icone nome="exportar" tam={16} /> Gerar vídeo final</button>
          )}
          {final && <a className="btn btn-contorno-ouro" href={final.url} download={final.nome}><Icone nome="importar" tam={16} /> Baixar {final.nome}</a>}
          {final && <video className="ev-resultado" src={final.url} controls playsInline />}
          {final && <div className="ia-linha"><BotaoConcluir peca={peca} video={final.arquivo} aoMudar={aoMudar} /></div>}
        </section>
      )}
    </div>
  )
}
