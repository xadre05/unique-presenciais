// Notificação extrajudicial (administrador): escolher em lote quem notificar, ver a carta de cada um, enviar (boleto no
// Asaas + e-mail), avisar no WhatsApp, acompanhar o prazo e pedir a negativação de quem não pagou. Tudo fica no histórico.
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { brl, dataBR, hojeISO } from '../../../lib/format'
import { Badge, Erro, Modal, Vazio } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { aberta, linkWhatsComTexto, nomeCurtoConta, registrarContato, useContasHotmart, type Cobranca } from '../dados'
import { mesesParado } from '../filtros'
import { campos, FASES, pendencias, preencher, type Config, type Dados, type Extra } from './modelo'
import { ConfigNotificacao } from './ConfigNotificacao'

type Aba = 'para_notificar' | 'notificada' | 'prazo_vencido' | 'negativacao' | 'paga'
const ABAS: [Aba, string][] = [['para_notificar', 'Para notificar'], ['notificada', 'Prazo correndo'], ['prazo_vencido', 'Prazo vencido'], ['negativacao', 'Negativação'], ['paga', 'Pagaram']]
const naAba = (c: Cobranca, a: Aba) => a === 'para_notificar' ? aberta(c) && !c.fase_legal
  : a === 'negativacao' ? c.fase_legal === 'negativacao_pedida' || c.fase_legal === 'negativada' || c.fase_legal === 'advogado' : c.fase_legal === a
const comoDados = (x: unknown) => x as Dados

type Props = { lista: Cobranca[]; nomeConta: (id: string | null) => string; aoMudar: () => void; eu: string }

