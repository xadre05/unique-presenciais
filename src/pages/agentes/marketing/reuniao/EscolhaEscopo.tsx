// Começo do planejamento: "O que vamos planejar?" (algo para hoje, próximos dias, semana, mês ou campanha) e a campanha.
// Depois, dois caminhos: conversar com o agente (reunião de pauta) ou dizer direto o que vai ser postado.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { hojeISO, segundaDe } from '../../comum'
import type { Campanha } from '../useMarketing'
import { periodoDe, tituloDe, type Escopo, type Reuniao, type TipoEscopo } from './dados'
import { DecidirDireto } from './DecidirDireto'
import { EscolherPost } from '../../instagram/EscolherPost'
import { EMPRESA } from '../useMarketing'

const OPCOES: { tipo: TipoEscopo; nome: string; sub: string; icone: string }[] = [
  { tipo: 'dia', nome: 'Algo para hoje', sub: 'Uma novidade, um assunto do mercado, um stories de última hora. Conversa curta, de 1 a 3 peças.', icone: 'relogio' },
  { tipo: 'dias', nome: 'Os próximos dias', sub: 'Dois ou três dias, ou um intervalo que você escolhe.', icone: 'agenda' },
  { tipo: 'semana', nome: 'A semana', sub: 'Segunda a domingo, olhando o que saiu, o que funcionou e o que vem pela frente.', icone: 'grafico' },
  { tipo: 'mes', nome: 'O mês', sub: 'A linha do mês inteiro, com as datas importantes.', icone: 'lista' },
  { tipo: 'campanha', nome: 'Uma campanha', sub: 'O conteúdo de uma campanha do começo ao fim.', icone: 'floco' },
]
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const STATUS: Record<Reuniao['status'], string> = { aberta: 'Em conversa', plano: 'Plano para revisar', fechada: 'Plano aprovado' }

type Props = {
  tipoInicial: TipoEscopo; dataInicial: string; campanhas: Campanha[]; recentes: Reuniao[]
  aoComecar: (escopo: Escopo, titulo: string) => Promise<void>; aoContinuar: (id: string) => void; aoGuardou: () => void; aoEscreveu: (ids: string[]) => void; aoCriarCampanha: () => void
}

