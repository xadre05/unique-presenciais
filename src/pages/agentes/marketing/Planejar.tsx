// Planejar: você escolhe a rede e diz exatamente o que entra em cada dia (os formatos daquela rede)
// e o agente escreve tudo de uma vez, dentro da campanha escolhida.
import { useEffect, useState } from 'react'
import { Campo, Erro, InputNumero, Modal } from '../../../components/ui'
import { AnexosPedido, type Anexo } from '../AnexosPedido'
import { diaCurto, somaDias } from '../comum'
import { COR_TIPO } from './etapas'
import { LISTA_REDES, REDES, nomeFormato, type Formato, type Rede } from './redes'
import { pedirTrabalho, type Campanha } from './useMarketing'

type Qtd = Record<Formato, number>
type Linha = Qtd & { dia: string }
const ZERO: Qtd = { post: 0, carrossel: 0, reels: 0, stories: 0, video: 0 }

// sugestão inicial por rede: algo leve que dê para cumprir
function sugestaoDia(rede: Rede, i: number): Qtd {
  if (rede === 'instagram') return { ...ZERO, carrossel: i % 3 === 0 ? 1 : 0, reels: i % 3 === 1 ? 1 : 0, stories: 1 }
  if (rede === 'tiktok') return { ...ZERO, reels: 1 }
  if (rede === 'youtube') return { ...ZERO, reels: i % 2 === 0 ? 1 : 0, video: i === 3 ? 1 : 0 }
  if (rede === 'facebook') return { ...ZERO, post: i % 2 === 0 ? 1 : 0, reels: i % 2 === 1 ? 1 : 0 }
  return { ...ZERO, post: i % 2 === 0 ? 1 : 0 }
}
const sugestao = (rede: Rede, inicio: string, dias: number): Linha[] => Array.from({ length: dias }, (_, i) => ({ ...sugestaoDia(rede, i), dia: somaDias(inicio, i) }))

