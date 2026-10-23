// Estado das mídias de apoio e da música de uma peça: as do banco de imagens da marca (baixadas sozinhas) e as que a
// pessoa escolheu só para este vídeo (ficam no navegador), casadas com a lista guardada na peça; e o que vai para o
// agente (miniaturas). Separado da aba para ela ficar só com a tela.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { guardarEdicao, type Edicao, type MidiaParaAgente } from './dados'
import { miniatura, tipoDoArquivo, type MidiaApoio } from './midias'
import type { Musica } from './montagem'
import { descricaoParaAgente, type ItemBanco } from '../../BancoImagens'

const VOLUME_PADRAO = 0.12
const NENHUMA: MidiaApoio[] = []
export const chaveDe = (m: Pick<MidiaApoio, 'nome' | 'tamanho' | 'caminho'>) => (m.caminho ? `banco:${m.caminho}` : `${m.nome}|${m.tamanho}`)
const doBanco = (b: ItemBanco): MidiaApoio => ({ nome: b.nome, tamanho: 0, tipo: b.tipo, descricao: descricaoParaAgente(b), caminho: b.caminho })

const LIMITE_NUVEM = 45 * 1024 * 1024
async function guardarNaNuvem(pecaId: string, f: File): Promise<MidiaApoio> {
  const base: MidiaApoio = { nome: f.name, tamanho: f.size, tipo: tipoDoArquivo(f)!, propria: true }
  if (f.size > LIMITE_NUVEM) return { ...base, propria: undefined }
  const caminho = `apoio/${pecaId}/${f.size}_${f.name.normalize('NFD').replace(/[^\w.-]/g, '_')}`
  // o nome leva o tamanho: o mesmo arquivo escolhido de novo já está guardado (aí o envio diz que já existe)
  const { error } = await supabase.storage.from('arquivos').upload(caminho, f, { contentType: f.type || undefined })
  return !error || /exist|duplicate/i.test(error.message) ? { ...base, caminho } : { ...base, propria: undefined }
}

async function baixar(m: MidiaApoio) {
  const { data } = await supabase.storage.from(m.bucket ?? 'arquivos').download(m.caminho!)
  return data ? new File([data], m.nome, { type: data.type || (m.tipo === 'video' ? 'video/mp4' : 'image/jpeg') }) : undefined
}

