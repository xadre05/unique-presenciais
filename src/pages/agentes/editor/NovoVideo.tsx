// "Editar um vídeo": a pessoa arrasta o vídeo gravado (qualquer tamanho: ele não sobe, fica no computador), confere o
// nome e a campanha e clica em Editar. Cria a peça de reels e abre a edição já com o vídeo escolhido. Gravou em partes?
// Arrasta todas juntas: o Estúdio abre com o agente colocando as partes na ordem.
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { criarVideo, type NovoVideo as Dados } from './dados'
import { deixarArquivo, deixarPartes, doArraste, escolherVarios, type Atalho } from './arquivoPendente'
import { ACEITOS, lerTexto } from '../biblioteca/lerArquivo'

const nomeDoArquivo = (f: File) => f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

export function NovoVideo({ campanhas }: { campanhas: { id: string; nome: string }[] }) {
  const ir = useNavigate()
  const entrada = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [partes, setPartes] = useState<File[]>([])
  const roteiroArquivo = useRef<HTMLInputElement>(null)
  const [atalho, setAtalho] = useState<Atalho | null>(null)
  const [d, setD] = useState<Dados>({ titulo: '', finalidade: 'anuncio', campanha: campanhas[0]?.id, roteiro: '' })
  const [comRoteiro, setComRoteiro] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const escolher = (f?: File | null, a: Atalho | null = null) => {
    if (!f) return
    setAtalho(a)
    if (!f.type.startsWith('video/')) return setErro('Escolha um arquivo de vídeo.')
    setErro(null); setArquivo(f); setD((x) => ({ ...x, titulo: x.titulo || nomeDoArquivo(f) }))
  }
  // várias partes de um vídeo só: a primeira dá o nome; o Estúdio junta
  const escolherTodos = (fs: File[]) => {
    const videos = fs.filter((f) => f.type.startsWith('video/'))
    if (videos.length < 2) return escolher(videos[0] ?? fs[0])
    setPartes(videos); escolher(videos[0])
  }
  // o seletor do sistema guarda o atalho para reabrir depois de recarregar; sem ele, o seletor comum
  const procurar = async () => {
    const v = await escolherVarios()
    if (v === null) return entrada.current?.click()
    if (v === 'cancelado' || !v.arquivos.length) return
    if (v.arquivos.length > 1) return escolherTodos(v.arquivos)
    escolher(v.arquivos[0], v.atalhos[0])
  }
  const subirRoteiro = async (f: File) => {
    try { setD((x) => ({ ...x, roteiro: '' })); const t = (await lerTexto(f)).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(); setD((x) => ({ ...x, roteiro: t })); setComRoteiro(true) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui ler o roteiro.') }
  }
  const criar = async () => {
    if (!arquivo) return
    setErro(null); setCriando(true)
    const r = await criarVideo(d)
    setCriando(false)
    if (r.erro || !r.id) return setErro(r.erro ?? 'Não consegui criar o vídeo.')
    if (partes.length > 1) deixarPartes(r.id, partes)
    else deixarArquivo(r.id, arquivo, atalho)
    ir(`/agentes/editor/video/${r.id}`)
  }

  if (!arquivo) return (
    <>
      <button type="button" className="ed-soltar" onClick={procurar}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files.length > 1) return escolherTodos([...e.dataTransfer.files])
          void doArraste(e.dataTransfer).then((r) => escolher(r.arquivo, r.atalho))
        }}>
        <span className="ed-soltar-ico"><Icone nome="video" tam={26} /></span>
        <b>Arraste um vídeo para editar</b>
        <span className="muted">ou escolha um arquivo neste computador. Pode ser de qualquer tamanho: ele não sobe para o sistema. Gravou em partes? Escolha todas de uma vez.</span>
        <span className="btn btn-ouro ed-selecionar"><Icone nome="importar" tam={15} /> Selecionar vídeo</span>
      </button>
      <input ref={entrada} type="file" accept="video/*" multiple hidden onChange={(e) => { escolherTodos([...(e.target.files ?? [])]); e.target.value = '' }} />
      <Erro msg={erro} />
    </>
  )
  return (
    <div className="ed-novo">
      <div className="ed-novo-arquivo"><Icone nome="video" tam={18} /> <b>{partes.length > 1 ? `${partes.length} partes para juntar` : arquivo.name}</b>
        <span className="muted pequeno">{partes.length > 1 ? partes.map((f) => f.name).join(', ') : `${(arquivo.size / 1024 / 1024).toFixed(0)} MB`}</span>
        <button type="button" className="btn btn-mini" onClick={() => { setArquivo(null); setPartes([]) }} disabled={criando}>Trocar</button></div>
      <div className="ed-novo-campos">
        <label className="campo"><span>Nome do vídeo</span><input value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} /></label>
        <label className="campo"><span>Para que é</span><span className="select-icone"><select value={d.finalidade} onChange={(e) => setD({ ...d, finalidade: e.target.value as Dados['finalidade'] })}>
          <option value="anuncio">Criativo de anúncio</option><option value="organico">Post no perfil</option></select></span></label>
        <label className="campo"><span>Campanha</span><span className="select-icone"><select value={d.campanha ?? ''} onChange={(e) => setD({ ...d, campanha: e.target.value || undefined })}>
          <option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span></label>
      </div>
      {comRoteiro ? (
        <label className="campo"><span>Roteiro gravado</span>
          <textarea rows={4} value={d.roteiro} onChange={(e) => setD({ ...d, roteiro: e.target.value })} placeholder="Cenas separadas por uma linha em branco." /></label>
      ) : (
        <p className="muted pequeno">{d.campanha ? 'O agente descobre sozinho qual roteiro da campanha foi gravado. ' : ''}
          <button type="button" className="link" onClick={() => setComRoteiro(true)}>Colar o roteiro</button> ou{' '}
          <button type="button" className="link" onClick={() => roteiroArquivo.current?.click()}>subir o roteiro (PDF ou Word)</button></p>
      )}
      <input ref={roteiroArquivo} type="file" accept={ACEITOS} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirRoteiro(f); e.target.value = '' }} />
      <div className="linha-acoes">
        <button type="button" className="btn btn-ouro" disabled={!d.titulo.trim() || criando} onClick={criar}><Icone nome="floco" tam={15} /> {criando ? 'Abrindo…' : 'Continuar para a edição'}</button>
        <button type="button" className="btn" disabled={criando} onClick={() => { setArquivo(null); setPartes([]); setErro(null) }}>Cancelar</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
