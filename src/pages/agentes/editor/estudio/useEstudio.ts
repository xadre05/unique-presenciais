// Estado e ações do Estúdio de edição: o vídeo bruto (no computador), as mídias de apoio, o estilo escolhido, as versões
// da edição (receitas do agente), a prévia, o vídeo final e o passo aberto. As telas do Estúdio só desenham isto.
import { useEffect, useMemo, useState } from 'react'
import type { Peca } from '../../comum'
import { EMPRESA } from '../../marketing/useMarketing'
import { useLogos } from '../../LogosMarca'
import { bancoDe, bancoParaCampanha } from '../../BancoImagens'
import { transcreverVideo } from '../cortes/audioLongo'
import { edicaoDa, guardarEdicao, mesmoArquivo, pedirEdicao, useTemEditor, type Edicao, type Receita } from '../../marketing/edicao/dados'
import { CORRECAO_HDR, ehHdr, quadrosDoBruto, quadrosEm } from '../../marketing/edicao/midias'
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
import { avisoRepeticoes, tomadasParaAgente } from './repeticoes'

// o navegador já entrega largura e altura de exibição (com o giro do celular aplicado)
function orientacaoDe(endereco: string) {
  return new Promise<boolean | null>((resolver) => {
    const v = document.createElement('video')
    v.preload = 'metadata'; v.muted = true
    v.onloadedmetadata = () => resolver(v.videoWidth && v.videoHeight ? v.videoHeight > v.videoWidth : null)
    v.onerror = () => resolver(null)
    v.src = endereco
  })
}

// o que o agente precisa saber do vídeo gravado: formato, duração (vídeo longo pede corte mais suave) e mídias enviadas
function orientacoesDoBruto(vertical: boolean, duracao: number, midias: number) {
  return [
    vertical ? 'FORMATO: vídeo em pé (9:16).' : 'FORMATO: vídeo deitado (16:9), gravado na horizontal. O vídeo final sai deitado; enquadre pensando nisso e use "dividida" lado a lado só se couber.',
    duracao > 120 ? 'BRUTO LONGO POR CAUSA DE ERROS: o vídeo final tem que ser enxuto e com ritmo. Tire tudo o que não é a fala final: erro, frase repetida (fica a última tentativa), conversa com a equipe, comentário fora do roteiro e pausa. Mas cada frase que fica entra INTEIRA, do começo ao fim: nunca corte dentro de uma frase nem pule palavras no meio dela. A dinâmica vem de zoom, imagens por cima, textos na tela e cortes entre frases, não de picotar a fala.' : '',
    'PREÇOS E NÚMEROS: nunca corte dentro de um número falado ("quatro mil novecentos e noventa e sete" fica inteiro, do começo ao fim). Se a pessoa errou ou tropeçou no preço, use a tomada em que ela falou certo e completo. Número na legenda e no texto da tela tem que ser o número inteiro que foi dito e bater com o roteiro.',
    midias ? `A equipe enviou ${midias} mídias de apoio para ESTE vídeo: use-as em "coberturas" sempre que a fala falar do que a mídia mostra (plataforma, presencial, turma, depoimento, Clinical, oferta).` : '',
  ]
}

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
  // em pé ou deitado: segue o vídeo gravado (sem ler o vídeo ainda, vai pelo tipo da peça)
  const [emPe, setEmPe] = useState<boolean | null>(null)
  const vertical = emPe ?? peca.tipo !== 'video'
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
    const endereco = URL.createObjectURL(f)
    setErro(null); setArquivo(f); setUrl(endereco); setFinal(null); setHdr(false); void ehHdr(f).then(setHdr)
    setEmPe(null); void orientacaoDe(endereco).then(setEmPe)
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
    const midias = await apoio.paraAgente()
    // o agente assiste as tentativas repetidas: uma foto de cada (só no vídeo inteiro, não em corte de vídeo longo)
    setOcupado('Olhando as tomadas repetidas…')
    const tomadas = corte || narracao ? { fotos: [], aviso: avisoRepeticoes(palavras) } : await tomadasParaAgente(palavras, (t) => quadrosEm(arquivo, t))
    setOcupado('O agente está editando…')
    const quadros = [...await quadrosDoBruto(arquivo, 4, corte?.de, corte?.ate), ...tomadas.fotos]
    const { plano: rascunho } = await pedirEdicao(peca.id, palavras, d, midias, { modeloRef, quadros, referencia: edicao.referencia, pedido: [narracao ? SEM_PESSOA : '', pedidoDoConfig(edicao.config_estilo), ...orientacoesDoBruto(vertical, d, midias.length), tomadas.aviso].filter(Boolean).join('\n') || undefined })
    if (rascunho.cenas?.length) setOcupado(`Animando ${rascunho.cenas.length} cena(s)…`)
    const plano = await escreverCenas(peca.id, rascunho, palavras, vertical)
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, em: new Date().toISOString() }))
    setPasso(null); setFinal(null)
  })
  const ajustar = (pedido: string, regra: boolean) => executar('O agente está ajustando…', async () => {
    if (!edicao.palavras || !pedido.trim()) return
    const midias = await apoio.paraAgente()
    const { plano: rascunho } = await pedirEdicao(peca.id, edicao.palavras, duracaoBruto, midias, { pedido: [pedido.trim(), ...orientacoesDoBruto(vertical, duracaoBruto, midias.length)].filter(Boolean).join('\n'), lembrar: regra ? pedido.trim() : '', anterior: receita?.plano, modeloRef, quadros: arquivo ? await quadrosDoBruto(arquivo, 4, corte?.de, corte?.ate) : undefined, referencia: edicao.referencia })
    if (rascunho.cenas?.some((c) => !receita?.plano.cenas?.some((x) => x.descricao.trim() === c.descricao.trim()))) setOcupado('Animando as cenas…')
    const plano = await escreverCenas(peca.id, rascunho, edicao.palavras, vertical, receita?.plano)
    await guardarEdicao(peca.id, (e) => comReceita(e, { plano, pedido: pedido.trim(), em: new Date().toISOString() }))
    setFinal(null)
  })
  const gerarFinal = async () => {
    if (!arquivo || !linha) return
    setErro(null); setFinal(null); setProgresso(0)
    try {
      const blob = await montarVideo(arquivo, linha, vertical, setProgresso, apoio.apoio, apoio.musica, cor, codigos, visual)
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const nome = `${peca.titulo.replace(/[^\p{L}\p{N} -]/gu, '').trim().slice(0, 60) || 'video'} - V${versao + 1}.${ext}`
      setFinal({ url: URL.createObjectURL(blob), nome, arquivo: new File([blob], nome, { type: blob.type }) })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui montar o vídeo.') } finally { setProgresso(null) }
  }

  return {
    vertical, edicao, temEditor: temEditor.dados, apoio, arquivo, url, confere, escolher, hdr, corrigirHdr, setCorrigirHdr, cor,
    modeloRef, escolherEstilo, receitas, versao, setVersao, receita, linha, duracaoBruto,
    passo, setPasso, ocupado, erro, progresso, final, editar, ajustar, gerarFinal, codigos, visual,
    partes, escolherVarios, juntou, cancelarPartes: () => setPartes(null),
  }
}
export type Estudio = ReturnType<typeof useEstudio>
