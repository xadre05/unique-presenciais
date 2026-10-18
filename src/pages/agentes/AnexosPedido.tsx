// Arquivos de referência para o agente: prints de posts que você gostou, imagens ou PDF.
// Imagens são reduzidas no navegador (até 1568 px) para gastar poucos tokens.
import { useRef, useState } from 'react'
import { Icone } from '../../components/Icone'

export type Anexo = { nome: string; tipo: 'imagem' | 'pdf'; media_type: string; dados: string }
const MAX_ARQUIVOS = 6
const MAX_PDF = 4 * 1024 * 1024

function lerComoBase64(arquivo: Blob) {
  return new Promise<string>((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1] ?? '')
    r.onerror = () => erro(r.error)
    r.readAsDataURL(arquivo)
  })
}

async function reduzirImagem(arquivo: File): Promise<Anexo> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url })
    const escala = Math.min(1, 1568 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.85))
    return { nome: arquivo.name, tipo: 'imagem', media_type: 'image/jpeg', dados: await lerComoBase64(blob) }
  } finally { URL.revokeObjectURL(url) }
}

export function AnexosPedido({ anexos, aoMudar }: { anexos: Anexo[]; aoMudar: (a: Anexo[]) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)

  const adicionar = async (lista: FileList | null) => {
    if (!lista?.length) return
    setErro(null); setLendo(true)
    const novos: Anexo[] = []
    for (const f of Array.from(lista)) {
      if (anexos.length + novos.length >= MAX_ARQUIVOS) { setErro(`No máximo ${MAX_ARQUIVOS} arquivos por pedido.`); break }
      if (f.type === 'application/pdf') {
        if (f.size > MAX_PDF) { setErro(`${f.name}: PDF acima de 4 MB.`); continue }
        novos.push({ nome: f.name, tipo: 'pdf', media_type: 'application/pdf', dados: await lerComoBase64(f) })
      } else if (f.type.startsWith('image/')) {
        novos.push(await reduzirImagem(f))
      } else setErro(`${f.name}: envie imagem (print, foto) ou PDF. Vídeo ainda não: mande um print das cenas principais.`)
    }
    aoMudar([...anexos, ...novos]); setLendo(false)
    if (entrada.current) entrada.current.value = ''
  }

  return (
    <div className="anexos">
      <div className="anexos-topo">
        <button type="button" className="btn btn-contorno btn-mini" disabled={lendo} onClick={() => entrada.current?.click()}><Icone nome="arquivo" tam={14} /> {lendo ? 'Lendo…' : 'Anexar referência'}</button>
        <span className="muted pequeno">Print de um post ou reels que você gostou, imagem ou PDF. O agente usa como modelo, sem copiar.</span>
        <input ref={entrada} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => adicionar(e.target.files)} />
      </div>
      {!!anexos.length && (
        <div className="anexos-lista">{anexos.map((a, i) => (
          <span key={i} className="anexo">
            {a.tipo === 'imagem' ? <img src={`data:${a.media_type};base64,${a.dados}`} alt="" /> : <Icone nome="documento" tam={16} />}
            <span>{a.nome}</span>
            <button type="button" aria-label="Tirar" onClick={() => aoMudar(anexos.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}</div>
      )}
      {erro && <p className="erro-txt pequeno">{erro}</p>}
    </div>
  )
}
