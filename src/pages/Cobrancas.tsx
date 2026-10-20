// Cobranças: a lista de quem a vendedora precisa cobrar (o administrador vê todas e filtra por vendedora). Cada uma
// mostra o que está vencido, de qual conta da Hotmart, o último contato e a promessa. Botões: WhatsApp com a mensagem
// pronta, registrar contato e ver o histórico. Fecha sozinha quando a Hotmart confirma o pagamento.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConsulta } from '../lib/dados'
import { useAuth } from '../auth'
import { brl, dataBR } from '../lib/format'
import { Badge, Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { ABERTAS, SITUACAO_COBRANCA, nomeCurtoConta, registrarContato, useCobrancas, useContasHotmart, useContatos, type Cobranca } from './cobranca/dados'
import { MensagemWhats } from './cobranca/MensagemWhats'
import { RegistrarContato } from './cobranca/RegistrarContato'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Historico({ id }: { id: string }) {
  const contatos = useContatos(id)
  if (contatos.carregando) return <p className="muted pequeno">Carregando…</p>
  return (
    <ul className="cob-historico">{(contatos.dados ?? []).map((c) => (
      <li key={c.id}><span className="muted pequeno">{quando(c.criado_em)} · {c.quem_nome ?? '—'}</span><b>{c.resultado}</b>{c.observacao && <small className="muted">{c.observacao}</small>}</li>))}
    </ul>
  )
}

function CartaoCobranca({ c, conta, responsavel, eu, aoMudar }: { c: Cobranca; conta: string; responsavel: string | null; eu: string; aoMudar: () => void }) {
  const [aberto, setAberto] = useState<'whats' | 'registrar' | 'historico' | null>(null)
  const s = SITUACAO_COBRANCA[c.situacao]
  const fechar = () => { setAberto(null); aoMudar() }
  return (
    <li className="bloco cob-cartao">
      <div className="cob-cartao-topo"><div><b>{c.aluno_nome}</b><div className="muted pequeno">{c.produto} · {conta}</div></div><Badge tom={s.tom}>{s.rotulo}</Badge></div>
      <div className="cob-valores">
        <span><small className="muted">Vencido</small><b className="erro-txt">{brl(c.valor_vencido)}</b><small className="muted">{c.cobrancas_vencidas ?? 0} cobrança(s)</small></span>
        <span><small className="muted">Parou de pagar em</small><b>{dataBR(c.venceu_em)}</b></span>
        <span><small className="muted">Último contato</small><b>{c.ultimo_contato_em ? quando(c.ultimo_contato_em) : 'nenhum'}</b></span>
        {c.situacao === 'prometeu' && c.promessa_em && <span><small className="muted">Prometeu até</small><b>{dataBR(c.promessa_em)}</b></span>}
        {responsavel && <span><small className="muted">Com</small><b>{responsavel}</b></span>}
      </div>
      <div className="cob-botoes">
        <button type="button" className="btn btn-mini btn-contorno" disabled={!c.telefone} onClick={() => setAberto('whats')}><Icone nome="whats" tam={14} /> WhatsApp</button>
        <button type="button" className="btn btn-mini" onClick={() => setAberto('registrar')}><Icone nome="lapis" tam={13} /> Registrar contato</button>
        <button type="button" className="btn btn-mini" onClick={() => setAberto(aberto === 'historico' ? null : 'historico')}><Icone nome="historico" tam={13} /> Histórico</button>
      </div>
      {aberto === 'historico' && <Historico id={c.id} />}
      {aberto === 'whats' && <MensagemWhats dados={c} eu={eu} marca={conta} aoFechar={fechar} aoEnviar={(texto) => registrarContato(c.id, { canal: 'whatsapp', resultado: 'Mandei mensagem pelo WhatsApp', observacao: texto }, eu)} />}
      {aberto === 'registrar' && <RegistrarContato cobranca={c} eu={eu} aoFechar={() => setAberto(null)} aoSalvar={fechar} />}
    </li>
  )
}

export default function Cobrancas() {
  const { perfil, isAdmin } = useAuth()
  const cobrancas = useCobrancas(), contas = useContasHotmart()
  const vendedoras = useConsulta<{ id: string; nome: string }[]>(() => supabase.from('vendedoras').select('id,nome').eq('ativa', true).order('nome'), [])
  const [aba, setAba] = useState<'abertas' | 'resolvidas'>('abertas')
  const [quem, setQuem] = useState('')
  const eu = perfil?.nome || perfil?.email || 'Equipe'
  const nomeConta = (id: string | null) => nomeCurtoConta((contas.dados ?? []).find((x) => x.id === id)?.nome ?? 'Hotmart')
  const nomeVend = (id: string | null) => (vendedoras.dados ?? []).find((v) => v.id === id)?.nome ?? null
  const todas = (cobrancas.dados ?? []).filter((c) => !quem || (quem === 'ninguem' ? !c.responsavel_id : c.responsavel_id === quem))
  const lista = todas.filter((c) => (aba === 'abertas') === ABERTAS.includes(c.situacao))
    .sort((a, b) => (a.promessa_em ?? '9').localeCompare(b.promessa_em ?? '9') || Number(b.valor_vencido) - Number(a.valor_vencido))
  const totalAberto = todas.filter((c) => ABERTAS.includes(c.situacao)).reduce((s, c) => s + Number(c.valor_vencido ?? 0), 0)

  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Cobranças</h1>
        <p className="muted">{isAdmin ? 'Todas as cobranças passadas para a equipe.' : 'Quem você precisa cobrar.'} Fecham sozinhas quando a Hotmart confirma o pagamento.</p></div></header>
      <div className="cob-topo">
        <div className="re-abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === 'abertas'} className={aba === 'abertas' ? 'ativa' : ''} onClick={() => setAba('abertas')}>A cobrar <span className="re-selo">{todas.filter((c) => ABERTAS.includes(c.situacao)).length}</span></button>
          <button type="button" role="tab" aria-selected={aba === 'resolvidas'} className={aba === 'resolvidas' ? 'ativa' : ''} onClick={() => setAba('resolvidas')}>Resolvidas</button>
        </div>
        {isAdmin && <label className="select-icone"><select value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Vendedora">
          <option value="">Todas as vendedoras</option><option value="ninguem">Sem responsável</option>
          {(vendedoras.dados ?? []).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
        <span className="muted pequeno">Em aberto: <b>{brl(totalAberto)}</b></span>
      </div>
      <Erro msg={cobrancas.erro} />
      {!cobrancas.carregando && !lista.length ? <Vazio>{aba === 'abertas' ? (isAdmin ? 'Nenhuma cobrança aberta. Passe as cobranças em Pagamentos → Online → Vencido sem pagamento.' : 'Nenhuma cobrança passada para você.') : 'Nada resolvido ainda.'}</Vazio> : (
        <ul className="cob-lista">{lista.map((c) => <CartaoCobranca key={c.id} c={c} conta={nomeConta(c.integracao_id)} responsavel={isAdmin ? nomeVend(c.responsavel_id) : null} eu={eu} aoMudar={cobrancas.recarregar} />)}</ul>
      )}
    </div>
  )
}
