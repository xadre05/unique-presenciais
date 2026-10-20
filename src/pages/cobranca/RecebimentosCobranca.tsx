// Administrador: o que entrou dos acordos (conferir no extrato), a comissão de quem cobrou (% configurável, só sobre o
// que foi conferido) e a lista para enviar à negativação (com CPF, para o serviço contratado).
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { brl, dataBR } from '../../lib/format'
import { Badge, Erro, InputPercent, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { conferirRecebimento, mudarComissao, salvarPctComissao, useConfigCobranca, useRecebimentos, type Cobranca } from './dados'

type Props = { cobrancas: Cobranca[]; nomeVend: (id: string | null) => string | null; aoMudar: () => void }
type Negativar = { nome: string | null; documento: string | null; email: string | null; telefone: string | null; produto: string | null; valor: number; vencimento: string | null; negativar_ate: string | null; origem: string }

const csv = (linhas: (string | number | null)[][]) => linhas.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')

async function baixarNegativacao(setErro: (m: string | null) => void) {
  const { data, error } = await supabase.rpc('cobrancas_para_negativar')
  if (error) return setErro(error.message)
  const xs = (data ?? []) as Negativar[]
  if (!xs.length) return setErro('Nenhuma cobrança na etapa "Enviar para negativação".')
  const texto = csv([['Nome', 'CPF', 'E-mail', 'Telefone', 'Produto', 'Valor vencido', 'Vencimento', 'Negativar até', 'Origem'],
    ...xs.map((x) => [x.nome, x.documento, x.email, x.telefone, x.produto, String(x.valor).replace('.', ','), dataBR(x.vencimento), dataBR(x.negativar_ate), x.origem])])
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `negativacao-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export function RecebimentosCobranca({ cobrancas, nomeVend, aoMudar }: Props) {
  const rec = useRecebimentos(), cfg = useConfigCobranca()
  const [pct, setPct] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const porId = new Map(cobrancas.map((c) => [c.id, c]))
  const lista = rec.dados ?? []
  const aConferir = lista.filter((r) => !r.conferido)
  const comissoes = lista.filter((r) => r.conferido && r.comissao_valor != null)
  const pctAtual = pct ?? cfg.dados?.pct_comissao ?? null
  const negativar = cobrancas.filter((c) => c.etapa === 'negativar').length

  const fazer = async (f: () => Promise<void>, ok: string) => {
    setErro(null); setMsg(null)
    try { await f(); setMsg(ok); rec.recarregar(); aoMudar() } catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="cob-receb">
      <section className="bloco">
        <h2><Icone nome="dinheiro" className="ouro" /> Comissão de cobrança</h2>
        <p className="muted pequeno">Percentual sobre o que entrar dos acordos, depois de você conferir. Vale para os recebimentos conferidos a partir de agora.</p>
        <div className="cob-linha2">
          <InputPercent valor={pctAtual} onChange={setPct} />
          <button type="button" className="btn btn-ouro" disabled={pct == null} onClick={() => fazer(() => salvarPctComissao(pct), 'Percentual salvo.')}>Salvar</button>
        </div>
        {pctAtual == null && <p className="alerta-txt pequeno">Sem percentual definido: os recebimentos conferidos ficam sem comissão.</p>}
      </section>

      <section className="bloco">
        <h2><Icone nome="check" className="ouro" /> Pagamentos para conferir <Badge tom={aConferir.length ? 'info' : 'neutro'}>{aConferir.length}</Badge></h2>
        {!aConferir.length ? <Vazio>Nenhum pagamento de acordo esperando conferência.</Vazio> : (
          <div className="tabela-wrap"><table className="tabela compacta">
            <thead><tr><th>Aluno</th><th>Quem informou</th><th>Dia</th><th>Forma</th><th className="num">Valor</th><th></th></tr></thead>
            <tbody>{aConferir.map((r) => { const c = porId.get(r.cobranca_id); return (
              <tr key={r.id}><td><b>{c?.aluno_nome ?? '—'}</b><div className="muted pequeno">{c?.produto}</div></td><td>{r.informado_nome}</td><td>{dataBR(r.recebido_em)}</td><td>{r.forma}</td>
                <td className="num">{brl(r.valor)}</td><td><button type="button" className="btn btn-mini btn-ouro" onClick={() => fazer(() => conferirRecebimento(r.id), 'Pagamento conferido.')}>Conferi no extrato</button></td></tr>) })}</tbody>
          </table></div>)}
      </section>

      <section className="bloco">
        <h2><Icone nome="moedas" className="ouro" /> Comissões de cobrança</h2>
        {!comissoes.length ? <Vazio>Nenhuma comissão de cobrança ainda.</Vazio> : (
          <div className="tabela-wrap"><table className="tabela compacta">
            <thead><tr><th>Quem cobrou</th><th>Aluno</th><th>Recebido</th><th className="num">Base</th><th className="num">Comissão</th><th>Situação</th><th></th></tr></thead>
            <tbody>{comissoes.map((r) => (
              <tr key={r.id}><td>{nomeVend(r.vendedora_id) ?? '—'}</td><td>{porId.get(r.cobranca_id)?.aluno_nome ?? '—'}</td><td>{dataBR(r.recebido_em)}</td><td className="num">{brl(r.valor)}</td>
                <td className="num"><b>{brl(r.comissao_valor)}</b><div className="muted pequeno">{r.comissao_pct}%</div></td>
                <td><Badge tom={r.comissao_status === 'paga' ? 'ok' : r.comissao_status === 'liberada' ? 'info' : 'alerta'}>{r.comissao_status === 'paga' ? 'Paga' : r.comissao_status === 'liberada' ? 'Aprovada' : 'Em apuração'}</Badge></td>
                <td>{r.comissao_status === 'pendente' && <button type="button" className="btn btn-mini" onClick={() => fazer(() => mudarComissao([r.id], 'liberada'), 'Comissão aprovada.')}>Aprovar</button>}
                  {r.comissao_status === 'liberada' && <button type="button" className="btn btn-mini" onClick={() => fazer(() => mudarComissao([r.id], 'paga'), 'Comissão marcada como paga.')}>Marcar paga</button>}</td></tr>))}</tbody>
          </table></div>)}
      </section>

      <section className="bloco">
        <h2><Icone nome="alerta" className="ouro" /> Negativação</h2>
        <p className="muted pequeno">{negativar} cobrança(s) na etapa “Enviar para negativação”. Baixe a lista com CPF para enviar ao serviço contratado (Serasa, Boa Vista…). Depois de enviar, mude a etapa para “Negativado”. A lei exige aviso prévio por escrito e só permite negativar até 5 anos depois do vencimento; confirme as regras com o jurídico.</p>
        <button type="button" className="btn btn-contorno" disabled={!negativar} onClick={() => baixarNegativacao(setErro)}><Icone nome="importar" tam={16} /> Baixar lista (CSV)</button>
      </section>
      <Erro msg={erro || rec.erro} />
      {msg && <p className="ok-txt pequeno">{msg}</p>}
    </div>
  )
}
