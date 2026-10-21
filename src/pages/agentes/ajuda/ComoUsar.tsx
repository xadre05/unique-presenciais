// Página "Como usar" da área de Agentes: os guias por grupo, com busca. Cada guia abre com o passo a passo e um botão
// que leva direto à tela. O "?" de cada tela chega aqui com #id do guia, que já vem aberto e rolado até ele.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { Voltar } from '../../../components/Voltar'
import { GUIAS, type Guia } from './guias'

const GRUPOS: Guia['grupo'][] = ['Começo', 'Criar conteúdo', 'Vídeo', 'Ensinar os agentes', 'Outros']
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function CartaoGuia({ g, aberto, aoAbrir }: { g: Guia; aberto: boolean; aoAbrir: () => void }) {
  return (
    <li id={g.id} className={`cu-guia${aberto ? ' aberto' : ''}`}>
      <button type="button" className="cu-cabeca" aria-expanded={aberto} onClick={aoAbrir}>
        <span><b>{g.titulo}</b><small className="muted">{g.para}</small></span>
        <span className="cu-sinal"><Icone nome="mais" tam={16} /></span>
      </button>
      {aberto && (
        <div className="cu-corpo">
          <p className="pequeno"><b>Onde:</b> {g.onde.texto} <Link to={g.onde.link} className="btn btn-contorno-ouro btn-mini">Abrir esta tela</Link></p>
          <ol className="cu-passos">{g.passos.map((p) => <li key={p}>{p}</li>)}</ol>
          {g.dicas?.map((d) => <p key={d} className="cu-dica pequeno"><Icone nome="info" tam={14} /> {d}</p>)}
          {g.custo && <p className="muted pequeno"><b>Custo:</b> {g.custo}</p>}
        </div>
      )}
    </li>
  )
}

export default function ComoUsar() {
  const { hash } = useLocation()
  const [aberto, setAberto] = useState<string | null>(hash.slice(1) || null)
  const [busca, setBusca] = useState('')
  useEffect(() => {
    const id = hash.slice(1)
    if (!id) return
    setAberto(id)
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }, [hash])
  const lista = useMemo(() => {
    const b = semAcento(busca.trim())
    return b ? GUIAS.filter((g) => semAcento([g.titulo, g.para, ...g.passos].join(' ')).includes(b)) : GUIAS
  }, [busca])

  return (
    <div className="pagina">
      <div className="migalha"><Voltar para="/agentes" texto="Sala dos agentes" /></div>
      <header className="cu-topo">
        <h1>Como usar</h1>
        <p className="muted">Um guia curto para cada tarefa, com o caminho até a tela. Em cada tela, o botão <Icone nome="ajuda" tam={14} /> abre o guia dela.</p>
        <input className="cu-busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar (ex.: vídeo, canal, campanha)" aria-label="Procurar guia" />
      </header>
      {!lista.length && <p className="muted">Nenhum guia com esse termo.</p>}
      {GRUPOS.map((grupo) => {
        const doGrupo = lista.filter((g) => g.grupo === grupo)
        if (!doGrupo.length) return null
        return (
          <section key={grupo} className="bloco">
            <h2>{grupo}</h2>
            <ul className="cu-lista">{doGrupo.map((g) => <CartaoGuia key={g.id} g={g} aberto={aberto === g.id || !!busca.trim()} aoAbrir={() => setAberto(aberto === g.id ? null : g.id)} />)}</ul>
          </section>
        )
      })}
    </div>
  )
}
