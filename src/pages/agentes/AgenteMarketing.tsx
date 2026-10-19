// Agente de Marketing: Conteúdos (período livre, quadro e calendário), Produção (lista de peças e editor por peça),
// Resultados (posts do Instagram e análise) e Configurar agente. Uma entrada só para criar: "Planejar conteúdo" abre o Planejar (direto ou conversando com o agente) (algo para hoje,
// próximos dias, semana, mês ou campanha), em página própria com o caminho no topo.
// Regras em docs/agentes/REGRAS_AGENTE_MARKETING.md.
import { Voltar } from '../../components/Voltar'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { ConfigAgente } from './ConfigAgente'
import { hojeISO, type Peca } from './comum'
import { useMarketing, EMPRESA } from './marketing/useMarketing'
import { Planejamento, type ModoPlano } from './marketing/Planejamento'
import { Producao } from './marketing/Producao'
import { PaginaReuniao } from './marketing/reuniao/PaginaReuniao'
import type { TipoEscopo } from './marketing/reuniao/dados'
import { Caminho } from './marketing/Caminho'
import { ResultadosInstagram } from './instagram/ResultadosInstagram'
import { PaginaPlanejar } from './marketing/PaginaPlanejar'
import { NovaCampanha } from './marketing/Campanhas'
import { etapaDe } from './marketing/etapas'
import { RedesAtivas, redesAtivas } from './marketing/redes'
import { CabecalhoAba } from './marketing/BarraFiltros'
import { AbaAutomacoes } from './automacoes/AbaAutomacoes'
import { aplicar, filtrosIniciais, filtrosProducaoIniciais, intervaloDe, type Filtros, type FiltrosProducao } from './marketing/filtros'
import type { Plano } from './marketing/planos'

type Aba = 'conteudos' | 'producao' | 'resultados' | 'automacoes' | 'config'
// páginas que tomam a tela inteira (sem as abas), com o caminho no topo
type Pagina = { tipo: 'reuniao'; id?: string; escopo: TipoEscopo; data: string } | { tipo: 'planejar'; modo: ModoPlano; data: string; revisar: Plano | null } | null
const ESCOPO_DO_MODO: Record<ModoPlano, TipoEscopo> = { dia: 'dia', semana: 'semana', mes: 'mes', periodo: 'dias' }

