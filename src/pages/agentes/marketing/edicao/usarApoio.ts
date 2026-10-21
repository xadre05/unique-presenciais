// Estado das mídias de apoio e da música de uma peça: os arquivos escolhidos (só no navegador) casados com a lista
// guardada na peça, e o que vai para o agente (miniaturas). Separado da aba para ela ficar só com a tela.
import { useEffect, useMemo, useRef, useState } from 'react'
import { chaveArquivo } from './ApoioEdicao'
import { guardarEdicao, type Edicao, type MidiaParaAgente } from './dados'
import { miniatura, tipoDoArquivo, type MidiaApoio } from './midias'
import type { Musica } from './montagem'

const VOLUME_PADRAO = 0.12
const NENHUMA: MidiaApoio[] = []

export function usarApoio(pecaId: string, edicao: Edicao, aoMudar: () => void) {
  const [arquivos, setArquivos] = useState<Map<string, File>>(new Map())
  const [arquivoMusica, setArquivoMusica] = useState<File | undefined>()
  const [volume, setVolume] = useState(edicao.musica?.volume ?? VOLUME_PADRAO)
  // mesma lista enquanto o conteúdo não muda (a prévia só reabre as mídias quando a lista muda de verdade)
  const assinatura = JSON.stringify(edicao.midias ?? NENHUMA)
  const midias = useMemo(() => edicao.midias ?? NENHUMA, [assinatura]) // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = async (mudar: (e: Edicao) => Edicao) => { await guardarEdicao(pecaId, mudar); aoMudar() }

  const adicionar = async (fs: File[]) => {
    const validos = fs.filter((f) => tipoDoArquivo(f))
    setArquivos((m) => new Map([...m, ...validos.map((f) => [chaveArquivo(f.name, f.size), f] as const)]))
    // o que já está na lista (mesmo nome e tamanho) só volta a ter arquivo; o resto entra no fim da lista
    const novos = validos.filter((f) => !midias.some((m) => m.nome === f.name && m.tamanho === f.size))
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
  const apoio = useMemo(() => midias.map((m) => arquivos.get(chaveArquivo(m.nome, m.tamanho))), [midias, arquivos])
  const musica: Musica | undefined = useMemo(() => (arquivoMusica && edicao.musica ? { arquivo: arquivoMusica, volume } : undefined), [arquivoMusica, edicao.musica, volume])

  const paraAgente = async (): Promise<MidiaParaAgente[]> => Promise.all(midias.map(async (m, n) => {
    const f = apoio[n]
    return { n, tipo: m.tipo, descricao: m.descricao, miniatura: f ? await miniatura(f).catch(() => undefined) : undefined }
  })).then((lista) => lista.filter((m) => apoio[m.n]))

  return { midias, arquivos, apoio, musica, arquivoMusica, adicionar, remover, descrever, escolherMusica, mudarVolume, volume, paraAgente }
}
