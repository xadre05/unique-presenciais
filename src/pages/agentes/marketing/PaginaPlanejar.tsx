// Planejar conteúdos (página): à esquerda a direção do planejamento (período, objetivo, público, campanha, canais,
// volume, distribuição e orientação); à direita a proposta de calendário do agente para revisar e aprovar.
// Ver docs/agentes/REGRAS_AGENTE_MARKETING.md (regra 5: planejar e produzir são passos separados).
import { Voltar } from '../../../components/Voltar'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { Erro, InputNumero } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { segundaDe, somaDias, type Peca } from '../comum'
import { mudarPeca } from './etapas'
import { REDES, nomeFormato, useRedes, type Formato, type Rede } from './redes'
import { LogoRede } from './LogoRede'
import { OBJETIVOS, PUBLICOS } from './textos'
import { marcarPlano, nomePadrao, salvarPlano, type Briefing, type Plano } from './planos'
import { EMPRESA, criarTrabalho, pedirTrabalho, type Campanha } from './useMarketing'
import { PropostaCalendario } from './PropostaCalendario'

type Modo = 'dia' | 'semana' | 'mes' | 'periodo'
const MODOS: { id: Modo; nome: string }[] = [{ id: 'dia', nome: 'Dia' }, { id: 'semana', nome: 'Semana' }, { id: 'mes', nome: 'Mês' }, { id: 'periodo', nome: 'Período' }]
const NOME_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const FORMATOS_PADRAO: Record<Rede, Formato[]> = { instagram: ['carrossel', 'reels', 'stories'], youtube: ['video', 'reels'], tiktok: ['reels'], facebook: ['post'], linkedin: ['post'], pinterest: ['post'], threads: ['texto'], email: ['email'], whatsapp: ['mensagem'], site: ['artigo'] }

function intervalo(modo: Modo, data: string, ate: string) {
  if (modo === 'dia') return { inicio: data, fim: data }
  if (modo === 'semana') { const i = segundaDe(data); return { inicio: i, fim: somaDias(i, 6) } }
  if (modo === 'mes') { const i = data.slice(0, 8) + '01'; const d = new Date(i + 'T12:00:00'); return { inicio: i, fim: new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10) } }
  return { inicio: data, fim: ate < data ? data : ate }
}
const datasEntre = (a: string, b: string) => { const r: string[] = []; for (let d = a; d <= b && r.length < 92; d = somaDias(d, 1)) r.push(d); return r }
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

type Props = { planoInicial: Plano | null; modoInicial: Modo; dataInicial: string; campanhas: Campanha[]; campanhaPadrao: string; aoCriarCampanha: () => void; aoVoltar: () => void; aoMudou: () => void }

