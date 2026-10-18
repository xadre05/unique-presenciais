// Arquivos da peça (artes, capas, PDF, referências): vão para o armazenamento privado "arquivos",
// na pasta da peça. A tela mostra a miniatura por um link temporário.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { enviarArquivo } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'

const links = new Map<string, string>()
const ehImagem = (caminho: string) => /\.(png|jpe?g|webp|gif)$/i.test(caminho)

export async function linkDe(caminho: string) {
  if (links.has(caminho)) return links.get(caminho)!
  const { data } = await supabase.storage.from('arquivos').createSignedUrl(caminho, 3600)
  if (data?.signedUrl) links.set(caminho, data.signedUrl)
  return data?.signedUrl ?? null
}

export function Miniatura({ caminho, nome, proporcao }: { caminho?: string; nome?: string; proporcao?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let vivo = true; if (caminho && ehImagem(caminho)) linkDe(caminho).then((u) => vivo && setUrl(u)); return () => { vivo = false } }, [caminho])
  const abrir = async () => { if (caminho) { const u = await linkDe(caminho); if (u) window.open(u, '_blank') } }
  if (!caminho) return null
  return (
    <button type="button" className={`pp-mini${proporcao ? ` p-${proporcao.replace(':', '-')}` : ''}`} onClick={abrir} title={`Abrir ${nome ?? 'arquivo'}`}>
      {url ? <img src={url} alt={nome ?? ''} /> : <span><Icone nome={caminho.endsWith('.pdf') ? 'pdf' : 'arquivo'} tam={22} />{nome}</span>}
    </button>
  )
}

// botão que abre o seletor de arquivo e devolve o caminho guardado
export function BotaoEnviar({ pasta, aoEnviar, texto = 'Enviar arquivo', aceita = 'image/*,application/pdf', classe = 'btn btn-contorno', desligado }: {
  pasta: string; aoEnviar: (caminho: string, nome: string) => void; texto?: string; aceita?: string; classe?: string; desligado?: boolean
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const escolher = async (lista: FileList | null) => {
    const f = lista?.[0]
    if (!f) return
    setErro(null); setEnviando(true)
    try { aoEnviar(await enviarArquivo(pasta, f), f.name) } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui enviar.') }
    setEnviando(false)
    if (entrada.current) entrada.current.value = ''
  }
  return (
    <>
      <button type="button" className={classe} disabled={enviando || desligado} onClick={() => entrada.current?.click()}><Icone nome="importar" tam={16} /> {enviando ? 'Enviando…' : texto}</button>
      <input ref={entrada} type="file" accept={aceita} hidden onChange={(e) => escolher(e.target.files)} />
      {erro && <span className="erro-txt pequeno">{erro}</span>}
    </>
  )
}

export const pastaDa = (pecaId: string) => `agentes/pecas/${pecaId}`
