// Agente de Marketing: Planejamento (período livre, quadro e calendário), Produção (lista de peças e editor por peça)
// e Configurar agente. Duas entradas: "Nova peça com IA" (um conteúdo) e "Planejar conteúdos" (um conjunto, com
// proposta do agente para revisar). Regras em docs/agentes/REGRAS_AGENTE_MARKETING.md.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { ConfigAgente } from './ConfigAgente'
import type { Peca } from './comum'
import { useMarketing, EMPRESA } from './marketing/useMarketing'
import { Planejamento, type ModoPlano } from './marketing/Planejamento'
import { Producao } from './marketing/Producao'
import { NovaPecaIA } from './marketing/NovaPecaIA'
import { PaginaPlanejar } from './marketing/PaginaPlanejar'
import { NovaCampanha } from './marketing/Campanhas'
import { etapaDe } from './marketing/etapas'
import { RedesAtivas, redesAtivas } from './marketing/redes'
import { CabecalhoAba } from './marketing/BarraFiltros'
import { aplicar, filtrosIniciais, filtrosProducaoIniciais, intervaloDe, type Filtros, type FiltrosProducao } from './marketing/filtros'
import type { Plano } from './marketing/planos'

type Aba = 'planejamento' | 'planejar' | 'producao' | 'config'

