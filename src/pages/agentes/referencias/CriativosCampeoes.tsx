// Base da marca → Conhecimento: os anúncios NOSSOS que mais venderam (ranking da Hotmart pelo código de rastreio do
// Facebook). Em cada um, "Ensinar o roteiro": a equipe sobe o vídeo ou a imagem do anúncio (e o texto, se quiser), e o
// agente decompõe o roteiro. Os estudados passam a ser a base dos roteiros de venda do Agente de Marketing.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { brl } from '../../../lib/format'
import { guardarCampeao, useCampeoes, type Campeao, type NovoCampeao } from './campeoes'
import type { Referencia } from './dados'

const dia = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const MOSTRAR = 12

function Ensinar({ empresa, c, aoTerminar, aoFechar }: { empresa: string; c: Campeao; aoTerminar: () => void; aoFechar: () => void }) {
  const [n, setN] = useState<NovoCampeao>({ arquivo: null, texto: '', por_que: '' })
  const [etapa, setEtapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const estudar = async () => {
    setErro(null)
    try { await guardarCampeao(empresa, c, n, setEtapa); setEtapa(null); aoTerminar() } catch (e) { setErro((e as Error).message); setEtapa(null); aoTerminar() }
  }
  return (
    <div className="ref-form">
      <label>{c.tipo === 'imagem' ? 'Imagem do anúncio' : 'Vídeo do anúncio'} <small className="muted">(baixe do Gerenciador de Anúncios ou do Drive)</small>
        <input type="file" accept={c.tipo === 'imagem' ? 'image/*' : 'video/*,image/*'} disabled={!!etapa} onChange={(e) => setN({ ...n, arquivo: e.target.files?.[0] ?? null })} /></label>
      <label>Texto do anúncio <small className="muted">(opcional: o texto principal e o título; se não tiver o vídeo, cole aqui o roteiro)</small>
        <textarea rows={3} maxLength={6000} value={n.texto} disabled={!!etapa} onChange={(e) => setN({ ...n, texto: e.target.value })} /></label>
      <label>Por que você acha que vendeu <small className="muted">(opcional)</small>
        <input value={n.por_que} maxLength={600} disabled={!!etapa} onChange={(e) => setN({ ...n, por_que: e.target.value })} placeholder="Ex.: o gancho do procedimento que mais fatura; a urgência da virada de lote" /></label>
      <div className="ia-linha">
        <button type="button" className="btn btn-ouro btn-mini" disabled={!!etapa} onClick={estudar}><Icone nome="floco" tam={13} /> Ensinar o roteiro</button>
        <button type="button" className="btn btn-mini" disabled={!!etapa} onClick={aoFechar}>Cancelar</button>
        {etapa && <span className="muted pequeno">{etapa}…</span>}
      </div>
      <Erro msg={erro} />
    </div>
  )
}

type Props = { empresa: string; referencias: Referencia[]; aoMudou: () => void }

export function CriativosCampeoes({ empresa, referencias, aoMudou }: Props) {
  const ranking = useCampeoes()
  const [aberto, setAberto] = useState<string | null>(null)
  const [todos, setTodos] = useState(false)
  const lista = (ranking.dados ?? []).slice(0, todos ? 60 : MOSTRAR)
  const estudado = (anuncio: string) => referencias.find((r) => r.categoria === 'nosso' && r.nome === anuncio)
  return (
    <section className="bm-cartao ref">
      <div><h2>Nossos criativos que venderam</h2>
        <p className="muted pequeno">Anúncios do Facebook e do Instagram que mais venderam, pelas vendas da Hotmart (código de rastreio). Ensine o roteiro dos campeões: o Agente de Marketing parte deles para escrever os roteiros de venda, e pode reaproveitar as nossas frases.</p></div>
      <Erro msg={ranking.erro} />
      {ranking.carregando && !ranking.dados ? <p className="muted pequeno">Carregando…</p> : !lista.length ? <p className="muted pequeno">Nenhuma venda com código de anúncio ainda.</p> : (
        <ul className="vend-lista">
          {lista.map((c, i) => {
            const r = estudado(c.anuncio)
            return (
              <li key={c.anuncio} className="vend-item">
                <div className="vend-linha">
                  <span className="vend-pos">{i + 1}</span>
                  <span className="vend-nome"><b>{c.anuncio}</b><small className="muted">{c.tipo === 'imagem' ? 'Imagem' : 'Vídeo'} · {dia(c.de)} a {dia(c.ate)} · {c.produtos}</small></span>
                  <span className="vend-num"><b>{c.vendas}</b><small className="muted">compradores</small></span>
                  <span className="vend-num"><b>{brl(c.receita)}</b><small className="muted">líquido</small></span>
                  {r ? <span className={`badge ${r.status === 'pronta' ? 'badge-ok' : r.status === 'erro' ? 'badge-erro' : 'badge-info'}`}>{r.status === 'pronta' ? 'Roteiro ensinado' : r.status === 'erro' ? 'Não deu certo' : 'Estudando'}</span>
                    : aberto !== c.anuncio && <button type="button" className="btn btn-contorno-ouro btn-mini" onClick={() => setAberto(c.anuncio)}>Ensinar o roteiro</button>}
                </div>
                {aberto === c.anuncio && !r && <Ensinar empresa={empresa} c={c} aoFechar={() => setAberto(null)} aoTerminar={() => { setAberto(null); aoMudou() }} />}
              </li>
            )
          })}
        </ul>
      )}
      {(ranking.dados?.length ?? 0) > MOSTRAR && <button type="button" className="link pequeno" onClick={() => setTodos(!todos)}>{todos ? 'Mostrar só os primeiros' : `Ver todos (${ranking.dados!.length})`}</button>}
      <p className="nota-neutra pequeno"><Icone nome="info" tam={14} /> Vendas sem código de anúncio (link de vendedora, bio, direct) não entram aqui. O roteiro ensinado aparece em Referências de criação, em "Nossos que venderam".</p>
    </section>
  )
}
