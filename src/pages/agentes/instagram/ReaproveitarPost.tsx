// Planejar → "Reaproveitar um post com resultado" (página inteira): à esquerda, os posts da conta (período, formato e
// ordem por alcance, salvamentos ou compartilhamentos) em cartões com a imagem e os números; à direita, o post
// escolhido, o que manter, o que mudar, o formato da nova peça (ou o agente decide) e os canais. "Preparar nova versão"
// cria uma peça por canal com o post como base e já pede ao agente que escreva.
import { useMemo, useState } from 'react'
import { Icone } from '../../../components/Icone'
import { REDES, nomeFormato, type Rede } from '../marketing/redes'
import { LogoRede } from '../marketing/LogoRede'
import type { Campanha } from '../marketing/useMarketing'
import { NOME_TIPO, acaoInstagram, hojeBR, mediana, milhar, n, somaDias, useConexao, usePostsInstagram, type PostIG } from './dados'
import { FORMATO_DO_POST, MANTER, recriarPost } from './recriar'

type Ordem = 'alcance' | 'salvos' | 'compartilhamentos'
const ORDENS: { id: Ordem; nome: string; icone: string }[] = [{ id: 'alcance', nome: 'Alcance', icone: 'grafico' }, { id: 'salvos', nome: 'Salvamentos', icone: 'livro' }, { id: 'compartilhamentos', nome: 'Compartilhamentos', icone: 'enviar' }]
const PERIODOS: { id: string; nome: string; dias: number }[] = [{ id: '90', nome: 'Últimos 3 meses', dias: 90 }, { id: '180', nome: 'Últimos 6 meses', dias: 180 }, { id: '365', nome: 'Últimos 12 meses', dias: 365 }, { id: 'tudo', nome: 'Tudo', dias: 0 }]
const POR_VEZ = 12
const LIMITE = 500
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
// título do cartão: a primeira frase da legenda
const tituloDo = (p: PostIG) => { const t = (p.legenda ?? '').replace(/\s+/g, ' ').trim(); const f = t.split(/(?<=[.!?])\s|\n/)[0] ?? t; return (f.length > 80 ? f.slice(0, 78) + '…' : f) || NOME_TIPO[p.tipo] || 'Post' }

type Contexto = { campanha?: Campanha; inicio: string; fim: string; canais: string[] }
type Props = { empresa: string; contexto: Contexto; redesAtivas: Rede[]; aoVoltar: () => void; aoCriadas: (ids: string[]) => void }

function CartaoPost({ p, escolhido, aoEscolher }: { p: PostIG; escolhido: boolean; aoEscolher: () => void }) {
  return (
    <li><button type="button" className={`rp-cartao${escolhido ? ' ativo' : ''}`} onClick={aoEscolher} aria-pressed={escolhido}>
      <span className="rp-marca">{escolhido && <Icone nome="check" tam={13} />}</span>
      <span className="rp-imagem">{p.miniatura ? <img src={p.miniatura} alt="" loading="lazy" /> : <Icone nome="video" tam={26} />}
        <span className="rp-tipo"><Icone nome={p.tipo === 'reels' || p.tipo === 'video' ? 'video' : p.tipo === 'carrossel' ? 'quadro' : 'imagem'} tam={13} /></span></span>
      <small className="muted">{new Date(p.publicado_em).toLocaleDateString('pt-BR')} · {NOME_TIPO[p.tipo] ?? p.tipo}</small>
      <b className="rp-titulo">{tituloDo(p)}</b>
      <span className="rp-numeros">
        <span><Icone nome="grafico" tam={14} /><small>Alcance</small><b>{milhar(n(p, 'alcance'))}</b></span>
        <span><Icone nome="livro" tam={14} /><small>Salvos</small><b>{milhar(n(p, 'salvos'))}</b></span>
        <span><Icone nome="enviar" tam={14} /><small>Compart.</small><b>{milhar(n(p, 'compartilhamentos'))}</b></span>
      </span>
    </button></li>
  )
}

