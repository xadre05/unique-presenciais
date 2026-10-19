// Seletores em painel do filtro de peças: Canais e Formatos. Funcionam como os filtros de planilha:
// tudo começa marcado, "Selecionar todos" no topo, desmarca o que não quer ver e clica em Aplicar.
// Sem nada marcado não há o que aplicar. Limpar volta tudo para marcado. Fecha ao clicar fora ou com Esc.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { FORMATOS, REDES, nomeFormato, nomeGenerico, useRedes, type Formato, type Rede } from './redes'
import { infoFormato } from './formatos'
import { LogoRede } from './LogoRede'
import type { FiltrosPecas } from './filtros'

type Props = { f: FiltrosPecas; mudar: (c: Partial<FiltrosPecas>) => void }
type Item = { id: string; nome: string; detalhe?: string; icone: ReactNode }

// lista com "Selecionar todos" e uma caixa por item; devolve só os marcados
function ListaMarcar({ itens, marcados, setMarcados, busca }: { itens: Item[]; marcados: string[]; setMarcados: (m: string[]) => void; busca: string }) {
  const visiveis = itens.filter((i) => i.nome.toLowerCase().includes(busca.trim().toLowerCase()))
  const todos = itens.length > 0 && marcados.length === itens.length
  const algum = marcados.length > 0 && !todos
  return (
    <div className="mk-pop-lista">
      {!busca.trim() && (
        <label className="mk-pop-item mk-pop-todos">
          <input type="checkbox" checked={todos} ref={(el) => { if (el) el.indeterminate = algum }} onChange={() => setMarcados(todos ? [] : itens.map((i) => i.id))} />
          <span>Selecionar todos</span>
        </label>
      )}
      {visiveis.map((i) => (
        <label key={i.id} className="mk-pop-item">
          <input type="checkbox" checked={marcados.includes(i.id)} onChange={() => setMarcados(marcados.includes(i.id) ? marcados.filter((x) => x !== i.id) : [...marcados, i.id])} />
          <span className="mk-pop-icone">{i.icone}</span>
          <span className="mk-pop-nome">{i.nome}{i.detalhe && <small className="muted">{i.detalhe}</small>}</span>
        </label>
      ))}
      {!visiveis.length && <span className="muted pequeno">Nada com esse nome.</span>}
    </div>
  )
}

function Painel({ rotulo, resumo, titulo, itens, escolhidos, aoAplicar, largura, alinhar = 'esquerda', rodape }: {
  rotulo: string; resumo: ReactNode; titulo: string; itens: Item[]; escolhidos: string[]; aoAplicar: (lista: string[]) => void
  largura: number; alinhar?: 'esquerda' | 'direita'; rodape?: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const [marcados, setMarcados] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  const abrir = () => { setMarcados(escolhidos.length ? escolhidos.filter((x) => itens.some((i) => i.id === x)) : itens.map((i) => i.id)); setBusca(''); setAberto(true) }
  // tudo marcado = sem filtro (guarda lista vazia)
  const aplicar = () => { aoAplicar(marcados.length === itens.length ? [] : marcados); setAberto(false) }
  return (
    <div className="mk-pf-campo mk-pop" ref={caixa}>
      <span>{rotulo}</span>
      <button type="button" className={`select-icone mk-pop-botao${aberto ? ' aberto' : ''}`} aria-expanded={aberto} onClick={() => (aberto ? setAberto(false) : abrir())}>
        <span className="mk-pop-resumo">{resumo}</span><Icone nome="seta" tam={14} />
      </button>
      {aberto && (
        <div className={`mk-pop-painel ${alinhar}`} style={{ width: largura }} role="dialog" aria-label={titulo}>
          <header><b>{titulo}</b></header>
          {itens.length > 10 && <label className="select-icone mk-pop-busca"><Icone nome="busca" tam={16} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" autoFocus /></label>}
          <ListaMarcar itens={itens} marcados={marcados} setMarcados={setMarcados} busca={busca} />
          {rodape}
          <footer>
            <button type="button" className="link" onClick={() => setMarcados(itens.map((i) => i.id))}>Limpar</button>
            <span className="muted pequeno">{marcados.length} de {itens.length}</span>
            <button type="button" className="btn btn-ouro" disabled={!marcados.length} title={marcados.length ? '' : 'Marque pelo menos um'} onClick={aplicar}>Aplicar</button>
          </footer>
        </div>
      )}
    </div>
  )
}

export function SeletorCanais({ f, mudar }: Props) {
  const ativas = useRedes()
  const itens: Item[] = ativas.map((r) => ({ id: r, nome: REDES[r].nome, icone: <LogoRede rede={r} tam={20} /> }))
  const aplicar = (lista: string[]) => {
    const canais = lista as Rede[]
    // formato que nenhum canal escolhido tem sai do filtro
    const validos = f.formatos.filter((k) => (canais.length ? canais : ativas).some((r) => REDES[r].formatos.includes(k as Formato)))
    mudar({ canais, formatos: validos })
  }
  const resumo = !f.canais.length ? 'Todos'
    : <span className="mk-logos">{f.canais.slice(0, 3).map((c) => <LogoRede key={c} rede={c} />)}{f.canais.length === 1 ? REDES[f.canais[0]].nome : `${f.canais.length} canais`}</span>
  return <Painel rotulo="Canais" resumo={resumo} titulo="Canais" itens={itens} escolhidos={f.canais} aoAplicar={aplicar} largura={260}
    rodape={<Link to="/agentes/marca?aba=canais" className="mk-multi-rodape"><Icone nome="mais" tam={14} /> Ligar outros canais</Link>} />
}

// formatos que existem nos canais em foco; com um canal só, o nome que ele usa (Reels, Shorts…),
// com vários, o nome geral e embaixo em quais canais existe
export function SeletorFormatos({ f, mudar }: Props) {
  const ativas = useRedes()
  const canais = f.canais.length ? f.canais : ativas
  const itens: Item[] = FORMATOS.filter((k) => canais.some((r) => REDES[r].formatos.includes(k))).map((k) => {
    const onde = canais.filter((r) => REDES[r].formatos.includes(k))
    return {
      id: k, icone: <span style={{ color: infoFormato(k).cor }}><Icone nome={infoFormato(k).icone} tam={18} /></span>,
      nome: canais.length === 1 ? nomeFormato(k, canais[0]) : nomeGenerico(k),
      detalhe: canais.length > 1 ? onde.map((r) => REDES[r].nome).join(' · ') : undefined,
    }
  })
  const nome = (k: string) => (canais.length === 1 ? nomeFormato(k, canais[0]) : nomeGenerico(k))
  const resumo = !f.formatos.length ? 'Todos' : f.formatos.length === 1 ? nome(f.formatos[0]) : `${f.formatos.length} formatos`
  return <Painel rotulo="Formatos" resumo={resumo} titulo="Formatos" itens={itens} escolhidos={f.formatos} aoAplicar={(lista) => mudar({ formatos: lista })} largura={300} alinhar="direita" />
}
