// Planejar com o agente de Marketing. Passo 1: o que vamos planejar (hoje, próximos dias, semana, mês ou campanha),
// a campanha, o período e os canais (ou o agente define). Passo 2: como começar — reunião com o agente, pedido direto
// ou reaproveitar um post com resultado (página própria). À direita: retomar de onde parou e o resumo do planejamento.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { hojeISO, inicioDaSemana } from '../../comum'
import { situacaoCampanha } from '../../campanhas/dados'
import { useRedes } from '../redes'
import type { Campanha } from '../useMarketing'
import { periodoDe, tituloDe, type Escopo, type Reuniao, type TipoEscopo } from './dados'
import { DecidirDireto } from './DecidirDireto'
import { PacoteCriativos } from './PacoteCriativos'
import { NestePlanejamento, Retomar } from './LadoPlanejar'
import { CanaisPlanejar } from './CanaisPlanejar'

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
  tipoInicial: TipoEscopo; dataInicial: string; campanhas: Campanha[]; recentes: Reuniao[]; campanhaInicial?: string; caminhoInicial?: 'pacote'
  aoComecar: (escopo: Escopo, titulo: string) => Promise<void>; aoContinuar: (id: string) => void; aoGuardou: () => void; aoEscreveu: (ids: string[]) => void; aoCriarCampanha: () => void
  aoReaproveitar: (contexto: ContextoPlanejar) => void
}
export type ContextoPlanejar = { campanha?: Campanha; inicio: string; fim: string; canais: string[] }

export function EscolhaEscopo(pr: Props) {
  const ativas = useRedes()
  const [tipo, setTipo] = useState<TipoEscopo>(pr.tipoInicial)
  const [campanha, setCampanha] = useState(pr.campanhaInicial ?? (pr.tipoInicial === 'campanha' ? pr.campanhas[0]?.id ?? '' : ''))
  const [periodo, setPeriodo] = useState(() => periodoDe(pr.tipoInicial, pr.dataInicial || hojeISO(), pr.campanhas.find((c) => c.id === pr.campanhaInicial)))
  const [digitado, setDigitado] = useState(periodo.inicio)
  const [canais, setCanais] = useState<string[]>(ativas)
  const [agenteDefine, setAgenteDefine] = useState(false)
  const [comecando, setComecando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [caminho, setCaminho] = useState<'escolher' | 'direto' | 'pacote'>(pr.caminhoInicial ?? 'escolher')
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
  const mudarInicio = (d: string) => valida(d) && setPeriodo(tipo === 'dia' ? { inicio: d, fim: d } : tipo === 'semana' ? periodoDe('semana', inicioDaSemana(d)) : tipo === 'mes' ? periodoDe('mes', d) : { inicio: d, fim: periodo.fim < d ? d : periodo.fim })
  const escopo = (): Escopo => ({ tipo, ...periodo, campanha: camp?.id, canais: agenteDefine ? [] : canais })
  const comecar = async () => {
    if (tipo === 'campanha' && !camp) return setErro('Escolha a campanha ou crie uma nova.')
    if (!valida(periodo.inicio) || !valida(periodo.fim)) return setErro('Confira a data: use dia, mês e ano completos.')
    setErro(null); setComecando(true)
    const e = escopo()
    try { await pr.aoComecar(e, tituloDe(e, camp)) } catch (x) { setErro(x instanceof Error ? x.message : 'Não foi possível começar.'); setComecando(false) }
  }

  const canaisDosCaminhos = agenteDefine ? [] : canais
  const caminhos = [
    { id: 'reuniao', icone: 'mensagem', nome: 'Fazer uma reunião com o agente', acao: 'Iniciar reunião', aoClicar: comecar, gasta: true,
      texto: 'Converse sobre objetivo, público e ideias. O agente monta o briefing com você antes de propor os conteúdos.',
      custo: 'Usa créditos: o agente já responde ao abrir, cerca de 4 créditos por resposta' },
    { id: 'direto', icone: 'documento', nome: 'Já sei o que quero postar', acao: 'Descrever pedido', aoClicar: () => setCaminho('direto'), gasta: false,
      texto: 'Você informa tema, canal, formato e dia de cada peça, sem conversa.',
      custo: 'Abrir não gasta. Só gasta quando você mandar o agente escrever' },
    ...(camp ? [{ id: 'pacote', icone: 'floco', nome: 'Pacote de criativos da campanha', acao: 'Montar pacote', gasta: false, aoClicar: () => setCaminho('pacote'),
      texto: 'Anúncios com ganchos para testar, stories com link, reels para gravar e carrosséis, escritos com os materiais da campanha.',
      custo: 'Abrir não gasta. Só gasta quando você mandar criar' }] : []),
    { id: 'reaproveitar', icone: 'trocar', nome: 'Reaproveitar um post com resultado', acao: 'Escolher post', gasta: false,
      aoClicar: () => pr.aoReaproveitar({ campanha: camp, inicio: periodo.inicio, fim: periodo.fim, canais: canaisDosCaminhos }),
      texto: 'Escolha um post do Instagram que foi bem e diga o que manter ou mudar.',
      custo: 'Abrir não gasta. Só gasta quando você pedir a nova versão' },
  ]
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
        <CanaisPlanejar ativas={ativas} canais={canais} agente={agenteDefine} aoMudar={setCanais} aoAgente={setAgenteDefine} />

        <hr className="pl-divisao" />
        <h3 className="pl-passo"><span>2</span> Como você quer começar?</h3>
        <p className="muted pl-passo-sub">Escolha a forma de iniciar. Cada opção leva a um próximo passo diferente.</p>
        {caminho === 'pacote' && camp
          ? <PacoteCriativos campanha={camp} inicio={periodo.inicio} fim={periodo.fim} aoEscreveu={pr.aoEscreveu} aoVoltar={() => setCaminho('escolher')} />
          : caminho === 'direto'
          ? <DecidirDireto canais={canaisDosCaminhos} inicio={periodo.inicio} fim={periodo.fim} campanha={camp} aoEscreveu={pr.aoEscreveu} aoGuardou={pr.aoGuardou} aoVoltar={() => setCaminho('escolher')} />
          : <>
            <div className="pl-caminhos">{caminhos.map((c) => (
              <button key={c.id} type="button" className="pl-caminho" disabled={comecando} onClick={c.aoClicar}>
                <Icone nome={c.icone} tam={22} />
                <span className="pl-caminho-texto"><b>{c.nome}</b><span className="muted">{c.texto}</span>
                  <small className={`pl-custo${c.gasta ? ' gasta' : ''}`}><Icone nome={c.gasta ? 'floco' : 'check'} tam={12} /> {c.custo}</small></span>
                <span className="pl-acao">{c.id === 'reuniao' && comecando ? 'Abrindo…' : c.acao} <Icone nome="seta_dir" tam={14} /></span>
              </button>))}
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