export function Planejar({ aberto, aoFechar, inicioPadrao, diasPadrao, campanhas, campanhaPadrao, aoPedir, aoCriarCampanha }: {
  aberto: boolean; aoFechar: () => void; inicioPadrao: string; diasPadrao: number; campanhas: Campanha[]; campanhaPadrao: string; aoPedir: () => void; aoCriarCampanha: () => void
}) {
  const [rede, setRede] = useState<Rede>('instagram')
  const [inicio, setInicio] = useState(inicioPadrao)
  const [dias, setDias] = useState(diasPadrao)
  const [linhas, setLinhas] = useState<Linha[]>(() => sugestao('instagram', inicioPadrao, diasPadrao))
  const [antes, setAntes] = useState<Linha[] | null>(null)
  const [telas, setTelas] = useState(5)
  const [campanha, setCampanha] = useState(campanhaPadrao)
  const [foco, setFoco] = useState('')
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [preenchido, setPreenchido] = useState(false)
  useEffect(() => {
    if (!aberto) return
    setCampanha(campanhaPadrao)
    // ao voltar de "Nova campanha", mantém a grade que já estava preenchida
    if (!preenchido) { setInicio(inicioPadrao); setDias(diasPadrao); setLinhas(sugestao(rede, inicioPadrao, diasPadrao)); setAntes(null); setPreenchido(true) }
  }, [aberto, campanhaPadrao]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatos = REDES[rede].formatos
  // mudar início ou quantidade de dias mantém o que já foi escolhido em cada posição
  const remontar = (novoInicio: string, n: number) => {
    setInicio(novoInicio); setDias(n)
    setLinhas((atual) => Array.from({ length: n }, (_, i) => ({ ...(atual[i] ?? sugestaoDia(rede, i)), dia: somaDias(novoInicio, i) })))
  }
  const trocarRede = (r: Rede) => { setRede(r); setLinhas(sugestao(r, inicio, dias)); setAntes(null) }
  const fechar = () => { setPreenchido(false); aoFechar() }
  const muda = (i: number, k: Formato, v: number) => { setAntes(null); setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l))) }
  const repetirPrimeiro = () => { setAntes(linhas); setLinhas((ls) => ls.map((l) => ({ ...ls[0], dia: l.dia }))) }
  const desfazer = () => { if (antes) setLinhas(antes); setAntes(null) }
  const zerar = () => { setAntes(linhas); setLinhas((ls) => ls.map((l) => ({ ...ZERO, dia: l.dia }))) }
  const total = (k: Formato) => linhas.reduce((s, l) => s + l[k], 0)
  const nada = formatos.every((f) => total(f) === 0)

  const pedir = async () => {
    setErro(null); setEnviando(true)
    const c = campanhas.find((x) => x.id === campanha) ?? null
    // só os formatos da rede escolhida vão no pedido
    const plano = linhas.map((l) => ({ dia: l.dia, ...Object.fromEntries(formatos.map((f) => [f, l[f]])) })).filter((l) => formatos.some((f) => Number((l as Record<string, unknown>)[f]) > 0))
    const msg = await pedirTrabalho('semana', { modo: 'plano', rede, semana_inicio: inicio, dias, plano, stories_telas: telas, campanha: c, foco: foco.trim() || null, anexos })
    setEnviando(false)
    if (msg) return setErro(msg)
    setAnexos([]); setFoco(''); setPreenchido(false); aoPedir()
  }

  return (
    <Modal titulo="Planejar conteúdo" aberto={aberto} onFechar={fechar} largo>
      <div className="mk-form">
        <Campo rotulo="Rede">
          <div className="mk-chips">{LISTA_REDES.map((r) => <button key={r} type="button" className={`mk-chip${rede === r ? ' ativo' : ''}`} onClick={() => trocarRede(r)}>{REDES[r].nome}</button>)}</div>
        </Campo>
        <div className="mk-plan-topo">
          <Campo rotulo="Começa em"><input type="date" value={inicio} onChange={(e) => remontar(e.target.value, dias)} /></Campo>
          <Campo rotulo="Quantos dias"><InputNumero valor={dias} min={1} max={14} onChange={(v) => remontar(inicio, v ?? 1)} /></Campo>
          {formatos.includes('stories') && <Campo rotulo="Telas por stories" dica="Em cada sequência"><InputNumero valor={telas} min={2} max={15} onChange={(v) => setTelas(v ?? 5)} /></Campo>}
          <Campo rotulo="Campanha">
            <select value={campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha() : setCampanha(e.target.value))}>
              <option value="">Sem campanha</option>
              {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__nova">+ Nova campanha…</option>
            </select>
          </Campo>
        </div>

        <div className="mk-plan" style={{ ['--colunas' as string]: formatos.length }}>
          <div className="mk-plan-linha mk-plan-cab"><span>Dia</span>{formatos.map((f) => <span key={f} style={{ ['--cor-tipo' as string]: COR_TIPO[f] }}>{nomeFormato(f, rede)}</span>)}</div>
          {linhas.map((l, i) => (
            <div key={l.dia} className="mk-plan-linha">
              <span className="mk-plan-dia">{diaCurto(l.dia)}</span>
              {formatos.map((f) => <InputNumero key={f} valor={l[f]} min={0} max={5} onChange={(v) => muda(i, f, v ?? 0)} />)}
            </div>
          ))}
          <div className="mk-plan-linha mk-plan-total"><span>Total</span>{formatos.map((f) => <b key={f}>{total(f)}</b>)}</div>
        </div>
        <p className="pequeno muted mk-plan-acoes">
          {formatos.includes('stories') && <span>Stories = quantas sequências naquele dia (cada uma com {telas} telas).</span>}
          {dias > 1 && <button type="button" className="link" onClick={repetirPrimeiro}>Repetir o 1º dia em todos</button>}
          <button type="button" className="link" onClick={zerar}>Zerar tudo</button>
          {antes && <button type="button" className="btn btn-mini" onClick={desfazer}>Desfazer</button>}
        </p>

        <AnexosPedido anexos={anexos} aoMudar={setAnexos} />
        <Campo rotulo="Foco (opcional)" dica="Ex.: últimas vagas do módulo de toxina; falar de segurança"><textarea rows={2} value={foco} onChange={(e) => setFoco(e.target.value)} /></Campo>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={fechar}>Cancelar</button><button className="btn btn-ouro" disabled={enviando || nada} onClick={pedir}>{enviando ? 'Enviando…' : 'O agente escreve tudo'}</button></div>
      </div>
    </Modal>
  )
}