export function ReaproveitarPost({ empresa, contexto, redesAtivas, aoVoltar, aoCriadas }: Props) {
  const conexao = useConexao(empresa)
  const posts = usePostsInstagram(empresa)
  const [periodo, setPeriodo] = useState('365')
  const [tipo, setTipo] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('alcance')
  const [mostrar, setMostrar] = useState(POR_VEZ)
  const [escolhido, setEscolhido] = useState<PostIG | null>(null)
  const [manter, setManter] = useState<string[]>(['Gancho', 'Tema'])
  const [mudar, setMudar] = useState('')
  const [formato, setFormato] = useState('auto')
  const [canais, setCanais] = useState<string[]>(() => (contexto.canais.length ? contexto.canais : ['instagram']))
  const [hoje] = useState(hojeBR)
  const [atualizando, setAtualizando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const todos = useMemo(() => posts.dados ?? [], [posts.dados])
  const tipos = useMemo(() => [...new Set(todos.map((p) => p.tipo))], [todos])
  const lista = useMemo(() => {
    const dias = PERIODOS.find((x) => x.id === periodo)?.dias ?? 0
    const desde = dias ? somaDias(hoje, -dias + 1) : ''
    return todos.filter((p) => (!desde || p.publicado_em.slice(0, 10) >= desde) && (!tipo || p.tipo === tipo)).sort((a, b) => n(b, ordem) - n(a, ordem))
  }, [todos, periodo, tipo, ordem, hoje])
  const med = useMemo(() => mediana(lista.map((p) => n(p, 'alcance'))), [lista])
  const formatosDosCanais = [...new Set(canais.flatMap((c) => REDES[c as Rede]?.formatos ?? []))]
  const alternar = <T,>(lista: T[], x: T) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x])

  const atualizar = async () => { setAtualizando(true); try { await acaoInstagram(empresa, 'sincronizar'); posts.recarregar() } catch (e) { setErro((e as Error).message) } setAtualizando(false) }
  const preparar = async () => {
    if (!escolhido) return
    setErro(null); setCriando(true)
    try {
      const ids: string[] = []
      for (const rede of canais) {
        const formatosRede: string[] = REDES[rede as Rede]?.formatos ?? []
        const doPost = FORMATO_DO_POST[escolhido.tipo]
        const tipoPeca = formato === 'auto' ? 'auto' : formato === 'mesmo' ? (formatosRede.includes(doPost) ? doPost : 'auto') : formatosRede.includes(formato) ? formato : 'auto'
        ids.push(await recriarPost(escolhido, med, { mudar, manter, tipo: tipoPeca, dia: contexto.inicio, campanha: contexto.campanha?.id, rede }))
      }
      aoCriadas(ids)
    } catch (e) { setErro((e as Error).message); setCriando(false) }
  }

  return (
    <div className="rp-pagina">
      <button type="button" className="link rp-voltar" onClick={aoVoltar}><Icone nome="esquerda" tam={14} /> Voltar ao planejamento</button>
      <header className="rp-cab">
        <div><h2>Reaproveitar um post com resultado</h2><p className="muted">Escolha um post da sua conta e defina como criar uma nova versão.</p></div>
        <div className="rp-contexto">
          {contexto.campanha && <span className="rp-pilula"><Icone nome="floco" tam={14} /> {contexto.campanha.nome}</span>}
          <span className="rp-pilula"><Icone nome="agenda" tam={14} /> {dm(contexto.inicio)}{contexto.fim !== contexto.inicio ? ` – ${dm(contexto.fim)}` : ''}</span>
        </div>
        <div className="rp-conta">
          {conexao.dados?.status === 'conectado' ? <span className="rp-conectada"><i /> Conta conectada</span> : <span className="rp-pilula">Instagram não conectado</span>}
          <button type="button" className="btn btn-contorno" disabled={atualizando} onClick={atualizar}><Icone nome="atualizar" tam={15} /> {atualizando ? 'Atualizando…' : 'Atualizar posts'}</button>
        </div>
      </header>
      <div className="rp-grade">
        <section className="mk-painel rp-lista">
          <div className="rp-filtros">
            <label>Período:<span className="select-icone"><select value={periodo} onChange={(e) => { setPeriodo(e.target.value); setMostrar(POR_VEZ) }}>{PERIODOS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></span></label>
            <label>Formato:<span className="select-icone"><select value={tipo} onChange={(e) => { setTipo(e.target.value); setMostrar(POR_VEZ) }}><option value="">Todos</option>{tipos.map((t) => <option key={t} value={t}>{NOME_TIPO[t] ?? t}</option>)}</select></span></label>
            <div className="rp-ordens" role="radiogroup" aria-label="Ordenar por"><span>Ordenar:</span>{ORDENS.map((o) => <button key={o.id} type="button" role="radio" aria-checked={ordem === o.id} className={`rp-ordem${ordem === o.id ? ' ativa' : ''}`} onClick={() => setOrdem(o.id)}><Icone nome={o.icone} tam={14} /> {o.nome}</button>)}</div>
          </div>
          {posts.carregando && !posts.dados ? <p className="muted pequeno">Carregando os posts…</p>
            : !lista.length ? <p className="muted pequeno">Nenhum post com esses filtros.</p>
              : <ul className="rp-cartoes">{lista.slice(0, mostrar).map((p) => <CartaoPost key={p.id} p={p} escolhido={escolhido?.id === p.id} aoEscolher={() => setEscolhido(p)} />)}</ul>}
          {lista.length > mostrar && <button type="button" className="btn rp-mais" onClick={() => setMostrar((m) => m + POR_VEZ)}>Mostrar mais</button>}
        </section>
        <aside className="mk-painel rp-lado">
          <h3>Post selecionado</h3>
          {!escolhido ? <p className="muted">Escolha um post ao lado. Os primeiros são os que mais deram resultado.</p> : (<>
            <div className="rp-escolhido">
              {escolhido.miniatura ? <img src={escolhido.miniatura} alt="" /> : <span className="ig-sem-foto"><Icone nome="video" tam={20} /></span>}
              <div><small className="muted">{new Date(escolhido.publicado_em).toLocaleDateString('pt-BR')} · {NOME_TIPO[escolhido.tipo] ?? escolhido.tipo}</small>
                <b>{tituloDo(escolhido)}</b>
                {escolhido.link && <a href={escolhido.link} target="_blank" rel="noreferrer" className="link">Ver publicação original <Icone nome="seta_dir" tam={12} /></a>}</div>
            </div>
            <div className="rp-bloco"><h4>O que manter?</h4><span className="muted pequeno">Escolha os elementos principais deste post para a nova versão.</span>
              <div className="rp-manter">{MANTER.map((m) => <button key={m} type="button" className={`rp-marcar${manter.includes(m) ? ' ativo' : ''}`} onClick={() => setManter((l) => alternar(l, m))} aria-pressed={manter.includes(m)}><span>{manter.includes(m) && <Icone nome="check" tam={12} />}</span>{m}</button>)}</div></div>
            <div className="rp-bloco"><h4>O que mudar?</h4><span className="muted pequeno">Descreva o que você quer ajustar nesta nova versão.</span>
              <div className="rp-texto"><textarea rows={4} maxLength={LIMITE} value={mudar} onChange={(e) => setMudar(e.target.value)} placeholder="Ex.: manter a abertura, atualizar a abordagem e conectar à campanha atual." /><small className="muted">{mudar.length}/{LIMITE}</small></div></div>
            <div className="rp-bloco"><h4>Formato da nova peça</h4>
              <span className="select-icone"><select value={formato} onChange={(e) => setFormato(e.target.value)}>
                <option value="auto">Definir com o agente</option><option value="mesmo">Manter o formato ({NOME_TIPO[escolhido.tipo] ?? escolhido.tipo})</option>
                {formatosDosCanais.map((f) => <option key={f} value={f}>{nomeFormato(f, (canais[0] ?? 'instagram') as Rede)}</option>)}</select></span>
              <span className="muted pequeno">Pode manter o formato ou transformar em outro.</span></div>
            <div className="rp-bloco"><h4>Canais</h4>
              <div className="rp-canais">{redesAtivas.map((r) => <button key={r} type="button" className={`rp-canal${canais.includes(r) ? ' ativo' : ''}`} onClick={() => setCanais((l) => (l.includes(r) && l.length === 1 ? l : alternar(l, r)))} aria-pressed={canais.includes(r)}>
                <LogoRede rede={r} tam={16} /> {REDES[r].nome}{canais.includes(r) && <Icone nome="check" tam={13} />}</button>)}</div>
              {canais.length > 1 && <span className="muted pequeno">Uma peça para cada canal.</span>}</div>
            {erro && <p className="erro-txt pequeno">{erro}</p>}
            <button type="button" className="btn btn-ouro btn-grande rp-preparar" disabled={criando || !canais.length} onClick={preparar}><Icone nome="floco" tam={18} /> {criando ? 'Preparando…' : 'Preparar nova versão'} <Icone nome="seta_dir" tam={16} /></button>
            <p className="muted pequeno rp-nota"><Icone nome="info" tam={14} /> O agente usa o post selecionado e as suas orientações para montar uma proposta.</p>
          </>)}
        </aside>
      </div>
    </div>
  )
}
