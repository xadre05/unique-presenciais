// Cartão de um vídeo na entrada do Agente Editor: capa (foto do bruto), nome, campanha, origem, situação, destino e a
// data da última edição, com "Abrir no Estúdio".
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { useState } from 'react'
import { edicaoDa, guardarEdicao } from '../marketing/edicao/dados'
import { destinoDa, ehAvulso } from '../marketing/peca/editor'

export type Situacao = 'aguardando' | 'em_edicao' | 'previa' | 'entregue' | 'arquivado'
// "Edição pronta" (e não "prévia pronta"): a prévia só aparece depois de abrir o vídeo de novo neste computador
export const NOME_SITUACAO: Record<Situacao, string> = { aguardando: 'Aguardando vídeo', em_edicao: 'Em edição', previa: 'Edição pronta', entregue: 'Entregue', arquivado: 'Fora da lista' }
export function situacaoDe(p: Peca): Situacao {
  const e = edicaoDa(p.conteudo)
  if (e.arquivada) return 'arquivado'
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

export function CartaoVideo({ p, campanha, aoMudar }: { p: Peca; campanha?: string; aoMudar: () => void }) {
  const [tirar, setTirar] = useState(false)
  const [mudando, setMudando] = useState(false)
  const mudar = async (arquivada: string | undefined) => {
    setMudando(true)
    try { await guardarEdicao(p.id, (x) => ({ ...x, arquivada })); setTirar(false); aoMudar() } finally { setMudando(false) }
  }
  const e = edicaoDa(p.conteudo)
  const s = situacaoDe(p), o = origemDe(p)
  const duracao = e.arquivo?.duracao
  return (
    <article className={`ed-cartao${s === 'arquivado' ? ' arquivado' : ''}`}>
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
        {/* tirar da lista não apaga nada: o vídeo some daqui e volta pelo filtro "Fora da lista" */}
        <div className="ed-cartao-acoes">
          <Link to={`/agentes/editor/video/${p.id}`} className="btn btn-contorno-ouro btn-mini">Abrir no Estúdio</Link>
          {s === 'arquivado'
            ? <button type="button" className="btn btn-contorno btn-mini" disabled={mudando} onClick={() => void mudar(undefined)}>Voltar para a lista</button>
            : <button type="button" className="ed-tirar" title="Tirar da lista" aria-label="Tirar da lista" onClick={() => setTirar(true)}><Icone nome="lixeira" tam={16} /></button>}
        </div>
      </div>
      {tirar && (
        <div className="ed-confirma" role="alertdialog" aria-label="Tirar da lista">
          <span className="ed-confirma-icone"><Icone nome="lixeira" tam={20} /></span>
          <b>Tirar este vídeo da lista?</b>
          <p className="pequeno">Nada é apagado: a edição e as imagens continuam guardadas. Para ver de novo, use o filtro <b>Fora da lista</b>.</p>
          <div className="ed-confirma-botoes">
            <button type="button" className="btn btn-contorno btn-mini" disabled={mudando} onClick={() => setTirar(false)}>Cancelar</button>
            <button type="button" className="btn btn-perigo-cheio btn-mini" disabled={mudando} onClick={() => void mudar(new Date().toISOString())}>{mudando ? 'Tirando…' : 'Tirar da lista'}</button>
          </div>
        </div>
      )}
    </article>
  )
}
