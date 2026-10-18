// Seletores em painel do filtro de peças: Canais (vários, com busca) e Formatos (tipo de conteúdo + duração do vídeo).
// A escolha só vale ao clicar em Aplicar; Limpar volta para "todos". O painel fecha ao clicar fora ou com Esc.
// A orientação não é um filtro separado: vídeo curto é vertical e vídeo longo é horizontal.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { REDES, useRedes, type Formato, type Rede } from './redes'
import { LogoRede } from './LogoRede'
import type { FiltrosPecas } from './filtros'

type Props = { f: FiltrosPecas; mudar: (c: Partial<FiltrosPecas>) => void }

function Painel({ rotulo, resumo, titulo, sub, largura, alinhar = 'esquerda', aoAbrir, aoLimpar, aoAplicar, children }: {
  rotulo: string; resumo: ReactNode; titulo: string; sub: string; largura: number; alinhar?: 'esquerda' | 'direita'
  aoAbrir: () => void; aoLimpar: () => void; aoAplicar: () => void; children: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  return (
    <div className="mk-pf-campo mk-pop" ref={caixa}>
      <span>{rotulo}</span>
      <button type="button" className={`select-icone mk-pop-botao${aberto ? ' aberto' : ''}`} aria-expanded={aberto} onClick={() => { if (!aberto) aoAbrir(); setAberto(!aberto) }}>
        <span className="mk-pop-resumo">{resumo}</span><Icone nome="seta" tam={14} />
      </button>
      {aberto && (
        <div className={`mk-pop-painel ${alinhar}`} style={{ width: largura }} role="dialog" aria-label={titulo}>
          <header><b>{titulo}</b><span className="muted pequeno">{sub}</span></header>
          {children}
          <footer>
            <button type="button" className="link" onClick={aoLimpar}>Limpar</button>
            <button type="button" className="btn btn-ouro" onClick={() => { aoAplicar(); setAberto(false) }}>Aplicar</button>
          </footer>
        </div>
      )}
    </div>
  )
}

export function SeletorCanais({ f, mudar }: Props) {
  const ativas = useRedes()
  const [marcados, setMarcados] = useState<Rede[]>([])
  const [busca, setBusca] = useState('')
  const lista = ativas.filter((r) => REDES[r].nome.toLowerCase().includes(busca.trim().toLowerCase()))
  const alternar = (r: Rede) => setMarcados((m) => (m.includes(r) ? m.filter((x) => x !== r) : [...m, r]))
  const aplicar = () => {
    const canais = marcados.length === ativas.length ? [] : marcados
    // formato que nenhum canal escolhido tem sai do filtro
    const validos = f.formatos.filter((k) => (canais.length ? canais : ativas).some((r) => REDES[r].formatos.includes(k as Formato)))
    mudar({ canais, formatos: validos })
  }
  const resumo = !f.canais.length ? 'Todos'
    : <span className="mk-logos">{f.canais.slice(0, 3).map((c) => <LogoRede key={c} rede={c} />)}{f.canais.length === 1 ? REDES[f.canais[0]].nome : `${f.canais.length} canais`}</span>
  return (
    <Painel rotulo="Canais" resumo={resumo} titulo="Canais" sub="Selecione um ou mais canais" largura={260}
      aoAbrir={() => { setMarcados(f.canais.length ? f.canais : []); setBusca('') }} aoLimpar={() => setMarcados([])} aoAplicar={aplicar}>
      {ativas.length > 5 && <label className="select-icone mk-pop-busca"><Icone nome="busca" tam={16} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar canal…" autoFocus /></label>}
      <div className="mk-pop-lista">
        {lista.map((r) => (
          <label key={r} className="mk-pop-canal"><LogoRede rede={r} tam={20} /><span>{REDES[r].nome}</span><input type="checkbox" checked={marcados.includes(r)} onChange={() => alternar(r)} /></label>
        ))}
        {!lista.length && <span className="muted pequeno">Nenhum canal com esse nome.</span>}
      </div>
      <p className="muted pequeno">Nenhum marcado = todos os canais.</p>
      <Link to="/agentes/marca" className="mk-multi-rodape"><Icone nome="mais" tam={14} /> Ligar outros canais</Link>
    </Painel>
  )
}

type Tipo = { id: string; nome: string; icone: string; formatos: Formato[] }
const TIPOS: Tipo[] = [
  { id: 'imagem', nome: 'Imagem', icone: 'imagem', formatos: ['post'] },
  { id: 'carrossel', nome: 'Carrossel', icone: 'quadro', formatos: ['carrossel'] },
  { id: 'video', nome: 'Vídeo', icone: 'video', formatos: ['reels', 'video'] },
  { id: 'stories', nome: 'Stories', icone: 'celular', formatos: ['stories'] },
  { id: 'live', nome: 'Live', icone: 'live', formatos: ['live'] },
  { id: 'texto', nome: 'Texto / enquete', icone: 'texto', formatos: ['texto'] },
  { id: 'artigo', nome: 'Artigo', icone: 'documento', formatos: ['artigo'] },
  { id: 'email', nome: 'E-mail', icone: 'email', formatos: ['email'] },
  { id: 'mensagem', nome: 'Mensagem', icone: 'mensagem', formatos: ['mensagem'] },
  { id: 'pdf', nome: 'Material PDF', icone: 'pdf', formatos: ['pdf'] },
]
type Duracao = 'qualquer' | 'curto' | 'longo'
const DURACAO: Record<Duracao, string> = { qualquer: 'Qualquer', curto: 'Curto · vertical', longo: 'Longo · horizontal' }

export function SeletorFormatos({ f, mudar }: Props) {
  const ativas = useRedes()
  const canais = f.canais.length ? f.canais : ativas
  const existe = (k: Formato) => canais.some((r) => REDES[r].formatos.includes(k))
  const disponiveis = TIPOS.filter((t) => t.formatos.some(existe))
  const [tipos, setTipos] = useState<string[]>([])
  const [duracao, setDuracao] = useState<Duracao>('qualquer')
  const comVideo = tipos.includes('video')

  const daSelecao = (lista: string[]) => {
    const t = TIPOS.filter((x) => x.formatos.some((k) => lista.includes(k))).map((x) => x.id)
    const d: Duracao = lista.includes('reels') && !lista.includes('video') ? 'curto' : lista.includes('video') && !lista.includes('reels') ? 'longo' : 'qualquer'
    return { t, d }
  }
  const formatosDe = (t: string[], d: Duracao) => TIPOS.filter((x) => t.includes(x.id)).flatMap((x) =>
    x.id === 'video' && d !== 'qualquer' ? [d === 'curto' ? 'reels' : 'video'] : x.formatos).filter((k) => existe(k as Formato))
  const atual = daSelecao(f.formatos)
  const nomeTipo = (id: string, d: Duracao) => { const n = TIPOS.find((x) => x.id === id)?.nome ?? id; return id === 'video' && d !== 'qualquer' ? `${n} ${d}` : n }
  const resumo = !f.formatos.length ? 'Todos' : atual.t.length === 1 ? nomeTipo(atual.t[0], atual.d) : `${atual.t.length} tipos`
  const frase = tipos.length ? tipos.map((id) => nomeTipo(id, duracao)).join(' · ') : 'Todos os formatos'
  return (
    <Painel rotulo="Formatos" resumo={resumo} titulo="Filtrar formatos" sub="Combine o tipo de conteúdo e, no vídeo, a duração." largura={400} alinhar="direita"
      aoAbrir={() => { setTipos(atual.t); setDuracao(atual.d) }} aoLimpar={() => { setTipos([]); setDuracao('qualquer') }} aoAplicar={() => mudar({ formatos: formatosDe(tipos, duracao) })}>
      <span className="mk-pop-secao">Tipo de conteúdo</span>
      <div className="mk-pop-chips">
        {disponiveis.map((t) => {
          const sel = tipos.includes(t.id)
          return <button key={t.id} type="button" className={`mk-pop-chip${sel ? ' ativo' : ''}`} aria-pressed={sel} onClick={() => setTipos((x) => (sel ? x.filter((y) => y !== t.id) : [...x, t.id]))}>
            <Icone nome={t.icone} tam={16} />{t.nome}{sel && <Icone nome="check" tam={14} />}</button>
        })}
      </div>
      {comVideo && existe('reels') && existe('video') && (<>
        <span className="mk-pop-secao">Duração do vídeo</span>
        <div className="mk-pop-chips tres">
          {(Object.keys(DURACAO) as Duracao[]).map((d) => <button key={d} type="button" className={`mk-pop-chip${duracao === d ? ' ativo' : ''}`} aria-pressed={duracao === d} onClick={() => setDuracao(d)}>{DURACAO[d]}{duracao === d && <Icone nome="check" tam={14} />}</button>)}
        </div>
        <p className="muted pequeno">Curto: Reels, Shorts, TikTok. Longo: vídeo do YouTube.</p>
      </>)}
      <div className="mk-pop-frase"><b>{frase}</b><span className="muted pequeno">{tipos.length > 1 ? 'Mostra peças de qualquer um desses tipos.' : tipos.length ? 'Mostra só peças deste tipo.' : 'Nenhum marcado = todos os formatos.'}</span></div>
    </Painel>
  )
}
