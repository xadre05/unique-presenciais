// Um item da fila de cobrança: quem deve, quanto, desde quando, de qual conta, em que etapa está e com quem.
// Ações: WhatsApp com a mensagem pronta (conta a tentativa), registrar o contato, mudar a etapa, data de retorno,
// acordo, pagamento do acordo e histórico.
import { useState } from 'react'
import { Badge } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { brl, dataBR } from '../../lib/format'
import { ETAPAS, aberta, marcarEnviada, mudarCampos, useContatos, type Cobranca, type Etapa } from './dados'
import { prazoNegativar } from './filtros'
import { MensagemWhats } from './MensagemWhats'
import { RegistrarContato } from './RegistrarContato'
import { ModalAcordo, ModalRecebimento } from './ModaisAcordo'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const ETAPAS_MANUAIS: Etapa[] = ['a_contatar', 'aguardando', 'negociando', 'acordo', 'negativar', 'negativado', 'sem_acordo']

function Historico({ id }: { id: string }) {
  const contatos = useContatos(id)
  if (contatos.carregando) return <p className="muted pequeno">Carregando…</p>
  if (!contatos.dados?.length) return <p className="muted pequeno">Nada registrado ainda.</p>
  return (
    <ul className="cob-historico">{contatos.dados.map((c) => (
      <li key={c.id}><span className="muted pequeno">{quando(c.criado_em)} · {c.quem_nome ?? '—'}</span><b>{c.resultado}</b>{c.observacao && <small className="muted">{c.observacao}</small>}</li>))}
    </ul>
  )
}

type Props = {
  c: Cobranca; conta: string; responsavel: string | null; eu: string; hoje: string; isAdmin: boolean
  marcado: boolean; aoMarcar: ((v: boolean) => void) | null; aoMudar: () => void
}

