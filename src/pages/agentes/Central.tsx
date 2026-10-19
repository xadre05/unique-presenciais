// Configurações dos agentes, em 3 abas: Inteligências artificiais (chaves, qual IA faz cada trabalho, modelo e limite),
// Integrações (contas de fora ligadas ao sistema: Instagram; WhatsApp em seguida) e Agentes (quais trabalham e o gasto).
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { Badge, Campo, Erro } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { MODELOS, usd, type AgenteSala, type Config } from './comum'
import { ChavesIA } from './ChavesIA'
import type { EscolhaIAs } from './ias'
import { ConexaoInstagram } from './instagram/ConexaoInstagram'

const EMPRESA = EMPRESA_UNIQUE
type Aba = 'ias' | 'integracoes' | 'agentes'
const ABAS: { id: Aba; nome: string; sub: string }[] = [
  { id: 'ias', nome: 'Inteligências artificiais', sub: 'As chaves de cada IA, qual faz cada trabalho, o modelo do Claude e quanto pode gastar no mês.' },
  { id: 'integracoes', nome: 'Integrações', sub: 'Contas de fora ligadas ao sistema. O Instagram traz os posts e as métricas para o agente aprender.' },
  { id: 'agentes', nome: 'Agentes', sub: 'Quais agentes trabalham para a empresa e quanto cada um gastou no mês.' },
]

export default function Central() {
  const cfg = useConsulta<Config | null>(() => supabase.from('agentes_config').select('*').eq('empresa_id', EMPRESA).maybeSingle())
  const sala = useConsulta<AgenteSala[]>(() => supabase.rpc('agentes_sala', { p_empresa: EMPRESA }))
  const [erro, setErro] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<Aba>(() => ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'ias')
  // a volta do login do Instagram traz ?instagram=…; o aviso é lido pela própria conexão
  const trocar = (a: Aba) => { setAba(a); setParams({ aba: a }, { replace: true }) }

  const salvarCfg = async (campos: Partial<Config>) => {
    setErro(null)
    const { error } = await supabase.from('agentes_config').upsert({ empresa_id: EMPRESA, ...campos, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id' })
    if (error) setErro(msgErro(error)); else cfg.recarregar()
  }
  const ligar = async (agente: string, ativo: boolean) => {
    setErro(null)
    const { error } = await supabase.from('agentes_empresa').upsert({ empresa_id: EMPRESA, agente_id: agente, ativo }, { onConflict: 'empresa_id,agente_id' })
    if (error) setErro(msgErro(error)); else sala.recarregar()
  }
  const modelo = cfg.dados?.modelo ?? 'claude-sonnet-5-5'
  const total = (sala.dados ?? []).reduce((s, a) => s + Number(a.custo_mes_usd ?? 0), 0)

  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Configurações</h1><p className="muted">As IAs, as integrações e os agentes da empresa.</p></div></header>
      <nav className="mk-abas-topo">{ABAS.map((a) => <button key={a.id} className={aba === a.id ? 'ativa' : ''} onClick={() => trocar(a.id)}>{a.nome}</button>)}</nav>
      <p className="muted base-sub">{ABAS.find((a) => a.id === aba)!.sub}</p>
      {aba === 'ias' && <>
      <ChavesIA empresa={EMPRESA} ias={(cfg.dados?.ias ?? {}) as EscolhaIAs} aoMudarIAs={(ias) => salvarCfg({ ias })} />

      <section className="bloco">
        <h2>Modelo do Claude e limite</h2>
        <div className="linha-campos">
          <Campo rotulo="Modelo do Claude" dica={MODELOS[modelo]?.dica}>
            <select value={modelo} onChange={(e) => salvarCfg({ modelo: e.target.value })}>{Object.entries(MODELOS).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}</select>
          </Campo>
          <Campo rotulo="Limite de gasto no mês (US$)" dica="Ao chegar nele, os agentes param até o mês virar. Em branco: sem limite.">
            <input inputMode="decimal" defaultValue={cfg.dados?.limite_mes_usd ?? ''} key={String(cfg.dados?.limite_mes_usd)} onBlur={(e) => { const v = e.target.value.replace(',', '.').trim(); salvarCfg({ limite_mes_usd: v ? Number(v) : null }) }} placeholder="Ex.: 10" />
          </Campo>
        </div>
        <p className="muted pequeno">Gasto neste mês: <b>{usd(total)}</b>{cfg.dados?.limite_mes_usd != null && ` de ${usd(cfg.dados.limite_mes_usd)}`}. O valor exato aparece também em console.anthropic.com → Usage.</p>
      </section>
      </>}

      {aba === 'integracoes' && <>
        <section className="bloco"><h2>Instagram</h2><p className="muted pequeno">Só leitura: o sistema lê os posts e as métricas da conta profissional. Nada é publicado por aqui.</p>
          <ConexaoInstagram empresa={EMPRESA} /></section>
        <section className="bloco"><h2>WhatsApp</h2><p className="muted pequeno">Em seguida: os números das vendedoras no Atendimento e, depois, o envio de campanhas para os grupos.</p></section>
      </>}

      {aba === 'agentes' && <section className="bloco">
        <h2>Agentes</h2>
        <table className="tabela">
          <thead><tr><th>Agente</th><th>Faz o quê</th><th className="num">Gasto no mês</th><th>Ligado</th></tr></thead>
          <tbody>{(sala.dados ?? []).map((a) => (
            <tr key={a.agente_id}>
              <td><b>{a.nome}</b><div className="muted pequeno">{a.papel}</div></td>
              <td className="pequeno">{a.descricao}</td>
              <td className="num">{a.disponivel ? usd(a.custo_mes_usd) : '—'}</td>
              <td>{a.disponivel
                ? <label className="check"><input type="checkbox" checked={a.ativo} onChange={(e) => ligar(a.agente_id, e.target.checked)} /> {a.ativo ? 'Sim' : 'Não'}</label>
                : <Badge tom="apagado">em breve</Badge>}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>}
      <Erro msg={erro} />
    </div>
  )
}
