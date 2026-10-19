// Lista dos posts do Instagram no filtro: miniatura, data, formato, quem fez (agente ou fora, clicável para corrigir),
// métricas comparadas com a mediana, link para abrir e "Recriar" (nova versão de um post que deu resultado).
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { NOME_TIPO, marcarOrigem, milhar, n, origemDe, type PostIG } from './dados'

type Ordem = 'recentes' | 'alcance' | 'salvos'
type Props = { posts: PostIG[]; med: number; aoMudar: () => void; aoRecriar: (p: PostIG) => void }

function EtiquetaOrigem({ post, aoMudar }: { post: PostIG; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const origem = origemDe(post)
  const trocar = async () => { setOcupado(true); try { await marcarOrigem(post.id, origem === 'agente' ? 'fora' : 'agente'); aoMudar() } finally { setOcupado(false) } }
  return (
    <button type="button" className={`ig-origem ${origem}`} disabled={ocupado} onClick={trocar}
      title={`${origem === 'agente' ? (post.peca_id ? 'Ligado à peça do agente' : 'Marcado como feito pelo agente') : 'Feito fora do agente'}. Clique para trocar.`}>
      {origem === 'agente' ? 'Agente' : 'Fora'}
    </button>
  )
}

export function ListaPosts({ posts, med, aoMudar, aoRecriar }: Props) {
  const [ordem, setOrdem] = useState<Ordem>('recentes')
  const lista = [...posts].sort((a, b) => (ordem === 'alcance' ? n(b, 'alcance') - n(a, 'alcance') : ordem === 'salvos' ? n(b, 'salvos') - n(a, 'salvos') : b.publicado_em.localeCompare(a.publicado_em)))
  const comparar = (v: number) => (med && v ? Math.round(((v - med) / med) * 100) : null)
  return (
    <>
      <div className="ia-linha"><span className="muted pequeno">Ordenar por</span>
        {(['recentes', 'alcance', 'salvos'] as Ordem[]).map((o) => <button key={o} type="button" className={`mk-chip${ordem === o ? ' ativo' : ''}`} onClick={() => setOrdem(o)}>{o === 'recentes' ? 'Mais recentes' : o === 'alcance' ? 'Maior alcance' : 'Mais salvos'}</button>)}</div>
      <div className="ig-lista">
        <table className="tabela ig-tabela">
          <thead><tr><th>Post</th><th>Quem fez</th><th>Alcance</th><th>Curtidas</th><th>Coment.</th><th>Salvos</th><th>Compart.</th><th /></tr></thead>
          <tbody>{lista.map((p) => { const dif = comparar(n(p, 'alcance')); return (
            <tr key={p.id}>
              <td className="ig-post">{p.miniatura ? <img src={p.miniatura} alt="" loading="lazy" /> : <span className="ig-sem-foto"><Icone nome="video" tam={16} /></span>}
                <span><b>{new Date(p.publicado_em).toLocaleDateString('pt-BR')} · {NOME_TIPO[p.tipo] ?? p.tipo}</b><small>{(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 110)}</small></span></td>
              <td><EtiquetaOrigem post={p} aoMudar={aoMudar} /></td>
              <td>{milhar(n(p, 'alcance'))}{dif !== null && <small className={dif >= 0 ? 'ig-acima' : 'ig-abaixo'}>{dif >= 0 ? '+' : ''}{dif}%</small>}</td>
              <td>{milhar(n(p, 'curtidas'))}</td><td>{milhar(n(p, 'comentarios'))}</td><td>{milhar(n(p, 'salvos'))}</td><td>{milhar(n(p, 'compartilhamentos'))}</td>
              <td className="ig-acoes-post">{p.link && <a href={p.link} target="_blank" rel="noreferrer" className="btn btn-mini">Abrir</a>}
                <button type="button" className="btn btn-mini btn-contorno-ouro" onClick={() => aoRecriar(p)}><Icone nome="trocar" tam={13} /> Recriar</button></td>
            </tr>) })}</tbody>
        </table>
      </div>
    </>
  )
}
