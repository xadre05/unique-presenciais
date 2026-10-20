// Controle → Conexões do sistema: o que o próprio sistema sabe sobre as ligações com Hotmart, Instagram, WhatsApp e IA.
// Só leitura — cada cartão leva para a tela onde se resolve.
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { dataHoraBR, hojeISO } from '../../lib/format'
import { Badge, Erro, Vazio } from '../../components/ui'
import { diasAte } from './dados'
import { QuadroMonitor } from './QuadroMonitor'

type Integ = { id: string; nome: string; ativa: boolean; credenciais_em: string | null; ultimo_teste_ok: boolean | null; ultimo_erro: string | null; ultima_sinc_em: string | null; ultimo_aviso_em: string | null }
type Rede = { rede: string; status: string | null; usuario: string | null; token_expira_em: string | null; erro: string | null; sincronizado_em: string | null }
type Canal = { id: string; nome: string; tipo: string; status: string | null; status_info: string | null; ativo: boolean }
type Estado = { tom: string; texto: string }
type Cartao = { nome: string; estado: Estado; linhas: string[]; ir: string }

function cartaoHotmart(i: Integ): Cartao {
  const estado: Estado = !i.ativa ? { tom: 'apagado', texto: 'Desligada' }
    : !i.credenciais_em ? { tom: 'erro', texto: 'Sem credenciais' }
      : i.ultimo_teste_ok === false ? { tom: 'erro', texto: 'Com erro' }
        : !i.ultimo_aviso_em ? { tom: 'alerta', texto: 'Aviso (webhook) nunca chegou' } : { tom: 'ok', texto: 'Funcionando' }
  return { nome: i.nome, estado, ir: '/controle/configuracoes/integracoes', linhas: [
    `Última busca: ${dataHoraBR(i.ultima_sinc_em)}`, `Último aviso da Hotmart: ${dataHoraBR(i.ultimo_aviso_em)}`, ...(i.ultimo_erro ? [`Erro: ${i.ultimo_erro}`] : [])] }
}

function cartaoRede(r: Rede, hoje: string): Cartao {
  const dias = r.token_expira_em ? diasAte(r.token_expira_em.slice(0, 10), hoje) : null
  const estado: Estado = r.status !== 'conectado' ? { tom: 'erro', texto: 'Desconectado' }
    : dias != null && dias <= 7 ? { tom: 'alerta', texto: `Acesso vence em ${Math.max(dias, 0)} dia(s)` } : { tom: 'ok', texto: 'Conectado' }
  return { nome: r.rede === 'instagram' ? `Instagram${r.usuario ? ` (@${r.usuario})` : ''}` : r.rede, estado, ir: '/agentes/central', linhas: [
    `Acesso vale até: ${dataHoraBR(r.token_expira_em)}`, `Última leitura: ${dataHoraBR(r.sincronizado_em)}`, ...(r.erro ? [`Erro: ${r.erro}`] : [])] }
}

function cartaoCanal(c: Canal): Cartao {
  const ok = ['conectado', 'ativo', 'online', 'connected', 'open'].includes((c.status ?? '').toLowerCase())
  const estado: Estado = !c.ativo ? { tom: 'apagado', texto: 'Desligado' } : ok ? { tom: 'ok', texto: 'Conectado' } : { tom: 'erro', texto: c.status ?? 'Sem sinal' }
  return { nome: `WhatsApp: ${c.nome}`, estado, ir: '/atendimento/config', linhas: [c.status_info ?? c.tipo] }
}

export default function PaginaConexoes() {
  const hoje = hojeISO()
  const integ = useConsulta<Integ[]>(() => supabase.from('integracoes').select('id,nome,ativa,credenciais_em,ultimo_teste_ok,ultimo_erro,ultima_sinc_em,ultimo_aviso_em').order('ordem'), [])
  const redes = useConsulta<Rede[]>(() => supabase.from('marca_conexoes').select('rede,status,usuario,token_expira_em,erro,sincronizado_em'), [])
  const canais = useConsulta<Canal[]>(() => supabase.from('crm_canais').select('id,nome,tipo,status,status_info,ativo').order('nome'), [])
  const ia = useConsulta<{ chave_em: string | null }[]>(() => supabase.from('agentes_config').select('chave_em'), [])

  const cartoes: Cartao[] = [
    ...(integ.dados ?? []).map(cartaoHotmart),
    ...(redes.dados ?? []).map((r) => cartaoRede(r, hoje)),
    ...(canais.dados ?? []).map(cartaoCanal),
    ...(ia.dados ?? []).slice(0, 1).map((c) => ({ nome: 'Chave de IA dos agentes', ir: '/agentes/central', linhas: [`Cadastrada em: ${dataHoraBR(c.chave_em)}`],
      estado: c.chave_em ? { tom: 'ok', texto: 'Cadastrada' } : { tom: 'erro', texto: 'Sem chave' } })),
  ]
  const carregando = integ.carregando || redes.carregando || canais.carregando
  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Está tudo no ar?</h1><p className="muted">Sites, domínios, inteligência artificial, banco de dados e as ligações com Hotmart, Instagram e WhatsApp. Se alguma coisa cair, aparece aqui.</p></div></header>
      <QuadroMonitor />
      <h2 className="ctl-sub">Ligações do sistema</h2>
      <Erro msg={integ.erro || redes.erro || canais.erro || ia.erro} />
      {carregando && !cartoes.length ? <Vazio>Carregando…</Vazio> : !cartoes.length ? <Vazio>Nenhuma conexão encontrada.</Vazio> : (
        <div className="ctl-cartoes">{cartoes.map((c) => (
          <section key={c.nome} className="bloco ctl-cartao">
            <header><b>{c.nome}</b><Badge tom={c.estado.tom}>{c.estado.texto}</Badge></header>
            {c.linhas.map((l) => <p key={l} className="muted pequeno">{l}</p>)}
            <Link to={c.ir} className="link pequeno">Abrir onde se resolve</Link>
          </section>
        ))}</div>
      )}
    </div>
  )
}
