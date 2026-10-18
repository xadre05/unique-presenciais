// Formulário para pedir trabalho ao agente de Marketing: uma peça avulsa ou o conteúdo de alguns dias (1 a 14).
import { useState } from 'react'
import { Campo, InputNumero } from '../../components/ui'
import { AnexosPedido, type Anexo } from './AnexosPedido'
import { TIPO_PECA, hojeISO, proximaSegunda, somaDias } from './comum'

const amanha = () => somaDias(hojeISO(), 1)

export type ModoPedido = 'peca' | 'dias'
type TipoPeca = 'post' | 'carrossel' | 'reels' | 'stories'

const ATALHOS_DIAS: { rotulo: string; dias: number; hoje?: boolean }[] = [
  { rotulo: 'Só hoje', dias: 1, hoje: true }, { rotulo: 'Amanhã', dias: 1 }, { rotulo: '3 dias', dias: 3 }, { rotulo: 'Semana', dias: 7 }, { rotulo: '2 semanas', dias: 14 },
]

function montarPedido(modo: ModoPedido, tipo: TipoPeca, f: { inicio: string; dia: string; dias: number; posts: number; reels: number; stories: number; telas: number; foco: string }, anexos: Anexo[]) {
  const foco = f.foco.trim() || null
  if (modo === 'peca') {
    return { modo, tipo_peca: tipo, semana_inicio: f.dia, dias: 1, posts: tipo === 'post' || tipo === 'carrossel' ? 1 : 0, reels: tipo === 'reels' ? 1 : 0, stories: tipo === 'stories' ? 1 : 0, stories_telas: f.telas, foco, anexos }
  }
  return { modo, semana_inicio: f.inicio, dias: f.dias, posts: f.posts, reels: f.reels, stories: Math.min(f.stories, f.dias), stories_telas: f.telas, foco, anexos }
}

export function PedidoMarketing({ modoInicial, ocupado, aoPedir }: { modoInicial: ModoPedido; ocupado: boolean; aoPedir: (pedido: Record<string, unknown>) => Promise<boolean> }) {
  const [modo, setModo] = useState<ModoPedido>(modoInicial)
  const [tipo, setTipo] = useState<TipoPeca>('reels')
  const [f, setF] = useState({ inicio: proximaSegunda(), dia: hojeISO(), dias: 7, posts: 3, reels: 2, stories: 7, telas: 5, foco: '' })
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [enviando, setEnviando] = useState(false)
  const muda = (campos: Partial<typeof f>) => setF((x) => ({ ...x, ...campos }))
  const escolherDias = (a: (typeof ATALHOS_DIAS)[number]) => {
    const inicio = a.hoje ? hojeISO() : a.dias === 1 ? amanha() : f.inicio
    muda({ dias: a.dias, inicio, stories: Math.min(Math.max(f.stories, a.dias === 1 ? 1 : f.stories), a.dias), posts: Math.min(f.posts, a.dias * 2), reels: Math.min(f.reels, a.dias * 2) })
  }
  const pedir = async () => {
    setEnviando(true)
    const ok = await aoPedir(montarPedido(modo, tipo, f, anexos))
    setEnviando(false)
    if (ok) setAnexos([])
  }
  const nada = modo === 'dias' && f.posts + f.reels + Math.min(f.stories, f.dias) === 0
  const botao = ocupado ? 'O agente está trabalhando…' : enviando ? 'Enviando…' : modo === 'peca' ? `Fazer ${TIPO_PECA[tipo].toLowerCase()}` : f.dias === 1 ? 'Montar o dia' : f.dias === 7 ? 'Montar a semana' : `Montar ${f.dias} dias`

  return (
    <section className="bloco">
      <div className="bloco-topo">
        <h2>Pedir ao agente</h2>
        <div className="agente-modos" role="tablist">
          <button className={modo === 'peca' ? 'ativa' : ''} onClick={() => setModo('peca')}>Uma peça</button>
          <button className={modo === 'dias' ? 'ativa' : ''} onClick={() => setModo('dias')}>Alguns dias ou semana</button>
        </div>
      </div>

      {modo === 'peca' ? (
        <div className="agente-pedido">
          <Campo rotulo="O que fazer">
            <div className="chips">{(Object.keys(TIPO_PECA) as TipoPeca[]).map((t) => <button key={t} type="button" className={`chip${tipo === t ? ' ativo' : ''}`} onClick={() => setTipo(t)}>{TIPO_PECA[t]}</button>)}</div>
          </Campo>
          <Campo rotulo="Para o dia"><input type="date" value={f.dia} onChange={(e) => muda({ dia: e.target.value })} /></Campo>
          {tipo === 'stories' && <Campo rotulo="Telas" dica="Quantos stories na sequência"><InputNumero valor={f.telas} min={2} max={15} onChange={(v) => muda({ telas: v ?? 5 })} /></Campo>}
        </div>
      ) : (<>
        <div className="chips agente-atalhos">{ATALHOS_DIAS.map((a) => <button key={a.rotulo} type="button" className={`chip${f.dias === a.dias && (a.dias !== 1 || (a.hoje ? f.inicio === hojeISO() : f.inicio === amanha())) ? ' ativo' : ''}`} onClick={() => escolherDias(a)}>{a.rotulo}</button>)}</div>
        <div className="agente-pedido">
          <Campo rotulo="Começa em"><input type="date" value={f.inicio} onChange={(e) => muda({ inicio: e.target.value })} /></Campo>
          <Campo rotulo="Quantos dias"><InputNumero valor={f.dias} min={1} max={14} onChange={(v) => muda({ dias: v ?? 1, stories: Math.min(f.stories, v ?? 1) })} /></Campo>
          <Campo rotulo="Posts / carrosséis"><InputNumero valor={f.posts} min={0} max={14} onChange={(v) => muda({ posts: v ?? 0 })} /></Campo>
          <Campo rotulo="Reels"><InputNumero valor={f.reels} min={0} max={14} onChange={(v) => muda({ reels: v ?? 0 })} /></Campo>
          <Campo rotulo="Dias com stories" dica={`${f.dias} = todos os dias`}><InputNumero valor={Math.min(f.stories, f.dias)} min={0} max={f.dias} onChange={(v) => muda({ stories: v ?? 0 })} /></Campo>
          <Campo rotulo="Stories por dia" dica="Telas em cada dia"><InputNumero valor={f.telas} min={2} max={15} onChange={(v) => muda({ telas: v ?? 5 })} /></Campo>
        </div>
      </>)}

      <AnexosPedido anexos={anexos} aoMudar={setAnexos} />
      <Campo rotulo={modo === 'peca' ? 'Sobre o quê (opcional)' : 'Foco (opcional)'} dica={modo === 'peca' ? 'Ex.: reels contando os 3 bônus da Black, com gancho de quem tem medo de intercorrência' : 'Ex.: Black Friday Limited Edition — últimas vagas do módulo de toxina'}>
        <textarea rows={2} value={f.foco} onChange={(e) => muda({ foco: e.target.value })} />
      </Campo>
      <div className="modal-acoes"><button className="btn btn-ouro btn-grande" disabled={enviando || ocupado || nada} onClick={pedir}>{botao}</button></div>
    </section>
  )
}

