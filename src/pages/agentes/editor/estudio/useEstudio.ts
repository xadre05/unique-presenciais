// Estado e ações do Estúdio de edição: o vídeo bruto (no computador), as mídias de apoio, o estilo escolhido, as versões
// da edição (receitas do agente), a prévia, o vídeo final e o passo aberto. As telas do Estúdio só desenham isto.
import { useEffect, useMemo, useState } from 'react'
import type { Peca } from '../../comum'
import { EMPRESA } from '../../marketing/useMarketing'
import { useLogos } from '../../LogosMarca'
import { bancoDe, bancoParaCampanha } from '../../BancoImagens'
import { audioDoVideo } from '../../marketing/edicao/audio'
import { edicaoDa, guardarEdicao, mesmoArquivo, pedirEdicao, transcrever, useTemEditor, type Edicao, type Receita } from '../../marketing/edicao/dados'
import { CORRECAO_HDR, ehHdr, quadrosDoBruto } from '../../marketing/edicao/midias'
import { montarLinhaTempo } from '../../marketing/edicao/linhaTempo'
import { montarVideo } from '../../marketing/edicao/montagem'
import { escreverCenas } from '../../marketing/edicao/escreverCenas'
import { usarApoio } from '../../marketing/edicao/usarApoio'
import { pegarArquivo } from '../arquivoPendente'
import { usePerfilEditor } from '../dados'

export type Passo = 'video' | 'conteudo' | 'estilo' | 'imagens'
export const PASSOS: Passo[] = ['video', 'conteudo', 'estilo', 'imagens']
const MAX_RECEITAS = 6
const comReceita = (e: Edicao, r: Receita): Edicao => ({ ...e, receitas: [...(e.receitas ?? []), r].slice(-MAX_RECEITAS) })
export type VideoMontado = { url: string; nome: string; arquivo: File }