export function PaginaPlanejar(pr: Props) {
  const redes = useRedes()
  const b = pr.planoInicial?.briefing
  const [plano, setPlano] = useState<Plano | null>(pr.planoInicial)
  const [modo, setModo] = useState<Modo>((b?.modo as Modo) ?? pr.modoInicial)
  const [data, setData] = useState(pr.planoInicial?.inicio ?? pr.dataInicial)
  const [ate, setAte] = useState(pr.planoInicial?.fim ?? somaDias(pr.dataInicial, 13))
  const [objetivo, setObjetivo] = useState(b?.objetivo ?? OBJETIVOS[0])
  const [publico, setPublico] = useState(b?.publico ?? PUBLICOS[0])
  const [campanha, setCampanha] = useState(b?.campanha ?? pr.campanhaPadrao)
  const [canais, setCanais] = useState<{ rede: Rede; formatos: Formato[] }[]>((b?.canais as { rede: Rede; formatos: Formato[] }[]) ?? redes.slice(0, 3).map((r) => ({ rede: r, formatos: FORMATOS_PADRAO[r] })))
  const [total, setTotal] = useState(b?.total ?? 6)
  const [diasSemana, setDiasSemana] = useState(b?.diasSemana ?? [1, 2, 3, 4, 5, 6, 0])
  const [orientacao, setOrientacao] = useState(b?.orientacao ?? '')
  const [link, setLink] = useState(b?.link ?? '')
  const [distribuicao, setDistribuicao] = useState(false)
  const [trabalho, setTrabalho] = useState<string | null>(null)
  const [resumo, setResumo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => setCampanha((c) => c || pr.campanhaPadrao), [pr.campanhaPadrao])

  const pecas = useConsulta<Peca[]>(() => plano ? supabase.from('agentes_pecas').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').eq('conteudo->>plano', plano.id).neq('status', 'descartada').order('dia').order('ordem') : Promise.resolve({ data: [], error: null }), [plano?.id])
  // enquanto o agente monta (ou ajusta) a proposta, confere a cada 3 segundos
  useEffect(() => {
    if (!trabalho) return
    const t = setInterval(async () => {
      const { data: tr } = await supabase.from('agentes_trabalhos').select('status,erro,resumo').eq('id', trabalho).maybeSingle()
      if (tr?.status === 'pronto') { setTrabalho(null); setResumo(tr.resumo); pecas.recarregar(); pr.aoMudou() }
      if (tr?.status === 'erro') { setTrabalho(null); setErro(tr.erro) }
    }, 3000)
    return () => clearInterval(t)
  }, [trabalho]) // eslint-disable-line react-hooks/exhaustive-deps

  const { inicio, fim } = intervalo(modo, data, ate)
  const datas = datasEntre(inicio, fim).filter((d) => modo === 'dia' || diasSemana.includes(new Date(d + 'T12:00:00').getDay()))
  const briefing = (): Briefing => ({ modo, objetivo, publico, campanha, canais, total, diasSemana, orientacao, link })
  const novoPlano = (status: Plano['status']): Plano => ({ id: plano?.id ?? crypto.randomUUID(), nome: plano?.nome ?? nomePadrao(modo, inicio, fim), inicio, fim, objetivo, status, criado_em: plano?.criado_em ?? new Date().toISOString(), briefing: briefing() })
  const pedido = (p: Plano) => ({
    plano: { id: p.id, nome: p.nome }, datas, unidade: 'periodo', total, objetivo, publico, tema: orientacao.trim() || null, orientacao: orientacao.trim() || null,
    link: link.trim() || null, campanha: pr.campanhas.find((x) => x.id === campanha) ?? null, canais: canais.filter((c) => c.formatos.length).map((c) => ({ ...c, quantidade: total })),
  })
  const lista = pecas.dados ?? []

  const sugerir = async () => {
    setErro(null)
    if (!canais.some((c) => c.formatos.length)) return setErro('Escolha pelo menos um canal com formato.')
    if (!datas.length) return setErro('Nenhuma data disponível nesse período.')
    const p = novoPlano('proposta')
    const r = await salvarPlano(p); if (r.error) return setErro(r.error.message)
    // se já havia proposta, a nova substitui a anterior
    const { id, erro: e } = await criarTrabalho('propor_plano', { ...pedido(p), substituir: lista.map((x) => x.id) })
    if (e || !id) return setErro(e ?? 'Não foi possível pedir a proposta.')
    setPlano(p); setTrabalho(id); setResumo(null); pr.aoMudou()
  }
  const ajustar = async (instrucao: string) => {
    if (!plano) return
    setErro(null)
    const { id, erro: e } = await criarTrabalho('propor_plano', { ...pedido(plano), ajuste: instrucao, substituir: lista.map((x) => x.id),
      anteriores: lista.map((x) => ({ dia: x.dia, rede: x.conteudo.rede ?? 'instagram', tipo: x.tipo, titulo: x.titulo, angulo: x.conteudo.objetivo })) })
    if (e || !id) return setErro(e ?? 'Não foi possível ajustar.')
    setTrabalho(id)
  }
  const salvarBriefing = async () => { const p = novoPlano(plano?.status === 'proposta' ? 'proposta' : 'briefing'); const r = await salvarPlano(p); if (r.error) return setErro(r.error.message); setPlano(p); pr.aoMudou() }
  const acrescentar = async () => {
    if (!plano) return
    const m = await pedirTrabalho('ideia', { pecas: [{ tipo: 'carrossel', rede: 'instagram', dia: inicio, titulo: 'Nova peça', plano: plano.id, proposta: plano.status !== 'aprovado' }] })
    if (m) return setErro(m)
    setTimeout(() => pecas.recarregar(), 1500)
  }
  const aprovar = async () => {
    if (!plano) return
    setEnviando(true)
    await Promise.all(lista.map((p) => mudarPeca(p.id, { conteudo: { ...p.conteudo, proposta: undefined } })))
    await marcarPlano(plano.id, 'aprovado')
    setEnviando(false); pr.aoMudou(); pr.aoVoltar()
  }
  const alternarCanal = (r: Rede) => setCanais((cs) => (cs.some((c) => c.rede === r) ? cs.filter((c) => c.rede !== r) : [...cs, { rede: r, formatos: FORMATOS_PADRAO[r] }]))
  const alternarFormato = (r: Rede, f: Formato) => setCanais((cs) => cs.map((c) => (c.rede !== r ? c : { ...c, formatos: c.formatos.includes(f) ? c.formatos.filter((x) => x !== f) : [...c.formatos, f] })))
  const status = trabalho ? 'aguardando' : !lista.length ? 'vazio' : plano?.status === 'aprovado' ? 'aprovado' : 'proposta'

  return (
    <div className="mk-pagina-planejar">
      <Voltar aoClicar={pr.aoVoltar} texto="Voltar ao planejamento" />
      <div className="mk-titulo-aba"><h2>Planejar conteúdos{plano ? `: ${plano.nome}` : ''}</h2><p className="muted">Defina o objetivo e revise a distribuição antes de produzir.</p></div>
      <div className="mk-planejar-grade">
        <section className="mk-painel">
          <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="grafico" tam={22} /></span><h3>Direção do planejamento</h3></header>
          <dl className="mk-detalhes mk-direcao">
            <dt>Período</dt><dd><div className="mk-visoes">{MODOS.map((m) => <button key={m.id} type="button" className={modo === m.id ? 'ativa' : ''} onClick={() => setModo(m.id)}>{m.nome}</button>)}</div></dd>
            <dt />
            <dd className="form-duas">{modo === 'mes' ? <label>Mês<input type="month" value={data.slice(0, 7)} onChange={(e) => setData(e.target.value + '-01')} /></label>
              : modo === 'periodo' ? <><label>Início<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label><label>Fim<input type="date" value={ate} min={data} onChange={(e) => setAte(e.target.value)} /></label></>
              : <><label>Início<input type="date" value={modo === 'semana' ? inicio : data} onChange={(e) => setData(e.target.value)} /></label><label>Fim<input type="date" value={fim} disabled /></label></>}</dd>
            <dt>Objetivo do conteúdo</dt><dd><select value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</select></dd>
            <dt>Público-alvo</dt><dd><select value={publico} onChange={(e) => setPublico(e.target.value)}>{PUBLICOS.map((o) => <option key={o}>{o}</option>)}</select></dd>
            <dt>Campanha <small>(opcional)</small></dt><dd><select value={campanha} onChange={(e) => (e.target.value === '__nova' ? pr.aoCriarCampanha() : setCampanha(e.target.value))}><option value="">Sem campanha</option>{pr.campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__nova">+ Nova campanha…</option></select></dd>
            <dt>Canais</dt><dd><div className="mk-chips">{redes.map((r) => <button key={r} type="button" className={`mk-chip mk-chip-rede${canais.some((c) => c.rede === r) ? ' ativo' : ''}`} style={{ ['--cor-rede' as string]: REDES[r].cor }} onClick={() => alternarCanal(r)}><LogoRede rede={r} tam={15} />{REDES[r].nome}{canais.some((c) => c.rede === r) && ' ×'}</button>)}</div></dd>
            <dt>Volume total</dt><dd><InputNumero valor={total} min={1} max={40} sufixo="peças" onChange={(v) => setTotal(v ?? 1)} /></dd>
          </dl>
          <button type="button" className={`mk-secao-cab mk-opcionais${distribuicao ? ' aberta' : ''}`} onClick={() => setDistribuicao(!distribuicao)}><Icone nome="agenda" tam={18} /><b>Distribuição e disponibilidade</b><Icone nome="seta" tam={16} /></button>
          {distribuicao && (
            <div className="mk-form mk-distribuicao">
              {canais.map((c) => <div key={c.rede} className="mk-dias-semana"><b style={{ color: REDES[c.rede].cor }}><LogoRede rede={c.rede} tam={15} /> {REDES[c.rede].nome}:</b>{REDES[c.rede].formatos.map((f) => <button key={f} type="button" className={`mk-chip mini${c.formatos.includes(f) ? ' ativo' : ''}`} onClick={() => alternarFormato(c.rede, f)}>{nomeFormato(f, c.rede)}</button>)}</div>)}
              {modo !== 'dia' && <div className="mk-dias-semana"><span className="muted pequeno">Dias em que vocês postam:</span>{[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} type="button" className={`mk-chip mini${diasSemana.includes(d) ? ' ativo' : ''}`} onClick={() => setDiasSemana((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>{NOME_DIA[d]}</button>)}</div>}
              <span className="pequeno muted">{datas.length} {datas.length === 1 ? 'data disponível' : 'datas disponíveis'}.</span>
            </div>
          )}
          <label className="mk-rotulo">Orientação para a IA</label>
          <textarea rows={3} maxLength={500} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} placeholder="Ex.: equilibrar conteúdo educativo, apresentação da formação e dúvidas frequentes" />
          <span className="pequeno muted mk-contador">{orientacao.length}/500</span>
          <label className="mk-rotulo">Link de referência (opcional)</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
          <Erro msg={erro} />
          <footer className="mk-criar-rodape">
            <button className="btn btn-ouro" disabled={!!trabalho} onClick={sugerir}><Icone nome="floco" tam={16} /> {lista.length ? 'Sugerir de novo' : 'Sugerir planejamento'}</button>
            <button className="btn btn-contorno-ouro" onClick={salvarBriefing}><Icone nome="documento" tam={16} /> Salvar briefing</button>
          </footer>
        </section>
        <PropostaCalendario pecas={lista} status={status as 'vazio' | 'aguardando' | 'proposta' | 'aprovado'} periodo={`${dm(inicio)}–${dm(fim)}`} resumo={resumo} erro={null}
          aoMudar={pecas.recarregar} aoAcrescentar={acrescentar} aoAjustar={ajustar} aoSalvar={() => { salvarBriefing(); pr.aoVoltar() }} aoAprovar={aprovar} enviando={enviando || !!trabalho} />
      </div>
    </div>
  )
}