export function EscolhaEscopo(pr: Props) {
  const [tipo, setTipo] = useState<TipoEscopo>(pr.tipoInicial)
  // a campanha vale em qualquer planejamento (opcional); em "Uma campanha" ela é obrigatória e define o período
  const [campanha, setCampanha] = useState(pr.tipoInicial === 'campanha' ? pr.campanhas[0]?.id ?? '' : '')
  const [periodo, setPeriodo] = useState(() => periodoDe(pr.tipoInicial, pr.dataInicial || hojeISO()))
  const [texto, setTexto] = useState('')
  const [comecando, setComecando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)
  const [direto, setDireto] = useState(false)
  const [deUmPost, setDeUmPost] = useState(false)
  const camp = pr.campanhas.find((c) => c.id === campanha)

  const escolher = (t: TipoEscopo) => {
    const c = t === 'campanha' ? camp ?? pr.campanhas[0] : camp
    if (t === 'campanha' && c) setCampanha(c.id)
    const p = periodoDe(t, t === 'dia' ? hojeISO() : periodo.inicio, t === 'campanha' ? c : undefined); setTipo(t); setPeriodo(p); setDigitado(p.inicio)
  }
  const mudarCampanha = (id: string) => {
    if (id === '__nova') return pr.aoCriarCampanha()
    setCampanha(id)
    if (tipo !== 'campanha') return
    const p = periodoDe('campanha', '', pr.campanhas.find((c) => c.id === id)); setPeriodo(p); setDigitado(p.inicio)
  }
  // o campo guarda o que foi digitado; o período só muda com uma data completa (ano com 4 dígitos)
  const [digitado, setDigitado] = useState(periodo.inicio)
  const valida = (d: string) => /^20\d\d-\d\d-\d\d$/.test(d)
  const mudarInicio = (d: string) => valida(d) && setPeriodo(tipo === 'dia' ? { inicio: d, fim: d } : tipo === 'semana' ? periodoDe('semana', segundaDe(d)) : tipo === 'mes' ? periodoDe('mes', d) : { inicio: d, fim: periodo.fim < d ? d : periodo.fim })
  const comecar = async () => {
    if (tipo === 'campanha' && !camp) return setErro('Escolha a campanha ou crie uma nova.')
    if (!valida(periodo.inicio) || !valida(periodo.fim)) return setErro('Confira a data: use dia, mês e ano completos.')
    setErro(null); setComecando(true)
    const escopo: Escopo = { tipo, ...periodo, campanha: camp?.id, texto: texto.trim() || undefined }
    try { await pr.aoComecar(escopo, tituloDe(escopo, camp)) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível começar.'); setComecando(false) }
  }
  const lista = verTodas ? pr.recentes : pr.recentes.slice(0, 4)

  return (
    <div className={`reu-escolha${pr.recentes.length ? '' : ' sozinha'}`}>
      <div className="reu-col">
      <section className="mk-painel">
        <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="mensagem" tam={22} /></span><div><h3>O que vamos planejar?</h3><span className="muted pequeno">Escolha o período e a campanha. Depois você decide: conversar com o agente antes, ou dizer direto o que quer postar.</span></div></header>
        <div className="reu-opcoes" role="radiogroup">
          {OPCOES.map((o) => (
            <button key={o.tipo} type="button" role="radio" aria-checked={tipo === o.tipo} className={`reu-opcao${tipo === o.tipo ? ' ativa' : ''}`} onClick={() => escolher(o.tipo)}>
              <Icone nome={o.icone} tam={20} /><b>{o.nome}</b><span>{o.sub}</span>
            </button>
          ))}
        </div>
        <div className="form-duas reu-periodo">
          <label>Campanha {tipo !== 'campanha' && <small className="muted">(opcional)</small>}
            <select value={camp?.id ?? ''} onChange={(e) => mudarCampanha(e.target.value)}>
              {(tipo !== 'campanha' || !pr.campanhas.length) && <option value="">{tipo === 'campanha' ? 'Nenhuma campanha cadastrada' : 'Nenhuma: conteúdo do dia a dia'}</option>}
              {pr.campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__nova">+ Nova campanha…</option>
            </select></label>
          {tipo === 'mes'
            ? <label>Mês<input type="month" value={periodo.inicio.slice(0, 7)} onChange={(e) => e.target.value && mudarInicio(e.target.value + '-01')} /></label>
            : <label>{tipo === 'dia' ? 'Dia' : tipo === 'semana' ? 'Semana de' : 'Início'}<input type="date" value={digitado} onChange={(e) => { setDigitado(e.target.value); mudarInicio(e.target.value) }} /></label>}
          {(tipo === 'dias' || tipo === 'campanha') && <label>Fim<input type="date" value={periodo.fim} min={periodo.inicio} onChange={(e) => valida(e.target.value) && setPeriodo({ ...periodo, fim: e.target.value })} /></label>}
          <span className="muted pequeno reu-periodo-txt">Período: {dmy(periodo.inicio)}{periodo.fim !== periodo.inicio ? ` a ${dmy(periodo.fim)}` : ''}{camp ? ` · as peças usam a oferta e as regras de ${camp.nome}` : ''}</span>
        </div>
        {!direto && !deUmPost && <>
          <div className="reu-caminhos">
            <div className="reu-caminho">
              <b><Icone nome="lista" tam={18} /> Já sei o que quero postar</b>
              <span className="muted pequeno">Você diz cada peça (canal, formato, dia e sobre o quê) e o agente escreve. Sem conversa.</span>
              <button type="button" className="btn btn-ouro" onClick={() => setDireto(true)}>Dizer o que postar</button>
            </div>
            <div className="reu-caminho">
              <b><Icone nome="trocar" tam={18} /> Partir de um post que deu resultado</b>
              <span className="muted pequeno">Escolha um post que funcionou e diga o que mudar. O agente mantém o gancho, a estrutura e o formato e escreve a nova versão.</span>
              <button type="button" className="btn btn-contorno-ouro" onClick={() => setDeUmPost(true)}>Escolher o post</button>
            </div>
            <div className="reu-caminho">
              <b><Icone nome="mensagem" tam={18} /> Conversar com o agente antes</b>
              <span className="muted pequeno">Ele chega com o que levantou (o que saiu, o que funcionou, campanhas e datas) e vocês decidem juntos. Cada mensagem custa alguns centavos.</span>
              <label className="mk-rotulo">Já tem um assunto em mente? <small className="muted">(opcional; a conversa começa por ele)</small></label>
              <textarea rows={2} maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: saiu uma notícia sobre a regulamentação da HOF e quero falar disso hoje" />
              <button type="button" className="btn btn-contorno-ouro" disabled={comecando} onClick={comecar}>{comecando ? 'Abrindo a conversa…' : 'Começar a conversa'}</button>
            </div>
          </div>
          <Erro msg={erro} />
        </>}
      </section>
      {deUmPost && <EscolherPost empresa={EMPRESA} dia={periodo.inicio} campanha={camp?.id} aoCriada={(id) => pr.aoEscreveu([id])} aoVoltar={() => setDeUmPost(false)} />}
      {direto && <DecidirDireto inicio={periodo.inicio} fim={periodo.fim} campanha={camp} aoEscreveu={pr.aoEscreveu} aoGuardou={pr.aoGuardou} aoVoltar={() => setDireto(false)} />}
      </div>

      <aside className="reu-lado">
        {pr.recentes.length > 0 && (
          <section className="mk-painel">
            <h4 className="reu-lado-titulo"><Icone nome="historico" tam={18} /> Conversas anteriores</h4>
            <ul className="reu-recentes">
              {lista.map((r) => (
                <li key={r.id}><button type="button" onClick={() => pr.aoContinuar(r.id)}>
                  <b>{r.titulo}</b>
                  <small>{STATUS[r.status]} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}{r.ata?.assuntos?.length ? ` · ${r.ata.assuntos.length} assunto(s)` : ''}</small>
                  {r.ata?.objetivo && <span className="muted pequeno">{r.ata.objetivo}</span>}
                </button></li>
              ))}
            </ul>
            {pr.recentes.length > 4 && <button type="button" className="btn btn-mini" onClick={() => setVerTodas(!verTodas)}>{verTodas ? 'Ver menos' : `Ver todas (${pr.recentes.length})`}</button>}
          </section>
        )}
      </aside>
    </div>
  )
}