export function usarApoio(pecaId: string, edicao: Edicao, banco: ItemBanco[], aoMudar: () => void) {
  const [arquivos, setArquivos] = useState<Map<string, File>>(new Map())
  const [arquivoMusica, setArquivoMusica] = useState<File | undefined>()
  const [volume, setVolume] = useState(edicao.musica?.volume ?? VOLUME_PADRAO)
  // mesma lista enquanto o conteúdo não muda (a prévia só reabre as mídias quando a lista muda de verdade)
  const assinatura = JSON.stringify(edicao.midias ?? NENHUMA)
  const midias = useMemo(() => edicao.midias ?? NENHUMA, [assinatura]) // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = async (mudar: (e: Edicao) => Edicao) => { await guardarEdicao(pecaId, mudar); aoMudar() }
  // o que do banco ainda não está na lista da peça (entra no fim, para não mudar o número das que já estão)
  const novasDoBanco = banco.filter((b) => !midias.some((m) => m.caminho === b.caminho)).map(doBanco)

  // as do banco abrem sozinhas
  useEffect(() => {
    const faltam = midias.filter((m) => m.caminho && !arquivos.has(chaveDe(m)))
    if (!faltam.length) return
    let vivo = true
    Promise.all(faltam.map(async (m) => [chaveDe(m), await baixar(m).catch(() => undefined)] as const)).then((lista) => {
      if (vivo) setArquivos((atual) => new Map([...atual, ...lista.filter((x): x is readonly [string, File] => !!x[1])]))
    })
    return () => { vivo = false }
  }, [midias]) // eslint-disable-line react-hooks/exhaustive-deps

  const [enviando, setEnviando] = useState<string | null>(null)
  // cada mídia escolhida é guardada na nuvem (pasta deste vídeo): depois de recarregar a página ela volta sozinha,
  // com a miniatura, sem escolher de novo. Arquivo grande demais para guardar fica só neste computador, como antes.
  const adicionar = async (fs: File[]) => {
    const validos = fs.filter((f) => tipoDoArquivo(f))
    const guardadas: MidiaApoio[] = []
    try {
      for (const [k, f] of validos.entries()) {
        setEnviando(`Guardando ${k + 1} de ${validos.length}…`)
        guardadas.push(await guardarNaNuvem(pecaId, f))
      }
    } finally { setEnviando(null) }
    setArquivos((m) => new Map([...m, ...guardadas.map((g, k) => [chaveDe(g), validos[k]] as const)]))
    // o que já está na lista (mesmo nome e tamanho) passa a apontar para a cópia guardada, no mesmo lugar; o resto entra no fim
    const mesma = (m: MidiaApoio, g: MidiaApoio) => m.nome === g.nome && (m.tamanho === g.tamanho || m.caminho === g.caminho)
    await guardar((e) => {
      const lista = (e.midias ?? []).map((m) => { const g = guardadas.find((x) => mesma(m, x)); return g ? { ...g, descricao: m.descricao ?? g.descricao } : m })
      return { ...e, midias: [...lista, ...guardadas.filter((g) => !lista.some((m) => mesma(m, g)))] }
    })
  }
  // tirar uma mídia muda a numeração: as coberturas das edições já feitas que apontavam para ela deixam de valer
  const remover = (n: number) => guardar((e) => ({ ...e, midias: (e.midias ?? []).filter((_, k) => k !== n) }))
  // tirar várias de uma vez: todas, ou só as que ficaram sem arquivo depois de recarregar a página
  const limpar = (soSemArquivo: boolean) => guardar((e) => ({ ...e, midias: soSemArquivo ? (e.midias ?? []).filter((m) => m.caminho || arquivos.has(chaveDe(m))) : [] }))
  const descrever = (n: number, texto: string) => guardar((e) => ({ ...e, midias: (e.midias ?? []).map((m, k) => (k === n ? { ...m, descricao: texto.trim() || undefined } : m)) }))

  const escolherMusica = async (f: File | null) => {
    setArquivoMusica(f ?? undefined)
    await guardar((e) => ({ ...e, musica: f ? { nome: f.name, tamanho: f.size, volume } : undefined }))
  }
  // o volume muda na hora na prévia e é guardado depois que a pessoa para de mexer
  const espera = useRef<number | undefined>(undefined)
  const mudarVolume = (v: number) => {
    setVolume(v)
    window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => { guardar((e) => (e.musica ? { ...e, musica: { ...e.musica, volume: v } } : e)) }, 600)
  }
  useEffect(() => () => window.clearTimeout(espera.current), [])

  // na ordem da lista guardada (é o número que o agente usa); sem arquivo escolhido fica vazio
  const apoio = useMemo(() => midias.map((m) => arquivos.get(chaveDe(m))), [midias, arquivos])
  const musica: Musica | undefined = useMemo(() => (arquivoMusica && edicao.musica ? { arquivo: arquivoMusica, volume } : undefined), [arquivoMusica, edicao.musica, volume])

  // antes de pedir a edição: o que entrou no banco desde a última vez passa a fazer parte da lista da peça, e o agente
  // recebe a miniatura de cada mídia que tem arquivo
  const paraAgente = async (): Promise<MidiaParaAgente[]> => {
    const lista = [...midias, ...novasDoBanco]
    if (novasDoBanco.length) await guardarEdicao(pecaId, (e) => ({ ...e, midias: [...(e.midias ?? []), ...novasDoBanco.filter((b) => !(e.midias ?? []).some((m) => m.caminho === b.caminho))] }))
    const arquivosDe = await Promise.all(lista.map(async (m) => arquivos.get(chaveDe(m)) ?? (m.caminho ? await baixar(m).catch(() => undefined) : undefined)))
    const prontas = await Promise.all(lista.map(async (m, n) => {
      const f = arquivosDe[n]
      // mídia do banco: a descrição mais recente de lá (a equipe pode ter melhorado depois)
      const doBancoAgora = m.caminho ? banco.find((b) => b.caminho === m.caminho) : undefined
      return f ? { n, tipo: m.tipo, descricao: doBancoAgora ? descricaoParaAgente(doBancoAgora) : m.descricao, miniatura: await miniatura(f).catch(() => undefined) } : null
    }))
    return prontas.filter((x): x is NonNullable<typeof x> => !!x)
  }

  return { midias, novasDoBanco, arquivos, apoio, musica, arquivoMusica, adicionar, enviando, remover, limpar, descrever, escolherMusica, mudarVolume, volume, paraAgente }
}
