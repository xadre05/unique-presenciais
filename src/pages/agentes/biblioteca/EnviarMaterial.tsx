// Entradas da Biblioteca: enviar arquivos (PDF, Word, texto) ou colar um texto. Cada um pode entrar aprovado
// (o agente já usa) ou "a validar" (fica guardado até alguém revisar), por exemplo um texto escrito pela IA.
import { useRef, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { ACEITOS, lerTexto, tipoDoArquivo } from './lerArquivo'
import { guardarTexto } from './dados'

type Envio = { nome: string; estado: string; erro?: boolean }
type Props = { empresa: string; aoTerminar: () => void }

function CaixaValidar({ valor, aoMudar }: { valor: boolean; aoMudar: (v: boolean) => void }) {
  return <label className="pp-check pequeno"><input type="checkbox" checked={valor} onChange={(e) => aoMudar(e.target.checked)} /> Precisa de revisão antes de o agente usar</label>
}

export function EnviarArquivos({ empresa, aoTerminar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [envios, setEnvios] = useState<Envio[]>([])
  const marcar = (nome: string, estado: string, erro = false) => setEnvios((l) => l.map((e) => (e.nome === nome ? { nome, estado, erro } : e)))
  const enviar = async (lista: FileList | null) => {
    const arquivos = Array.from(lista ?? [])
    if (!arquivos.length) return
    setEnvios(arquivos.map((a) => ({ nome: a.name, estado: 'Na fila' })))
    for (const a of arquivos) {
      const tipo = tipoDoArquivo(a.name)
      if (!tipo) { marcar(a.name, 'Formato não aceito (envie PDF, Word ou .txt)', true); continue }
      try {
        marcar(a.name, 'Lendo o texto…')
        const texto = await lerTexto(a)
        marcar(a.name, 'Guardando na biblioteca…')
        const n = await guardarTexto(empresa, a.name.replace(/\.[^.]+$/, ''), tipo, texto, a.name)
        marcar(a.name, `Pronto · ${n} trechos`)
      } catch (e) { marcar(a.name, e instanceof Error ? e.message : 'Não consegui ler este arquivo.', true) }
    }
    if (entrada.current) entrada.current.value = ''
    aoTerminar()
  }
  return (
    <>
      <button type="button" className="btn btn-ouro" onClick={() => entrada.current?.click()}><Icone nome="importar" tam={16} /> Enviar arquivos</button>
      <input ref={entrada} type="file" accept={ACEITOS} multiple hidden onChange={(e) => enviar(e.target.files)} />
      {envios.length > 0 && <ul className="bib-envios">{envios.map((e) => <li key={e.nome} className={e.erro ? 'erro' : ''}><b>{e.nome}</b> <span>{e.estado}</span></li>)}</ul>}
    </>
  )
}

export function ColarTexto({ empresa, aoTerminar, aoFechar }: Props & { aoFechar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [validar, setValidar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const guardar = async () => {
    if (!titulo.trim() || texto.trim().length < 40) return setErro('Dê um título e cole um texto de pelo menos algumas linhas.')
    setErro(null); setSalvando(true)
    try { await guardarTexto(empresa, titulo, 'texto', texto, undefined, !validar); aoTerminar(); aoFechar() } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui guardar.') }
    setSalvando(false)
  }
  return (
    <div className="bib-colar">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex.: Protocolo Mento de Diamante)" aria-label="Título do texto" />
      <textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui o texto: trecho de apostila, roteiro de aula, explicação de técnica, respostas a dúvidas frequentes…" aria-label="Texto" />
      <CaixaValidar valor={validar} aoMudar={setValidar} />
      <div className="ia-linha">
        <button type="button" className="btn btn-contorno-ouro" disabled={salvando} onClick={guardar}>{salvando ? 'Guardando…' : 'Guardar na biblioteca'}</button>
        <button type="button" className="btn btn-mini" onClick={aoFechar}>Cancelar</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