export default function AgenteMarketing() {
  const local = useLocation()
  const [aba, setAba] = useState<Aba>(() => { const a = new URLSearchParams(local.search).get('aba'); return a === 'config' || a === 'resultados' || a === 'producao' || a === 'automacoes' ? a : 'conteudos' })
  // filtros moram aqui: continuam iguais ao trocar Quadro/Calendário e ao ir à Produção e voltar (regra 6)
  // ?campanha=id (atalho de Base da marca → Campanhas) já abre filtrado; ?data= leva o calendário ao mês da campanha
  const [f, setF] = useState<Filtros>(() => { const q = new URLSearchParams(local.search), d = q.get('data'); return { ...filtrosIniciais(), campanha: q.get('campanha') ?? '', ...(d ? { periodo: 'mes' as const, data: d, visao: 'calendario' as const } : {}) } })
  const [fp, setFp] = useState<FiltrosProducao>(() => ({ ...filtrosProducaoIniciais(), campanha: new URLSearchParams(local.search).get('campanha') ?? '' }))
  const mudar = (c: Partial<Filtros>) => setF((x) => ({ ...x, ...c }))
  const [aberta, setAberta] = useState<string | null>(null)
  // ?modo=peca (atalho da Sala dos agentes) abre direto a reunião de algo para hoje
  const [pagina, setPagina] = useState<Pagina>(() => (new URLSearchParams(local.search).get('modo') === 'peca' ? { tipo: 'reuniao', escopo: 'dia', data: hojeISO() } : null))
  const [campanhaAberta, setCampanhaAberta] = useState(false)
  const { inicio, dias } = intervaloDe(f)
  const { pecas, todas, trabalhos, perfil, campanhas, planos, emAndamento, ocupado, erro } = useMarketing(inicio, dias)

  const redes = useMemo(() => redesAtivas((perfil.dados?.perfil ?? undefined) as Record<string, unknown> | undefined), [perfil.dados])
  const visiveis = useMemo(() => aplicar(pecas.dados ?? [], f), [pecas.dados, f])
  // peças que o agente está escrevendo agora (ajuste de uma ou várias de uma vez)
  const ocupadas = new Set(emAndamento.flatMap((t) => [String(t.pedido.peca_id ?? ''), ...((t.pedido.peca_ids as string[] | undefined) ?? [])]))
  const pecaAberta = (todas.dados ?? []).find((p) => p.id === aberta) ?? (pecas.dados ?? []).find((p) => p.id === aberta) ?? null
  const aguardando = (todas.dados ?? []).filter((p) => etapaDe(p) === 'revisao').length
  const abrir = (p: Peca) => { setAberta(p.id); setAba('producao') }
  const recarregar = () => { trabalhos.recarregar(); pecas.recarregar(); todas.recarregar(); perfil.recarregar() }
  const reuniao = (escopo: TipoEscopo, data: string, id?: string) => setPagina({ tipo: 'reuniao', escopo, data: data || hojeISO(), id })
  const planejarAgora = () => reuniao(f.periodo === 'dia' ? 'dia' : f.periodo === 'mes' ? 'mes' : 'semana', f.periodo === 'dia' ? f.data : inicio)
  const revisarPlano = (p: Plano) => (p.reuniao ? reuniao('semana', p.inicio, p.reuniao) : setPagina({ tipo: 'planejar', modo: 'periodo', data: p.inicio, revisar: p }))
  const fecharPagina = () => { setPagina(null); setAba('conteudos'); recarregar() }
  // com uma peça aberta, o topo vira o da peça (título, selos e régua) e as abas vão logo abaixo dele
  const detalhe = aba === 'producao' && !!pecaAberta
  const abasTopo = (
    <nav className="mk-abas-topo">
      <button className={aba === 'conteudos' ? 'ativa' : ''} onClick={() => setAba('conteudos')}>Conteúdos</button>
      <button className={aba === 'producao' ? 'ativa' : ''} onClick={() => { setAba('producao'); setAberta(null) }}>Produção{aguardando ? <span className="mk-conta">{aguardando}</span> : null}</button>
      <button className={aba === 'resultados' ? 'ativa' : ''} onClick={() => setAba('resultados')}>Resultados</button>
      <button className={aba === 'automacoes' ? 'ativa' : ''} onClick={() => setAba('automacoes')}>Automações</button>
      <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>Configurar agente</button>
    </nav>
  )

  if (pagina) return (
    <RedesAtivas.Provider value={redes}>
    <div className="pagina larga mk">
      {pagina.tipo === 'reuniao' && (
        <PaginaReuniao key={pagina.id ?? `${pagina.escopo}-${pagina.data}`} reuniaoId={pagina.id} tipoInicial={pagina.escopo} dataInicial={pagina.data} campanhas={campanhas} planos={planos}
          aoVoltar={fecharPagina} aoMudou={recarregar} aoAbrirReuniao={(id) => setPagina({ ...pagina, id })} aoCriarCampanha={() => setCampanhaAberta(true)}
          aoIrProducao={(id) => { setPagina(null); setAberta(id ?? null); setAba('producao'); recarregar() }} />
      )}
      {pagina.tipo === 'planejar' && (<>
        <Caminho passos={[{ texto: 'Agente de Marketing', aoClicar: fecharPagina }, { texto: pagina.revisar?.nome ?? 'Plano' }]} />
        <PaginaPlanejar key={pagina.revisar?.id ?? `${pagina.modo}-${pagina.data}`} planoInicial={pagina.revisar} modoInicial={pagina.modo} dataInicial={pagina.data}
          campanhas={campanhas} campanhaPadrao={f.campanha} aoCriarCampanha={() => setCampanhaAberta(true)} aoVoltar={fecharPagina} aoMudou={recarregar} />
      </>)}
      <NovaCampanha aberto={campanhaAberta} aoFechar={() => setCampanhaAberta(false)} aoCriar={(id) => { perfil.recarregar(); mudar({ campanha: id }); setCampanhaAberta(false) }} />
    </div>
    </RedesAtivas.Provider>
  )

  return (
    <RedesAtivas.Provider value={redes}>
    <div className="pagina larga mk">
      {!detalhe && <>
      <div className="migalha"><Voltar para="/agentes" texto="Sala dos agentes" /></div>
      <header className="mk-topo">
        <span className={`mk-avatar-pronto${ocupado ? ' trabalhando' : ''}`}><img src="/agentes/marketing-avatar.webp?v=1" alt="" /></span>
        <div className="mk-topo-txt">
          <h1>Agente de Marketing</h1>
          <p className="muted">Conteúdo e campanhas para os seus canais. Nada é publicado sozinho.</p>
          {perfil.dados && !perfil.dados.ativo && <p className="erro-txt pequeno">Este agente está desligado. Ligue em Configurar agente.</p>}
        </div>
        <div className="mk-topo-botoes">
          <button className="btn btn-ouro btn-grande" onClick={planejarAgora}><Icone nome="agenda" /> Planejar conteúdo</button>
        </div>
      </header>
      </>}
      {!detalhe && abasTopo}
      {ocupado && !detalhe && <div className="progresso"><div className="indeterminado" /><span>O agente está trabalhando (uma peça leva uns 20 segundos; um plano, até 2 minutos). Pode sair da tela: o trabalho continua.</span></div>}
      {erro && <div className="erro agente-erro"><span>{erro.erro}</span></div>}

      {aba === 'conteudos' && (
        <Planejamento f={f} mudar={mudar} pecas={visiveis} recarregar={recarregar} ocupadas={ocupadas} campanhas={campanhas} aoCriarCampanha={() => setCampanhaAberta(true)}
          aoAbrir={abrir} aoNovaPeca={(d) => reuniao('dia', d ?? hojeISO())} aoPlanejar={(modo, data) => reuniao(ESCOPO_DO_MODO[modo], data)}
          planos={planos} aoRevisarPlano={revisarPlano} aoPedido={recarregar} />
      )}
      {aba === 'producao' && (
        <Producao pecas={todas.dados ?? []} carregando={todas.carregando && !todas.dados} aberta={pecaAberta} aoAbrir={(p) => setAberta(p.id)} aoFecharPeca={() => setAberta(null)}
          trabalhos={trabalhos.dados ?? []} aoMudar={recarregar} campanhas={campanhas} planos={planos} abasTopo={abasTopo} f={fp} mudar={(c) => setFp((x) => ({ ...x, ...c }))} />
      )}
      {aba === 'resultados' && <ResultadosInstagram empresa={EMPRESA} aoAbrirPeca={(id) => { recarregar(); setAberta(id); setAba('producao') }} />}
      {aba === 'automacoes' && <AbaAutomacoes empresa={EMPRESA} />}
      {aba === 'config' && (
        <section className="mk-plano">
          <CabecalhoAba titulo="Funcionamento e preferências" sub="Defina como este agente trabalha e revise o que ele deve lembrar." />
          {perfil.dados !== undefined && !perfil.carregando && <ConfigAgente key={perfil.dados?.perfil ? 'ok' : 'novo'} empresaId={EMPRESA} agenteId="marketing" ativo={perfil.dados?.ativo ?? true} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}
        </section>
      )}

      <NovaCampanha aberto={campanhaAberta} aoFechar={() => setCampanhaAberta(false)} aoCriar={(id) => { perfil.recarregar(); mudar({ campanha: id }); setCampanhaAberta(false) }} />
    </div>
    </RedesAtivas.Provider>
  )
}
