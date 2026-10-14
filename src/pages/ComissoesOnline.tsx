import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno } from '../lib/format'
import { Badge, Campo, enviarArquivo, Erro, InputPercent, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'

type CO = {
  id: string; pagamento_id: string; vendedora_id: string; tipo_lead: 'proprio' | 'campanha'; origem: 'rastreio' | 'atribuicao'; rastreio: string | null
  base: number; percentual: number; valor: number; competencia: string; status: string; observacao: string | null
  liberada_em: string | null; paga_em: string | null; pago_comprovante: string | null
  comprador_nome: string | null; comprador_email: string | null; produto_nome: string | null; data_pagamento: string | null; valor_pago: number | null; cobranca: number | null
}
type Atrib = {
  id: string; comprador_email: string; comprador_nome: string | null; produto_id: number | null; produto_nome: string | null; vendedora_id: string
  tipo_lead: 'proprio' | 'campanha'; origem: string; status: string; justificativa: string | null; resposta: string | null; criado_em: string; decidido_em: string | null
}
type RegraOnline = { id: string; vigente_desde: string; pct_proprio: number; pct_campanha: number; observacao: string | null }
type Compra = { comprador_email: string; email_exibido: string; comprador_nome: string; produto_id: number | null; produto_nome: string; primeira: string; ultima: string; pagamentos: number; liquido: number | null; vendedora_atual: string | null; origem_atual: string | null; pedido_pendente: boolean; minha: boolean }

export const STATUS_ONLINE: Record<string, { rotulo: string; tom: string }> = {
  pendente: { rotulo: 'Em conferência', tom: 'alerta' }, liberada: { rotulo: 'Aprovada para pagamento', tom: 'info' },
  paga: { rotulo: 'Paga', tom: 'ok' }, cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
}
export const TIPO_LEAD: Record<string, string> = { proprio: 'Lead da vendedora', campanha: 'Lead de campanha' }
const pct = (v: number) => `${String(Number(v)).replace('.', ',')}%`
const mesDe = (iso: string) => iso.slice(0, 7)
const mesAnterior = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) }

