// Planejar: você diz exatamente o que entra em cada dia (posts, carrosséis, reels e sequências de stories)
// e o agente escreve tudo de uma vez, dentro da campanha escolhida.
import { useEffect, useState } from 'react'
import { Campo, Erro, InputNumero, Modal } from '../../../components/ui'
import { AnexosPedido, type Anexo } from '../AnexosPedido'
import { diaCurto, somaDias } from '../comum'
import { COR_TIPO } from './etapas'
import { pedirTrabalho, type Campanha } from './useMarketing'

type Linha = { dia: string; post: number; carrossel: number; reels: number; stories: number }
const COLUNAS: { k: keyof Omit<Linha, 'dia'>; nome: string }[] = [
  { k: 'post', nome: 'Post' }, { k: 'carrossel', nome: 'Carrossel' }, { k: 'reels', nome: 'Reels' }, { k: 'stories', nome: 'Stories' },
]

// sugestão inicial: carrossel e reels alternados, stories todo dia
function sugestao(inicio: string, dias: number): Linha[] {
  return Array.from({ length: dias }, (_, i) => ({ dia: somaDias(inicio, i), post: 0, carrossel: i % 3 === 0 ? 1 : 0, reels: i % 3 === 1 ? 1 : 0, stories: 1 }))
}

export function Planejar({ aberto, aoFechar, inicioPadrao, campanhas, campanhaPadrao, aoPedir, aoCriarCampanha }: {
  aberto: boolean; aoFechar: () => void; inicioPadrao: string; campanhas: Campanha[]; campanhaPadrao: string; aoPedir: () => void; aoCriarCampanha: () => void
}) {
  const [inicio, setInicio] = useState(inicioPadrao)
  const [dias, setDias] = useState(7)
  const [linhas, setLinhas] = useState<Linha[]>(() => sugestao(inicioPadrao, 7))
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
    if (!preenchido) { setInicio(inicioPadrao); setLinhas(sugestao(inicioPadrao, dias)); setPreenchido(true) }
  }, [aberto, campanhaPadrao]) // eslint-disable-line react-hooks/exhaustive-deps

  // mudar início ou quantidade de dias mantém o que já foi escolhido em cada posição
  const remontar = (novoInicio: string, n: number) => {
    setInicio(novoInicio); setDias(n)
    setLinhas((atual) => Array.from({ length: n }, (_, i) => ({ ...(atual[i] ?? { post: 0, carrossel: 0, reels: 0, stories: 1 }), dia: somaDias(novoInicio, i) })))
  }
  const fechar = () => { setPreenchido(false); aoFechar() }
  const muda = (i: number, k: keyof Omit<Linha, 'dia'>, v: number) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const repetirPrimeiro = () => setLinhas((ls) => ls.map((l) => ({ ...ls[0], dia: l.dia })))
  const total = (k: keyof Omit<Linha, 'dia'>) => linhas.reduce((s, l) => s + l[k], 0)
  const nada = COLUNAS.every((c) => total(c.k) === 0)

  const pedir = async () => {
    setErro(null); setEnviando(true)
    const c = campanhas.find((x) => x.id === campanha) ?? null
    const plano = linhas.filter((l) => l.post + l.carrossel + l.reels + l.stories > 0)
    const msg = await pedirTrabalho('semana', { modo: 'plano', semana_inicio: inicio, dias, plano, stories_telas: telas, campanha: c, foco: foco.trim() || null, anexos })
    setEnviando(false)
    if (msg) return setErro(msg)
    setAnexos([]); setFoco(''); setPreenchido(false); aoPedir()
  }

  return (
    <Modal titulo="Planejar conteúdo" aberto={aberto} onFechar={fechar} largo>
      <div className="mk-form">
        <div className="mk-plan-topo">
          <Campo rotulo="Começa em"><input type="date" value={inicio} onChange={(e) => remontar(e.target.value, dias)} /></Campo>
          <Campo rotulo="Quantos dias"><InputNumero valor={dias} min={1} max={14} onChange={(v) => remontar(inicio, v ?? 1)} /></Campo>
          <Campo rotulo="Telas por stories" dica="Em cada sequência"><InputNumero valor={telas} min={2} max={15} onChange={(v) => setTelas(v ?? 5)} /></Campo>
          <Campo rotulo="Campanha">
            <select value={campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha() : setCampanha(e.target.value))}>
              <option value="">Sem campanha</option>
              {campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__nova">+ Nova campanha…</option>
            </select>
          </Campo>
        </div>

        <div className="mk-plan">
          <div className="mk-plan-linha mk-plan-cab"><span>Dia</span>{COLUNAS.map((c) => <span key={c.k} style={{ ['--cor-tipo' as string]: COR_TIPO[c.k] }}>{c.nome}</span>)}</div>
          {linhas.map((l, i) => (
            <div key={l.dia} className="mk-plan-linha">
              <span className="mk-plan-dia">{diaCurto(l.dia)}</span>
              {COLUNAS.map((c) => <InputNumero key={c.k} valor={l[c.k]} min={0} max={5} onChange={(v) => muda(i, c.k, v ?? 0)} />)}
            </div>
          ))}
          <div className="mk-plan-linha mk-plan-total"><span>Total</span>{COLUNAS.map((c) => <b key={c.k}>{total(c.k)}</b>)}</div>
        </div>
        <p className="pequeno muted">Stories = quantas sequências naquele dia (cada uma com {telas} telas). <button type="button" className="link" onClick={repetirPrimeiro}>Repetir o 1º dia em todos</button></p>

        <AnexosPedido anexos={anexos} aoMudar={setAnexos} />
        <Campo rotulo="Foco (opcional)" dica="Ex.: últimas vagas do módulo de toxina; falar de segurança"><textarea rows={2} value={foco} onChange={(e) => setFoco(e.target.value)} /></Campo>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={fechar}>Cancelar</button><button className="btn btn-ouro" disabled={enviando || nada} onClick={pedir}>{enviando ? 'Enviando…' : 'O agente escreve tudo'}</button></div>
      </div>
    </Modal>
  )
}
