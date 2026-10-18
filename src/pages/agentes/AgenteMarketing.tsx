// Agente de Marketing: Planejamento (período livre, quadro por etapa e calendário), Produção (editar, ajustar com o agente,
// aprovar) e Configurar agente. Regras em docs/agentes/REGRAS_AGENTE_MARKETING.md.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { ConfigAgente } from './ConfigAgente'
import { hojeISO, usd, type Peca } from './comum'
import { useMarketing, EMPRESA } from './marketing/useMarketing'
import { Planejamento } from './marketing/Planejamento'
import { Producao } from './marketing/Producao'
import { CriarConteudo, type ModoCriar } from './marketing/CriarConteudo'
import { NovaCampanha } from './marketing/Campanhas'
import { etapaDe } from './marketing/etapas'
import { aplicar, filtrosIniciais, intervaloDe, type Filtros } from './marketing/filtros'

type Aba = 'planejamento' | 'producao' | 'config'

export default function AgenteMarketing() {
  const local = useLocation()
  const [aba, setAba] = useState<Aba>(new URLSearchParams(local.search).get('aba') === 'config' ? 'config' : 'planejamento')
  // filtros moram aqui: continuam iguais ao trocar Quadro/Calendário e ao ir à Produção e voltar (regra 6)
  const [f, setF] = useState<Filtros>(filtrosIniciais)
  const mudar = (c: Partial<Filtros>) => setF((x) => ({ ...x, ...c }))
  const [aberta, setAberta] = useState<string | null>(null)
  const [criar, setCriar] = useState<{ modo: ModoCriar; data: string } | null>(null)
  const [campanhaAberta, setCampanhaAberta] = useState(false)
  const { inicio, dias } = intervaloDe(f)
  const { pecas, trabalhos, perfil, campanhas, emAndamento, ocupado, erro } = useMarketing(inicio, dias)
  useEffect(() => { if (new URLSearchParams(local.search).get('modo') === 'peca') setCriar({ modo: 'peca', data: hojeISO() }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => aplicar(pecas.dados ?? [], f), [pecas.dados, f])
  // peças que o agente está escrevendo agora (ajuste de uma ou várias de uma vez)
  const ocupadas = new Set(emAndamento.flatMap((t) => [String(t.pedido.peca_id ?? ''), ...((t.pedido.peca_ids as string[] | undefined) ?? [])]))
  const pecaAberta = visiveis.find((p) => p.id === aberta) ?? (pecas.dados ?? []).find((p) => p.id === aberta) ?? null
  const aguardando = visiveis.filter((p) => etapaDe(p) === 'revisao').length
  const abrir = (p: Peca) => { setAberta(p.id); setAba('producao') }
  const depoisDoPedido = () => { setCriar(null); trabalhos.recarregar(); pecas.recarregar() }
  const custoMes = (trabalhos.dados ?? []).reduce((s, t) => s + Number(t.custo_usd ?? 0), 0)
  const abrirCriar = (modo: ModoCriar, data?: string) => setCriar({ modo, data: data ?? (f.periodo === 'dia' ? f.data : inicio) })

  return (
    <div className="pagina larga mk">
      <div className="migalha"><Link to="/agentes" className="link">← Todos os agentes</Link></div>
      <header className="mk-topo">
        <span className={`mk-avatar${ocupado ? ' trabalhando' : ''}`}><img src="/agentes/marketing-rosto.webp" alt="" /></span>
        <div className="mk-topo-txt">
          <h1>Agente de Marketing</h1>
          <p className="muted">Conteúdo e campanhas para os seus canais. Nada é publicado sozinho.</p>
          {perfil.dados && !perfil.dados.ativo && <p className="erro-txt pequeno">Este agente está desligado. Ligue em Configurar agente.</p>}
        </div>
        <div className="mk-topo-botoes">
          <button className="btn btn-ouro btn-grande" onClick={() => abrirCriar('peca')}><Icone nome="mais" /> Nova peça</button>
          <button className="btn btn-contorno-ouro btn-grande" onClick={() => abrirCriar(f.periodo === 'dia' ? 'dia' : f.periodo === 'periodo' ? 'periodo' : 'semana')}><Icone nome="agenda" /> Planejar conteúdo</button>
        </div>
      </header>
      <nav className="mk-abas-topo">
        <button className={aba === 'planejamento' ? 'ativa' : ''} onClick={() => setAba('planejamento')}>Planejamento</button>
        <button className={aba === 'producao' ? 'ativa' : ''} onClick={() => setAba('producao')}>Produção{aguardando ? <span className="mk-conta">{aguardando}</span> : null}</button>
        <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>Configurar agente</button>
      </nav>

      {ocupado && <div className="progresso"><div className="indeterminado" /><span>O agente está escrevendo (uma peça leva uns 20 segundos; uma semana, até 2 minutos). Pode sair da tela: o trabalho continua.</span></div>}
      {erro && <div className="erro agente-erro"><span>{erro.erro}</span></div>}

      {aba === 'planejamento' && (
        <Planejamento f={f} mudar={mudar} pecas={visiveis} recarregar={pecas.recarregar} ocupadas={ocupadas}
          campanhas={campanhas} aoCriarCampanha={() => setCampanhaAberta(true)} aoAbrir={abrir} aoCriar={abrirCriar} aoPedido={depoisDoPedido} />
      )}
      {aba === 'producao' && <Producao pecas={visiveis} aberta={pecaAberta} aoAbrir={(p) => setAberta(p.id)} trabalhos={trabalhos.dados ?? []} aoMudar={() => { pecas.recarregar(); trabalhos.recarregar() }} aoVoltar={() => setAba('planejamento')} campanhas={campanhas} />}
      {aba === 'config' && (
        <section className="bloco">
          <h2>Configurar o Agente de Marketing</h2>
          {perfil.dados !== undefined && !perfil.carregando && <ConfigAgente empresaId={EMPRESA} agenteId="marketing" ativo={perfil.dados?.ativo ?? true} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}
          <p className="muted pequeno">Últimos trabalhos deste agente: {usd(custoMes)}. Tudo em <Link to="/agentes/historico" className="link">Histórico</Link>.</p>
        </section>
      )}

      <CriarConteudo aberto={!!criar && !campanhaAberta} aoFechar={() => setCriar(null)} modoInicial={criar?.modo ?? 'dia'} dataInicial={criar?.data ?? hojeISO()}
        campanhas={campanhas} campanhaPadrao={f.campanha} aoCriarCampanha={() => setCampanhaAberta(true)} aoPronto={depoisDoPedido} />
      <NovaCampanha aberto={campanhaAberta} aoFechar={() => setCampanhaAberta(false)} aoCriar={(id) => { perfil.recarregar(); mudar({ campanha: id }); setCampanhaAberta(false) }} />
    </div>
  )
}
