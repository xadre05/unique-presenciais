// Prévia sem o vídeo bruto (a página foi recarregada): um clique traz o vídeo de volta. Com o "atalho" guardado no
// navegador (Chrome e Edge), basta reabrir; sem ele, abre o seletor já guardando o atalho para a próxima vez.
import { useEffect, useRef, useState } from 'react'
import { atalhoGuardado, deixarArquivo, escolherComAtalho, reabrir } from '../arquivoPendente'

type Props = { pecaId: string; nomeEsperado?: string; aoEscolher: (f: File) => void }

export function ReabrirBruto({ pecaId, nomeEsperado, aoEscolher }: Props) {
  const [guardado, setGuardado] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  useEffect(() => { void atalhoGuardado(pecaId).then((a) => setGuardado(a?.name ?? null)) }, [pecaId])
  const procurar = async () => {
    const r = await escolherComAtalho()
    if (r === null) return entrada.current?.click() // navegador sem seletor com atalho
    if (r === 'cancelado') return
    deixarArquivo(pecaId, r.arquivo, r.atalho)
    aoEscolher(r.arquivo)
  }
  const voltar = async () => { const f = await reabrir(pecaId); if (f) aoEscolher(f); else void procurar() }
  return (
    <>
      <button type="button" className="btn btn-ouro btn-mini" onClick={() => void (guardado ? voltar() : procurar())}>
        {guardado ? `Reabrir ${guardado}` : `Escolher ${nomeEsperado ?? 'o vídeo'}`}</button>
      {guardado && <button type="button" className="link pequeno" onClick={() => void procurar()}>Escolher outro arquivo</button>}
      <input ref={entrada} type="file" accept="video/*" hidden onChange={(x) => { const f = x.target.files?.[0]; if (f) { deixarArquivo(pecaId, f); aoEscolher(f) } x.target.value = '' }} />
    </>
  )
}
