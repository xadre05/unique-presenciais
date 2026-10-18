// Central de agentes: a chave do Claude, o modelo, o limite de gasto do mês e quais agentes estão ligados.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro, useConsulta } from '../../lib/dados'
import { dataHoraBR } from '../../lib/format'
import { Badge, Campo, Erro } from '../../components/ui'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { MODELOS, usd, type AgenteSala, type Config } from './comum'

const EMPRESA = EMPRESA_UNIQUE

function ChaveClaude({ cfg, aoSalvar }: { cfg: Config | null; aoSalvar: () => void }) {
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const salvar = async () => {
    setErro(null); setOk(false)
    const { error } = await supabase.rpc('agentes_salvar_chave', { p_empresa: EMPRESA, p_valor: chave })
    if (error) return setErro(msgErro(error))
    setChave(''); setOk(true); aoSalvar()
  }
  return (
    <section className="bloco">
      <div className="bloco-topo"><h2>Chave do Claude</h2>{cfg?.chave_em ? <Badge tom="ok">cadastrada em {dataHoraBR(cfg.chave_em)}</Badge> : <Badge tom="alerta">faltando</Badge>}</div>
      <ol className="passos pequeno">
        <li>Entre em <b>console.anthropic.com</b> com o seu login (é diferente da assinatura do app do Claude: o app não vale aqui).</li>
        <li>Em <b>Billing</b>, coloque crédito (é pré-pago, cobrado por uso). Para começar, US$ 5 a US$ 10 rendem muitas semanas de conteúdo.</li>
        <li>Em <b>API Keys</b> → <b>Create Key</b>, dê o nome "Unique Comercial" e copie a chave (começa com <code>sk-ant-</code>).</li>
        <li>Cole aqui e salve. A chave fica cifrada no servidor: depois de salva, ninguém consegue ver de volta, só trocar.</li>
      </ol>
      <div className="linha-campos">
        <Campo rotulo={cfg?.chave_em ? 'Trocar a chave' : 'Chave'}><input type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} placeholder="sk-ant-…" /></Campo>
        <button className="btn btn-ouro" disabled={!chave.trim()} onClick={salvar}>Salvar chave</button>
      </div>
      <Erro msg={erro} />{ok && <p className="ok-txt pequeno">Chave salva ✓</p>}
    </section>
  )
}

export default function Central() {
  const cfg = useConsulta<Config | null>(() => supabase.from('agentes_config').select('*').eq('empresa_id', EMPRESA).maybeSingle())
  const sala = useConsulta<AgenteSala[]>(() => supabase.rpc('agentes_sala', { p_empresa: EMPRESA }))
  const [erro, setErro] = useState<string | null>(null)

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
      <header className="pagina-topo"><div><h1>Central de agentes</h1><p className="muted">Chave da IA, quanto pode gastar e quais agentes trabalham para a empresa.</p></div></header>
      <ChaveClaude cfg={cfg.dados ?? null} aoSalvar={cfg.recarregar} />

      <section className="bloco">
        <h2>Modelo e limite</h2>
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

      <section className="bloco">
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
      </section>
      <Erro msg={erro} />
    </div>
  )
}