export function PainelNotificacao({ lista, nomeConta, aoMudar, eu }: Props) {
  const extras = useConsulta<Extra[]>(() => supabase.rpc('cobrancas_para_notificar'), [])
  const cfg = useConsulta<Config>(() => supabase.from('cobranca_config').select('*').single(), [])
  const contas = useContasHotmart()
  const [aba, setAba] = useState<Aba>('para_notificar')
  const [idade, setIdade] = useState<'' | 'mais12' | 'ate12'>('mais12')
  const [conta, setConta] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [carta, setCarta] = useState<Cobranca | null>(null)
  const [confirmar, setConfirmar] = useState<'enviar' | 'negativar' | null>(null)
  const [editar, setEditar] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const hoje = hojeISO()
  const limiteNegativar = new Date(new Date(hoje + 'T12:00:00').getTime() - 5 * 864e5).toISOString().slice(0, 10)
  const ex = useMemo(() => new Map((extras.dados ?? []).map((e) => [e.cobranca_id, e])), [extras.dados])
  const doFiltro = lista.filter((c) => (!conta || c.integracao_id === conta) && (!idade || (idade === 'mais12' ? mesesParado(c) > 12 : mesesParado(c) <= 12)))
  const visiveis = doFiltro.filter((c) => naAba(c, aba)).sort((a, b) => (a.parou_em ?? '').localeCompare(b.parou_em ?? ''))
  const podeNegativar = (c: Cobranca) => c.fase_legal === 'prazo_vencido' && !!c.prazo_ate && c.prazo_ate <= limiteNegativar
  const paraNegativar = aba === 'prazo_vencido'
  const prontas = visiveis.filter((c) => marcadas.has(c.id) && (paraNegativar
    ? podeNegativar(c) && !pendencias(c.email, ex.get(c.id)).negativar.length
    : !pendencias(c.email, ex.get(c.id)).notificar.length))
  const config = cfg.dados

  const valores = (c: Cobranca) => campos(comoDados(c), comoDados(config ?? {}), comoDados(ex.get(c.id) ?? {}))
  const avisarWhats = async (c: Cobranca) => {
    const texto = preencher(config?.whatsapp_modelo ?? '', valores(c))
    const l = linkWhatsComTexto(c.telefone, texto)
    if (!l) return setMsg('Sem telefone para essa pessoa.')
    window.open(l, '_blank', 'noopener')
    await supabase.from('cobrancas').update({ whatsapp_avisado_em: new Date().toISOString() }).eq('id', c.id)
    await registrarContato(c, { canal: 'whatsapp', resultado: 'Aviso da notificação enviado pelo WhatsApp', observacao: texto }, eu)
    aoMudar()
  }
  const executar = async (acao: 'enviar' | 'negativar') => {
    const ids = prontas.map((c) => c.id)
    let feitos = 0
    const falhas: string[] = []
    for (let i = 0; i < ids.length; i += 20) {
      setMsg(`Processando ${Math.min(i + 20, ids.length)} de ${ids.length}…`)
      const { data, error } = await supabase.functions.invoke('notificacao', { body: { acao, ids: ids.slice(i, i + 20) } })
      if (error) { falhas.push(error.message); break }
      feitos += data.feitos
      for (const f of data.falhas ?? []) falhas.push(`${f.nome}: ${f.motivo}`)
    }
    setConfirmar(null); setMarcadas(new Set())
    setMsg(`${feitos} ${acao === 'enviar' ? 'notificação(ões) enviada(s)' : 'negativação(ões) pedida(s)'}.${falhas.length ? ` Não foi possível: ${falhas.slice(0, 8).join(' · ')}${falhas.length > 8 ? ` e mais ${falhas.length - 8}` : ''}` : ''}`)
    aoMudar()
  }

  return (
    <div className="not-painel">
      <div className="faixa-info"><Icone nome="info" tam={18} /><span>Antes do primeiro envio: o advogado revisa a carta (<button type="button" className="link" onClick={() => setEditar(true)}>dados e modelos</button>) e as chaves do Asaas e do e-mail precisam estar em Configurações → Integrações. O boleto vence em {config?.prazo_dias ?? 5} dias; a negativação só pode ser pedida 5 dias depois do vencimento.</span></div>
      <nav className="abas">{ABAS.map(([k, r]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => { setAba(k); setMarcadas(new Set()) }}>{r} <span className="muted">{doFiltro.filter((c) => naAba(c, k)).length}</span></button>)}</nav>
      <div className="pg-filtros">
        <label className="select-icone pg-rotulado"><span>Parou há:</span><select value={idade} onChange={(e) => setIdade(e.target.value as typeof idade)}><option value="mais12">mais de 1 ano</option><option value="ate12">até 1 ano</option><option value="">qualquer tempo</option></select></label>
        <label className="select-icone pg-rotulado"><span>Conta:</span><select value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todas</option>{(contas.dados ?? []).map((x) => <option key={x.id} value={x.id}>{nomeCurtoConta(x.nome)}</option>)}</select></label>
        {visiveis.length > 0 && <label className="check"><input type="checkbox" checked={visiveis.every((c) => marcadas.has(c.id))} onChange={(e) => setMarcadas(e.target.checked ? new Set(visiveis.map((c) => c.id)) : new Set())} /> Selecionar as {visiveis.length}</label>}
        {marcadas.size > 0 && aba === 'para_notificar' && <button type="button" className="btn btn-ouro" onClick={() => setConfirmar('enviar')}>Enviar notificação ({marcadas.size})</button>}
        {marcadas.size > 0 && aba === 'prazo_vencido' && <button type="button" className="btn btn-ouro" onClick={() => setConfirmar('negativar')}>Pedir negativação ({marcadas.size})</button>}
      </div>
      {msg && <p className="nota pequeno">{msg}</p>}
      <Erro msg={extras.erro || cfg.erro} />
      {!visiveis.length ? <Vazio>Ninguém nesta etapa com esses filtros.</Vazio> : (
        <div className="tabela-wrap"><table className="tabela tabela-pag">
          <thead><tr><th></th><th>Pessoa / curso</th><th>Parou em</th><th className="num">Deve</th><th>Falta</th><th>Situação</th><th className="direita">Ações</th></tr></thead>
          <tbody>{visiveis.map((c) => {
            const p = pendencias(c.email, ex.get(c.id))
            const falta = aba === 'prazo_vencido' ? p.negativar : p.notificar
            const f = FASES[c.fase_legal ?? '']
            return (
              <tr key={c.id}>
                <td><input type="checkbox" checked={marcadas.has(c.id)} onChange={(e) => { const s = new Set(marcadas); if (e.target.checked) s.add(c.id); else s.delete(c.id); setMarcadas(s) }} aria-label="Selecionar" /></td>
                <td><span className="forte">{c.aluno_nome}</span><div className="muted pequeno">{c.produto} · {c.origem === 'online' ? nomeConta(c.integracao_id) : 'Presencial'}</div></td>
                <td>{dataBR(c.parou_em)}</td>
                <td className="num">{brl(c.boleto_valor ?? c.valor_restante)}</td>
                <td>{falta.length ? <Badge tom="alerta">sem {falta.join(', ')}</Badge> : <span className="ok-txt pequeno">pronto</span>}</td>
                <td><Badge tom={f.tom}>{f.rotulo}</Badge>{c.prazo_ate && <div className={`pequeno ${c.prazo_ate < hoje ? 'erro-txt' : 'muted'}`}>prazo {dataBR(c.prazo_ate)}</div>}{c.whatsapp_avisado_em && <div className="muted pequeno">WhatsApp ✓</div>}</td>
                <td><div className="pg-acoes">
                  <button type="button" className="btn btn-mini" onClick={() => setCarta(c)}>Ver carta</button>
                  {c.fase_legal === 'notificada' && <button type="button" className="btn btn-mini btn-contorno" disabled={!c.telefone} onClick={() => avisarWhats(c)}><Icone nome="whats" tam={14} /> Avisar</button>}
                  {c.boleto_url && <a className="btn btn-mini" href={c.boleto_url} target="_blank" rel="noreferrer">Boleto</a>}
                </div></td>
              </tr>)
          })}</tbody>
        </table></div>)}

      {carta && config && <Modal titulo={`Carta · ${carta.aluno_nome ?? ''}`} aberto onFechar={() => setCarta(null)} largo>
        <p className="muted pequeno">Assunto: {preencher(config.carta_assunto ?? '', valores(carta))}</p>
        <pre className="not-carta">{preencher(config.carta_modelo ?? '', valores(carta))}</pre>
        <p className="muted pequeno">O prazo e o link do boleto entram no envio. WhatsApp: “{preencher(config.whatsapp_modelo ?? '', valores(carta))}”</p>
      </Modal>}
      {confirmar && <Modal titulo={confirmar === 'enviar' ? 'Enviar notificações' : 'Pedir negativação'} aberto onFechar={() => setConfirmar(null)}>
        <p>{prontas.length} de {marcadas.size} selecionada(s) estão prontas, somando <b>{brl(prontas.reduce((s, c) => s + Number(c.boleto_valor ?? c.valor_restante ?? 0), 0))}</b>.{marcadas.size > prontas.length && ' As outras ficam de fora (falta CPF, e-mail, endereço ou o prazo de 5 dias depois do vencimento).'}</p>
        {confirmar === 'enviar' ? <p className="muted pequeno">Para cada uma: gera o boleto no Asaas com vencimento em {config?.prazo_dias ?? 5} dias e envia a carta por e-mail. Depois, avise cada uma no WhatsApp pelo botão “Avisar”.</p>
          : <p className="muted pequeno">O Asaas manda o pedido ao Serasa, que envia uma carta ao endereço da pessoa com mais 10 dias para pagar antes de negativar. Se ela pagar o boleto, a negativação é cancelada sozinha.</p>}
        <div className="modal-acoes"><button className="btn" onClick={() => setConfirmar(null)}>Cancelar</button><button className="btn btn-ouro" disabled={!prontas.length} onClick={() => executar(confirmar)}>{confirmar === 'enviar' ? `Enviar ${prontas.length}` : `Pedir ${prontas.length}`}</button></div>
      </Modal>}
      {editar && config && <ConfigNotificacao cfg={config} aoFechar={() => setEditar(false)} aoSalvar={() => { setEditar(false); cfg.recarregar() }} />}
    </div>
  )
}
