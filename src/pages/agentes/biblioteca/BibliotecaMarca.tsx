// Base da marca → Biblioteca: o que o agente sabe da empresa além do cadastro (apostilas, aulas, protocolos, textos).
// Cada arquivo vira trechos pesquisáveis; antes de escrever uma peça, o agente busca os trechos do assunto.
// "Testar busca" mostra o que o agente encontraria para um tema.
import { useRef, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { ACEITOS, lerTexto, tipoDoArquivo } from './lerArquivo'
import { buscar, guardarTexto, tirarFonte, useFontes, type Achado, type Fonte } from './dados'

const ICONE: Record<string, string> = { pdf: 'pdf', docx: 'documento', texto: 'texto', tutor: 'mensagem', video: 'video', post: 'imagem', link: 'globo' }
const NOME_TIPO: Record<string, string> = { pdf: 'PDF', docx: 'Word', texto: 'Texto', tutor: 'Conversa com o tutor', video: 'Vídeo transcrito', post: 'Post', link: 'Página' }
const mil = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n))
type Envio = { nome: string; estado: string; erro?: boolean }

function EnviarArquivos({ empresa, aoTerminar }: { empresa: string; aoTerminar: () => void }) {
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
      <button type="button" className="btn btn-contorno-ouro" onClick={() => entrada.current?.click()}><Icone nome="importar" tam={16} /> Enviar arquivos</button>
      <input ref={entrada} type="file" accept={ACEITOS} multiple hidden onChange={(e) => enviar(e.target.files)} />
      {envios.length > 0 && <ul className="bib-envios">{envios.map((e) => <li key={e.nome} className={e.erro ? 'erro' : ''}><b>{e.nome}</b> <span>{e.estado}</span></li>)}</ul>}
    </>
  )
}

function ColarTexto({ empresa, aoTerminar }: { empresa: string; aoTerminar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const guardar = async () => {
    if (!titulo.trim() || texto.trim().length < 40) return setErro('Dê um título e cole um texto de pelo menos algumas linhas.')
    setErro(null); setSalvando(true)
    try { await guardarTexto(empresa, titulo, 'texto', texto); setTitulo(''); setTexto(''); setAberto(false); aoTerminar() } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui guardar.') }
    setSalvando(false)
  }
  if (!aberto) return <button type="button" className="btn btn-contorno" onClick={() => setAberto(true)}><Icone nome="texto" tam={16} /> Colar texto</button>
  return (
    <div className="bib-colar">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ex.: Protocolo Mento de Diamante)" aria-label="Título do texto" />
      <textarea rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui o texto: trecho de apostila, roteiro de aula, explicação de técnica, respostas a dúvidas frequentes…" aria-label="Texto" />
      <div className="ia-linha">
        <button type="button" className="btn btn-contorno-ouro" disabled={salvando} onClick={guardar}>{salvando ? 'Guardando…' : 'Guardar na biblioteca'}</button>
        <button type="button" className="btn btn-mini" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}

function ItemFonte({ f, aoTirar }: { f: Fonte; aoTirar: () => void }) {
  return (
    <li className="bib-fonte">
      <Icone nome={ICONE[f.tipo] ?? 'arquivo'} tam={18} />
      <span className="bib-fonte-txt"><b>{f.titulo}</b>
        <small>{NOME_TIPO[f.tipo] ?? f.tipo} · {f.status === 'pronta' ? `${f.trechos} trechos · ${mil(f.caracteres)} caracteres` : f.status === 'erro' ? `Erro: ${f.erro ?? ''}` : 'Guardando…'} · {new Date(f.criado_em).toLocaleDateString('pt-BR')}</small></span>
      <button type="button" className="btn btn-mini" onClick={aoTirar} title="Tirar da biblioteca"><Icone nome="lixeira" tam={14} /> Tirar</button>
    </li>
  )
}

function TestarBusca({ empresa }: { empresa: string }) {
  const [consulta, setConsulta] = useState('')
  const [achados, setAchados] = useState<Achado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const procurar = async () => {
    if (!consulta.trim()) return
    setErro(null)
    try { setAchados(await buscar(empresa, consulta)) } catch (e) { setErro(e instanceof Error ? e.message : 'Falhou.') }
  }
  return (
    <div className="bib-busca">
      <div className="ia-linha">
        <input value={consulta} onChange={(e) => setConsulta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && procurar()} placeholder="Teste um tema (ex.: sorriso gengival, bioestimulador, lábios)" aria-label="Tema para testar a busca" />
        <button type="button" className="btn btn-contorno" onClick={procurar}><Icone nome="busca" tam={16} /> Testar busca</button>
      </div>
      {achados && (achados.length
        ? <ol className="bib-achados">{achados.map((a) => <li key={a.trecho_id}><small>{a.fonte_titulo}</small><p>{a.conteudo.slice(0, 360)}{a.conteudo.length > 360 ? '…' : ''}</p></li>)}</ol>
        : <p className="muted pequeno">Nada sobre isso na biblioteca ainda. O agente vai escrever só com o cadastro da marca.</p>)}
      <Erro msg={erro} />
    </div>
  )
}

export function BibliotecaMarca({ empresa }: { empresa: string }) {
  const fontes = useFontes(empresa)
  const lista = fontes.dados ?? []
  const prontas = lista.filter((f) => f.status === 'pronta')
  const total = prontas.reduce((s, f) => s + f.caracteres, 0)
  return (
    <div className="bib">
      <p className="muted pequeno">{prontas.length ? `${prontas.length} fonte(s) · ${prontas.reduce((s, f) => s + f.trechos, 0)} trechos · ${mil(total)} caracteres.` : 'A biblioteca está vazia.'} Antes de escrever cada peça, o agente procura aqui o que a marca ensina sobre o assunto e escreve com essas informações e palavras, sem inventar.</p>
      <div className="ia-linha"><EnviarArquivos empresa={empresa} aoTerminar={fontes.recarregar} /><ColarTexto empresa={empresa} aoTerminar={fontes.recarregar} /></div>
      <span className="muted pequeno">Aceita PDF (com texto selecionável), Word (.docx) e texto. Pode enviar vários de uma vez: apostilas, roteiros de aula, protocolos, perguntas frequentes.</span>
      {lista.length > 0 && <ul className="bib-fontes">{lista.map((f) => <ItemFonte key={f.id} f={f} aoTirar={async () => { await tirarFonte(f.id); fontes.recarregar() }} />)}</ul>}
      {prontas.length > 0 && <TestarBusca empresa={empresa} />}
      <Erro msg={fontes.erro} />
    </div>
  )
}