export function CartaoCobranca({ c, conta, responsavel, eu, hoje, isAdmin, marcado, aoMarcar, aoMudar }: Props) {
  const [aberto, setAberto] = useState<'whats' | 'registrar' | 'acordo' | 'pagamento' | 'historico' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const e = ETAPAS[c.etapa]
  const prazo = c.origem === 'online' ? prazoNegativar(c, hoje) : null
  const fechar = () => { setAberto(null); aoMudar() }
  const mudar = async (campos: Partial<Cobranca>) => { setErro(null); try { await mudarCampos(c.id, campos); aoMudar() } catch (x) { setErro((x as Error).message) } }
  const retornarAtrasado = c.retornar_em && c.retornar_em <= hoje && aberta(c)

  return (
    <div className={`item-lista cob-item${marcado ? ' marcado' : ''}`}>
      <div className="il-topo">
        <div className="cob-quem">
          {aoMarcar && <input type="checkbox" checked={marcado} onChange={(x) => aoMarcar(x.target.checked)} aria-label="Selecionar" />}
          <div>
            <b>{c.aluno_nome || 'Sem nome'}</b> <Badge tom={c.origem === 'online' ? 'info' : 'ouro'}>{c.origem === 'online' ? conta || 'Online' : 'Presencial'}</Badge>
            <div className="muted pequeno">{c.produto}{c.telefone ? '' : ' · sem telefone'}{isAdmin && responsavel ? ` · com ${responsavel}` : isAdmin ? ' · sem responsável' : ''}</div>
          </div>
        </div>
        <Badge tom={e.tom}>{e.rotulo}</Badge>
      </div>
      <div className="cob-valores">
        <span><small className="muted">Vencido</small><b className="erro-txt">{brl(c.valor_vencido)}</b><small className="muted">{c.cobrancas_vencidas ?? 0} parcela(s)</small></span>
        {Number(c.valor_restante) > Number(c.valor_vencido) && <span><small className="muted">Falta do contrato</small><b>{brl(c.valor_restante)}</b></span>}
        <span><small className="muted">1ª parcela em aberto</small><b>{dataBR(c.parou_em)}</b>{c.ultimo_pagamento_em && <small className="muted">último pago {dataBR(c.ultimo_pagamento_em)}</small>}</span>
        {c.etapa === 'acordo' && c.acordo_valor != null && <span><small className="muted">Acordo</small><b className="ouro-txt">{brl(c.acordo_valor)}</b><small className="muted">{c.acordo_parcelas}x · 1º {dataBR(c.acordo_primeiro_venc)}</small></span>}
        {c.promessa_em && c.etapa === 'negociando' && <span><small className="muted">Prometeu até</small><b>{dataBR(c.promessa_em)}</b></span>}
      </div>
      <div className="muted pequeno cob-rodape">
        {c.tentativas > 0 ? `${c.tentativas} mensagem(ns)` : 'Nenhuma mensagem ainda'}{c.ultimo_contato_em && ` · último contato ${quando(c.ultimo_contato_em)}`}
        {c.retornar_em && aberta(c) && <span className={retornarAtrasado ? ' ouro-txt forte' : ''}> · retornar em {dataBR(c.retornar_em)}</span>}
        {prazo && aberta(c) && <span className={prazo.tom === 'erro' ? ' erro-txt' : ''}> · {prazo.texto}</span>}
        {c.negativado_em && <span> · negativado em {dataBR(c.negativado_em)}</span>}
      </div>
      {erro && <p className="erro-txt pequeno">{erro}</p>}
      {aberta(c) && (
        <div className="il-acoes">
          <button type="button" className={`btn btn-mini ${c.etapa === 'a_contatar' ? 'btn-ouro' : 'btn-contorno'}`} disabled={!c.telefone} title={c.telefone ? '' : 'Sem telefone: procure no CRM'} onClick={() => setAberto('whats')}><Icone nome="whats" tam={15} /> WhatsApp</button>
          <button type="button" className="btn btn-mini" onClick={() => setAberto('registrar')}><Icone nome="lapis" tam={13} /> Registrar</button>
          <select value={c.etapa} onChange={(x) => mudar({ etapa: x.target.value as Etapa, ...(x.target.value === 'negativado' ? { negativado_em: hoje } : {}) })} aria-label="Etapa">
            {ETAPAS_MANUAIS.map((k) => <option key={k} value={k}>{ETAPAS[k].rotulo}</option>)}
          </select>
          <label className="il-data" title="Retornar em"><Icone nome="agenda" tam={15} /><input type="date" value={c.retornar_em ?? ''} onChange={(x) => mudar({ retornar_em: x.target.value || null })} /></label>
          <button type="button" className="btn btn-mini" onClick={() => setAberto('acordo')}>{c.acordo_valor != null ? 'Ver acordo' : 'Fechar acordo'}</button>
          {c.etapa === 'acordo' && <button type="button" className="btn btn-mini btn-contorno-ouro" onClick={() => setAberto('pagamento')}><Icone nome="moedas" tam={14} /> Pagamento</button>}
          <button type="button" className="btn btn-mini" onClick={() => setAberto(aberto === 'historico' ? null : 'historico')}><Icone nome="historico" tam={13} /> Histórico</button>
        </div>
      )}
      {!aberta(c) && <button type="button" className="btn btn-mini" onClick={() => setAberto(aberto === 'historico' ? null : 'historico')}><Icone nome="historico" tam={13} /> Histórico</button>}
      {aberto === 'historico' && <Historico id={c.id} />}
      {aberto === 'whats' && <MensagemWhats dados={c} eu={eu} marca={c.origem === 'online' ? conta || 'Unique HOF Academy' : 'Unique HOF Academy'} aoFechar={fechar} aoEnviar={(texto) => marcarEnviada(c, texto, eu)} />}
      {aberto === 'registrar' && <RegistrarContato cobranca={c} eu={eu} aoFechar={() => setAberto(null)} aoSalvar={fechar} />}
      {aberto === 'acordo' && <ModalAcordo cobranca={c} eu={eu} aoFechar={() => setAberto(null)} aoSalvar={fechar} />}
      {aberto === 'pagamento' && <ModalRecebimento cobranca={c} eu={eu} aoFechar={() => setAberto(null)} aoSalvar={fechar} />}
    </div>
  )
}
