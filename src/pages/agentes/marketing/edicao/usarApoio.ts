// Estado das mídias de apoio e da música de uma peça: as do banco de imagens da marca (baixadas sozinhas) e as que a
// pessoa escolheu só para este vídeo (ficam no navegador), casadas com a lista guardada na peça; e o que vai para o
// agente (miniaturas). Separado da aba para ela ficar só com a tela.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { guardarEdicao, type Edicao, type MidiaParaAgente } from './dados'
import { miniatura, tipoDoArquivo, type MidiaApoio } from './midias'
import type { Musica } from './montagem'
import type { ItemBanco } from '../../BancoImagens'

const VOLUME_PADRAO = 0.12
const NENHUMA: MidiaApoio[] = []
export const chaveDe = (m: Pick<MidiaApoio, 'nome' | 'tamanho' | 'caminho'>) => (m.caminho ? `banco:${m.caminho}` : `${m.nome}|${m.tamanho}`)
const doBanco = (b: ItemBanco): MidiaApoio => ({ nome: b.nome, tamanho: 0, tipo: b.tipo, descricao: b.descricao, caminho: b.caminho })

async function baixar(m: MidiaApoio) {
  const { data } = await supabase.storage.from('arquivos').download(m.caminho!)
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

  const adicionar = async (fs: File[]) => {
    const validos = fs.filter((f) => tipoDoArquivo(f))
    setArquivos((m) => new Map([...m, ...validos.map((f) => [chaveDe({ nome: f.name, tamanho: f.size }), f] as const)]))
    // o que já está na lista (mesmo nome e tamanho) só volta a ter arquivo; o resto entra no fim da lista
    const novos = validos.filter((f) => !midias.some((m) => !m.caminho && m.nome === f.name && m.tamanho === f.size))
    if (novos.length) await guardar((e) => ({ ...e, midias: [...(e.midias ?? []), ...novos.map((f): MidiaApoio => ({ nome: f.name, tamanho: f.size, tipo: tipoDoArquivo(f)! }))] }))
  }
  // tirar uma mídia muda a numeração: as coberturas das edições já feitas que apontavam para ela deixam de valer
  const remover = (n: number) => guardar((e) => ({ ...e, midias: (e.midias ?? []).filter((_, k) => k !== n) }))
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
      return f ? { n, tipo: m.tipo, descricao: m.descricao, miniatura: await miniatura(f).catch(() => undefined) } : null
    }))
    return prontas.filter((x): x is NonNullable<typeof x> => !!x)
  }

  return { midias, novasDoBanco, arquivos, apoio, musica, arquivoMusica, adicionar, remover, descrever, escolherMusica, mudarVolume, volume, paraAgente }
}
