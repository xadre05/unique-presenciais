// Conteúdos (antes "Planejamento editorial"): período livre (dia, semana, mês, período), Quadro por etapa ou Calendário,
// filtros que não se perdem e o convite para criar conteúdo do período que está na tela.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { inicioDaSemana, somaDias, type Peca } from '../comum'
import { moverPara, mudarPeca, ehIdeia, type Etapa } from './etapas'
import { instrucaoNovoDia, pedirAjuste } from './ajuste'
import { Calendario, QuadroEtapas } from './Quadros'
import { CabecalhoAba, PainelFiltros, Resumo, TrocaVisao } from './BarraFiltros'
import { intervaloDe, type Filtros } from './filtros'
import { pedirTrabalho, type Campanha } from './useMarketing'
import type { Plano } from './planos'

export type ModoPlano = 'dia' | 'semana' | 'mes' | 'periodo'

const CONVITE: Record<Filtros['periodo'], { pergunta: string; botao: string; modo: ModoPlano }> = {
  dia: { pergunta: 'Planejar conteúdo para este dia?', botao: 'Planejar este dia', modo: 'dia' },
  semana: { pergunta: 'Planejar conteúdo para esta semana?', botao: 'Planejar esta semana', modo: 'semana' },
  mes: { pergunta: 'Planejar conteúdo para este mês?', botao: 'Planejar este mês', modo: 'mes' },
  periodo: { pergunta: 'Planejar conteúdo para este período?', botao: 'Planejar o período', modo: 'periodo' },
}

type Props = {
  f: Filtros; mudar: (c: Partial<Filtros>) => void; pecas: Peca[]; recarregar: () => void; ocupadas: Set<string>
  campanhas: Campanha[]; aoCriarCampanha: () => void; aoAbrir: (p: Peca) => void; aoNovaPeca: (data?: string) => void; aoPlanejar: (modo: ModoPlano, data: string) => void
  planos: Plano[]; aoRevisarPlano: (p: Plano) => void; aoPedido: () => void
}

