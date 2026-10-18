// Agente de Marketing: Planejamento (quadro por etapa e calendário), Produção (editar, ajustar com o agente, aprovar)
// e Configurar agente. A semana mostra todas as peças daqueles dias, venham de que pedido vierem.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icone } from '../../components/Icone'
import { ConfigAgente } from './ConfigAgente'
import { hojeISO, segundaDe, usd, type Peca } from './comum'
import { useMarketing, EMPRESA } from './marketing/useMarketing'
import { Planejamento } from './marketing/Planejamento'
import { Producao } from './marketing/Producao'
import { Planejar } from './marketing/Planejar'
import { NovaPeca } from './marketing/NovaPeca'
import { NovaCampanha, TODAS } from './marketing/Campanhas'
import { etapaDe } from './marketing/etapas'

type Aba = 'planejamento' | 'producao' | 'config'

export default function AgenteMarketing() {
  const local = useLocation()
  const [aba, setAba] = useState<Aba>(new URLSearchParams(local.search).get('aba') === 'config' ? 'config' : 'planejamento')
  const [inicio, setInicio] = useState(() => segundaDe(hojeISO()))
  const [campanha, setCampanha] = useState(TODAS)
  const [aberta, setAberta] = useState<string | null>(null)
  const [modal, setModal] = useState<'planejar' | 'nova' | 'campanha' | null>(null)
  const { pecas, trabalhos, perfil, campanhas, emAndamento, ocupado, erro } = useMarketing(inicio)
  useEffect(() => { if (new URLSearchParams(local.search).get('modo') === 'peca') setModal('nova') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const daCampanha = useMemo(() => (pecas.dados ?? []).filter((p) => !campanha || p.conteudo.campanha === campanha), [pecas.dados, campanha])
  const ocupadas = new Set(emAndamento.map((t) => String(t.pedido.peca_id ?? '')))
  const pecaAberta = daCampanha.find((p) => p.id === aberta) ?? null
  const aguardando = daCampanha.filter((p) => etapaDe(p) === 'revisao').length
  const abrir = (p: Peca) => { setAberta(p.id); setAba('producao') }
  const depoisDoPedido = () => { setModal(null); trabalhos.recarregar() }
  const custoMes = (trabalhos.dados ?? []).reduce((s, t) => s + Number(t.custo_usd ?? 0), 0)

  return (
    <div className="pagina larga mk">
      <div className="migalha"><Link to="/agentes" className="link">← Todos os agentes</Link></div>
      <header className="mk-topo">
        <span className={`mk-avatar${ocupado ? ' trabalhando' : ''}`}><img src="/agentes/marketing-rosto.webp" alt="" /></span>
        <div className="mk-topo-txt">
          <h1>Agente de Marketing</h1>
          <p className="muted">Conteúdo e campanhas da Unique. Nada é publicado sozinho.</p>
          {perfil.dados && !perfil.dados.ativo && <p className="erro-txt pequeno">Este agente está desligado. Ligue em Configurar agente.</p>}
        </div>
        <button className="btn btn-ouro btn-grande mk-nova" onClick={() => setModal('nova')}><Icone nome="mais" /> Nova peça</button>
      </header>
      <nav className="mk-abas-topo">
        <button className={aba === 'planejamento' ? 'ativa' : ''} onClick={() => setAba('planejamento')}>Planejamento</button>
        <button className={aba === 'producao' ? 'ativa' : ''} onClick={() => setAba('producao')}>Produção{aguardando ? <span className="mk-conta">{aguardando}</span> : null}</button>
        <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>Configurar agente</button>
      </nav>

      {ocupado && <div className="progresso"><div className="indeterminado" /><span>O agente está escrevendo (uma peça leva uns 20 segundos; uma semana, até 2 minutos). Pode sair da tela: o trabalho continua.</span></div>}
      {erro && <div className="erro agente-erro"><span>{erro.erro}</span></div>}

      {aba === 'planejamento' && (
        <Planejamento inicio={inicio} aoMudarSemana={setInicio} pecas={daCampanha} recarregar={pecas.recarregar} ocupadas={ocupadas}
          campanhas={campanhas} campanha={campanha} aoMudarCampanha={setCampanha} aoCriarCampanha={() => setModal('campanha')}
          aoAbrir={abrir} aoPlanejar={() => setModal('planejar')} aoNova={() => setModal('nova')} />
      )}
      {aba === 'producao' && <Producao pecas={daCampanha} aberta={pecaAberta} aoAbrir={(p) => setAberta(p.id)} trabalhos={trabalhos.dados ?? []} aoMudar={() => { pecas.recarregar(); trabalhos.recarregar() }} />}
      {aba === 'config' && (
        <section className="bloco">
          <h2>Configurar o Agente de Marketing</h2>
          {perfil.dados !== undefined && !perfil.carregando && <ConfigAgente empresaId={EMPRESA} agenteId="marketing" ativo={perfil.dados?.ativo ?? true} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}
          <p className="muted pequeno">Últimos trabalhos deste agente: {usd(custoMes)}. Tudo em <Link to="/agentes/historico" className="link">Histórico</Link>.</p>
        </section>
      )}

      <Planejar aberto={modal === 'planejar'} aoFechar={() => setModal(null)} inicioPadrao={inicio} campanhas={campanhas} campanhaPadrao={campanha} aoPedir={depoisDoPedido} />
      <NovaPeca aberto={modal === 'nova'} aoFechar={() => setModal(null)} campanhas={campanhas} campanhaPadrao={campanha} aoPedir={depoisDoPedido} />
      <NovaCampanha aberto={modal === 'campanha'} aoFechar={() => setModal(null)} aoCriar={(id) => { setModal(null); perfil.recarregar(); setCampanha(id) }} />
    </div>
  )
}
