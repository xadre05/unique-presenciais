// CRM — NÚCLEO: painel do gestor (agora, por pessoa, funil, motivos de perda, origem dos leads).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Erro } from '../components/ui'
import { horaCurta, type BaseCRM } from './tipos'

type Painel = {
  agora: { esperando: number; maior_espera: string | null; sem_dona: number; tarefas_atrasadas: number; equipe: { usuario_id: string; nome: string; disponivel: boolean; recebe_leads: boolean }[] }
  por_pessoa: { usuario_id: string; nome: string; conversas: number; esperando: number; mediana_resposta_min: number | null; tarefas_atrasadas: number; tarefas_feitas: number; ganhos: number; perdas: number }[]
  funil: { etapa: string; cor: string | null; final: string | null; contatos: number; dias_medio: number | null }[]
  motivos_perda: { motivo: string; n: number }[]
  origens: { origem: string; novos: number; ganhos: number }[]
}
const minutos = (m: number | null) => m == null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.round(m / 6) / 10} h`

export default function PainelGestor({ empresaId, base }: { empresaId: string; base: BaseCRM }) {
  const [dias, setDias] = useState(30)
  const [p, setP] = useState<Painel | null>(null)
  const [t, setT] = useState<{ devolvidos: number; arquivados: number; reativados: number; no_arquivo: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('crm_painel', { p_empresa: empresaId, p_dias: dias })
    if (error) setErro(error.message); else { setErro(null); setP(data as Painel) }
    const r = await supabase.rpc('crm_painel_tentativas', { p_empresa: empresaId, p_dias: dias })
    if (!r.error) setT(r.data)
  }, [empresaId, dias])
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t) }, [carregar])

  const alternar = async (u: string, campo: 'disponivel' | 'recebe_leads', v: boolean) => {
    const r = campo === 'disponivel'
      ? await supabase.rpc('crm_minha_disponibilidade', { p_empresa: empresaId, p_disponivel: v, p_usuario: u })
      : await supabase.rpc('crm_recebe_leads', { p_empresa: empresaId, p_usuario: u, p_valor: v })
    if (r.error) setErro(r.error.message); else { carregar(); base.recarregar() }
  }
  const rodizio = async (v: boolean) => { await supabase.rpc('crm_salvar_config', { p_empresa: empresaId, p_config: { rodizio: v } }); base.recarregar() }

  if (!p) return <div className="pagina"><Erro msg={erro} /></div>
  const maxFunil = Math.max(1, ...p.funil.map((f) => f.contatos))
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Painel do atendimento</h1><p className="muted">O que está acontecendo agora e como cada pessoa está indo.</p></div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select>
      </header>
      <Erro msg={erro} />

      <h2 className="titulo-secao">Agora</h2>
      <section className="kpis">
        <div className="kpi"><div className="kpi-rotulo">Esperando resposta</div><div className={`kpi-valor${p.agora.esperando ? ' erro-txt' : ''}`}>{p.agora.esperando}</div><div className="kpi-sub">{p.agora.maior_espera ? `maior espera desde ${horaCurta(p.agora.maior_espera)}` : 'ninguém esperando'}</div></div>
        <div className="kpi"><div className="kpi-rotulo">Conversas sem dona</div><div className="kpi-valor">{p.agora.sem_dona}</div></div>
        <div className="kpi"><div className="kpi-rotulo">Tarefas atrasadas</div><div className={`kpi-valor${p.agora.tarefas_atrasadas ? ' erro-txt' : ''}`}>{p.agora.tarefas_atrasadas}</div></div>
      </section>
      {t && <section className="kpis">
        <div className="kpi"><div className="kpi-rotulo">Voltaram para a fila</div><div className={`kpi-valor${t.devolvidos ? ' aviso-txt' : ''}`}>{t.devolvidos}</div><div className="kpi-sub">sem primeiro contato no prazo · {dias} dias</div></div>
        <div className="kpi"><div className="kpi-rotulo">Arquivados</div><div className="kpi-valor">{t.arquivados}</div><div className="kpi-sub">não responderam · {dias} dias</div></div>
        <div className="kpi"><div className="kpi-rotulo">Voltaram do arquivo</div><div className="kpi-valor">{t.reativados}</div><div className="kpi-sub">responderam ou compraram depois</div></div>
        <div className="kpi"><div className="kpi-rotulo">No arquivo hoje</div><div className="kpi-valor">{t.no_arquivo.toLocaleString('pt-BR')}</div></div>
      </section>}

      <section className="bloco">
        <div className="bloco-topo"><h2>Equipe e rodízio</h2>
          <label className={`interruptor${base.config.rodizio ? ' ligado' : ''}`}><input type="checkbox" checked={!!base.config.rodizio} onChange={(e) => rodizio(e.target.checked)} />{base.config.rodizio ? 'Rodízio ligado: lead novo vai para a próxima disponível' : 'Rodízio desligado: lead novo cai na Fila'}</label>
        </div>
        <table className="tabela compacta">
          <thead><tr><th>Pessoa</th><th>Agora</th><th>Entra no rodízio</th></tr></thead>
          <tbody>{p.agora.equipe.map((m) => (
            <tr key={m.usuario_id}>
              <td>{m.nome}</td>
              <td><label className="check"><input type="checkbox" checked={m.disponivel} onChange={(e) => alternar(m.usuario_id, 'disponivel', e.target.checked)} /> {m.disponivel ? 'disponível' : 'ausente'}</label></td>
              <td><label className="check"><input type="checkbox" checked={m.recebe_leads} onChange={(e) => alternar(m.usuario_id, 'recebe_leads', e.target.checked)} /> {m.recebe_leads ? 'sim' : 'não'}</label></td>
            </tr>
          ))}</tbody>
        </table>
        <p className="muted pequeno">Quem já falou com uma vendedora continua com ela. Lead novo vai para quem está disponível e entra no rodízio, um de cada vez.</p>
      </section>

      <h2 className="titulo-secao">Por pessoa · últimos {dias} dias</h2>
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela">
          <thead><tr><th>Pessoa</th><th className="num">Conversas</th><th className="num">Esperando agora</th><th className="num">Tempo de 1ª resposta</th><th className="num">Tarefas atrasadas</th><th className="num">Tarefas feitas</th><th className="num">Vendas</th><th className="num">Perdas</th></tr></thead>
          <tbody>{p.por_pessoa.map((x) => (
            <tr key={x.usuario_id}>
              <td className="forte">{x.nome}</td><td className="num">{x.conversas}</td>
              <td className={`num${x.esperando ? ' erro-txt' : ''}`}>{x.esperando}</td>
              <td className="num">{minutos(x.mediana_resposta_min)}</td>
              <td className={`num${x.tarefas_atrasadas ? ' erro-txt' : ''}`}>{x.tarefas_atrasadas}</td>
              <td className="num">{x.tarefas_feitas}</td><td className="num ok-txt">{x.ganhos}</td><td className="num">{x.perdas}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="muted pequeno" style={{ padding: '0 16px 12px' }}>Tempo de 1ª resposta é a mediana: metade das conversas foi respondida mais rápido que isso.</p>
      </div>

      <div className="grade-2">
        <section className="bloco">
          <h2>Funil agora</h2>
          {p.funil.map((f) => (
            <div key={f.etapa} className="funil-barra">
              <span className="pequeno">{f.etapa}</span>
              <div className="fb-trilho"><div style={{ width: `${(100 * f.contatos) / maxFunil}%`, background: f.cor ?? 'var(--ouro)' }} /></div>
              <span className="pequeno num">{f.contatos}{f.dias_medio != null ? <span className="muted"> · {f.dias_medio} d</span> : ''}</span>
            </div>
          ))}
          <p className="muted pequeno">“d” = dias, em média, parados nessa etapa.</p>
        </section>
        <section className="bloco">
          <h2>Motivos de perda</h2>
          {p.motivos_perda.length === 0 ? <p className="muted pequeno">Nenhuma perda marcada no período.</p>
            : <table className="tabela compacta"><tbody>{p.motivos_perda.map((m) => <tr key={m.motivo}><td>{m.motivo}</td><td className="num">{m.n}</td></tr>)}</tbody></table>}
          <h2 className="mt">De onde vieram</h2>
          <table className="tabela compacta"><thead><tr><th>Origem</th><th className="num">Novos</th><th className="num">Vendas</th></tr></thead>
            <tbody>{p.origens.map((o) => <tr key={o.origem}><td>{o.origem}</td><td className="num">{o.novos}</td><td className="num ok-txt">{o.ganhos}</td></tr>)}</tbody></table>
        </section>
      </div>
    </div>
  )
}
