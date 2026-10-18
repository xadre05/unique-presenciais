// Agente de Marketing: pedir uma peça avulsa ou o conteúdo de alguns dias, acompanhar o trabalho e aprovar peça por peça.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { dataHoraBR } from '../../lib/format'
import { Erro, Vazio } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Retrato } from './Retrato'
import type { PerfilMarketing } from './MarketingPerfil'
import { SemanaQuadro } from './SemanaQuadro'
import { ConfigAgente } from './ConfigAgente'
import { PedidoMarketing } from './PedidoMarketing'
import { PecaCartao } from './PecaCartao'
import { rotuloTrabalho, usd, type Peca, type Trabalho } from './comum'

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
  const [erro, setErro] = useState<string | null>(null)
  const trabalhando = (trabalhos.dados ?? []).some(ocupado)

  // enquanto o agente trabalha, confere a cada 4 segundos
  useEffect(() => {
    if (!trabalhando) return
    const t = setInterval(() => trabalhos.recarregar(), 4000)
    return () => clearInterval(t)
  }, [trabalhando]) // eslint-disable-line react-hooks/exhaustive-deps

  // peça avulsa e conteúdo de vários dias são o mesmo tipo de trabalho; o pedido diz o modo
  const pedir = async (pedido: Record<string, unknown>) => {
    setErro(null)
    const { data, error } = await supabase.from('agentes_trabalhos').insert({ empresa_id: EMPRESA, agente_id: 'marketing', tipo: 'semana', pedido }).select('id').single()
    if (error) { setErro(msgErro(error)); return false }
    const r = await supabase.functions.invoke('agentes', { body: { trabalho: data.id } })
    if (r.error) setErro('O agente não conseguiu começar. Tente de novo em instantes.')
    setEscolhido(data.id); trabalhos.recarregar()
    return !r.error
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
        <Retrato agente="marketing" estado={estado} alto={210} aguardando={(pecas.dados ?? []).filter((p) => p.status === 'rascunho').length} />
        <div>
          <h1>Agente de Marketing</h1>
          <p className="muted">Faz conteúdo do Instagram (uma peça avulsa, alguns dias ou a semana) com o que a Unique vende agora: turmas com vaga e campanha ativa. Nada é publicado sozinho.</p>
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

      <PedidoMarketing modoInicial={new URLSearchParams(local.search).get('modo') === 'peca' ? 'peca' : 'dias'} ocupado={trabalhando} aoPedir={pedir} />
      <Erro msg={erro} />

      <section className="bloco">
        <div className="bloco-topo">
          <h2>Trabalhos do agente</h2>
          {(trabalhos.dados ?? []).length > 1 && (
            <label className="select-icone"><select value={atual?.id ?? ''} onChange={(e) => setEscolhido(e.target.value)}>
              {(trabalhos.dados ?? []).map((t) => <option key={t.id} value={t.id}>{rotuloTrabalho(t)} · pedido em {dataHoraBR(t.criado_em)}</option>)}
            </select></label>
          )}
        </div>
        {!atual && <Vazio>Nenhum trabalho ainda. Peça o primeiro acima.</Vazio>}
        {ocupado(atual) && <div className="progresso"><div className="indeterminado" /><span>O agente está trabalhando (uma peça leva uns 20 segundos; uma semana, de 30 segundos a 2 minutos). Pode sair da tela: o trabalho continua.</span></div>}
        {atual?.status === 'erro' && <div className="erro agente-erro"><span>{atual.erro}</span><button className="btn btn-mini" onClick={apagarErro}>Apagar este aviso</button></div>}
        {atual?.status === 'pronto' && (<>
          {atual.resumo && <p className="nota">{atual.resumo}</p>}
          {atual.pedido.modo === 'peca'
            ? <div className="peca-avulsa">{(pecas.dados ?? []).map((p) => <PecaCartao key={p.id} peca={p} aoMudar={pecas.recarregar} />)}</div>
            : <SemanaQuadro inicio={String(atual.pedido.semana_inicio)} dias={Number(atual.pedido.dias ?? 7)} pecas={pecas.dados ?? []} aoMudar={pecas.recarregar} />}
          <p className="muted pequeno">Custo deste trabalho: {usd(atual.custo_usd)}. O que o agente sabe da Unique fica em <Link to="/agentes/marca" className="link">Base da marca</Link>.</p>
        </>)}
      </section>
      </>)}
    </div>
  )
}
