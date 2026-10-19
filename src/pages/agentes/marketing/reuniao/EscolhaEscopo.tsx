// Começo da Reunião de pauta: "O que vamos planejar?" (algo para hoje, próximos dias, semana, mês ou campanha),
// as reuniões recentes para continuar e, para quem não quer usar o agente, anotar uma ideia à mão.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { hojeISO, segundaDe } from '../../comum'
import type { Campanha } from '../useMarketing'
import { periodoDe, tituloDe, type Escopo, type Reuniao, type TipoEscopo } from './dados'
import { AnotarIdeia } from './AnotarIdeia'

const OPCOES: { tipo: TipoEscopo; nome: string; sub: string; icone: string }[] = [
  { tipo: 'dia', nome: 'Algo para hoje', sub: 'Uma novidade, um assunto do mercado, um stories de última hora. Conversa curta, de 1 a 3 peças.', icone: 'relogio' },
  { tipo: 'dias', nome: 'Os próximos dias', sub: 'Dois ou três dias, ou um intervalo que você escolhe.', icone: 'agenda' },
  { tipo: 'semana', nome: 'A semana', sub: 'Reunião completa: o que saiu, o que funcionou e o que vem pela frente.', icone: 'grafico' },
  { tipo: 'mes', nome: 'O mês', sub: 'A linha do mês inteiro, com as datas importantes.', icone: 'lista' },
  { tipo: 'campanha', nome: 'Uma campanha', sub: 'O conteúdo de uma campanha do começo ao fim.', icone: 'floco' },
]
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const STATUS: Record<Reuniao['status'], string> = { aberta: 'Em conversa', plano: 'Plano para revisar', fechada: 'Plano aprovado' }

type Props = {
  tipoInicial: TipoEscopo; dataInicial: string; campanhas: Campanha[]; recentes: Reuniao[]
  aoComecar: (escopo: Escopo, titulo: string) => Promise<void>; aoContinuar: (id: string) => void; aoAnotou: () => void; aoCriarCampanha: () => void
}

export function EscolhaEscopo(pr: Props) {
  const [tipo, setTipo] = useState<TipoEscopo>(pr.tipoInicial)
  const [campanha, setCampanha] = useState(pr.campanhas[0]?.id ?? '')
  const [periodo, setPeriodo] = useState(() => periodoDe(pr.tipoInicial, pr.dataInicial || hojeISO()))
  const [texto, setTexto] = useState('')
  const [comecando, setComecando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)
  const camp = pr.campanhas.find((c) => c.id === campanha) ?? pr.campanhas[0]

  const escolher = (t: TipoEscopo) => { const p = periodoDe(t, t === 'dia' ? hojeISO() : periodo.inicio, t === 'campanha' ? camp : undefined); setTipo(t); setPeriodo(p); setDigitado(p.inicio) }
  // o campo guarda o que foi digitado; o período só muda com uma data completa (ano com 4 dígitos)
  const [digitado, setDigitado] = useState(periodo.inicio)
  const valida = (d: string) => /^20\d\d-\d\d-\d\d$/.test(d)
  const mudarInicio = (d: string) => valida(d) && setPeriodo(tipo === 'dia' ? { inicio: d, fim: d } : tipo === 'semana' ? periodoDe('semana', segundaDe(d)) : tipo === 'mes' ? periodoDe('mes', d) : { inicio: d, fim: periodo.fim < d ? d : periodo.fim })
  const comecar = async () => {
    if (tipo === 'campanha' && !camp) return setErro('Escolha a campanha ou crie uma nova.')
    if (!valida(periodo.inicio) || !valida(periodo.fim)) return setErro('Confira a data: use dia, mês e ano completos.')
    setErro(null); setComecando(true)
    const escopo: Escopo = { tipo, ...periodo, campanha: tipo === 'campanha' ? camp?.id : undefined, texto: texto.trim() || undefined }
    try { await pr.aoComecar(escopo, tituloDe(escopo, camp)) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível começar.'); setComecando(false) }
  }
  const lista = verTodas ? pr.recentes : pr.recentes.slice(0, 4)

  return (
    <div className="reu-escolha">
      <section className="mk-painel">
        <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="mensagem" tam={22} /></span><div><h3>O que vamos planejar?</h3><span className="muted pequeno">O agente abre a reunião com o que levantou: o que já saiu, o que está planejado, campanhas e datas. Vocês decidem juntos e só depois ele monta o plano.</span></div></header>
        <div className="reu-opcoes" role="radiogroup">
          {OPCOES.map((o) => (
            <button key={o.tipo} type="button" role="radio" aria-checked={tipo === o.tipo} className={`reu-opcao${tipo === o.tipo ? ' ativa' : ''}`} onClick={() => escolher(o.tipo)}>
              <Icone nome={o.icone} tam={20} /><b>{o.nome}</b><span>{o.sub}</span>
            </button>
          ))}
        </div>
        <div className="form-duas reu-periodo">
          {tipo === 'campanha' && <label>Campanha<select value={camp?.id ?? ''} onChange={(e) => { if (e.target.value === '__nova') return pr.aoCriarCampanha(); setCampanha(e.target.value); const p = periodoDe('campanha', '', pr.campanhas.find((c) => c.id === e.target.value)); setPeriodo(p); setDigitado(p.inicio) }}>{!pr.campanhas.length && <option value="">Nenhuma campanha cadastrada</option>}{pr.campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__nova">+ Nova campanha…</option></select></label>}
          {tipo === 'mes'
            ? <label>Mês<input type="month" value={periodo.inicio.slice(0, 7)} onChange={(e) => e.target.value && mudarInicio(e.target.value + '-01')} /></label>
            : <label>{tipo === 'dia' ? 'Dia' : tipo === 'semana' ? 'Semana de' : 'Início'}<input type="date" value={digitado} onChange={(e) => { setDigitado(e.target.value); mudarInicio(e.target.value) }} /></label>}
          {(tipo === 'dias' || tipo === 'campanha') && <label>Fim<input type="date" value={periodo.fim} min={periodo.inicio} onChange={(e) => valida(e.target.value) && setPeriodo({ ...periodo, fim: e.target.value })} /></label>}
          <span className="muted pequeno reu-periodo-txt">Período: {dmy(periodo.inicio)}{periodo.fim !== periodo.inicio ? ` a ${dmy(periodo.fim)}` : ''}</span>
        </div>
        <label className="mk-rotulo">Quer adiantar o assunto? <small className="muted">(opcional)</small></label>
        <textarea rows={2} maxLength={600} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: saiu uma notícia sobre a regulamentação da HOF e quero falar disso hoje" />
        <Erro msg={erro} />
        <footer className="mk-criar-rodape">
          <span className="mk-criar-resumo"><Icone nome="info" tam={18} /><span className="pequeno muted">Cada mensagem da reunião custa alguns centavos. O plano só é montado quando você clicar em "Montar o plano".</span></span>
          <button className="btn btn-ouro" disabled={comecando} onClick={comecar}><Icone nome="mensagem" tam={16} /> {comecando ? 'Abrindo a reunião…' : 'Começar a reunião'}</button>
        </footer>
      </section>

      <aside className="reu-lado">
        {pr.recentes.length > 0 && (
          <section className="mk-painel">
            <h4 className="reu-lado-titulo"><Icone nome="historico" tam={18} /> Reuniões anteriores</h4>
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
        <AnotarIdeia dataInicial={periodo.inicio} aoAnotou={pr.aoAnotou} />
      </aside>
    </div>
  )
}
