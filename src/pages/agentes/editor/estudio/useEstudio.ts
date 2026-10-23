// Estado e ações do Estúdio de edição: o vídeo bruto (no computador), as mídias de apoio, o estilo escolhido, as versões
// da edição (receitas do agente), a prévia, o vídeo final e o passo aberto. As telas do Estúdio só desenham isto.
import { useEffect, useMemo, useState } from 'react'
import type { Peca } from '../../comum'
import { EMPRESA } from '../../marketing/useMarketing'
import { useLogos } from '../../LogosMarca'
import { bancoDe, bancoParaCampanha } from '../../BancoImagens'
import { transcreverVideo } from '../cortes/audioLongo'
import { edicaoDa, guardarEdicao, mesmoArquivo, pedirEdicao, useTemEditor, type Edicao, type Receita } from '../../marketing/edicao/dados'
import { CORRECAO_HDR, ehHdr, quadrosDoBruto } from '../../marketing/edicao/midias'
import { montarLinhaTempo } from '../../marketing/edicao/linhaTempo'
import { montarVideo } from '../../marketing/edicao/montagem'
import { escreverCenas } from '../../marketing/edicao/escreverCenas'
import { usarApoio } from '../../marketing/edicao/usarApoio'
import { deixarArquivo, pegarArquivo, pegarPartes } from '../arquivoPendente'
import { baixarNarracao } from '../semGravar/dados'
import { pedidoDoConfig, visualDoConfig } from './configEstilo'
import { brutoDe } from '../../marketing/fluxo'
import { baixarBruto } from '../../marketing/edicao/brutoNuvem'
import { usePerfilEditor } from '../dados'
import type { Juntado } from '../partes/PartesDoVideo'