export default function ComissoesOnline() {
  const { isAdmin, perfil } = useAuth()
  const cad = useCadastros()
  const lista = useConsulta<CO[]>(() => supabase.from('comissoes_online').select('*').order('data_pagamento', { ascending: false }))
  const pedidos = useConsulta<Atrib[]>(() => supabase.from('atribuicoes_online').select('*').order('criado_em', { ascending: false }))
  const regras = useConsulta<RegraOnline[]>(() => supabase.from('comissao_online_regras').select('*').order('vigente_desde', { ascending: false }))
  const todas = lista.dados ?? []
  const meses = [...new Set(todas.map((c) => mesDe(c.competencia)))].sort().reverse()
  const [mes, setMes] = useState('')
  const [vend, setVend] = useState('')
  const [situacao, setSituacao] = useState('')
  const [modal, setModal] = useState<null | { tipo: 'liberar' | 'pagar'; itens: CO[] } | { tipo: 'meu' } | { tipo: 'decidir'; a: Atrib } | { tipo: 'trocar'; c: CO }>(null)
  useEffect(() => { if (!mes && meses.length) setMes(meses.includes(mesAnterior()) ? mesAnterior() : meses[0]) }, [meses, mes])
  const minha = cad.vendedoras.find((v) => v.perfil_id === perfil?.id)
  const nomeV = (id: string) => cad.vendedoras.find((v) => v.id === id)?.nome ?? '—'
  const regra = regras.dados?.find((r) => r.vigente_desde <= hojeISO())

  const doMes = todas.filter((c) => (!mes || mesDe(c.competencia) === mes) && (!vend || c.vendedora_id === vend))
  const filtradas = doMes.filter((c) => situacao ? c.status === situacao : c.status !== 'cancelada')
  const soma = (xs: CO[]) => xs.reduce((s, c) => s + Number(c.valor), 0)
  const porVendedora = useMemo(() => {
    const g = new Map<string, { id: string; itens: CO[] }>()
    for (const c of doMes) { const v = g.get(c.vendedora_id) ?? { id: c.vendedora_id, itens: [] }; v.itens.push(c); g.set(c.vendedora_id, v) }
    return [...g.values()].filter((v) => v.itens.some((c) => c.status !== 'cancelada'))
  }, [doMes])
  const pendentesPedido = (pedidos.dados ?? []).filter((a) => a.status === 'pendente')
  const recarregar = () => { setModal(null); lista.recarregar(); pedidos.recarregar() }

  return (<>
    <div className="faixa-info"><Icone nome="info" tam={18} /> <span>
      <b>Online: {regra ? `${pct(regra.pct_proprio)} se o lead é da vendedora · ${pct(regra.pct_campanha)} se o lead veio de campanha` : 'sem regra'}</b> · sobre o <b>líquido</b> que a Hotmart repassa · a comissão nasce a cada pagamento que cai (parcelado = comissão parcelada) · fechamento no início do mês seguinte.
      {isAdmin && <> <Link to="/configuracoes/comissoes" className="link">Percentuais e links das vendedoras</Link></>}
    </span></div>

    {!isAdmin && (
      <div className="bloco online-meu">
        <div><b>Vendeu e o link não tinha seu nome?</b><p className="muted pequeno">Diga qual aluno é seu. O administrador confere e, se aprovar, a comissão entra (inclusive das parcelas que já caíram).</p></div>
        <button className="btn btn-ouro" disabled={!minha} onClick={() => setModal({ tipo: 'meu' })}><Icone nome="mais" /> Esse aluno é meu</button>
      </div>
    )}

    {pendentesPedido.length > 0 && (
      <section className="bloco">
        <h2><Icone nome="alerta" className="ouro" /> {isAdmin ? 'Pedidos “esse aluno é meu” para conferir' : 'Meus pedidos em conferência'} <span className="muted">{pendentesPedido.length}</span></h2>
        <div className="tabela-wrap">
          <table className="tabela compacta">
            <thead><tr>{isAdmin && <th>Vendedora</th>}<th>Aluno</th><th>Produto</th><th>Lead</th><th>Como fechou</th><th>Pedido em</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>{pendentesPedido.map((a) => (
              <tr key={a.id}>
                {isAdmin && <td className="forte">{nomeV(a.vendedora_id)}</td>}
                <td>{a.comprador_nome}{isAdmin && <div className="muted pequeno">{a.comprador_email}</div>}</td>
                <td className="pequeno">{a.produto_nome}</td>
                <td className="pequeno">{TIPO_LEAD[a.tipo_lead]}</td>
                <td className="pequeno">{a.justificativa}</td>
                <td className="pequeno">{dataBR(a.criado_em)}</td>
                {isAdmin && <td className="celula-acao"><button className="btn btn-ouro btn-mini" onClick={() => setModal({ tipo: 'decidir', a })}>Conferir</button></td>}
              </tr>))}</tbody>
          </table>
        </div>
      </section>
    )}

    <div className="filtros-comissoes">
      <label className="select-icone"><select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos os meses</option>{meses.map((m) => <option key={m} value={m}>Vendas recebidas em {mesAno(m + '-01')}</option>)}</select></label>
      {isAdmin && <label className="select-icone"><select value={vend} onChange={(e) => setVend(e.target.value)}><option value="">Todas as vendedoras</option>{cad.vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
      <label className="select-icone"><select value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todas (menos canceladas)</option>{Object.entries(STATUS_ONLINE).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}</select></label>
    </div>

    <section className="por-vendedora online-fech">
      {porVendedora.map((g) => {
        const p = g.itens.filter((c) => c.status === 'pendente'), l = g.itens.filter((c) => c.status === 'liberada'), pg = g.itens.filter((c) => c.status === 'paga')
        return (
          <div key={g.id} className="pv-card online-card">
            <div className="online-card-topo"><span className="avatar"><Icone nome="usuario" /></span><div><b>{nomeV(g.id)}</b><div className="muted pequeno">{mes ? `recebidas em ${mesAno(mes + '-01')}` : 'todos os meses'} · {g.itens.filter((c) => c.status !== 'cancelada').length} pagamento(s)</div></div></div>
            <div className="online-valores">
              <span><small>Em conferência</small><b className="alerta-txt">{brl(soma(p))}</b></span>
              <span><small>Aprovado</small><b className="info-txt">{brl(soma(l))}</b></span>
              <span><small>Pago</small><b className="ok-txt">{brl(soma(pg))}</b></span>
            </div>
            {isAdmin && <div className="acoes">
              <button className="btn btn-contorno btn-mini" disabled={!p.length} onClick={() => setModal({ tipo: 'liberar', itens: p })}>Conferi — aprovar {brl(soma(p))}</button>
              <button className="btn btn-ouro btn-mini" disabled={!l.length} onClick={() => setModal({ tipo: 'pagar', itens: l })}>Registrar pagamento</button>
            </div>}
          </div>
        )
      })}
    </section>

    <Erro msg={lista.erro} />
    {filtradas.length === 0 && !lista.carregando ? <Vazio>Nenhuma comissão do online com esses filtros.</Vazio> : (
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela tabela-com">
          <thead><tr>{isAdmin && <th>Vendedora</th>}<th>Aluno</th><th>Produto</th><th>Pago em</th><th>Origem</th><th className="num">Líquido</th><th className="num">Comissão</th><th>Situação</th></tr></thead>
          <tbody>{filtradas.map((c) => (
            <tr key={c.id} className={c.status === 'cancelada' ? 'linha-apagada' : ''}>
              {isAdmin && <td className="forte">{nomeV(c.vendedora_id)}</td>}
              <td><div className="forte">{c.comprador_nome}</div>{isAdmin && <div className="muted pequeno">{c.comprador_email}</div>}</td>
              <td className="pequeno">{c.produto_nome}{c.cobranca ? <div className="muted">parcela {c.cobranca}</div> : null}</td>
              <td className="pequeno">{dataBR(c.data_pagamento)}<div className="muted">pago {brl(c.valor_pago)}</div></td>
              <td className="pequeno">{c.origem === 'rastreio' ? <>link “{c.rastreio}”</> : 'pedido aprovado'}<div className="muted">{TIPO_LEAD[c.tipo_lead]} · {pct(c.percentual)}</div>
                {isAdmin && c.status === 'pendente' && <button className="link pequeno" onClick={() => setModal({ tipo: 'trocar', c })}>corrigir</button>}</td>
              <td className="num">{brl(c.base)}</td>
              <td className="num forte">{brl(c.valor)}</td>
              <td><Badge tom={STATUS_ONLINE[c.status]?.tom}>{STATUS_ONLINE[c.status]?.rotulo}</Badge>
                {c.status === 'paga' && <div className="muted pequeno">em {dataBR(c.paga_em)}</div>}
                {c.observacao && <div className="muted pequeno">{c.observacao}</div>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    )}

    {(pedidos.dados ?? []).some((a) => a.status !== 'pendente') && (
      <details className="bloco online-hist"><summary>{isAdmin ? 'Pedidos já decididos' : 'Meus pedidos já decididos'}</summary>
        <table className="tabela compacta"><tbody>{(pedidos.dados ?? []).filter((a) => a.status !== 'pendente').map((a) => (
          <tr key={a.id}><td>{isAdmin && <b>{nomeV(a.vendedora_id)} · </b>}{a.comprador_nome} <span className="muted pequeno">({a.produto_nome})</span></td>
            <td><Badge tom={a.status === 'aprovada' ? 'ok' : 'erro'}>{a.status === 'aprovada' ? 'Aprovado' : 'Recusado'}</Badge> {a.origem === 'administrador' && <span className="muted pequeno">pelo administrador</span>}</td>
            <td className="pequeno">{a.resposta}</td><td className="pequeno">{dataBR(a.decidido_em)}</td></tr>))}</tbody></table>
      </details>
    )}

    {modal?.tipo === 'meu' && <EsseAlunoEMeu onFechar={() => setModal(null)} onSalvo={recarregar} />}
    {modal?.tipo === 'decidir' && <Decidir a={modal.a} nomeV={nomeV} onFechar={() => setModal(null)} onSalvo={recarregar} />}
    {modal?.tipo === 'trocar' && <Corrigir c={modal.c} vendedoras={cad.vendedoras} onFechar={() => setModal(null)} onSalvo={recarregar} />}
    {(modal?.tipo === 'liberar' || modal?.tipo === 'pagar') && <Fechamento tipo={modal.tipo} itens={modal.itens} nomeV={nomeV} onFechar={() => setModal(null)} onSalvo={recarregar} />}
  </>)
}

function EsseAlunoEMeu({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [termo, setTermo] = useState('')
  const [res, setRes] = useState<Compra[]>([])
  const [esc, setEsc] = useState<Compra | null>(null)
  const [tipo, setTipo] = useState<'proprio' | 'campanha'>('proprio')
  const [just, setJust] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (esc) return
    const t = setTimeout(async () => {
      if (termo.trim().length < 4) return setRes([])
      const { data, error } = await supabase.rpc('buscar_compras_online', { p_termo: termo })
      if (error) return setErro(msgErro(error))
      setErro(null); setRes((data as Compra[]) ?? [])
    }, 350)
    return () => clearTimeout(t)
  }, [termo, esc])
  const enviar = async () => {
    if (!esc) return
    const { error } = await supabase.rpc('pedir_atribuicao_online', { p_email: esc.comprador_email, p_produto: esc.produto_id, p_tipo: tipo, p_justificativa: just })
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo="Esse aluno é meu" aberto onFechar={onFechar} largo>
      {!esc ? (<>
        <Campo rotulo="Nome ou e-mail do aluno" dica="Digite pelo menos 4 letras. Aparecem só compras do online."><input value={termo} autoFocus onChange={(e) => setTermo(e.target.value)} /></Campo>
        {res.length > 0 && <ul className="lista selecionavel">{res.map((c) => (
          <li key={c.comprador_email + c.produto_id} onClick={() => !c.minha && !c.pedido_pendente && setEsc(c)} className={c.minha || c.pedido_pendente ? 'linha-apagada' : ''}>
            <b>{c.comprador_nome}</b>
            <span className="muted pequeno">{c.email_exibido} · {c.produto_nome} · {c.pagamentos} pagamento(s) de {dataBR(c.primeira)} a {dataBR(c.ultima)}</span>
            <span className="pequeno">{c.minha ? '✓ já é sua' : c.pedido_pendente ? 'já tem pedido em conferência' : c.vendedora_atual ? <span className="alerta-txt">hoje está com {c.vendedora_atual} ({c.origem_atual})</span> : <span className="muted">sem vendedora</span>}</span>
          </li>))}</ul>}
        {termo.trim().length >= 4 && res.length === 0 && !erro && <p className="muted pequeno">Nenhuma compra do online com esse nome ou e-mail.</p>}
      </>) : (<>
        <div className="nota pequeno"><b>{esc.comprador_nome}</b> · {esc.produto_nome} · {esc.pagamentos} pagamento(s){esc.vendedora_atual && <> · <span className="alerta-txt">hoje está com {esc.vendedora_atual}</span></>} <button className="link" onClick={() => setEsc(null)}>trocar</button></div>
        <div className="opcoes-papel">
          <label className={`opcao-papel ${tipo === 'proprio' ? 'marcada' : ''}`}><input type="radio" checked={tipo === 'proprio'} onChange={() => setTipo('proprio')} /><div><b>O lead é meu</b><div className="muted pequeno">Eu encontrei e conquistei esse aluno.</div></div></label>
          <label className={`opcao-papel ${tipo === 'campanha' ? 'marcada' : ''}`}><input type="radio" checked={tipo === 'campanha'} onChange={() => setTipo('campanha')} /><div><b>O lead veio de campanha</b><div className="muted pequeno">Lead captado com tráfego pago; eu fiz o atendimento e fechei.</div></div></label>
        </div>
        <Campo rotulo="Como você fechou essa venda?" dica="Ex.: atendi pelo WhatsApp dia 12/09 e mandei o link sem meu nome."><textarea rows={3} value={just} onChange={(e) => setJust(e.target.value)} /></Campo>
      </>)}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={!esc || just.trim().length < 10} onClick={enviar}>Enviar para conferência</button></div>
    </Modal>
  )
}

function Decidir({ a, nomeV, onFechar, onSalvo }: { a: Atrib; nomeV: (id: string) => string; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState(a.tipo_lead)
  const [resp, setResp] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const compras = useConsulta<Compra[]>(() => supabase.rpc('buscar_compras_online', { p_termo: a.comprador_email }), [a.id])
  const atual = (compras.dados ?? []).find((c) => c.comprador_email === a.comprador_email && (c.produto_id ?? 0) === (a.produto_id ?? 0))
  const decidir = async (aprovar: boolean) => {
    const { error } = await supabase.rpc('decidir_atribuicao_online', { p_id: a.id, p_aprovar: aprovar, p_tipo: tipo, p_resposta: resp })
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo={`Pedido de ${nomeV(a.vendedora_id)}`} aberto onFechar={onFechar}>
      <dl className="dl-curta">
        <dt>Aluno</dt><dd>{a.comprador_nome}<div className="muted pequeno">{a.comprador_email}</div></dd>
        <dt>Produto</dt><dd>{a.produto_nome}</dd>
        <dt>Pagamentos</dt><dd>{atual ? <>{atual.pagamentos} de {dataBR(atual.primeira)} a {dataBR(atual.ultima)} · líquido {brl(atual.liquido)}</> : '—'}</dd>
        <dt>Hoje está com</dt><dd>{atual?.vendedora_atual ? <span className="alerta-txt">{atual.vendedora_atual} ({atual.origem_atual})</span> : 'ninguém'}</dd>
        <dt>O que ela disse</dt><dd>{a.justificativa}</dd>
      </dl>
      <Campo rotulo="Tipo de lead"><select value={tipo} onChange={(e) => setTipo(e.target.value as Atrib['tipo_lead'])}><option value="proprio">Lead da vendedora</option><option value="campanha">Lead de campanha</option></select></Campo>
      <Campo rotulo="Resposta para a vendedora" dica="Obrigatória se recusar."><input value={resp} onChange={(e) => setResp(e.target.value)} /></Campo>
      <p className="muted pequeno">Ao aprovar, todas as parcelas desse aluno nesse produto passam a gerar comissão para ela (as já pagas a outra vendedora não mudam).</p>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={() => decidir(false)}>Recusar</button><button className="btn btn-ouro" onClick={() => decidir(true)}>Aprovar</button></div>
    </Modal>
  )
}

function Corrigir({ c, vendedoras, onFechar, onSalvo }: { c: CO; vendedoras: { id: string; nome: string; ativa: boolean }[]; onFechar: () => void; onSalvo: () => void }) {
  const [v, setV] = useState(c.vendedora_id)
  const [tipo, setTipo] = useState(c.tipo_lead)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async () => {
    if (motivo.trim().length < 3) return setErro('Escreva o motivo.')
    const { data: hp } = await supabase.from('hotmart_pagamentos').select('produto_id').eq('id', c.pagamento_id).single()
    const { error } = await supabase.rpc('atribuir_compra_online', { p_email: c.comprador_email, p_produto: hp?.produto_id ?? null, p_vendedora: v, p_tipo: tipo, p_motivo: motivo })
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo="Corrigir vendedora ou tipo de lead" aberto onFechar={onFechar}>
      <p className="muted pequeno">{c.comprador_nome} · {c.produto_nome}. Vale para todas as parcelas desse aluno nesse produto que ainda não foram pagas.</p>
      <Campo rotulo="Vendedora"><select value={v} onChange={(e) => setV(e.target.value)}>{vendedoras.map((x) => <option key={x.id} value={x.id}>{x.nome}{!x.ativa ? ' (inativa)' : ''}</option>)}</select></Campo>
      <Campo rotulo="Tipo de lead"><select value={tipo} onChange={(e) => setTipo(e.target.value as CO['tipo_lead'])}><option value="proprio">Lead da vendedora</option><option value="campanha">Lead de campanha</option></select></Campo>
      <Campo rotulo="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar</button></div>
    </Modal>
  )
}

function Fechamento({ tipo, itens, nomeV, onFechar, onSalvo }: { tipo: 'liberar' | 'pagar'; itens: CO[]; nomeV: (id: string) => string; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState(hojeISO())
  const [arq, setArq] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const total = itens.reduce((s, c) => s + Number(c.valor), 0)
  const salvar = async () => {
    setSalvando(true); setErro(null)
    let comp: string | null = null
    if (tipo === 'pagar' && arq) comp = await enviarArquivo(`comissoes-online/${itens[0].vendedora_id}`, arq)
    const campos = tipo === 'liberar' ? { status: 'liberada', liberada_em: hojeISO() } : { status: 'paga', paga_em: data, pago_comprovante: comp }
    const { error } = await supabase.from('comissoes_online').update(campos).in('id', itens.map((c) => c.id)).eq('status', tipo === 'liberar' ? 'pendente' : 'liberada')
    setSalvando(false)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo={tipo === 'liberar' ? 'Conferi — aprovar para pagamento' : 'Registrar pagamento da comissão'} aberto onFechar={onFechar}>
      <p><b>{nomeV(itens[0]?.vendedora_id)}</b>: {itens.length} pagamento(s) de aluno · <b>{brl(total)}</b></p>
      {tipo === 'liberar' ? <p className="muted pequeno">Confira a lista abaixo (aluno, produto e origem). Depois de aprovar, a vendedora vê esse valor como “Aprovado para pagamento”.</p> : (<>
        <Campo rotulo="Data do pagamento"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <Campo rotulo="Comprovante (opcional)"><input type="file" accept="image/*,application/pdf" onChange={(e) => setArq(e.target.files?.[0] ?? null)} /></Campo>
      </>)}
      <div className="lista-rolagem"><table className="tabela compacta"><tbody>{itens.map((c) => <tr key={c.id}><td className="pequeno">{dataBR(c.data_pagamento)}</td><td className="pequeno">{c.comprador_nome}</td><td className="pequeno muted">{c.origem === 'rastreio' ? `link “${c.rastreio}”` : 'pedido aprovado'} · {pct(c.percentual)}</td><td className="num">{brl(c.valor)}</td></tr>)}</tbody></table></div>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{tipo === 'liberar' ? `Aprovar ${brl(total)}` : `Registrar ${brl(total)} como pago`}</button></div>
    </Modal>
  )
}

/* ───────── Configurações → Comissões: parte do online ───────── */

type Rastreio = { id: string; valor: string; vendedora_id: string | null; tipo_lead: 'proprio' | 'campanha' | null; nao_e_vendedora: boolean; observacao: string | null }

export function RegrasOnline() {
  const cad = useCadastros()
  const regras = useConsulta<RegraOnline[]>(() => supabase.from('comissao_online_regras').select('*').order('vigente_desde', { ascending: false }))
  const rast = useConsulta<Rastreio[]>(() => supabase.from('rastreios').select('*').order('valor'))
  const vistos = useConsulta<{ rastreio: string | null }[]>(() => supabase.from('hotmart_pagamentos').select('rastreio').not('rastreio', 'is', null))
  const [nova, setNova] = useState<{ vigente_desde: string; pct_proprio: number | null; pct_campanha: number | null } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const atual = regras.dados?.find((r) => r.vigente_desde <= hojeISO())
  const contagem = useMemo(() => { const m = new Map<string, number>(); for (const v of vistos.dados ?? []) if (v.rastreio) m.set(v.rastreio.toLowerCase(), (m.get(v.rastreio.toLowerCase()) ?? 0) + 1); return m }, [vistos.dados])
  const conhecidos = new Set((rast.dados ?? []).map((r) => r.valor.toLowerCase()))
  const novos = [...contagem.keys()].filter((k) => !conhecidos.has(k))

  const recalcular = async () => { const { error } = await supabase.rpc('recalcular_comissoes_online'); if (error) setErro(msgErro(error)); else setMsg('Comissões do online recalculadas (as já aprovadas ou pagas não mudam).') }
  const salvarRast = async (r: Partial<Rastreio> & { valor: string }) => {
    setErro(null); setMsg(null)
    const reg = { valor: r.valor, vendedora_id: r.nao_e_vendedora ? null : r.vendedora_id ?? null, tipo_lead: r.nao_e_vendedora ? null : r.tipo_lead ?? 'proprio', nao_e_vendedora: !!r.nao_e_vendedora, observacao: r.observacao ?? null }
    const { error } = r.id ? await supabase.from('rastreios').update(reg).eq('id', r.id) : await supabase.from('rastreios').insert(reg)
    if (error) return setErro(msgErro(error))
    rast.recarregar(); await recalcular()
  }
  const salvarRegra = async () => {
    if (!nova || nova.pct_proprio === null || nova.pct_campanha === null) return
    const { error } = await supabase.from('comissao_online_regras').insert({ vigente_desde: nova.vigente_desde, pct_proprio: nova.pct_proprio, pct_campanha: nova.pct_campanha })
    if (error) return setErro(msgErro(error))
    setNova(null); regras.recarregar(); await recalcular()
  }

  return (
    <section className="bloco">
      <h2><Icone nome="links" className="ouro" /> Comissão do online</h2>
      <p className="muted pequeno">Calculada sobre o <b>líquido</b> que a Hotmart repassa, a cada pagamento que cai. A vendedora é reconhecida pelo nome que ela põe no link da Hotmart (<code>src</code> ou <code>sck</code>) ou por um pedido “esse aluno é meu” que você aprovou. Vendas de cursos presenciais ficam de fora (já têm a comissão por matrícula).</p>
      <div className="online-regra">
        <div><small className="muted">Lead da vendedora</small><b>{atual ? pct(atual.pct_proprio) : '—'}</b></div>
        <div><small className="muted">Lead de campanha</small><b>{atual ? pct(atual.pct_campanha) : '—'}</b></div>
        <div><small className="muted">Vale para pagamentos desde</small><b>{atual ? dataBR(atual.vigente_desde) : '—'}</b></div>
        <button className="btn btn-contorno" onClick={() => setNova({ vigente_desde: hojeISO(), pct_proprio: atual?.pct_proprio ?? 10, pct_campanha: atual?.pct_campanha ?? 5 })}>Mudar percentuais</button>
      </div>
      {nova && (
        <div className="nota form-grade">
          <Campo rotulo="Vale para pagamentos a partir de"><input type="date" value={nova.vigente_desde} onChange={(e) => setNova({ ...nova, vigente_desde: e.target.value })} /></Campo>
          <Campo rotulo="Lead da vendedora"><InputPercent valor={nova.pct_proprio} onChange={(x) => setNova({ ...nova, pct_proprio: x })} /></Campo>
          <Campo rotulo="Lead de campanha"><InputPercent valor={nova.pct_campanha} onChange={(x) => setNova({ ...nova, pct_campanha: x })} /></Campo>
          <div className="acoes"><button className="btn" onClick={() => setNova(null)}>Cancelar</button><button className="btn btn-ouro" onClick={salvarRegra}>Salvar nova regra</button></div>
        </div>
      )}

      <h3>Nomes nos links (rastreio)</h3>
      <p className="muted pequeno">Cada valor que aparece no link da Hotmart e de quem ele é. Mudou aqui, as comissões ainda em conferência são recalculadas.</p>
      {novos.length > 0 && <div className="faixa-alerta"><Icone nome="alerta" tam={18} /><span><b>{novos.length} nome(s) novo(s) nos links</b>, ainda sem dono: {novos.join(', ')}. Diga de quem é cada um na tabela abaixo.</span></div>}
      <div className="tabela-wrap">
        <table className="tabela compacta">
          <thead><tr><th>No link</th><th className="num">Pagamentos</th><th>Vendedora</th><th>Tipo de lead</th><th>Observação</th></tr></thead>
          <tbody>
            {novos.map((k) => <LinhaRastreio key={'n' + k} r={{ valor: k, vendedora_id: null, tipo_lead: null, nao_e_vendedora: false, observacao: null }} n={contagem.get(k) ?? 0} vendedoras={cad.vendedoras} onSalvar={salvarRast} novo />)}
            {(rast.dados ?? []).map((r) => <LinhaRastreio key={r.id} r={r} n={contagem.get(r.valor.toLowerCase()) ?? 0} vendedoras={cad.vendedoras} onSalvar={salvarRast} />)}
          </tbody>
        </table>
      </div>
      {msg && <div className="nota pequeno"><Icone nome="check" tam={14} className="ok" /> {msg}</div>}
      <Erro msg={erro} />
    </section>
  )
}

function LinhaRastreio({ r, n, vendedoras, onSalvar, novo }: { r: Partial<Rastreio> & { valor: string }; n: number; vendedoras: { id: string; nome: string; ativa: boolean }[]; onSalvar: (r: Partial<Rastreio> & { valor: string }) => void; novo?: boolean }) {
  const dono = r.nao_e_vendedora ? 'nao' : r.vendedora_id ?? ''
  return (
    <tr className={novo ? 'linha-nova' : ''}>
      <td><code>{r.valor}</code>{novo && <> <Badge tom="alerta">novo</Badge></>}</td>
      <td className="num">{n}</td>
      <td><select value={dono} onChange={(e) => onSalvar({ ...r, vendedora_id: e.target.value === 'nao' ? null : e.target.value || null, nao_e_vendedora: e.target.value === 'nao' })}>
        <option value="">— escolher —</option><option value="nao">Não é vendedora (campanha, stories…)</option>
        {vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}{!v.ativa ? ' (inativa)' : ''}</option>)}
      </select></td>
      <td>{!r.nao_e_vendedora && r.vendedora_id ? <select value={r.tipo_lead ?? 'proprio'} onChange={(e) => onSalvar({ ...r, tipo_lead: e.target.value as 'proprio' | 'campanha' })}><option value="proprio">Lead da vendedora</option><option value="campanha">Lead de campanha</option></select> : <span className="muted">—</span>}</td>
      <td className="pequeno muted">{r.observacao}</td>
    </tr>
  )
}
