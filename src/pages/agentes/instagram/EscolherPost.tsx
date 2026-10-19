// Planejar → "Partir de um post que deu resultado": os posts do último ano que mais alcançaram (ou mais salvos e
// compartilhamentos), com o quanto ficaram acima da mediana. Escolhido o post, abre o Recriar com o dia do planejamento.
import { useMemo, useState } from 'react'
import { Icone } from '../../../components/Icone'
import { NOME_TIPO, hojeBR, mediana, milhar, n, somaDias, usePostsInstagram, type PostIG } from './dados'
import { RecriarPost } from './RecriarPost'

type Ordem = 'alcance' | 'salvos' | 'compartilhamentos'
const NOME_ORDEM: Record<Ordem, string> = { alcance: 'Maior alcance', salvos: 'Mais salvos', compartilhamentos: 'Mais compartilhados' }
type Props = { empresa: string; dia: string; campanha?: string; aoCriada: (pecaId: string) => void; aoVoltar: () => void }

export function EscolherPost({ empresa, dia, campanha, aoCriada, aoVoltar }: Props) {
  const posts = usePostsInstagram(empresa)
  const [ordem, setOrdem] = useState<Ordem>('alcance')
  const [tipo, setTipo] = useState('')
  const [escolhido, setEscolhido] = useState<PostIG | null>(null)
  const [desde] = useState(() => somaDias(hojeBR(), -365))
  const doAno = useMemo(() => (posts.dados ?? []).filter((p) => p.publicado_em >= desde), [posts.dados, desde])
  const med = useMemo(() => mediana(doAno.map((p) => n(p, 'alcance'))), [doAno])
  const tipos = [...new Set(doAno.map((p) => p.tipo))]
  const lista = doAno.filter((p) => !tipo || p.tipo === tipo).sort((a, b) => n(b, ordem) - n(a, ordem)).slice(0, 24)
  return (
    <section className="mk-painel ep-painel">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="trocar" tam={22} /></span>
        <div><h3>Partir de um post que deu resultado</h3><span className="muted pequeno">Os melhores do último ano. Escolha um e diga o que mudar: o agente mantém o que funcionou.</span></div>
        <button type="button" className="btn btn-mini" onClick={aoVoltar}><Icone nome="esquerda" tam={13} /> Voltar</button></header>
      {posts.carregando && !posts.dados ? <p className="muted pequeno">Carregando os posts…</p> : !doAno.length ? <p className="muted pequeno">Nenhum post do Instagram no último ano. Ligue o Instagram em Configurações → Integrações.</p> : (<>
        <div className="ia-linha">
          {(Object.keys(NOME_ORDEM) as Ordem[]).map((o) => <button key={o} type="button" className={`mk-chip${ordem === o ? ' ativo' : ''}`} onClick={() => setOrdem(o)}>{NOME_ORDEM[o]}</button>)}
          <span className="select-icone"><select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Formato"><option value="">Todos os formatos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span>
        </div>
        <ul className="ep-grade">{lista.map((p) => { const acima = med ? Math.round(((n(p, 'alcance') - med) / med) * 100) : 0; return (
          <li key={p.id}><button type="button" className="ep-post" onClick={() => setEscolhido(p)}>
            {p.miniatura ? <img src={p.miniatura} alt="" loading="lazy" /> : <span className="ig-sem-foto"><Icone nome="video" tam={18} /></span>}
            <span><b>{new Date(p.publicado_em).toLocaleDateString('pt-BR')} · {NOME_TIPO[p.tipo] ?? p.tipo}</b>
              <small className={acima >= 0 ? 'ig-acima' : 'ig-abaixo'}>Alcance {milhar(n(p, 'alcance'))} ({acima >= 0 ? '+' : ''}{acima}%)</small>
              <small className="muted">{milhar(n(p, 'salvos'))} salvos · {milhar(n(p, 'compartilhamentos'))} compart.</small>
              <small>{(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 90)}</small></span>
          </button></li>) })}</ul>
      </>)}
      {escolhido && <RecriarPost key={escolhido.id} post={escolhido} med={med} diaInicial={dia} campanha={campanha} aoFechar={() => setEscolhido(null)} aoCriada={aoCriada} />}
    </section>
  )
}
