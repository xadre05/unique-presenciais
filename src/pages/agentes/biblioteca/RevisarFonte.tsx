// Revisar um material da Biblioteca: ler o texto inteiro, corrigir se precisar e aprovar (o agente passa a usar)
// ou deixar "a validar". Texto corrigido vira uma versão nova do material; a antiga sai da biblioteca.
import { useEffect, useState } from 'react'
import { Erro } from '../../../components/ui'
import { aprovarFonte, substituirFonte, textoDaFonte, type Fonte } from './dados'

type Props = { empresa: string; f: Fonte; aoTerminar: () => void; aoFechar: () => void }

export function RevisarFonte({ empresa, f, aoTerminar, aoFechar }: Props) {
  const [original, setOriginal] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [titulo, setTitulo] = useState(f.titulo)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => {
    textoDaFonte(f.id).then((t) => { setOriginal(t); setTexto(t) }).catch((e: Error) => setErro(e.message))
  }, [f.id])
  const mudou = original !== null && (texto.trim() !== original.trim() || titulo.trim() !== f.titulo)
  const concluir = async (aprovada: boolean) => {
    setErro(null); setSalvando(true)
    try {
      if (mudou) await substituirFonte(empresa, f, titulo.trim() || f.titulo, texto, aprovada)
      else await aprovarFonte(f.id, aprovada)
      aoTerminar(); aoFechar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui salvar.') }
    setSalvando(false)
  }
  return (
    <div className="bib-revisar">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título do material" />
      {original === null && !erro ? <p className="muted pequeno">Carregando o texto…</p>
        : <textarea rows={14} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto do material" />}
      <p className="muted pequeno">Confira termos técnicos, nomes de técnicas e números. O agente só usa este material depois de aprovado.</p>
      <Erro msg={erro} />
      <div className="ia-linha">
        <button type="button" className="btn btn-ouro" disabled={salvando || original === null} onClick={() => concluir(true)}>{mudou ? 'Salvar e aprovar' : 'Aprovar'}</button>
        {(mudou || f.aprovada) && <button type="button" className="btn btn-contorno" disabled={salvando} onClick={() => concluir(false)}>{mudou ? 'Salvar, ainda a validar' : 'Voltar para a validar'}</button>}
        <button type="button" className="btn btn-mini" onClick={aoFechar}>Fechar</button>
      </div>
    </div>
  )
}
