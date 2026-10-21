// "Editar um vídeo": a pessoa arrasta o vídeo gravado (qualquer tamanho: ele não sobe, fica no computador), confere o
// nome e a campanha e clica em Editar. Cria a peça de reels e abre a edição já com o vídeo escolhido.
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { criarVideo, type NovoVideo as Dados } from './dados'
import { deixarArquivo } from './arquivoPendente'

const nomeDoArquivo = (f: File) => f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

export function NovoVideo({ campanhas }: { campanhas: { id: string; nome: string }[] }) {
  const ir = useNavigate()
  const entrada = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [d, setD] = useState<Dados>({ titulo: '', finalidade: 'anuncio', campanha: campanhas[0]?.id, roteiro: '' })
  const [comRoteiro, setComRoteiro] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const escolher = (f?: File | null) => {
    if (!f) return
    if (!f.type.startsWith('video/')) return setErro('Escolha um arquivo de vídeo.')
    setErro(null); setArquivo(f); setD((x) => ({ ...x, titulo: x.titulo || nomeDoArquivo(f) }))
  }
  const criar = async () => {
    if (!arquivo) return
    setErro(null); setCriando(true)
    const r = await criarVideo(d)
    setCriando(false)
    if (r.erro || !r.id) return setErro(r.erro ?? 'Não consegui criar o vídeo.')
    deixarArquivo(r.id, arquivo)
    ir(`/agentes/marketing?peca=${r.id}&edicao=1`)
  }

  if (!arquivo) return (
    <>
      <button type="button" className="ed-soltar" onClick={() => entrada.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files[0]) }}>
        <span className="ed-soltar-ico"><Icone nome="video" tam={26} /></span>
        <b>Editar um vídeo</b>
        <span className="muted">Arraste aqui o vídeo gravado, ou clique para escolher. Pode ser de qualquer tamanho: ele não sobe para o sistema, fica no seu computador.</span>
      </button>
      <input ref={entrada} type="file" accept="video/*" hidden onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = '' }} />
      <Erro msg={erro} />
    </>
  )
  return (
    <div className="ed-novo">
      <div className="ed-novo-arquivo"><Icone nome="video" tam={18} /> <b>{arquivo.name}</b> <span className="muted pequeno">{(arquivo.size / 1024 / 1024).toFixed(0)} MB</span>
        <button type="button" className="btn btn-mini" onClick={() => setArquivo(null)} disabled={criando}>Trocar</button></div>
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
          <button type="button" className="link" onClick={() => setComRoteiro(true)}>Colar o roteiro</button></p>
      )}
      <div className="linha-acoes">
        <button type="button" className="btn btn-ouro" disabled={!d.titulo.trim() || criando} onClick={criar}><Icone nome="floco" tam={15} /> {criando ? 'Abrindo…' : 'Continuar para a edição'}</button>
        <button type="button" className="btn" disabled={criando} onClick={() => { setArquivo(null); setErro(null) }}>Cancelar</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
