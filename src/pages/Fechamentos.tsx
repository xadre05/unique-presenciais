import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, hojeISO, mesAno } from '../lib/format'
import { Badge, Campo, enviarArquivo, Erro, LinkArquivo, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'

// Uma linha de comissão, venha do presencial ou do online, já no mês em que deve ser paga.
type Item = {
  id: string; area: 'presencial' | 'online'; vendedora_id: string; aluno: string; detalhe: string
  valor: number; status: string; mes: string; paga_em: string | null; comprovante: string | null; conta: string | null
}
type Grupo = { chave: string; mes: string; vendedora_id: string; itens: Item[] }

const proximoMes = (iso: string) => { const [y, m] = iso.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` }
const mesAnterior = (mes: string) => { const [y, m] = mes.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
const soma = (xs: Item[]) => xs.reduce((s, c) => s + Number(c.valor), 0)

export default function Fechamentos() {
  const { isAdmin } = useAuth()
  const cad = useCadastros()
  const pres = useConsulta<any[]>(() => supabase.from('v_comissoes').select('id,vendedora_id,aluno_nome,turma_nome,valor,status,mes_pagamento,paga_em,pago_comprovante,pago_conta').neq('status', 'cancelada'))
  const onl = useConsulta<any[]>(() => supabase.from('comissoes_online').select('id,vendedora_id,comprador_nome,produto_nome,cobranca,valor,status,competencia,paga_em,pago_comprovante,pago_conta').neq('status', 'cancelada'))
  const [vend, setVend] = useState('')
  const [mesF, setMesF] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [pagar, setPagar] = useState<Grupo | null>(null)
  const nomeV = (id: string) => cad.vendedoras.find((v) => v.id === id)?.nome ?? '—'
  const hoje = hojeISO().slice(0, 7)

  const grupos = useMemo(() => {
    const itens: Item[] = [
      ...(pres.dados ?? []).map((c) => ({ id: c.id, area: 'presencial' as const, vendedora_id: c.vendedora_id, aluno: c.aluno_nome, detalhe: c.turma_nome, valor: Number(c.valor), status: c.status, mes: String(c.mes_pagamento).slice(0, 7), paga_em: c.paga_em, comprovante: c.pago_comprovante, conta: c.pago_conta })),
      ...(onl.dados ?? []).map((c) => ({ id: c.id, area: 'online' as const, vendedora_id: c.vendedora_id, aluno: c.comprador_nome, detalhe: `${c.produto_nome ?? ''}${c.cobranca ? ` · parcela ${c.cobranca}` : ''}`, valor: Number(c.valor), status: c.status, mes: proximoMes(String(c.competencia)), paga_em: c.paga_em, comprovante: c.pago_comprovante, conta: c.pago_conta })),
    ]
    const g = new Map<string, Grupo>()
    for (const i of itens) {
      const k = `${i.mes}|${i.vendedora_id}`
      if (!g.has(k)) g.set(k, { chave: k, mes: i.mes, vendedora_id: i.vendedora_id, itens: [] })
      g.get(k)!.itens.push(i)
    }
    return [...g.values()].sort((a, b) => b.mes.localeCompare(a.mes))
  }, [pres.dados, onl.dados])

  const meses = [...new Set(grupos.map((g) => g.mes))].sort().reverse()
  const vis = grupos.filter((g) => (!vend || g.vendedora_id === vend) && (!mesF || g.mes === mesF))
  const recarregar = () => { setPagar(null); pres.recarregar(); onl.recarregar() }

  return (<>
    <div className="faixa-info"><Icone nome="info" tam={18} /> <span>
      <b>Fechamento por mês de pagamento.</b> Cada linha mostra quanto a vendedora deveria receber naquele mês, quanto já foi pago e o comprovante. O presencial é das vendas do mês anterior e o online, do que caiu na Hotmart no mês anterior. O fixo e as horas extras ficam fora do sistema.
    </span></div>

    <div className="filtros-comissoes">
      <label className="select-icone"><select value={mesF} onChange={(e) => setMesF(e.target.value)}><option value="">Todos os meses de pagamento</option>{meses.map((m) => <option key={m} value={m}>{mesAno(m + '-01')}</option>)}</select></label>
      {isAdmin && <label className="select-icone"><select value={vend} onChange={(e) => setVend(e.target.value)}><option value="">Todas as vendedoras</option>{cad.vendedoras.filter((v) => v.ativa).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>}
    </div>

    <Erro msg={pres.erro || onl.erro} />
    {vis.length === 0 && !pres.carregando ? <Vazio>Nenhum fechamento com esses filtros.</Vazio> : (
      <div className="tabela-wrap bloco sem-padding">
        <table className="tabela fech-tabela">
          <thead><tr><th>Pagar em</th>{isAdmin && <th>Vendedora</th>}<th className="num">Presencial</th><th className="num">Online</th><th className="num">Devido</th><th className="num">Pago</th><th className="num">Falta</th><th>Situação</th><th></th></tr></thead>
          <tbody>{vis.map((g) => {
            const p = g.itens.filter((i) => i.area === 'presencial'), o = g.itens.filter((i) => i.area === 'online')
            const pago = g.itens.filter((i) => i.status === 'paga'), falta = g.itens.filter((i) => i.status !== 'paga')
            const futuro = g.mes > hoje
            const comps = [...new Set(pago.map((i) => i.comprovante).filter(Boolean))] as string[]
            const situ = falta.length === 0 ? <Badge tom="ok">Pago</Badge> : futuro ? <Badge>Mês ainda não fechou</Badge> : pago.length ? <Badge tom="alerta">Pago em parte</Badge> : <Badge tom="alerta">Em aberto</Badge>
            const abrir = aberto === g.chave
            return (<Fragment key={g.chave}>
              <tr>
                <td><b>{mesAno(g.mes + '-01')}</b><div className="muted pequeno">ref. {mesAno(mesAnterior(g.mes) + '-01')}</div></td>
                {isAdmin && <td className="forte">{nomeV(g.vendedora_id)}</td>}
                <td className="num">{brl(soma(p))}<div className="muted pequeno">{p.length} venda(s)</div></td>
                <td className="num">{brl(soma(o))}<div className="muted pequeno">{o.length} pagamento(s)</div></td>
                <td className="num forte">{brl(soma(g.itens))}</td>
                <td className="num ok-txt">{brl(soma(pago))}{comps.length > 0 && <div className="pequeno">{comps.map((c, i) => <LinkArquivo key={c} caminho={c}>comprovante{comps.length > 1 ? ` ${i + 1}` : ''} </LinkArquivo>)}</div>}</td>
                <td className={`num ${soma(falta) > 0 ? 'alerta-txt' : 'muted'}`}>{brl(soma(falta))}</td>
                <td>{situ}</td>
                <td className="celula-acao">
                  <button className="link pequeno" onClick={() => setAberto(abrir ? null : g.chave)}>{abrir ? 'esconder' : 'ver itens'}</button>
                  {isAdmin && falta.length > 0 && !futuro && <button className="btn btn-ouro btn-mini" onClick={() => setPagar(g)}>Registrar pagamento</button>}
                </td>
              </tr>
              {abrir && (
                <tr className="linha-detalhe"><td colSpan={isAdmin ? 9 : 8}>
                  <ul className="fech-itens">{g.itens.sort((a, b) => a.area.localeCompare(b.area)).map((i) => (
                    <li key={i.area + i.id}>
                      <Badge tom={i.area === 'online' ? 'info' : 'neutro'}>{i.area === 'online' ? 'Online' : 'Presencial'}</Badge>
                      <span><b>{i.aluno}</b> <span className="muted pequeno">{i.detalhe}</span></span>
                      <span className="num">{brl(i.valor)}</span>
                      <span className="pequeno">{i.status === 'paga' ? <span className="ok-txt">pago em {dataBR(i.paga_em)}{i.conta ? ` · ${i.conta}` : ''}</span> : <span className="muted">{i.status === 'liberada' ? 'aprovado, falta pagar' : 'em apuração'}</span>}</span>
                    </li>))}</ul>
                  <p className="muted pequeno"><Link className="link" to="/comissoes">Presencial</Link> e <Link className="link" to="/comissoes?area=online">Online</Link> têm o detalhe completo de cada comissão.</p>
                </td></tr>
              )}
            </Fragment>)
          })}</tbody>
        </table>
      </div>
    )}
    {pagar && <PagarMes g={pagar} nome={nomeV(pagar.vendedora_id)} contas={cad.contas} onFechar={() => setPagar(null)} onSalvo={recarregar} />}
  </>)
}

function PagarMes({ g, nome, contas, onFechar, onSalvo }: { g: Grupo; nome: string; contas: { nome: string; ativa: boolean }[]; onFechar: () => void; onSalvo: () => void }) {
  const abertos = g.itens.filter((i) => i.status !== 'paga')
  const [sel, setSel] = useState<Set<string>>(new Set(abertos.map((i) => i.area + i.id)))
  const [data, setData] = useState(hojeISO())
  const [conta, setConta] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const escolhidos = abertos.filter((i) => sel.has(i.area + i.id))
  const alternar = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const salvar = async () => {
    setErro(null)
    if (!escolhidos.length) return setErro('Marque pelo menos uma comissão.')
    if (!conta) return setErro('Diga de qual conta saiu o pagamento.')
    setSalvando(true)
    try {
      const comp = arquivo ? await enviarArquivo(`comissoes/${g.vendedora_id}`, arquivo) : null
      const p = escolhidos.filter((i) => i.area === 'presencial').map((i) => i.id)
      const o = escolhidos.filter((i) => i.area === 'online').map((i) => i.id)
      const nota = obs.trim() || null
      if (p.length) {
        const { error } = await supabase.from('comissoes').update({ status: 'paga', paga_em: data, pago_conta: conta, pago_comprovante: comp, ...(nota ? { observacao: nota } : {}) }).in('id', p).neq('status', 'paga')
        if (error) throw error
      }
      if (o.length) {
        const { error } = await supabase.from('comissoes_online').update({ status: 'paga', liberada_em: data, paga_em: data, pago_conta: conta, pago_comprovante: comp, ...(nota ? { observacao: nota } : {}) }).in('id', o).neq('status', 'paga')
        if (error) throw error
      }
      onSalvo()
    } catch (e) { setErro(msgErro(e)) } finally { setSalvando(false) }
  }
  return (
    <Modal titulo={`Pagamento de ${nome} — ${mesAno(g.mes + '-01')}`} aberto onFechar={onFechar} largo>
      <p className="muted pequeno">Registre uma transferência que já foi feita (isso não envia dinheiro). Se pagou só uma parte, desmarque o que ainda não pagou.</p>
      <ul className="fech-itens selecao">{abertos.map((i) => (
        <li key={i.area + i.id} onClick={() => alternar(i.area + i.id)}>
          <input type="checkbox" checked={sel.has(i.area + i.id)} readOnly />
          <Badge tom={i.area === 'online' ? 'info' : 'neutro'}>{i.area === 'online' ? 'Online' : 'Presencial'}</Badge>
          <span><b>{i.aluno}</b> <span className="muted pequeno">{i.detalhe}</span></span>
          <span className="num">{brl(i.valor)}</span>
        </li>))}</ul>
      <div className="nota"><b>Total marcado: {brl(soma(escolhidos))}</b></div>
      <div className="form-grade">
        <Campo rotulo="Data da transferência"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <Campo rotulo="Conta de saída"><select value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Escolha…</option>{contas.filter((c) => c.ativa).map((c) => <option key={c.nome}>{c.nome}</option>)}<option>Outra conta</option></select></Campo>
      </div>
      <Campo rotulo="Comprovante (recomendado)"><input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
      <Campo rotulo="Observação (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: pago junto com o fixo de setembro" /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>Registrar {brl(soma(escolhidos))} como pago</button></div>
    </Modal>
  )
}
