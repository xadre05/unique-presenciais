// CRM — NÚCLEO: painel do gestor (agora, por pessoa, funil, motivos de perda, origem dos leads).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Erro } from '../components/ui'
import { horaCurta, type BaseCRM } from './tipos'
import { Icone } from '../components/Icone'
import { Avatar, KpiAt } from './Pecas'

type Painel = {
  agora: { esperando: number; maior_espera: string | null; sem_dona: number; tarefas_atrasadas: number; equipe: { usuario_id: string; nome: string; disponivel: boolean; recebe_leads: boolean }[] }
  por_pessoa: { usuario_id: string; nome: string; conversas: number; esperando: number; mediana_resposta_min: number | null; tarefas_atrasadas: number; tarefas_feitas: number; ganhos: number; perdas: number }[]
  funil: { etapa: string; cor: string | null; final: string | null; contatos: number; dias_medio: number | null }[]
  motivos_perda: { motivo: string; n: number }[]
  origens: { origem: string; novos: number; ganhos: number }[]
}
const minutos = (m: number | null) => m == null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.round(m / 6) / 10} h`

// ir: navegação da área (conversas, fila de alguém) — fica de fora para o núcleo não conhecer endereços
export default function PainelGestor({ empresaId, base, ir }: { empresaId: string; base: BaseCRM; ir?: (destino: { aba?: string; fila?: string }) => void }) {
  const [dias, setDias] = useState(30)
  const [p, setP] = useState<Painel | null>(null)
  const [metas, setMetas] = useState<{ usuario_id: string; nome: string; meta: number | null; vendas: number }[]>([])
  const [t, setT] = useState<{ devolvidos: number; arquivados: number; reativados: number; no_arquivo: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('crm_painel', { p_empresa: empresaId, p_dias: dias })
    if (error) setErro(error.message); else { setErro(null); setP(data as Painel) }
    const r = await supabase.rpc('crm_painel_tentativas', { p_empresa: empresaId, p_dias: dias })
    if (!r.error) setT(r.data)
    const m = await supabase.rpc('crm_metas', { p_empresa: empresaId })
    if (!m.error) setMetas(m.data ?? [])
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
  const tot = p.por_pessoa.reduce((a, x) => ({ conversas: a.conversas + x.conversas, ganhos: a.ganhos + x.ganhos, perdas: a.perdas + x.perdas }), { conversas: 0, ganhos: 0, perdas: 0 })
  const medianas = p.por_pessoa.map((x) => x.mediana_resposta_min).filter((x): x is number => x != null).sort((a, b) => a - b)
  const medianaGeral = medianas.length ? medianas[Math.floor(medianas.length / 2)] : null
  const conversao = tot.ganhos + tot.perdas ? Math.round((100 * tot.ganhos) / (tot.ganhos + tot.perdas)) : null
  const pessoa = (id: string) => p.por_pessoa.find((x) => x.usuario_id === id)
  const atencao: { icone: string; titulo: string; texto: string; botao: string; acao: () => void }[] = []
  if (p.agora.sem_dona) atencao.push({ icone: 'usuario', titulo: `${p.agora.sem_dona} conversa(s) sem responsável`, texto: 'Dê para alguém da equipe.', botao: 'Atribuir', acao: () => ir?.({ aba: 'fila' }) })
  if (p.agora.tarefas_atrasadas) atencao.push({ icone: 'relogio', titulo: `${p.agora.tarefas_atrasadas} tarefa(s) atrasada(s)`, texto: 'Veja na fila de quem estão.', botao: 'Revisar tarefas', acao: () => ir?.({ fila: p.agora.equipe.find((m) => (pessoa(m.usuario_id)?.tarefas_atrasadas ?? 0) > 0)?.usuario_id }) })
  if (p.agora.esperando) atencao.push({ icone: 'whats', titulo: `${p.agora.esperando} pessoa(s) esperando resposta`, texto: p.agora.maior_espera ? `A mais antiga desde ${horaCurta(p.agora.maior_espera)}.` : '', botao: 'Ver conversas', acao: () => ir?.({ aba: 'todas' }) })
  if (t?.devolvidos) atencao.push({ icone: 'transferir', titulo: `${t.devolvidos} lead(s) voltaram para a fila`, texto: `Ficaram sem primeiro contato no prazo (${dias} dias).`, botao: 'Ver fila', acao: () => ir?.({ aba: 'fila' }) })
  return (
    <div className="pagina at-pagina">
      <header className="pagina-topo at-titulo-pagina">
        <div><h1>Painel do atendimento</h1><p className="muted">Prioridades da operação e desempenho da equipe.</p></div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select>
      </header>
      <Erro msg={erro} />

      <section className="at-kpis at-kpis-3">
        <KpiAt icone="whats" rotulo="Esperando resposta" valor={p.agora.esperando} tom={p.agora.esperando ? 'erro' : undefined} sub={p.agora.maior_espera ? `maior espera desde ${horaCurta(p.agora.maior_espera)}` : 'ninguém esperando'} onClick={ir ? () => ir({ aba: 'todas' }) : undefined} />
        <KpiAt icone="usuario" rotulo="Sem responsável" valor={p.agora.sem_dona} tom={p.agora.sem_dona ? 'ouro' : undefined} sub="conversa(s) na fila, sem dona" onClick={ir ? () => ir({ aba: 'fila' }) : undefined} />
        <KpiAt icone="relogio" rotulo="Tarefas atrasadas" valor={p.agora.tarefas_atrasadas} tom={p.agora.tarefas_atrasadas ? 'erro' : undefined} sub="tarefas com prazo vencido" />
      </section>
      <section className="at-kpis at-kpis-4">
        <KpiAt icone="whats" rotulo="Conversas" valor={tot.conversas} tom="info" sub={`nos últimos ${dias} dias`} />
        <KpiAt icone="relogio" rotulo="Primeira resposta" valor={minutos(medianaGeral)} sub="tempo típico (mediana)" />
        <KpiAt icone="comissoes" rotulo="Vendas confirmadas" valor={tot.ganhos} tom="ok" sub={`nos últimos ${dias} dias`} />
        <KpiAt icone="filtro" rotulo="Conversão" valor={conversao == null ? '—' : `${conversao}%`} sub={`${tot.ganhos} de ${tot.ganhos + tot.perdas} encerradas`} />
      </section>

      <div className="at-duas at-duas-painel">
        <section className="at-painel">
          <div className="at-painel-topo"><Icone nome="turmas" tam={22} /><h2>Equipe e rodízio</h2>
            <label className={`interruptor${base.config.rodizio ? ' ligado' : ''}`}><input type="checkbox" checked={!!base.config.rodizio} onChange={(e) => rodizio(e.target.checked)} />{base.config.rodizio ? 'Rodízio ligado: lead novo vai para a próxima disponível' : 'Rodízio desligado: lead novo cai na Fila'}</label>
          </div>
          <div className="tabela-wrap">
            <table className="tabela compacta at-equipe">
              <thead><tr><th>Pessoa</th><th>Disponibilidade</th><th>Rodízio</th><th className="num">Conversas</th><th className="num">Esperando</th><th className="num">Atrasadas</th><th></th></tr></thead>
              <tbody>{p.agora.equipe.map((m) => {
                const x = pessoa(m.usuario_id)
                return (
                  <tr key={m.usuario_id}>
                    <td><span className="at-contato-cel"><Avatar nome={m.nome} /> {m.nome}</span></td>
                    <td><button className={`at-pill${m.disponivel ? ' ok' : ''}`} onClick={() => alternar(m.usuario_id, 'disponivel', !m.disponivel)} title="Clique para trocar"><span className="at-ponto" /> {m.disponivel ? 'Disponível' : 'Ausente'}</button></td>
                    <td><input type="checkbox" checked={m.recebe_leads} onChange={(e) => alternar(m.usuario_id, 'recebe_leads', e.target.checked)} aria-label="Entra no rodízio" /></td>
                    <td className="num">{x?.conversas ?? 0}</td>
                    <td className={`num${x?.esperando ? ' erro-txt' : ''}`}>{x?.esperando ?? 0}</td>
                    <td className={`num${x?.tarefas_atrasadas ? ' erro-txt' : ''}`}>{x?.tarefas_atrasadas ?? 0}</td>
                    <td>{ir && <button className="btn btn-contorno-ouro btn-mini" onClick={() => ir({ fila: m.usuario_id })}>Ver fila <Icone nome="seta_dir" tam={14} /></button>}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
          <p className="muted pequeno">Quem já falou com uma vendedora continua com ela. Lead novo vai para quem está disponível e entra no rodízio, um de cada vez.</p>
        </section>

        <section className="at-painel">
          <div className="at-painel-topo"><Icone nome="alerta" tam={22} /><h2>Atenção do gestor</h2></div>
          {atencao.length === 0 ? <p className="muted pequeno">Nada pedindo atenção agora. 👏</p> : (
            <div className="at-lista">{atencao.map((a) => (
              <div key={a.titulo} className="at-atencao">
                <span className="at-kpi-icone"><Icone nome={a.icone} tam={20} /></span>
                <div><b>{a.titulo}</b>{a.texto && <span className="muted pequeno">{a.texto}</span>}</div>
                {ir && <button className="btn btn-contorno-ouro btn-mini" onClick={a.acao}>{a.botao} <Icone nome="seta_dir" tam={14} /></button>}
              </div>
            ))}</div>
          )}
        </section>
      </div>

      {t && <section className="at-painel at-movimento">
        <div className="at-painel-topo"><Icone nome="arquivo" tam={22} /><h2>Movimentação da base</h2></div>
        <div className="at-kpis at-kpis-4">
          <KpiAt icone="transferir" rotulo="Voltaram para a fila" valor={t.devolvidos} tom={t.devolvidos ? 'alerta' : undefined} sub={`sem primeiro contato no prazo · ${dias} dias`} />
          <KpiAt icone="arquivo" rotulo="Arquivados" valor={t.arquivados} sub={`não responderam · ${dias} dias`} />
          <KpiAt icone="atualizar" rotulo="Voltaram do arquivo" valor={t.reativados} sub="responderam ou compraram depois" />
          <KpiAt icone="arquivo" rotulo="No arquivo hoje" valor={t.no_arquivo.toLocaleString('pt-BR')} sub="fora das listas e disparos" />
        </div>
      </section>}

      <section className="bloco">
        <div className="bloco-topo"><h2>Metas do mês</h2><span className="muted pequeno">Cada vendedora vê só a própria meta, na Minha fila.</span></div>
        <table className="tabela compacta">
          <thead><tr><th>Pessoa</th><th className="num">Vendas no mês</th><th>Meta</th><th>Andamento</th></tr></thead>
          <tbody>{[...metas].sort((a, b) => b.vendas - a.vendas).map((m) => (
            <tr key={m.usuario_id}>
              <td>{m.nome}</td><td className="num ok-txt">{m.vendas}</td>
              <td><input className="input-meta" type="number" min={0} defaultValue={m.meta ?? ''} placeholder="—"
                onBlur={async (e) => { const v = Number(e.target.value) || 0; if (v !== (m.meta ?? 0)) { const { error } = await supabase.rpc('crm_definir_meta', { p_empresa: empresaId, p_usuario: m.usuario_id, p_meta: v }); if (error) setErro(error.message); else carregar() } }} /></td>
              <td>{m.meta ? <div className="barra-meta larga"><div style={{ width: `${Math.min(100, (100 * m.vendas) / m.meta)}%` }} /></div> : <span className="muted pequeno">sem meta</span>}</td>
            </tr>
          ))}</tbody>
        </table>
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
