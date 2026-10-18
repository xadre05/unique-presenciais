// Planejamento editorial: a semana em Quadro (por etapa) ou Calendário (por dia), com campanha, filtros e busca.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { TIPO_PECA, somaDias, type Peca } from '../comum'
import { moverPara, mudarPeca, type Etapa } from './etapas'
import { instrucaoNovoDia, pedirAjuste } from './ajuste'
import { Calendario, QuadroEtapas } from './Quadros'
import { SeletorCampanha } from './Campanhas'
import type { Campanha } from './useMarketing'

const intervalo = (inicio: string) => {
  const a = new Date(inicio + 'T12:00:00'), b = new Date(somaDias(inicio, 6) + 'T12:00:00')
  const mesA = a.toLocaleDateString('pt-BR', { month: 'long' }), mesB = b.toLocaleDateString('pt-BR', { month: 'long' })
  return `${a.getDate()}${mesA !== mesB ? ` de ${mesA}` : ''} – ${b.getDate()} de ${mesB} de ${b.getFullYear()}`
}

type Props = {
  inicio: string; aoMudarSemana: (inicio: string) => void; pecas: Peca[]; recarregar: () => void; ocupadas: Set<string>
  campanhas: Campanha[]; campanha: string; aoMudarCampanha: (id: string) => void; aoCriarCampanha: () => void
  aoAbrir: (p: Peca) => void; aoPlanejar: () => void; aoNova: () => void
}

export function Planejamento(pr: Props) {
  const [visao, setVisao] = useState<'quadro' | 'calendario'>('quadro')
  const [formato, setFormato] = useState('')
  const [busca, setBusca] = useState('')
  const [movida, setMovida] = useState<{ peca: Peca; dia: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const termo = busca.trim().toLowerCase()
  const visiveis = pr.pecas.filter((p) => (!formato || p.tipo === formato) && (!termo || p.titulo.toLowerCase().includes(termo)))
  const pendentes = visiveis.filter((p) => p.conteudo.pendencia && p.status !== 'postada')

  const mover = async (p: Peca, etapa: Etapa) => { const { error } = await moverPara(p, etapa); if (error) return setErro(msgErro(error)); pr.recarregar() }
  // mudar o dia pode deixar o texto errado ("amanhã", "segunda"): oferece pedir ao agente para ajustar
  const mudarDia = async (p: Peca, dia: string) => {
    const { error } = await mudarPeca(p.id, { dia }); if (error) return setErro(msgErro(error))
    pr.recarregar(); if (p.conteudo.roteiro?.length || p.conteudo.legenda) setMovida({ peca: p, dia })
  }
  const ajustarDia = async () => { if (!movida) return; const m = await pedirAjuste(movida.peca, instrucaoNovoDia(movida.dia), { lembrar: false }); setMovida(null); if (m) setErro(m) }

  return (
    <section className="mk-plano">
      <div className="mk-barra">
        <div className="mk-semana">
          <button className="btn btn-quadrado" aria-label="Semana anterior" onClick={() => pr.aoMudarSemana(somaDias(pr.inicio, -7))}><Icone nome="esquerda" /></button>
          <b>{intervalo(pr.inicio)}</b>
          <button className="btn btn-quadrado" aria-label="Próxima semana" onClick={() => pr.aoMudarSemana(somaDias(pr.inicio, 7))}><Icone nome="seta_dir" /></button>
        </div>
        <SeletorCampanha campanhas={pr.campanhas} valor={pr.campanha} aoMudar={pr.aoMudarCampanha} aoCriar={pr.aoCriarCampanha} />
        <button className="btn btn-contorno-ouro mk-planejar" onClick={pr.aoPlanejar}><Icone nome="agenda" /> Planejar</button>
      </div>
      <div className="mk-barra mk-barra-2">
        <div className="mk-visoes">
          <button className={visao === 'quadro' ? 'ativa' : ''} onClick={() => setVisao('quadro')}><Icone nome="quadro" /> Quadro</button>
          <button className={visao === 'calendario' ? 'ativa' : ''} onClick={() => setVisao('calendario')}><Icone nome="agenda" /> Calendário</button>
        </div>
        <label className="select-icone"><select value={formato} onChange={(e) => setFormato(e.target.value)}><option value="">Formato: todos</option>{Object.entries(TIPO_PECA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="select-icone mk-busca"><Icone nome="busca" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça…" /></label>
      </div>

      {!!pendentes.length && (
        <div className="mk-aviso"><Icone nome="alerta" tam={20} /><span>{pendentes.length === 1 ? 'Há 1 peça com pendência na oferta.' : `Há ${pendentes.length} peças com pendências na oferta.`}</span>
          <Link to="/agentes/marca" className="link pequeno">Completar ofertas e materiais</Link>
          <button className="btn btn-ouro btn-mini" onClick={() => pr.aoAbrir(pendentes[0])}>Revisar</button></div>
      )}
      {movida && (
        <div className="mk-aviso mk-aviso-info"><Icone nome="agenda" tam={20} /><span>"{movida.peca.titulo}" mudou de dia. Se o texto fala da data, o agente pode ajustar.</span>
          <button className="btn btn-ouro btn-mini" onClick={ajustarDia}>Pedir ao agente para ajustar</button><button className="btn btn-mini" onClick={() => setMovida(null)}>Deixar assim</button></div>
      )}
      <Erro msg={erro} />

      {!pr.pecas.length
        ? <div className="mk-vazio-grande"><Icone nome="ideia" tam={34} /><p>Nada planejado nesta semana.</p><div><button className="btn btn-ouro" onClick={pr.aoPlanejar}>Planejar os dias</button> <button className="btn" onClick={pr.aoNova}>Uma peça só</button></div></div>
        : visao === 'quadro'
          ? <QuadroEtapas pecas={visiveis} aoAbrir={pr.aoAbrir} ocupadas={pr.ocupadas} aoMover={mover} aoNova={pr.aoNova} />
          : <Calendario inicio={pr.inicio} pecas={visiveis} aoAbrir={pr.aoAbrir} ocupadas={pr.ocupadas} aoMudarDia={mudarDia} />}
      <p className="pequeno muted mk-rodape">Arraste os cartões: no Quadro muda a etapa (Pronto = aprovada, Publicado = postada); no Calendário muda o dia. Nada é publicado sozinho.</p>
    </section>
  )
}
