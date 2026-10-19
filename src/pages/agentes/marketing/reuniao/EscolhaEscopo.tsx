// Planejar com o agente de Marketing. Passo 1: o que vamos planejar (hoje, próximos dias, semana, mês ou campanha),
// a campanha, o período e os canais (ou o agente define). Passo 2: como começar — reunião com o agente, pedido direto
// ou reaproveitar um post com resultado (página própria). À direita: retomar de onde parou e o resumo do planejamento.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { hojeISO, segundaDe } from '../../comum'
import { situacaoCampanha } from '../../campanhas/dados'
import { REDES, useRedes, type Rede } from '../redes'
import { LogoRede } from '../LogoRede'
import { EMPRESA, type Campanha } from '../useMarketing'
import { periodoDe, tituloDe, type Escopo, type Reuniao, type TipoEscopo } from './dados'
import { DecidirDireto } from './DecidirDireto'
import { NestePlanejamento, Retomar } from './LadoPlanejar'
import { ReaproveitarPost } from '../../instagram/ReaproveitarPost'

const OPCOES: { tipo: TipoEscopo; nome: string; sub: string; icone: string }[] = [
  { tipo: 'dia', nome: 'Algo para hoje', sub: 'Conteúdo pontual', icone: 'relogio' },
  { tipo: 'dias', nome: 'Próximos dias', sub: 'Escolha um intervalo', icone: 'agenda' },
  { tipo: 'semana', nome: 'A semana', sub: 'Distribuição semanal', icone: 'agenda' },
  { tipo: 'mes', nome: 'O mês', sub: 'Visão do mês', icone: 'lista' },
  { tipo: 'campanha', nome: 'Uma campanha', sub: 'Do início ao fim da ação', icone: 'floco' },
]
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const NOME_ESCOPO: Record<TipoEscopo, string> = { dia: 'Dia', dias: 'Dias', semana: 'Semana', mes: 'Mês', campanha: 'Campanha' }

type Props = {
  tipoInicial: TipoEscopo; dataInicial: string; campanhas: Campanha[]; recentes: Reuniao[]
  aoComecar: (escopo: Escopo, titulo: string) => Promise<void>; aoContinuar: (id: string) => void; aoGuardou: () => void; aoEscreveu: (ids: string[]) => void; aoCriarCampanha: () => void
}

function Canais({ ativas, canais, agente, aoMudar, aoAgente }: { ativas: Rede[]; canais: string[]; agente: boolean; aoMudar: (c: string[]) => void; aoAgente: (v: boolean) => void }) {
  const faltam = ativas.filter((r) => !canais.includes(r))
  return (
    <div className="pl-canais">
      <div className="pl-canais-linha">
        <span className="select-icone pl-canais-sel"><select value="" disabled={agente || !faltam.length} onChange={(e) => e.target.value && aoMudar([...canais, e.target.value])} aria-label="Adicionar canal">
          <option value="">{agente ? 'O agente sugere os canais na reunião' : canais.length ? canais.map((c) => REDES[c as Rede]?.nome ?? c).join(', ') : 'Escolha os canais'}</option>
          {faltam.map((r) => <option key={r} value={r}>+ {REDES[r].nome}</option>)}</select></span>
        <button type="button" className={`btn pl-agente${agente ? ' ativo' : ''}`} onClick={() => aoAgente(!agente)} aria-pressed={agente}><Icone nome="floco" tam={16} /> Definir com o agente</button>
      </div>
      {!agente && canais.length > 0 && <div className="pl-canais-chips">{canais.map((c) => (
        <span key={c} className="pl-canal"><LogoRede rede={c as Rede} tam={15} /> {REDES[c as Rede]?.nome ?? c}
          <button type="button" aria-label={`Tirar ${REDES[c as Rede]?.nome ?? c}`} onClick={() => aoMudar(canais.filter((x) => x !== c))}><Icone nome="fechar" tam={12} /></button></span>))}</div>}
    </div>
  )
}