export type Passo = 'video' | 'conteudo' | 'estilo' | 'imagens'
export const PASSOS: Passo[] = ['video', 'conteudo', 'estilo', 'imagens']
const MAX_RECEITAS = 6
const comReceita = (e: Edicao, r: Receita): Edicao => ({ ...e, receitas: [...(e.receitas ?? []), r].slice(-MAX_RECEITAS) })
const SEM_PESSOA = 'Vídeo SEM pessoa na tela: é só a narração. Cubra 100% do tempo, sem nenhum buraco, com cenas animadas (layout cheia) e mídias de apoio em tela cheia, trocando a cada 2 a 4 segundos, sempre ilustrando o que a narração diz.'
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
  // vídeo gravado em partes: os arquivos escolhidos, enquanto o agente organiza e a pessoa confere a ordem
  const [partes, setPartes] = useState<File[] | null>(null)
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
  const visual = useMemo(() => visualDoConfig(edicao.config_estilo), [edicao.config_estilo])
  const corte = (peca.conteudo as { corte?: { de: number; ate: number } }).corte
  const escolher = (f: File) => {
    setErro(null); setArquivo(f); setUrl(URL.createObjectURL(f)); setFinal(null); setHdr(false); void ehHdr(f).then(setHdr)
    // capa do cartão na entrada do Editor (uma foto pequena do bruto)
    if (!edicao.capa) void quadrosDoBruto(f, 1, corte?.de, corte?.ate).then((q) => q[0] && guardarEdicao(peca.id, (x) => ({ ...x, capa: q[0].miniatura })))
  }
  const escolherVarios = (fs: File[]) => {
    if (fs.length === 1) { deixarArquivo(peca.id, fs[0]); return escolher(fs[0]) } // pelo <input>: sem atalho
    setErro(null); setPartes(fs)
  }
  // partes juntadas: o vídeo juntado vira o bruto, com a fala já transcrita (a edição não lê o áudio de novo)
  const juntou = async (j: Juntado) => {
    const mesmo = mesmoArquivo(edicao.arquivo, j.arquivo)
    await guardarEdicao(peca.id, (e) => ({ ...e, arquivo: { nome: j.arquivo.name, tamanho: j.arquivo.size, duracao: j.duracao }, palavras: j.palavras, partes: j.partes, receitas: mesmo ? e.receitas : [] }))
    deixarArquivo(peca.id, j.arquivo); escolher(j.arquivo); setDuracao(j.duracao); setPartes(null); aoMudar()
  }
  // vídeo sem gravar: o "bruto" é a narração da IA, guardada na nuvem (volta sozinha, sem escolher arquivo)
  const narracao = (peca.conteudo as { narracao?: { caminho: string; nome: string } }).narracao
  const bruto = brutoDe(peca)
  // o vídeo escolhido antes (na entrada do Editor ou antes de trocar de tela) volta escolhido
  useEffect(() => {
    const fs = pegarPartes(peca.id)
    if (fs) return setPartes(fs)
    const f = pegarArquivo(peca.id)
    if (f) return escolher(f)
    if (narracao) void baixarNarracao(narracao).then((n) => { if (n) { deixarArquivo(peca.id, n); escolher(n) } })
    // vídeo enviado pela equipe (do celular, na lista "Para gravar"): baixa da nuvem
    else if (bruto) {
      setOcupado('Baixando o vídeo enviado…')
      void baixarBruto(bruto, (fr) => setOcupado(`Baixando o vídeo enviado… ${Math.round(fr * 100)}%`))
        .then((f) => { if (f) { deixarArquivo(peca.id, f); escolher(f) } else setErro('Não consegui baixar o vídeo enviado. Recarregue a página.') })
        .catch(() => setErro('Não consegui baixar o vídeo enviado. Recarregue a página.'))
        .finally(() => setOcupado(null))
    }
  }, [peca.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const executar = async (rotulo: string, fazer: () => Promise<void>) => {
    setErro(null); setOcupado(rotulo)
    try { await fazer(); aoMudar() } catch (e) { setErro(e instanceof Error ? e.message : 'Algo deu errado.') } finally { setOcupado(null) }
  }
  const escolherEstilo = async (id: string) => { setEscolhido(id); await guardarEdicao(peca.id, (e) => ({ ...e, estilo_ref: id })); aoMudar() }
  const editar = () => executar('Lendo o áudio do vídeo…', async () => {
    if (!arquivo) return
    // corte de vídeo longo: a fala do trecho já veio transcrita (não lê o áudio de novo)
    // narração de IA: as palavras já vieram com o tempo exato da ElevenLabs
    // vídeo juntado de partes: a fala de cada parte já foi transcrita ao juntar
    let palavras = (corte || narracao || edicao.partes?.length) && edicao.palavras?.length && confere ? edicao.palavras : null
    let d = corte ? corte.ate - corte.de : edicao.arquivo?.duracao ?? 0
    if (!palavras) {
      const t = await transcreverVideo(peca.id, arquivo, (texto) => setOcupado(texto))
      d = t.duracao; setDuracao(d)
      palavras = t.palavras
      if (!palavras.length) throw new Error('Não encontrei fala neste vídeo.')
      await guardarEdicao(peca.id, (e) => ({ ...e, arquivo: { nome: arquivo.name, tamanho: arquivo.size, duracao: d }, palavras: palavras!, partes: undefined, receitas: [] }))
    }
    setOcupado('O agente está editando…')
    const { plano: rascunho } = await pedirEdicao(peca.id, palavras, d, await apoio.paraAgente(), { modeloRef, quadros: await quadrosDoBruto(arquivo, 4, corte?.de, corte?.ate), referencia: edicao.referencia, pedido: [narracao ? SEM_PESSOA : '', pedidoDoConfig(edicao.config_estilo)].filter(Boolean).join('\n') || undefined })
    if (rascunho.cenas?.length) setOcupado(`Animando ${rascunho.cenas.length} cena(s)…`)
    const plano = await escreverCenas(peca.id, rascunho, palavras, peca.tipo !== 'video')
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, em: new Date().toISOString() }))
    setPasso(null); setFinal(null)
  })
  const ajustar = (pedido: string, regra: boolean) => executar('O agente está ajustando…', async () => {
    if (!edicao.palavras || !pedido.trim()) return
    const { plano: rascunho } = await pedirEdicao(peca.id, edicao.palavras, duracaoBruto, await apoio.paraAgente(), { pedido: pedido.trim(), lembrar: regra ? pedido.trim() : '', anterior: receita?.plano, modeloRef, quadros: arquivo ? await quadrosDoBruto(arquivo, 4, corte?.de, corte?.ate) : undefined, referencia: edicao.referencia })
    if (rascunho.cenas?.some((c) => !receita?.plano.cenas?.some((x) => x.descricao.trim() === c.descricao.trim()))) setOcupado('Animando as cenas…')
    const plano = await escreverCenas(peca.id, rascunho, edicao.palavras, peca.tipo !== 'video', receita?.plano)
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, pedido: pedido.trim(), em: new Date().toISOString() }))
    setFinal(null)
  })
  const gerarFinal = async () => {
    if (!arquivo || !linha) return
    setErro(null); setFinal(null); setProgresso(0)
    try {
      const blob = await montarVideo(arquivo, linha, peca.tipo !== 'video', setProgresso, apoio.apoio, apoio.musica, cor, codigos, visual)
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const nome = `${peca.titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - V${versao + 1}.${ext}`
      setFinal({ url: URL.createObjectURL(blob), nome, arquivo: new File([blob], nome, { type: blob.type }) })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui montar o vídeo.') } finally { setProgresso(null) }
  }

  return {
    edicao, temEditor: temEditor.dados, apoio, arquivo, url, confere, escolher, hdr, corrigirHdr, setCorrigirHdr, cor,
    modeloRef, escolherEstilo, receitas, versao, setVersao, receita, linha, duracaoBruto,
    passo, setPasso, ocupado, erro, progresso, final, editar, ajustar, gerarFinal, codigos, visual,
    partes, escolherVarios, juntou, cancelarPartes: () => setPartes(null),
  }
}
export type Estudio = ReturnType<typeof useEstudio>
