// O vídeo gravado que a pessoa envia (normalmente do celular) para a fila de edição. O armazenamento aceita até
// 50 MB por arquivo, então o vídeo sobe em pedaços de 40 MB (com barra de progresso) e é remontado ao baixar. Fica
// ligado à peça (conteudo.bruto); quem abrir o Estúdio, em qualquer computador, recebe o vídeo sem procurar arquivo.
import { supabase, SUPABASE_KEY } from '../../../../lib/supabase'
import { EMPRESA } from '../useMarketing'
import { alterarPeca } from '../peca/useEdicao'
import type { Bruto } from '../fluxo'

const PEDACO = 40 * 1024 * 1024
const LIMITE = 1500 * 1024 * 1024
const TIPOS: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4' }

function enviarPedaco(url: string, pedaco: Blob, tipo: string, aoProgresso: (bytes: number) => void) {
  return new Promise<void>((ok, falha) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url)
    x.setRequestHeader('apikey', SUPABASE_KEY)
    x.upload.onprogress = (e) => aoProgresso(e.loaded)
    x.onload = () => (x.status < 300 ? ok() : falha(new Error(`O envio falhou (${x.status}). Tente de novo.`)))
    x.onerror = () => falha(new Error('A internet caiu durante o envio. Tente de novo (de preferência no Wi-Fi).'))
    const corpo = new FormData()
    corpo.append('cacheControl', '3600')
    corpo.append('', new File([pedaco], 'parte', { type: tipo }))
    x.send(corpo)
  })
}

export async function enviarBruto(pecaId: string, arquivo: File, aoProgresso: (fracao: number) => void, por?: string): Promise<Bruto> {
  if (arquivo.size > LIMITE) throw new Error(`O vídeo tem ${Math.round(arquivo.size / 1048576)} MB. Grave em 1080p (não 4K) ou mais curto.`)
  const ext = (arquivo.name.split('.').pop() ?? 'mp4').toLowerCase()
  const tipo = TIPOS[ext] ?? (TIPOS[(arquivo.type.split('/')[1] ?? '')] ? arquivo.type : 'video/mp4')
  const base = `${EMPRESA}/brutos/${pecaId}/${Date.now()}`
  const n = Math.max(1, Math.ceil(arquivo.size / PEDACO))
  const partes: string[] = []
  for (let k = 0; k < n; k++) {
    const caminho = `${base}-${k}.${TIPOS[ext] ? ext : 'mp4'}`
    const { data, error } = await supabase.storage.from('videos').createSignedUploadUrl(caminho)
    if (error || !data) throw new Error(`Não consegui preparar o envio: ${error?.message ?? 'sem resposta'}`)
    const ini = k * PEDACO
    await enviarPedaco(data.signedUrl, arquivo.slice(ini, ini + PEDACO), tipo, (b) => aoProgresso(Math.min(1, (ini + b) / arquivo.size)))
    partes.push(caminho)
  }
  const bruto: Bruto = { caminho: partes[0], partes, nome: arquivo.name, tamanho: arquivo.size, em: new Date().toISOString(), por }
  const erro = await alterarPeca(pecaId, (p) => ({ conteudo: { ...p.conteudo, bruto } }))
  if (erro) throw new Error(erro)
  return bruto
}

// baixa o vídeo enviado (todas as partes, em ordem) e devolve o mesmo File que a pessoa escolheria no computador
export async function baixarBruto(b: Bruto, aoProgresso?: (fracao: number) => void): Promise<File | null> {
  const partes = b.partes?.length ? b.partes : [b.caminho]
  const pedacos: BlobPart[] = []
  let lido = 0, tipo = 'video/mp4'
  for (const caminho of partes) {
    const { data } = await supabase.storage.from('videos').createSignedUrl(caminho, 3600)
    if (!data?.signedUrl) return null
    const r = await fetch(data.signedUrl)
    if (!r.ok || !r.body) return null
    tipo = r.headers.get('content-type') ?? tipo
    const leitor = r.body.getReader()
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      pedacos.push(value); lido += value.length
      aoProgresso?.(Math.min(1, lido / b.tamanho))
    }
  }
  return new File(pedacos, b.nome, { type: tipo })
}
