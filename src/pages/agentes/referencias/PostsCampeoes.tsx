// Os posts do Instagram da marca que mais deram resultado em toda a história (orgânico, não só anúncio). Um clique em
// "Ensinar" e o agente busca o post no Instagram, ouve a fala do reels e aprende o roteiro; dá para ensinar os 10
// primeiros de uma vez. Precisa do Instagram conectado (Resultados).
import { useMemo, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { NOME_TIPO, usePostsInstagram } from '../instagram/dados'
import type { Referencia } from './dados'
import { CRITERIOS, estudarPost, rankingPosts, type Criterio, type PostRanking } from './rankingPosts'

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const LOTE = 10

type Props = { empresa: string; referencias: Referencia[]; aoMudou: () => void }

export function PostsCampeoes({ empresa, referencias, aoMudou }: Props) {
  const posts = usePostsInstagram(empresa)
  const [criterio, setCriterio] = useState<Criterio>('alcance')
  const [tipo, setTipo] = useState('reels')
  const [estudando, setEstudando] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const lista = useMemo(() => rankingPosts(posts.dados ?? [], criterio, tipo), [posts.dados, criterio, tipo])
  const ensinado = (r: PostRanking) => referencias.find((x) => x.categoria === 'nosso' && x.link && x.link === r.post.link)
  const ocupado = Object.values(estudando).some((v) => v === 'estudando')

  const ensinar = async (itens: PostRanking[]) => {
    setErro(null)
    for (const r of itens) {
      setEstudando((e) => ({ ...e, [r.post.id]: 'estudando' }))
      try { await estudarPost(empresa, r); setEstudando((e) => ({ ...e, [r.post.id]: 'ok' })) } catch (x) { setEstudando((e) => ({ ...e, [r.post.id]: 'erro' })); setErro((x as Error).message) }
      aoMudou()
    }
  }
  const faltam = lista.filter((r) => !ensinado(r)).slice(0, LOTE)

  if (posts.carregando && !posts.dados) return <p className="muted pequeno">Carregando os posts…</p>
  if (!posts.dados?.length) return <p className="muted pequeno">Conecte o Instagram em Agente de Marketing → Resultados para ver os posts.</p>
  return (
    <>
      <div className="ia-linha">
        <span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Formato">
          <option value="todos">Todos os formatos</option>{['reels', 'carrossel', 'imagem'].map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}</select></span>
        <span className="select-icone"><select value={criterio} onChange={(e) => setCriterio(e.target.value as Criterio)} aria-label="Medir por">
          {CRITERIOS.map((c) => <option key={c.id} value={c.id}>Mais {c.nome.toLowerCase()}</option>)}</select></span>
        {faltam.length > 0 && <button type="button" className="btn btn-ouro btn-mini" disabled={ocupado} onClick={() => ensinar(faltam)}><Icone nome="floco" tam={13} /> Ensinar os {faltam.length} primeiros</button>}
        <span className="muted pequeno">Cerca de R$ 0,30 por post.</span>
      </div>
      <Erro msg={erro} />
      <ul className="vend-lista">
        {lista.map((r, i) => {
          const ref = ensinado(r), st = estudando[r.post.id]
          return (
            <li key={r.post.id} className="vend-item">
              <div className="vend-linha vend-post">
                <span className="vend-pos">{i + 1}</span>
                {r.post.miniatura ? <img className="vend-mini" src={r.post.miniatura} alt="" loading="lazy" /> : <span className="vend-mini" />}
                <span className="vend-nome"><b>{(r.post.legenda ?? '').replace(/\s+/g, ' ').slice(0, 90) || NOME_TIPO[r.post.tipo]}</b>
                  <small className="muted">{NOME_TIPO[r.post.tipo] ?? r.post.tipo} · {dia(r.post.publicado_em)} · {r.comparacao}</small></span>
                {r.post.link && <a className="btn btn-mini" href={r.post.link} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram"><Icone nome="globo" tam={13} /></a>}
                {st === 'estudando' ? <span className="badge badge-info">Estudando…</span>
                  : ref?.status === 'pronta' || st === 'ok' ? <span className="badge badge-ok">Ensinado</span>
                  : <button type="button" className="btn btn-contorno-ouro btn-mini" disabled={ocupado} onClick={() => ensinar([r])}>{st === 'erro' || ref?.status === 'erro' ? 'Tentar de novo' : 'Ensinar'}</button>}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
