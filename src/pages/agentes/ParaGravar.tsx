// "Para gravar": a lista de quem grava (pensada para o celular). Cada vídeo planejado, com o prazo para chegar, o
// roteiro e as orientações; depois de gravar, "Enviar o vídeo" sobe o arquivo e a peça cai na fila do Editor.
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { useAuth } from '../../auth'
import { Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import type { Peca } from './comum'
import { EMPRESA } from './marketing/useMarketing'
import { atrasado, brutoDe, dm, fluxoDe, passoDe, prazoGravacao, type Fluxo } from './marketing/fluxo'
import { enviarBruto } from './marketing/edicao/brutoNuvem'
import { BotaoAjuda } from './ajuda/BotaoAjuda'

const cenasDe = (p: Peca) => (p.conteudo.roteiro ?? []).map((s) => { const q = s.indexOf('\n'); return q < 0 ? { titulo: '', texto: s } : { titulo: s.slice(0, q), texto: s.slice(q + 1) } })

function Cartao({ p, f, aoMudar }: { p: Peca; f: Fluxo; aoMudar: () => void }) {
  const { perfil } = useAuth()
  const entrada = useRef<HTMLInputElement>(null)
  const [aberto, setAberto] = useState(false)
  const [progresso, setProgresso] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const prazo = prazoGravacao(p, f)
  const tarde = atrasado(p, f)
  const enviado = passoDe(p) !== 'gravar'
  const enviar = async (arquivo?: File) => {
    if (!arquivo) return
    setErro(null); setProgresso(0)
    try { await enviarBruto(p.id, arquivo, setProgresso, perfil?.nome); aoMudar() } catch (e) { setErro((e as Error).message) } finally { setProgresso(null) }
  }
  const cenas = cenasDe(p)
  return (
    <article className={`pg-cartao${tarde ? ' atrasado' : ''}${enviado ? ' enviado' : ''}`}>
      <header>
        <span className="pg-tipo">{p.tipo === 'video' ? 'Vídeo' : 'Reels'}</span>
        {enviado ? <span className="pg-prazo ok"><Icone nome="check" tam={13} /> Enviado · na edição</span>
          : prazo && <span className={`pg-prazo${tarde ? ' tarde' : ''}`}><Icone nome="relogio" tam={13} /> {tarde ? `Atrasado · era até ${dm(prazo)}` : `Enviar até ${dm(prazo)}`}</span>}
      </header>
      <h3>{p.titulo}</h3>
      {p.dia && <p className="muted pequeno">Post em {dm(p.dia)}{p.conteudo.objetivo ? ` · ${p.conteudo.objetivo}` : ''}</p>}
      {!enviado && (<>
        <button type="button" className="link pequeno" onClick={() => setAberto(!aberto)}>{aberto ? 'Esconder o roteiro' : `Ver o roteiro${cenas.length ? ` (${cenas.length} cenas)` : ''}`}</button>
        {aberto && (
          <div className="pg-roteiro">
            {p.conteudo.observacao && <p className="pg-orienta"><Icone nome="video" tam={14} /> {p.conteudo.observacao}</p>}
            <ol>{cenas.map((c, k) => <li key={k}>{c.titulo && <b>{c.titulo}</b>}<span>{c.texto}</span></li>)}</ol>
            {!cenas.length && <p className="muted pequeno">Sem roteiro escrito: fale sobre o tema do título.</p>}
          </div>
        )}
        {progresso != null ? (
          <div className="pg-envio"><i style={{ width: `${Math.round(progresso * 100)}%` }} /><span>Enviando… {Math.round(progresso * 100)}%</span></div>
        ) : (
          <button type="button" className="btn btn-ouro pg-enviar" onClick={() => entrada.current?.click()}><Icone nome="enviar" tam={16} /> Enviar o vídeo gravado</button>
        )}
        <input ref={entrada} type="file" accept="video/*" hidden onChange={(e) => { void enviar(e.target.files?.[0]); e.target.value = '' }} />
        {erro && <p className="erro-txt pequeno">{erro}</p>}
      </>)}
      {enviado && <Link to={`/agentes/editor/video/${p.id}`} className="link pequeno">Abrir no Estúdio ›</Link>}
    </article>
  )
}

export default function ParaGravar() {
  const pecas = useConsulta<Peca[]>(() => supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').in('tipo', ['reels', 'video']).eq('status', 'rascunho').order('dia'))
  const perfil = useConsulta<{ perfil: Record<string, unknown> } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').maybeSingle())
  const f = fluxoDe(perfil.dados?.perfil)
  const todas = pecas.dados ?? []
  const gravar = todas.filter((p) => passoDe(p) === 'gravar').sort((a, b) => Number(atrasado(b, f)) - Number(atrasado(a, f)) || (a.dia ?? '9').localeCompare(b.dia ?? '9'))
  const semana = Date.now() - 7 * 86400000
  const enviados = todas.filter((p) => { const b = brutoDe(p); return b && passoDe(p) === 'edicao' && new Date(b.em).getTime() > semana })
  return (
    <div className="pagina para-gravar">
      <header className="pagina-topo"><div><h1>Para gravar <BotaoAjuda id="fluxo-semana" /></h1>
        <p className="muted">Os vídeos planejados por {f.apelido}. Grave, toque em "Enviar o vídeo gravado" e ele vai direto para a edição.</p></div></header>
      <Erro msg={pecas.erro} />
      {!pecas.carregando && !gravar.length && <Vazio>Nada para gravar agora. Quando a pauta for aprovada, os vídeos aparecem aqui.</Vazio>}
      <div className="pg-lista">{gravar.map((p) => <Cartao key={p.id} p={p} f={f} aoMudar={pecas.recarregar} />)}</div>
      {enviados.length > 0 && (<>
        <h2 className="pg-sub">Enviados nesta semana</h2>
        <div className="pg-lista">{enviados.map((p) => <Cartao key={p.id} p={p} f={f} aoMudar={pecas.recarregar} />)}</div>
      </>)}
    </div>
  )
}