export function EscolhaEscopo(pr: Props) {
  const ativas = useRedes()
  const [tipo, setTipo] = useState<TipoEscopo>(pr.tipoInicial)
  const [campanha, setCampanha] = useState(pr.tipoInicial === 'campanha' ? pr.campanhas[0]?.id ?? '' : '')
  const [periodo, setPeriodo] = useState(() => periodoDe(pr.tipoInicial, pr.dataInicial || hojeISO()))
  const [digitado, setDigitado] = useState(periodo.inicio)
  const [canais, setCanais] = useState<string[]>(ativas)
  const [agenteDefine, setAgenteDefine] = useState(false)
  const [comecando, setComecando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [caminho, setCaminho] = useState<'escolher' | 'direto' | 'post'>('escolher')
  const camp = pr.campanhas.find((c) => c.id === campanha)
  const ativa = camp ? situacaoCampanha(camp) === 'ativa' : false

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
  const valida = (d: string) => /^20\d\d-\d\d-\d\d$/.test(d)
  const mudarInicio = (d: string) => valida(d) && setPeriodo(tipo === 'dia' ? { inicio: d, fim: d } : tipo === 'semana' ? periodoDe('semana', segundaDe(d)) : tipo === 'mes' ? periodoDe('mes', d) : { inicio: d, fim: periodo.fim < d ? d : periodo.fim })
  const escopo = (): Escopo => ({ tipo, ...periodo, campanha: camp?.id, canais: agenteDefine ? [] : canais })
  const comecar = async () => {
    if (tipo === 'campanha' && !camp) return setErro('Escolha a campanha ou crie uma nova.')
    if (!valida(periodo.inicio) || !valida(periodo.fim)) return setErro('Confira a data: use dia, mês e ano completos.')
    setErro(null); setComecando(true)
    const e = escopo()
    try { await pr.aoComecar(e, tituloDe(e, camp)) } catch (x) { setErro(x instanceof Error ? x.message : 'Não foi possível começar.'); setComecando(false) }
  }

  if (caminho === 'post') return <ReaproveitarPost empresa={EMPRESA} contexto={{ campanha: camp, inicio: periodo.inicio, fim: periodo.fim, canais: agenteDefine ? [] : canais }} redesAtivas={ativas} aoVoltar={() => setCaminho('escolher')} aoCriadas={pr.aoEscreveu} />
  const textoPeriodo = `${NOME_ESCOPO[tipo]} ${dm(periodo.inicio)}${periodo.fim !== periodo.inicio ? ` a ${dm(periodo.fim)}` : ''}`
  return (
    <div className="pl-grade">
      <section className="mk-painel pl-principal">
        <h3 className="pl-passo"><span>1</span> O que vamos planejar?</h3>
        <p className="muted pl-passo-sub">Escolha o escopo do seu planejamento.</p>
        <div className="pl-opcoes" role="radiogroup">{OPCOES.map((o) => (
          <button key={o.tipo} type="button" role="radio" aria-checked={tipo === o.tipo} className={`pl-opcao${tipo === o.tipo ? ' ativa' : ''}`} onClick={() => escolher(o.tipo)}>
            <Icone nome={o.icone} tam={26} /><b>{o.nome}</b><small>{o.sub}</small></button>))}</div>

        <label className="pl-rotulo">Campanha deste planejamento {tipo !== 'campanha' && <small className="muted">(opcional)</small>}</label>
        <div className="pl-campanha">
          <span className="select-icone"><select value={camp?.id ?? ''} onChange={(e) => mudarCampanha(e.target.value)}>
            {(tipo !== 'campanha' || !pr.campanhas.length) && <option value="">{tipo === 'campanha' ? 'Nenhuma campanha cadastrada' : 'Nenhuma: conteúdo do dia a dia'}</option>}
            {pr.campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="__nova">+ Nova campanha…</option></select></span>
          {ativa && <span className="pl-ativa"><i /> Ativa</span>}
        </div>
        {camp && <small className="muted">Oferta, datas e orientações da campanha acompanham o planejamento.</small>}

        <div className="pl-datas">
          {tipo === 'mes'
            ? <label>Mês<input type="month" value={periodo.inicio.slice(0, 7)} onChange={(e) => e.target.value && mudarInicio(e.target.value + '-01')} /></label>
            : <label>{tipo === 'dia' ? 'Dia' : 'Início'}<input type="date" value={digitado} onChange={(e) => { setDigitado(e.target.value); mudarInicio(e.target.value) }} /></label>}
          {tipo !== 'dia' && tipo !== 'mes' && <label>Fim<input type="date" value={periodo.fim} min={periodo.inicio} disabled={tipo === 'semana'} onChange={(e) => valida(e.target.value) && setPeriodo({ ...periodo, fim: e.target.value })} /></label>}
          {camp?.inicio && <div className="pl-periodo-camp"><small className="muted">Período da campanha:</small><b>{dm(camp.inicio)}{camp.fim ? ` a ${dm(camp.fim)}` : ''}</b></div>}
        </div>

        <label className="pl-rotulo">Canais</label>
        <Canais ativas={ativas} canais={canais} agente={agenteDefine} aoMudar={setCanais} aoAgente={setAgenteDefine} />

        <hr className="pl-divisao" />
        <h3 className="pl-passo"><span>2</span> Como você quer começar?</h3>
        <p className="muted pl-passo-sub">Escolha a forma de iniciar. Cada opção leva a um próximo passo diferente.</p>
        {caminho === 'direto'
          ? <DecidirDireto inicio={periodo.inicio} fim={periodo.fim} campanha={camp} aoEscreveu={pr.aoEscreveu} aoGuardou={pr.aoGuardou} aoVoltar={() => setCaminho('escolher')} />
          : <>
            <div className="pl-caminhos">
              <div className="pl-caminho destaque">
                <b><Icone nome="mensagem" tam={22} /> Fazer uma reunião com o agente</b>
                <p className="muted">Converse sobre objetivos, público, campanha e ideias. O agente organiza o briefing com você antes de propor os conteúdos.</p>
                <span className="pl-etiqueta">Antes do briefing</span>
                <button type="button" className="btn btn-ouro" disabled={comecando} onClick={comecar}>{comecando ? 'Abrindo a reunião…' : 'Iniciar reunião'} <Icone nome="seta_dir" tam={15} /></button>
              </div>
              <div className="pl-caminho">
                <b><Icone nome="documento" tam={22} /> Já sei o que quero postar</b>
                <p className="muted">Informe tema, canal e formato. O agente estrutura seu pedido para você revisar.</p>
                <button type="button" className="btn btn-contorno" onClick={() => setCaminho('direto')}>Descrever meu pedido <Icone nome="seta_dir" tam={15} /></button>
              </div>
              <div className="pl-caminho">
                <b><Icone nome="trocar" tam={22} /> Reaproveitar um post com resultado</b>
                <p className="muted">Escolha entre os posts da sua conta do Instagram e defina o que manter ou mudar.</p>
                <span className="pl-fonte"><LogoRede rede="instagram" tam={14} /> Posts e métricas da conta conectada</span>
                <button type="button" className="btn btn-contorno" onClick={() => setCaminho('post')}>Escolher um post <Icone nome="seta_dir" tam={15} /></button>
              </div>
            </div>
            <p className="muted pequeno pl-rodape"><Icone nome="info" tam={14} /> Você revisa o briefing e a proposta antes de criar as peças.</p>
          </>}
        <Erro msg={erro} />
      </section>
      <aside className="pl-lado">
        <Retomar recentes={pr.recentes} aoAbrir={pr.aoContinuar} />
        <NestePlanejamento periodo={textoPeriodo} campanha={camp ? { nome: camp.nome, ativa } : undefined} canais={canais} agenteDefine={agenteDefine} />
      </aside>
    </div>
  )
}
