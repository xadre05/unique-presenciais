// O vídeo gravado que a pessoa envia (normalmente do celular) para a fila de edição. Sobe para o armazenamento de
// vídeos com barra de progresso e fica ligado à peça (conteudo.bruto); quem abrir o Estúdio, em qualquer computador,
// recebe esse vídeo sem procurar arquivo.
import { supabase, SUPABASE_KEY } from '../../../../lib/supabase'
import { EMPRESA } from '../useMarketing'
import { alterarPeca } from '../peca/useEdicao'
import type { Bruto } from '../fluxo'

const LIMITE = 300 * 1024 * 1024
const TIPOS: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4' }

export async function enviarBruto(pecaId: string, arquivo: File, aoProgresso: (fracao: number) => void, por?: string): Promise<Bruto> {
  if (arquivo.size > LIMITE) throw new Error(`O vídeo tem ${Math.round(arquivo.size / 1048576)} MB e o limite é 300 MB. Grave em 1080p (não 4K) ou corte o começo e o fim.`)
  const ext = (arquivo.name.split('.').pop() ?? 'mp4').toLowerCase()
  const tipo = arquivo.type || TIPOS[ext] || 'video/mp4'
  const caminho = `${EMPRESA}/brutos/${pecaId}/${Date.now()}.${TIPOS[ext] ? ext : 'mp4'}`
  const { data, error } = await supabase.storage.from('videos').createSignedUploadUrl(caminho)
  if (error || !data) throw new Error(`Não consegui preparar o envio: ${error?.message ?? 'sem resposta'}`)
  await new Promise<void>((ok, falha) => {
    const x = new XMLHttpRequest()
    x.open('PUT', data.signedUrl)
    x.setRequestHeader('apikey', SUPABASE_KEY)
    x.upload.onprogress = (e) => { if (e.lengthComputable) aoProgresso(e.loaded / e.total) }
    x.onload = () => (x.status < 300 ? ok() : falha(new Error(x.status === 413 ? 'O vídeo é maior do que o armazenamento aceita. Grave em 1080p ou mais curto.' : `O envio falhou (${x.status}). Tente de novo.`)))
    x.onerror = () => falha(new Error('A internet caiu durante o envio. Tente de novo (de preferência no Wi-Fi).'))
    const corpo = new FormData()
    corpo.append('cacheControl', '3600')
    corpo.append('', new File([arquivo], arquivo.name, { type: tipo }))
    x.send(corpo)
  })
  const bruto: Bruto = { caminho, nome: arquivo.name, tamanho: arquivo.size, em: new Date().toISOString(), por }
  const erro = await alterarPeca(pecaId, (p) => ({ conteudo: { ...p.conteudo, bruto } }))
  if (erro) throw new Error(erro)
  return bruto
}

// baixa o vídeo enviado para o Estúdio (vira o mesmo File que a pessoa escolheria no computador)
export async function baixarBruto(b: Bruto, aoProgresso?: (fracao: number) => void): Promise<File | null> {
  const { data } = await supabase.storage.from('videos').createSignedUrl(b.caminho, 3600)
  if (!data?.signedUrl) return null
  const r = await fetch(data.signedUrl)
  if (!r.ok || !r.body) return null
  const total = Number(r.headers.get('content-length') ?? b.tamanho) || b.tamanho
  const leitor = r.body.getReader()
  const partes: Uint8Array[] = []
  let lido = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    partes.push(value); lido += value.length
    aoProgresso?.(Math.min(1, lido / total))
  }
  return new File(partes as BlobPart[], b.nome, { type: r.headers.get('content-type') ?? 'video/mp4' })
}
