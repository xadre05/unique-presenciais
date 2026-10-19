// Janela "Recriar este post": mostra o post e os números, a equipe diz o que manter e o que mudar, escolhe o formato
// e o dia; o agente cria a peça nova e começa a escrever. Ao terminar, abre a peça na Produção.
import { useState } from 'react'
import { Modal } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { FORMATO, FORMATOS } from '../marketing/formatos'
import { REDES } from '../marketing/redes'
import { NOME_TIPO, milhar, n, type PostIG } from './dados'
import { FORMATO_DO_POST, MANTER, recriarPost } from './recriar'

type Props = { post: PostIG | null; med: number; diaInicial?: string; campanha?: string; aoFechar: () => void; aoCriada: (pecaId: string) => void }
const FORMATOS_IG = FORMATOS.filter((f) => REDES.instagram.formatos.includes(f))

export function RecriarPost({ post, med, diaInicial = '', campanha, aoFechar, aoCriada }: Props) {
  const [mudar, setMudar] = useState('')
  const [manter, setManter] = useState<string[]>(['Gancho', 'Tema'])
  const [tipo, setTipo] = useState(post ? FORMATO_DO_POST[post.tipo] ?? 'post' : 'post')
  const [dia, setDia] = useState(diaInicial)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (!post) return null
  const alcance = n(post, 'alcance'), acima = med && alcance ? Math.round(((alcance - med) / med) * 100) : null
  const alternar = (m: string) => setManter((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]))
  const criar = async () => {
    setErro(null); setCriando(true)
    try { aoCriada(await recriarPost(post, med, { mudar, manter, tipo, dia, campanha })) } catch (e) { setErro((e as Error).message); setCriando(false) }
  }
  return (
    <Modal titulo="Recriar este post" aberto onFechar={aoFechar}>
      <div className="rc-post">
        {post.miniatura ? <img src={post.miniatura} alt="" /> : <span className="ig-sem-foto"><Icone nome="video" tam={18} /></span>}
        <div><b>{new Date(post.publicado_em).toLocaleDateString('pt-BR')} · {NOME_TIPO[post.tipo] ?? post.tipo}</b>
          <small className="muted">Alcance {milhar(alcance)}{acima !== null && ` (${acima >= 0 ? '+' : ''}${acima}% contra a mediana)`} · salvos {milhar(n(post, 'salvos'))} · compartilhamentos {milhar(n(post, 'compartilhamentos'))}</small>
          <p className="pequeno">{(post.legenda ?? '').replace(/\s+/g, ' ').slice(0, 220)}</p></div>
      </div>
      <h5 className="reu-subtitulo">O que manter</h5>
      <div className="ia-linha">{MANTER.map((m) => <button key={m} type="button" className={`mk-chip${manter.includes(m) ? ' ativo' : ''}`} onClick={() => alternar(m)}>{m}</button>)}</div>
      <label className="rc-campo"><span className="muted pequeno">O que mudar</span>
        <textarea rows={3} value={mudar} onChange={(e) => setMudar(e.target.value)} placeholder="Ex.: mesmo gancho, mas sobre lábios; ou atualizar os dados; ou trocar a chamada para a Black" /></label>
      <div className="rc-linha">
        <label><span className="muted pequeno">Formato</span><span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {FORMATOS_IG.map((f) => <option key={f} value={f}>{FORMATO[f].nome}</option>)}</select></span></label>
        <label><span className="muted pequeno">Dia (opcional)</span><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
      </div>
      {erro && <p className="erro-txt pequeno">{erro}</p>}
      <div className="ia-linha rc-acoes"><button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-ouro" disabled={criando} onClick={criar}><Icone nome="floco" tam={15} /> {criando ? 'Criando a peça…' : 'Criar a nova versão'}</button></div>
      <p className="muted pequeno">A peça nasce na Produção e o agente já começa a escrever (uns 20 segundos). Depois segue o caminho normal: revisão, aprovação e agenda.</p>
    </Modal>
  )
}