export function Planejamento(pr: Props) {
  const { f } = pr
  const [movida, setMovida] = useState<{ peca: Peca; dia: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const { inicio, dias } = intervaloDe(f)
  const pendentes = pr.pecas.filter((p) => p.conteudo.pendencia && p.status !== 'postada')
  const ideias = pr.pecas.filter((p) => ehIdeia(p) && !pr.ocupadas.has(p.id))
  const convite = CONVITE[f.periodo]
  // calendário: uma semana por vez (no mês e no período, com setas para as outras semanas)
  const fim = somaDias(inicio, dias - 1)
  const semanas: string[] = []
  for (let m = inicioDaSemana(inicio); m <= fim; m = somaDias(m, 7)) semanas.push(m)
  const chave = `${inicio}|${dias}`
  const [pag, setPag] = useState({ chave, n: 0 })
  const pagina = pag.chave === chave ? Math.min(pag.n, semanas.length - 1) : 0
  const irPara = (n: number) => setPag({ chave, n })
  const colunas = f.periodo === 'dia' ? [inicio] : Array.from({ length: 7 }, (_, i) => somaDias(semanas[pagina], i))
  const dentro = (d: string) => d >= inicio && d <= fim
  const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const faixa = (a: string, b: string) => (a === b ? curta(a) : a.slice(5, 7) === b.slice(5, 7) ? `${a.slice(8, 10)} – ${curta(b)}` : `${curta(a)} – ${curta(b)}`)
  const vistos = colunas.filter(dentro)

  const mover = async (p: Peca, etapa: Etapa) => { const { error } = await moverPara(p, etapa); if (error) return setErro(msgErro(error)); pr.recarregar() }
  const tirar = async (p: Peca) => { const { error } = await mudarPeca(p.id, { status: 'descartada' }); if (error) return setErro(msgErro(error)); pr.recarregar() }
  // mudar o dia pode deixar o texto errado ("amanhã", "segunda"): oferece pedir ao agente para ajustar
  const mudarDia = async (p: Peca, dia: string) => {
    const { error } = await mudarPeca(p.id, { dia }); if (error) return setErro(msgErro(error))
    pr.recarregar(); if (!ehIdeia(p) && (p.conteudo.roteiro?.length || p.conteudo.legenda)) setMovida({ peca: p, dia })
  }
  const ajustarDia = async () => { if (!movida) return; const m = await pedirAjuste(movida.peca, instrucaoNovoDia(movida.dia), { lembrar: false }); setMovida(null); if (m) setErro(m) }
  // regra 5: as ideias salvas só viram texto quando alguém pede
  const gerarIdeias = async () => {
    setErro(null)
    const m = await pedirTrabalho('escrever', { peca_ids: ideias.slice(0, 40).map((p) => p.id), adaptar: true })
    if (m) setErro(m); else pr.aoPedido()
  }

  return (
    <section className="mk-plano">
      <CabecalhoAba titulo="Conteúdos" sub="As peças do período em cada etapa, do planejado ao publicado.">
        <TrocaVisao visao={f.visao} mudar={(visao) => pr.mudar({ visao })} />
      </CabecalhoAba>
      <PainelFiltros tela={{ periodo: f.periodo, data: f.data, ate: f.ate }} mudarTela={(c) => pr.mudar(c as Partial<Filtros>)}
        f={f} mudar={pr.mudar} campanhas={pr.campanhas} planos={pr.planos} aoCriarCampanha={pr.aoCriarCampanha} />
      <Resumo f={f} mudar={pr.mudar}
        texto={`${pr.pecas.length} ${pr.pecas.length === 1 ? 'peça' : 'peças'} ${f.periodo === 'dia' ? 'no dia' : 'no período'} · ${faixa(inicio, fim)}`}
        meio={f.visao === 'calendario' && semanas.length > 1 && f.periodo !== 'dia' && vistos.length ? <>
          <button className="btn btn-quadrado" aria-label="Semana anterior" disabled={pagina === 0} onClick={() => irPara(pagina - 1)}><Icone nome="esquerda" /></button>
          <b>Exibindo {faixa(vistos[0], vistos[vistos.length - 1])}</b>
          <button className="btn btn-quadrado" aria-label="Próxima semana" disabled={pagina >= semanas.length - 1} onClick={() => irPara(pagina + 1)}><Icone nome="seta_dir" /></button>
        </> : undefined}
        direita={<>
          {f.visao === 'calendario' && semanas.length > 1 && f.periodo !== 'dia' && <span className="muted">Semana {pagina + 1} de {semanas.length}</span>}
          {!!ideias.length && <button className="btn btn-contorno-ouro btn-mini" onClick={gerarIdeias}><Icone nome="floco" tam={14} /> Gerar rascunhos das {Math.min(40, ideias.length)} ideias</button>}
        </>} />

      {!!pendentes.length && (
        <div className="mk-aviso"><Icone nome="alerta" tam={20} /><span>{pendentes.length === 1 ? 'Há 1 peça com pendência na oferta.' : `Há ${pendentes.length} peças com pendências na oferta.`}</span>
          <Link to="/agentes/marca" className="link pequeno">Completar ofertas e materiais</Link>
          <button className="btn btn-ouro btn-mini" onClick={() => pr.aoAbrir(pendentes[0])}>Revisar</button></div>
      )}
      {movida && (
        <div className="mk-aviso mk-aviso-info"><Icone nome="agenda" tam={20} /><span>"{movida.peca.titulo}" mudou de dia. Se o texto fala da data, o agente pode ajustar.</span>
          <button className="btn btn-ouro btn-mini" onClick={ajustarDia}>Pedir ao agente para ajustar</button><button className="btn btn-mini" onClick={() => setMovida(null)}>Deixar assim</button></div>
      )}
      {pr.planos.filter((p) => p.status !== 'aprovado').map((p) => (
        <div key={p.id} className="mk-aviso mk-aviso-info"><Icone nome="agenda" tam={20} /><span><b>{p.nome}</b>: {p.status === 'proposta' ? 'proposta do agente aguardando sua revisão.' : 'briefing salvo, ainda sem proposta.'}</span>
          <button className="btn btn-ouro btn-mini" onClick={() => pr.aoRevisarPlano(p)}>{p.status === 'proposta' ? 'Revisar e aprovar' : 'Continuar'}</button></div>
      ))}
      <Erro msg={erro} />

      {f.visao === 'quadro'
        ? <QuadroEtapas pecas={pr.pecas} aoAbrir={pr.aoAbrir} ocupadas={pr.ocupadas} aoMover={mover} aoTirar={tirar} aoNova={() => pr.aoNovaPeca(f.periodo === 'dia' ? f.data : undefined)} />
        : <Calendario colunas={colunas} dentro={dentro} pecas={pr.pecas} aoAbrir={pr.aoAbrir} ocupadas={pr.ocupadas} aoMover={mover} aoTirar={tirar} aoMudarDia={mudarDia}
            aoAbrirDia={f.periodo === 'dia' ? undefined : (d) => pr.mudar({ periodo: 'dia', data: d })} aoCriarNoDia={(d) => pr.aoNovaPeca(d)} />}
      {f.visao === 'calendario' && <p className="pequeno muted">Clique na peça para abrir a produção. Arraste para outro dia para mudar a data.</p>}
      {pr.pecas.some((p) => !p.dia) && <p className="pequeno muted">Sem dia definido: {pr.pecas.filter((p) => !p.dia).map((p) => <button key={p.id} className="link" onClick={() => pr.aoAbrir(p)}>{p.titulo}</button>)}. Abra a peça e escolha o dia.</p>}

      <div className="mk-convite">
        <span className="mk-convite-icone"><Icone nome="agenda" tam={22} /></span>
        <span><b>{convite.pergunta}</b><br /><span className="muted pequeno">Abra uma reunião de pauta: o agente mostra o que já saiu, sugere o que postar e por quê. Nada é gerado sem o seu ok.</span></span>
        <button className="btn btn-contorno-ouro" onClick={() => pr.aoPlanejar(convite.modo, f.periodo === 'mes' ? inicio : f.data)}><Icone nome="agenda" /> {convite.botao}</button>
      </div>
    </section>
  )
}
