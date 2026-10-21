// Cartão de um vídeo na entrada do Agente Editor: capa (foto do bruto), nome, campanha, origem, situação, destino e a
// data da última edição, com "Abrir no Estúdio".
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { edicaoDa } from '../marketing/edicao/dados'
import { destinoDa, ehAvulso } from '../marketing/peca/editor'

export type Situacao = 'aguardando' | 'em_edicao' | 'previa' | 'entregue'
export const NOME_SITUACAO: Record<Situacao, string> = { aguardando: 'Aguardando vídeo', em_edicao: 'Em edição', previa: 'Prévia pronta', entregue: 'Entregue' }
export function situacaoDe(p: Peca): Situacao {
  const e = edicaoDa(p.conteudo)
  if (e.concluida) return 'entregue'
  if (e.receitas?.length) return 'previa'
  if (e.arquivo || e.palavras?.length) return 'em_edicao'
  return 'aguardando'
}
export function origemDe(p: Peca) {
  if ((p.conteudo.briefing as { finalidade?: string } | undefined)?.finalidade === 'anuncio') return { id: 'anuncio', nome: 'Criativo de anúncio' }
  return ehAvulso(p) ? { id: 'avulso', nome: 'Vídeo avulso' } : { id: 'post', nome: 'Post planejado' }
}
const DESTINO = { trafego: 'Tráfego', avulso: 'Marketing', post: 'Marketing' }
const dia = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

export function CartaoVideo({ p, campanha }: { p: Peca; campanha?: string }) {
  const e = edicaoDa(p.conteudo)
  const s = situacaoDe(p), o = origemDe(p)
  const duracao = e.arquivo?.duracao
  return (
    <article className="ed-cartao">
      <Link to={`/agentes/editor/video/${p.id}`} className="ed-capa" aria-label={`Abrir ${p.titulo}`}>
        {e.capa ? <img src={`data:image/jpeg;base64,${e.capa}`} alt="" /> : <span className="ed-capa-vazia"><Icone nome="video" tam={26} /></span>}
        {duracao ? <span className="ed-duracao">{Math.floor(duracao / 60)}:{String(Math.round(duracao % 60)).padStart(2, '0')}</span> : null}
      </Link>
      <div className="ed-cartao-corpo">
        <h3>{p.titulo}</h3>
        <p className="muted pequeno">{campanha ?? (p.tipo === 'video' ? 'Vídeo longo' : 'Reels')}</p>
        <div className="ed-selos"><span className={`ed-selo origem-${o.id}`}>{o.nome}</span><span className={`ed-selo sit-${s}`}>{NOME_SITUACAO[s]}</span></div>
        <ul className="ed-dados muted pequeno">
          <li><Icone nome="enviar" tam={13} /> Destino: {DESTINO[destinoDa(p)]}</li>
          <li><Icone nome="agenda" tam={13} /> Última edição: {dia(e.atualizado_em ?? p.atualizado_em)}</li>
        </ul>
        <Link to={`/agentes/editor/video/${p.id}`} className="btn btn-contorno-ouro btn-mini">Abrir no Estúdio</Link>
      </div>
    </article>
  )
}
