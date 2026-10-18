// Agente de Marketing: pedir uma semana de conteúdo, acompanhar o trabalho e aprovar peça por peça.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { dataBR, dataHoraBR } from '../../lib/format'
import { Campo, Erro, InputNumero, Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Personagem } from './Personagem'
import { MarketingPerfil, type PerfilMarketing } from './MarketingPerfil'
import { PecaCartao } from './PecaCartao'
import { VISUAL, proximaSegunda, usd, type Peca, type Trabalho } from './comum'

const EMPRESA = EMPRESA_UNIQUE
const ocupado = (t?: Trabalho | null) => t?.status === 'na_fila' || t?.status === 'trabalhando'

export default function AgenteMarketing() {
  const trabalhos = useConsulta<Trabalho[]>(() => supabase.from('agentes_trabalhos').select('*').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').order('criado_em', { ascending: false }).limit(12))
  const perfil = useConsulta<{ perfil: PerfilMarketing; ativo: boolean } | null>(() => supabase.from('agentes_empresa').select('perfil,ativo').eq('empresa_id', EMPRESA).eq('agente_id', 'marketing').maybeSingle())
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const atual = (trabalhos.dados ?? []).find((t) => t.id === escolhido) ?? trabalhos.dados?.[0] ?? null
  const pecas = useConsulta<Peca[]>(() => atual ? supabase.from('agentes_pecas').select('*').eq('trabalho_id', atual.id).order('dia').order('ordem') : Promise.resolve({ data: [], error: null }), [atual?.id, atual?.status])
  const [pedido, setPedido] = useState({ semana_inicio: proximaSegunda(), foco: '', posts: 3, reels: 2, stories: 3 })
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
    const { data, error } = await supabase.from('agentes_trabalhos').insert({ empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'semana', pedido: { ...pedido, foco: pedido.foco.trim() || null } }).select('id').single()
    if (error) { setEnviando(false); return setErro(msgErro(error)) }
    const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
    if (r.error) setErro('O agente não conseguiu começar. Tente de novo em instantes.')
    setEscolhido(data.id); setEnviando(false); trabalhos.recarregar()
  }

  const estado = trabalhando ? 'trabalhando' : atual?.status === 'erro' ? 'erro' : (pecas.dados ?? []).some((p) => p.status === 'rascunho') ? 'esperando' : 'parado'
  const porDia = new Map<string, Peca[]>()
  for (const p of pecas.dados ?? []) { const k = p.dia ?? 'sem dia'; porDia.set(k, [...(porDia.get(k) ?? []), p]) }

  return (
    <div className="pagina larga">
      <div className="migalha"><Link to="/agentes" className="link">← Sala dos agentes</Link></div>
      <header className="agente-topo">
        <Personagem cor={VISUAL.marketing.cor} estado={estado} tam={92} />
        <div>
          <h1>Agente de Marketing</h1>
          <p className="muted">Monta a semana de conteúdo do Instagram com o que a Unique vende agora (turmas com vaga, campanha ativa). Nada é publicado sozinho.</p>
          {perfil.dados && !perfil.dados.ativo && <p className="erro-txt pequeno">Este agente está desligado na <Link to="/agentes/central" className="link">Central</Link>.</p>}
        </div>
      </header>

      <section className="bloco">
        <h2>Pedir uma semana</h2>
        <div className="agente-pedido">
          <Campo rotulo="Semana que começa em"><input type="date" value={pedido.semana_inicio} onChange={(e) => setPedido((p) => ({ ...p, semana_inicio: e.target.value }))} /></Campo>
          <Campo rotulo="Posts / carrosséis"><InputNumero valor={pedido.posts} min={0} max={7} onChange={(v) => setPedido((p) => ({ ...p, posts: v ?? 0 }))} /></Campo>
          <Campo rotulo="Reels"><InputNumero valor={pedido.reels} min={0} max={7} onChange={(v) => setPedido((p) => ({ ...p, reels: v ?? 0 }))} /></Campo>
          <Campo rotulo="Stories (sequências)"><InputNumero valor={pedido.stories} min={0} max={7} onChange={(v) => setPedido((p) => ({ ...p, stories: v ?? 0 }))} /></Campo>
        </div>
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
        {atual?.status === 'erro' && <div className="erro">{atual.erro}</div>}
        {atual?.status === 'pronto' && (<>
          {atual.resumo && <p className="nota">{atual.resumo}</p>}
          <p className="muted pequeno">{(pecas.dados ?? []).length} peça(s) · custo {usd(atual.custo_usd)} · {((atual.tokens_entrada ?? 0) + (atual.tokens_saida ?? 0)).toLocaleString('pt-BR')} tokens</p>
          {[...porDia.entries()].map(([dia, ps]) => (
            <div key={dia} className="pecas-dia">
              <h3>{dia === 'sem dia' ? 'Sem dia definido' : new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</h3>
              <div className="pecas-grade">{ps.map((p) => <PecaCartao key={p.id} peca={p} aoMudar={pecas.recarregar} />)}</div>
            </div>
          ))}
        </>)}
      </section>

      <details className="bloco agente-perfil">
        <summary><b>O que o agente sabe da Unique</b> <span className="muted pequeno">· abra para ajustar</span></summary>
        {perfil.dados && <MarketingPerfil empresaId={EMPRESA} perfil={perfil.dados.perfil ?? {}} aoSalvar={perfil.recarregar} />}
      </details>
    </div>
  )
}
