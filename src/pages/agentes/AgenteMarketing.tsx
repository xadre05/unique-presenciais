// Agente de Marketing: pedir uma semana de conteúdo, acompanhar o trabalho e aprovar peça por peça.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { dataBR, dataHoraBR } from '../../lib/format'
import { Campo, Erro, InputNumero, Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import type { PerfilMarketing } from './MarketingPerfil'
import { SemanaQuadro } from './SemanaQuadro'
import { ConfigAgente } from './ConfigAgente'
import { AnexosPedido, type Anexo } from './AnexosPedido'
import { proximaSegunda, usd, type Peca, type Trabalho } from './comum'

const EMPRESA = EMPRESA_UNIQUE
const ocupado = (t?: Trabalho | null) => t?.status === 'na_fila' || t?.status === 'trabalhando'

export default function AgenteMarketing() {
  const trabalhos = useConsulta<Trabalho[]>(() => supabase.from('agentes_trabalhos').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').eq('tipo', 'semana').order('criado_em', { ascending: false }).limit(12))
  const perfil = useConsulta<{ perfil: PerfilMarketing; ativo: boolean } | null>(() => supabase.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').maybeSingle())
  const local = useLocation()
  const [aba, setAba] = useState<'trabalho' | 'config'>(new URLSearchParams(local.search).get('aba') === 'config' ? 'config' : 'trabalho')
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const atual = (trabalhos.dados ?? []).find((t) => t.id === escolhido) ?? trabalhos.dados?.[0] ?? null
  const pecas = useConsulta<Peca[]>(() => atual ? supabase.from('agentes_pecas').select('*').eq('trabalho_id', atual.id).order('dia').order('ordem') : Promise.resolve({ data: [], error: null }), [atual?.id, atual?.status])
  const [pedido, setPedido] = useState({ semana_inicio: proximaSegunda(), foco: '', posts: 3, reels: 2, stories: 7, stories_telas: 5 })
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const trabalhando = (trabalhos.dados ?? []).some(ocupado)

  // enquanto o agente trabalha, confere a cada 4 segundos
  useEffect(() => {
    if (!trabalhando) return
    const t = setInterval(() => trabalhos.recarregar(), 4000)
    return () => clearInterval(t)
  }, [trabalhando]) // eslint-disable-line react-hooks/exhaustive-deps

  const pedir = async () => {
    setErro(null); setEnviando(true)
    const { data, error } = await supabase.from('agentes_trabalhos').insert({ empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'semana', pedido: { ...pedido, foco: pedido.foco.trim() || null, anexos } }).select('id').single()
    if (error) { setEnviando(false); return setErro(msgErro(error)) }
    const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
    if (r.error) setErro('O agente não conseguiu começar. Tente de novo em instantes.')
    setEscolhido(data.id); setEnviando(false); setAnexos([]); trabalhos.recarregar()
  }

  const apagarErro = async () => {
    if (!atual) return
    const { error } = await supabase.from('agentes_trabalhos').delete().eq('id', atual.id).eq('status', 'erro')
    if (error) return setErro(msgErro(error))
    setEscolhido(null); trabalhos.recarregar()
  }

  const estado = trabalhando ? 'trabalhando' : atual?.status === 'erro' ? 'erro' : (pecas.dados ?? []).some((p) => p.status === 'rascunho') ? 'esperando' : 'parado'

  return (
    <div className="pagina larga">
      <div className="migalha"><Link to="/agentes" className="link">← Sala dos agentes</Link></div>
      <header className="agente-topo">
        <Retrato agente="marketing" estado={estado} alto={210} />
        <div>
          <h1>Agente de Marketing</h1>
          <p className="muted">Monta a semana de conteúdo do Instagram com o que a Unique vende agora (turmas com vaga, campanha ativa). Nada é publicado sozinho.</p>
          {perfil.dados && !perfil.dados.ativo && <p className="erro-txt pequeno">Este agente está desligado. Ligue em Configurar agente.</p>}
          <div className="agente-abas">
            <button className={aba === 'trabalho' ? 'ativa' : ''} onClick={() => setAba('trabalho')}>Trabalho</button>
            <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>Configurar agente</button>
          </div>
        </div>
      </header>

      {aba === 'config' && (
        <section className="bloco">
          <h2>Configurar o Agente de Marketing</h2>
          {perfil.dados !== undefined && !perfil.carregando && <ConfigAgente empresaId={EMPRESA} agenteId="marketing" ativo={perfil.dados?.ativo ?? true} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}
        </section>
      )}
      {aba === 'trabalho' && (<>

      <section className="bloco">
        <h2>Pedir uma semana</h2>
        <div className="agente-pedido">
          <Campo rotulo="Semana que começa em"><input type="date" value={pedido.semana_inicio} onChange={(e) => setPedido((p) => ({ ...p, semana_inicio: e.target.value }))} /></Campo>
          <Campo rotulo="Posts / carrosséis"><InputNumero valor={pedido.posts} min={0} max={7} onChange={(v) => setPedido((p) => ({ ...p, posts: v ?? 0 }))} /></Campo>
          <Campo rotulo="Reels"><InputNumero valor={pedido.reels} min={0} max={7} onChange={(v) => setPedido((p) => ({ ...p, reels: v ?? 0 }))} /></Campo>
          <Campo rotulo="Dias com stories" dica="7 = todos os dias"><InputNumero valor={pedido.stories} min={0} max={7} onChange={(v) => setPedido((p) => ({ ...p, stories: v ?? 0 }))} /></Campo>
          <Campo rotulo="Stories por dia" dica="Telas em cada dia"><InputNumero valor={pedido.stories_telas} min={2} max={15} onChange={(v) => setPedido((p) => ({ ...p, stories_telas: v ?? 5 }))} /></Campo>
        </div>
        <AnexosPedido anexos={anexos} aoMudar={setAnexos} />
        <Campo rotulo="Foco da semana (opcional)" dica="Ex.: Black Friday Limited Edition — últimas vagas do módulo de toxina"><textarea rows={2} value={pedido.foco} onChange={(e) => setPedido((p) => ({ ...p, foco: e.target.value }))} /></Campo>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn btn-ouro btn-grande" disabled={enviando || trabalhando} onClick={pedir}>{trabalhando ? 'O agente está trabalhando…' : enviando ? 'Enviando…' : 'Montar a semana'}</button></div>
      </section>

      <section className="bloco">
        <div className="bloco-topo">
          <h2>Semanas montadas</h2>
          {(trabalhos.dados ?? []).length > 1 && (
            <label className="select-icone"><select value={atual?.id ?? ''} onChange={(e) => setEscolhido(e.target.value)}>
              {(trabalhos.dados ?? []).map((t) => <option key={t.id} value={t.id}>Semana de {dataBR(String(t.pedido.semana_inicio))} · pedida em {dataHoraBR(t.criado_em)}</option>)}
            </select></label>
          )}
        </div>
        {!atual && <Vazio>Nenhuma semana ainda. Peça a primeira acima.</Vazio>}
        {ocupado(atual) && <div className="progresso"><div className="indeterminado" /><span>O agente está montando a semana (leva de 30 segundos a 2 minutos). Pode sair da tela: o trabalho continua.</span></div>}
        {atual?.status === 'erro' && <div className="erro agente-erro"><span>{atual.erro}</span><button className="btn btn-mini" onClick={apagarErro}>Apagar este aviso</button></div>}
        {atual?.status === 'pronto' && (<>
          {atual.resumo && <p className="nota">{atual.resumo}</p>}
          <SemanaQuadro inicio={String(atual.pedido.semana_inicio)} pecas={pecas.dados ?? []} aoMudar={pecas.recarregar} />
          <p className="muted pequeno">Custo desta semana: {usd(atual.custo_usd)}. O que o agente sabe da Unique fica em <Link to="/agentes/marca" className="link">Base da marca</Link>.</p>
        </>)}
      </section>
      </>)}
    </div>
  )
}