export default function AgenteMarketing() {
  const local = useLocation()
  const [aba, setAba] = useState<Aba>(new URLSearchParams(local.search).get('aba') === 'config' ? 'config' : 'planejamento')
  // filtros moram aqui: continuam iguais ao trocar Quadro/Calendário e ao ir à Produção e voltar (regra 6)
  const [f, setF] = useState<Filtros>(filtrosIniciais)
  const [fp, setFp] = useState<FiltrosProducao>(filtrosProducaoIniciais)
  const mudar = (c: Partial<Filtros>) => setF((x) => ({ ...x, ...c }))
  const [aberta, setAberta] = useState<string | null>(null)
  const [nova, setNova] = useState<{ data: string } | null>(null)
  const [planejar, setPlanejar] = useState<{ modo: ModoPlano; data: string; revisar: Plano | null } | null>(null)
  const [campanhaAberta, setCampanhaAberta] = useState(false)
  const { inicio, dias } = intervaloDe(f)
  const { pecas, todas, trabalhos, perfil, campanhas, planos, emAndamento, ocupado, erro } = useMarketing(inicio, dias)
  useEffect(() => { if (new URLSearchParams(local.search).get('modo') === 'peca') setNova({ data: '' }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const redes = useMemo(() => redesAtivas((perfil.dados?.perfil ?? undefined) as Record<string, unknown> | undefined), [perfil.dados])
  const visiveis = useMemo(() => aplicar(pecas.dados ?? [], f), [pecas.dados, f])
  // peças que o agente está escrevendo agora (ajuste de uma ou várias de uma vez)
  const ocupadas = new Set(emAndamento.flatMap((t) => [String(t.pedido.peca_id ?? ''), ...((t.pedido.peca_ids as string[] | undefined) ?? [])]))
  const pecaAberta = (todas.dados ?? []).find((p) => p.id === aberta) ?? (pecas.dados ?? []).find((p) => p.id === aberta) ?? null
  const aguardando = (todas.dados ?? []).filter((p) => etapaDe(p) === 'revisao').length
  const abrir = (p: Peca) => { setAberta(p.id); setAba('producao') }
  const recarregar = () => { trabalhos.recarregar(); pecas.recarregar(); todas.recarregar(); perfil.recarregar() }
  const custoMes = (trabalhos.dados ?? []).reduce((s, t) => s + Number(t.custo_usd ?? 0), 0)
  const modoAtual: ModoPlano = f.periodo

  return (
    <RedesAtivas.Provider value={redes}>
    <div className="pagina larga mk">
      <div className="migalha"><Link to="/agentes" className="link">← Todos os agentes</Link></div>
      <header className="mk-topo">
        <span className={`mk-avatar${ocupado ? ' trabalhando' : ''}`}><img src="/agentes/marketing-rosto.webp?v=2" alt="" /></span>
        <div className="mk-topo-txt">
          <h1>Agente de Marketing</h1>
          <p className="muted">Conteúdo e campanhas para os seus canais. Nada é publicado sozinho.</p>
          {perfil.dados && !perfil.dados.ativo && <p className="erro-txt pequeno">Este agente está desligado. Ligue em Configurar agente.</p>}
        </div>
        <div className="mk-topo-botoes">
          <button className="btn btn-ouro btn-grande" onClick={() => setNova({ data: f.periodo === 'dia' ? f.data : '' })}><Icone nome="mais" /> Nova peça com IA</button>
          <button className="btn btn-contorno-ouro btn-grande" onClick={() => { setPlanejar({ modo: modoAtual, data: f.periodo === 'dia' ? f.data : inicio, revisar: null }); setAba('planejar') }}><Icone nome="agenda" /> Planejar conteúdos</button>
        </div>
      </header>
      <nav className="mk-abas-topo">
        <button className={aba === 'planejamento' || aba === 'planejar' ? 'ativa' : ''} onClick={() => setAba('planejamento')}>Planejamento</button>
        <button className={aba === 'producao' ? 'ativa' : ''} onClick={() => { setAba('producao'); setAberta(null) }}>Produção{aguardando ? <span className="mk-conta">{aguardando}</span> : null}</button>
        <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>Configurar agente</button>
      </nav>

      {ocupado && <div className="progresso"><div className="indeterminado" /><span>O agente está trabalhando (uma peça leva uns 20 segundos; um plano, até 2 minutos). Pode sair da tela: o trabalho continua.</span></div>}
      {erro && <div className="erro agente-erro"><span>{erro.erro}</span></div>}

      {aba === 'planejamento' && (
        <Planejamento f={f} mudar={mudar} pecas={visiveis} recarregar={recarregar} ocupadas={ocupadas} campanhas={campanhas} aoCriarCampanha={() => setCampanhaAberta(true)}
          aoAbrir={abrir} aoNovaPeca={(d) => setNova({ data: d ?? '' })} aoPlanejar={(modo, data) => { setPlanejar({ modo, data, revisar: null }); setAba('planejar') }}
          planos={planos} aoRevisarPlano={(p) => { setPlanejar({ modo: 'periodo', data: p.inicio, revisar: p }); setAba('planejar') }} aoPedido={recarregar} />
      )}
      {aba === 'planejar' && planejar && (
        <PaginaPlanejar key={planejar.revisar?.id ?? `${planejar.modo}-${planejar.data}`} planoInicial={planejar.revisar} modoInicial={planejar.modo} dataInicial={planejar.data}
          campanhas={campanhas} campanhaPadrao={f.campanha} aoCriarCampanha={() => setCampanhaAberta(true)} aoVoltar={() => { setAba('planejamento'); setPlanejar(null); recarregar() }} aoMudou={recarregar} />
      )}
      {aba === 'producao' && (
        <Producao pecas={todas.dados ?? []} carregando={todas.carregando && !todas.dados} aberta={pecaAberta} aoAbrir={(p) => setAberta(p.id)} aoFecharPeca={() => setAberta(null)}
          trabalhos={trabalhos.dados ?? []} aoMudar={recarregar} campanhas={campanhas} planos={planos} f={fp} mudar={(c) => setFp((x) => ({ ...x, ...c }))} />
      )}
      {aba === 'config' && (
        <section className="mk-plano">
          <CabecalhoAba titulo="Funcionamento e preferências" sub="Defina como este agente trabalha e revise o que ele deve lembrar." />
          {perfil.dados !== undefined && !perfil.carregando && <ConfigAgente key={perfil.dados?.perfil ? 'ok' : 'novo'} empresaId={EMPRESA} agenteId="marketing" ativo={perfil.dados?.ativo ?? true} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} custoMes={custoMes} />}
        </section>
      )}

      <NovaPecaIA aberto={!!nova && !campanhaAberta} aoFechar={() => setNova(null)} dataInicial={nova?.data ?? ''} campanhas={campanhas} campanhaPadrao={f.campanha}
        aoCriarCampanha={() => setCampanhaAberta(true)} aoPronto={(id) => { setNova(null); recarregar(); if (id) { setAberta(id); setAba('producao') } }} />
      <NovaCampanha aberto={campanhaAberta} aoFechar={() => setCampanhaAberta(false)} aoCriar={(id) => { perfil.recarregar(); mudar({ campanha: id }); setCampanhaAberta(false) }} />
    </div>
    </RedesAtivas.Provider>
  )
}