export function useEstudio(peca: Peca, aoMudar: () => void) {
  const edicao = edicaoDa(peca.conteudo)
  const temEditor = useTemEditor()
  const marca = useLogos(EMPRESA)
  const campanha = typeof peca.conteudo.campanha === 'string' ? peca.conteudo.campanha : undefined
  const banco = useMemo(() => bancoParaCampanha(bancoDe(marca.dados?.perfil), campanha), [marca.dados, campanha])
  const apoio = usarApoio(peca.id, edicao, banco, aoMudar)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duracao, setDuracao] = useState(0)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<number | null>(null)
  const [final, setFinal] = useState<VideoMontado | null>(null)
  const [hdr, setHdr] = useState(false)
  const [corrigirHdr, setCorrigirHdr] = useState(true)
  // estilo: o escolhido neste vídeo ('' = estilo da casa) ou, sem escolha, o padrão definido em Estilos
  const perfilEditor = usePerfilEditor()
  const padrao = typeof perfilEditor.dados?.perfil?.estilo_ref === 'string' ? perfilEditor.dados.perfil.estilo_ref : ''
  const [escolhido, setEscolhido] = useState<string | null>(edicao.estilo_ref ?? null)
  const modeloRef = escolhido ?? padrao
  const receitas = edicao.receitas ?? []
  const [versao, setVersao] = useState(receitas.length - 1)
  // antes da primeira edição o Estúdio abre no passo que falta; depois, na prévia
  const [passo, setPasso] = useState<Passo | null>(receitas.length ? null : 'video')
  useEffect(() => { setVersao((edicao.receitas ?? []).length - 1) }, [edicao.receitas?.length])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => { if (final) URL.revokeObjectURL(final.url) }, [final])

  const cor = hdr && corrigirHdr ? CORRECAO_HDR : undefined
  const confere = arquivo ? mesmoArquivo(edicao.arquivo, arquivo) : false
  const receita = receitas[versao]
  const duracaoBruto = duracao || edicao.arquivo?.duracao || 0
  const linha = useMemo(() => (receita && edicao.palavras?.length ? montarLinhaTempo(edicao.palavras, receita.plano, duracaoBruto, apoio.midias.length) : null), [receita, edicao.palavras, duracaoBruto, apoio.midias.length])

  const codigos = useMemo(() => (receita?.plano.cenas ?? []).map((c) => c.codigo), [receita])
  const escolher = (f: File) => {
    setErro(null); setArquivo(f); setUrl(URL.createObjectURL(f)); setFinal(null); setHdr(false); void ehHdr(f).then(setHdr)
    // capa do cartão na entrada do Editor (uma foto pequena do bruto)
    if (!edicao.capa) void quadrosDoBruto(f, 1).then((q) => q[0] && guardarEdicao(peca.id, (x) => ({ ...x, capa: q[0].miniatura })))
  }
  // o vídeo escolhido antes (na entrada do Editor ou antes de trocar de tela) volta escolhido
  useEffect(() => { const f = pegarArquivo(peca.id); if (f) escolher(f) }, [peca.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const executar = async (rotulo: string, fazer: () => Promise<void>) => {
    setErro(null); setOcupado(rotulo)
    try { await fazer(); aoMudar() } catch (e) { setErro(e instanceof Error ? e.message : 'Algo deu errado.') } finally { setOcupado(null) }
  }
  const escolherEstilo = async (id: string) => { setEscolhido(id); await guardarEdicao(peca.id, (e) => ({ ...e, estilo_ref: id })); aoMudar() }
  const editar = () => executar('Lendo o áudio do vídeo…', async () => {
    if (!arquivo) return
    const { wav, duracao: d } = await audioDoVideo(arquivo)
    setDuracao(d); setOcupado('Transcrevendo a fala…')
    const { palavras } = await transcrever(peca.id, wav)
    if (!palavras.length) throw new Error('Não encontrei fala neste vídeo.')
    await guardarEdicao(peca.id, (e) => ({ ...e, arquivo: { nome: arquivo.name, tamanho: arquivo.size, duracao: d }, palavras, receitas: [] }))
    setOcupado('O agente está editando…')
    const { plano: rascunho } = await pedirEdicao(peca.id, palavras, d, await apoio.paraAgente(), { modeloRef, quadros: await quadrosDoBruto(arquivo), referencia: edicao.referencia })
    if (rascunho.cenas?.length) setOcupado(`Animando ${rascunho.cenas.length} cena(s)…`)
    const plano = await escreverCenas(peca.id, rascunho, palavras, peca.tipo !== 'video')
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, em: new Date().toISOString() }))
    setPasso(null); setFinal(null)
  })
  const ajustar = (pedido: string, regra: boolean) => executar('O agente está ajustando…', async () => {
    if (!edicao.palavras || !pedido.trim()) return
    const { plano: rascunho } = await pedirEdicao(peca.id, edicao.palavras, duracaoBruto, await apoio.paraAgente(), { pedido: pedido.trim(), lembrar: regra ? pedido.trim() : '', anterior: receita?.plano, modeloRef, quadros: arquivo ? await quadrosDoBruto(arquivo) : undefined, referencia: edicao.referencia })
    if (rascunho.cenas?.some((c) => !receita?.plano.cenas?.some((x) => x.descricao.trim() === c.descricao.trim()))) setOcupado('Animando as cenas…')
    const plano = await escreverCenas(peca.id, rascunho, edicao.palavras, peca.tipo !== 'video', receita?.plano)
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, pedido: pedido.trim(), em: new Date().toISOString() }))
    setFinal(null)
  })
  const gerarFinal = async () => {
    if (!arquivo || !linha) return
    setErro(null); setFinal(null); setProgresso(0)
    try {
      const blob = await montarVideo(arquivo, linha, peca.tipo !== 'video', setProgresso, apoio.apoio, apoio.musica, cor, codigos)
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const nome = `${peca.titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - V${versao + 1}.${ext}`
      setFinal({ url: URL.createObjectURL(blob), nome, arquivo: new File([blob], nome, { type: blob.type }) })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui montar o vídeo.') } finally { setProgresso(null) }
  }

  return {
    edicao, temEditor: temEditor.dados, apoio, arquivo, url, confere, escolher, hdr, corrigirHdr, setCorrigirHdr, cor,
    modeloRef, escolherEstilo, receitas, versao, setVersao, receita, linha, duracaoBruto,
    passo, setPasso, ocupado, erro, progresso, final, editar, ajustar, gerarFinal, codigos,
  }
}
export type Estudio = ReturnType<typeof useEstudio>
