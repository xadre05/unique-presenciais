// Notificação extrajudicial (administrador): uma carta e um boleto por pessoa (CPF), só das parcelas vencidas + multa e juros.
// Travas do advogado: só depois de ele liberar, só compras até a data de corte, só em horário comercial; quem tem dúvida
// nos números vai para "Conferir na Hotmart". Depois: prazo, aviso no WhatsApp e negativação. Tudo fica no histórico.
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { brl, dataBR, hojeISO } from '../../../lib/format'
import { Badge, Erro, Modal, Vazio } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { linkWhatsComTexto, nomeCurtoConta, registrarContato, useContasHotmart, type Cobranca } from '../dados'
import { campos, FASES, horarioComercial, preencher, type Conferencia, type Config, type Dados, type Extra } from './modelo'
import { ABAS, abaDe, agrupar, semEndereco, type Aba, type Pessoa } from './pessoas'
import { ConfigNotificacao } from './ConfigNotificacao'
import { ConferirHotmart } from './ConferirHotmart'

type Props = { lista: Cobranca[]; nomeConta: (id: string | null) => string; aoMudar: () => void; eu: string }

export function PainelNotificacao({ lista, nomeConta, aoMudar, eu }: Props) {
  const extras = useConsulta<Extra[]>(() => supabase.rpc('cobrancas_para_notificar'), [])
  const conf = useConsulta<Conferencia[]>(() => supabase.from('v_cobranca_conferencia').select('*'), [lista])
  const cfg = useConsulta<Config>(() => supabase.from('cobranca_config').select('*').single(), [])
  const contas = useContasHotmart()
  const [aba, setAba] = useState<Aba>('para_notificar')
  const [conta, setConta] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [carta, setCarta] = useState<Pessoa | null>(null)
  const [conferir, setConferir] = useState<Cobranca | null>(null)
  const [confirmar, setConfirmar] = useState<'enviar' | 'negativar' | null>(null)
  const [editar, setEditar] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const hoje = hojeISO()
  const config = cfg.dados
  const ex = useMemo(() => new Map((extras.dados ?? []).map((e) => [e.cobranca_id, e])), [extras.dados])
  const kMap = useMemo(() => new Map((conf.dados ?? []).map((k) => [k.cobranca_id, k])), [conf.dados])
  const doFiltro = lista.filter((c) => !conta || c.integracao_id === conta)
  const naAba = (a: Aba) => doFiltro.filter((c) => abaDe(c, kMap.get(c.id), config ?? null) === a)
  const pessoas = useMemo(() => agrupar(naAba(aba), kMap, ex, config ?? null, hoje), [doFiltro, aba, kMap, ex, config, hoje]) // eslint-disable-line react-hooks/exhaustive-deps
  const limiteNegativar = useMemo(() => { const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - 5); return d.toISOString().slice(0, 10) }, [hoje])
  const pronta = (p: Pessoa) => aba === 'prazo_vencido'
    ? !p.pendencias.length && p.cobrancas.every((c) => c.prazo_ate && c.prazo_ate <= limiteNegativar) && !semEndereco(ex.get(p.cobrancas[0].id))
    : !p.pendencias.length
  const escolhidas = pessoas.filter((p) => marcadas.has(p.chave))
  const prontas = escolhidas.filter(pronta)
  const comercial = horarioComercial()

  const valores = (p: Pessoa) => campos({ aluno_nome: p.nome, email: p.email, documento: p.cpf, boleto_url: p.cobrancas[0].boleto_url, boleto_valor: p.total, prazo_ate: p.cobrancas[0].prazo_ate } as Dados, p.itens, (config ?? {}) as unknown as Dados, hoje)
  const avisarWhats = async (p: Pessoa) => {
    if (!comercial) return setMsg('WhatsApp só em horário comercial: segunda a sexta, das 9h às 18h.')
    const texto = preencher(config?.whatsapp_modelo ?? '', valores(p))
    const l = linkWhatsComTexto(p.telefone, texto)
    if (!l) return setMsg('Sem telefone para essa pessoa.')
    window.open(l, '_blank', 'noopener')
    for (const c of p.cobrancas) {
      await supabase.from('cobrancas').update({ whatsapp_avisado_em: new Date().toISOString() }).eq('id', c.id)
      await registrarContato(c, { canal: 'whatsapp', resultado: 'Aviso da notificação enviado pelo WhatsApp', observacao: texto }, eu)
    }
    aoMudar()
  }
  const executar = async (acao: 'enviar' | 'negativar') => {
    const ids = prontas.flatMap((p) => p.cobrancas.map((c) => c.id))
    let feitos = 0
    const falhas: string[] = []
    for (let i = 0; i < ids.length; i += 20) {
      setMsg(`Processando ${Math.min(i + 20, ids.length)} de ${ids.length}…`)
      const { data, error } = await supabase.functions.invoke('notificacao', { body: { acao, ids: ids.slice(i, i + 20) } })
      if (error || data?.erro) { falhas.push(data?.erro ?? error?.message ?? 'erro'); break }
      feitos += data.feitos
      for (const f of data.falhas ?? []) falhas.push(`${f.nome}: ${f.motivo}`)
    }
    setConfirmar(null); setMarcadas(new Set())
    setMsg(`${feitos} dívida(s) ${acao === 'enviar' ? 'notificada(s)' : 'com negativação pedida'}.${falhas.length ? ` Não foi possível: ${falhas.slice(0, 8).join(' · ')}${falhas.length > 8 ? ` e mais ${falhas.length - 8}` : ''}` : ''}`)
    aoMudar(); conf.recarregar()
  }
  const marcar = (p: Pessoa, v: boolean) => { const s = new Set(marcadas); if (v) s.add(p.chave); else s.delete(p.chave); setMarcadas(s) }

  return (
    <div className="not-painel">
      <div className={config?.advogado_liberou_em ? 'faixa-info' : 'faixa-alerta'}><Icone nome={config?.advogado_liberou_em ? 'check' : 'alerta'} tam={18} /><span>
        {config?.advogado_liberou_em ? <>Carta liberada pelo advogado em {dataBR(config.advogado_liberou_em)} ({config.advogado_liberou_por}). </> : <><b>Envio travado até o advogado liberar a carta.</b> </>}
        Só compras até <b>{dataBR(config?.compra_ate)}</b> (as mais novas aguardam a posição da Hotmart). Cobra só as parcelas vencidas + multa {config?.multa_pct ?? 2}% e juros {config?.juros_mes_pct ?? 1}% ao mês. Envio em horário comercial{comercial ? '' : ' (agora está fora)'}.
        {' '}<button type="button" className="link" onClick={() => setEditar(true)}>Dados, modelos e travas</button></span></div>
      <nav className="abas">{ABAS.map(([k, r]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => { setAba(k); setMarcadas(new Set()) }}>{r} <span className="muted">{agrupar(naAba(k), kMap, ex, config ?? null, hoje).length}</span></button>)}</nav>
      <div className="pg-filtros">
        <label className="select-icone pg-rotulado"><span>Conta:</span><select value={conta} onChange={(e) => setConta(e.target.value)}><option value="">Todas</option>{(contas.dados ?? []).map((x) => <option key={x.id} value={x.id}>{nomeCurtoConta(x.nome)}</option>)}</select></label>
        {['para_notificar', 'prazo_vencido'].includes(aba) && pessoas.length > 0 && <label className="check"><input type="checkbox" checked={pessoas.every((p) => marcadas.has(p.chave))} onChange={(e) => setMarcadas(e.target.checked ? new Set(pessoas.map((p) => p.chave)) : new Set())} /> Selecionar as {pessoas.length} pessoas</label>}
        {marcadas.size > 0 && aba === 'para_notificar' && <button type="button" className="btn btn-ouro" disabled={!config?.advogado_liberou_em || !comercial} title={!config?.advogado_liberou_em ? 'Falta o advogado liberar a carta' : !comercial ? 'Só em horário comercial' : ''} onClick={() => setConfirmar('enviar')}>Enviar notificação ({marcadas.size})</button>}
        {marcadas.size > 0 && aba === 'prazo_vencido' && <button type="button" className="btn btn-ouro" onClick={() => setConfirmar('negativar')}>Pedir negativação ({marcadas.size})</button>}
      </div>
      {aba === 'conferir' && <p className="muted pequeno">O sistema não tem certeza do valor dessas dívidas. Confira cada uma na Hotmart e marque se confere; só depois ela pode ser notificada.</p>}
      {aba === 'aguardando' && <p className="muted pequeno">Compras depois de {dataBR(config?.compra_ate)}: nessa época a Hotmart pode ter adiantado o dinheiro ou negativado em nome dela. Ficam paradas até a posição da Hotmart. A data de corte muda em “Dados, modelos e travas”.</p>}
      {msg && <p className="nota pequeno">{msg}</p>}
      <Erro msg={extras.erro || cfg.erro || conf.erro} />
      {!pessoas.length ? <Vazio>Ninguém nesta etapa com esses filtros.</Vazio> : (
        <div className="tabela-wrap"><table className="tabela tabela-pag">
          <thead><tr><th></th><th>Pessoa / cursos</th><th>Comprou</th><th>Parou em</th><th className="num">Vencido</th><th className="num">Com encargos</th><th>Situação</th><th className="direita">Ações</th></tr></thead>
          <tbody>{pessoas.map((p) => {
            const c0 = p.cobrancas[0], f = FASES[c0.fase_legal ?? '']
            return (
              <tr key={p.chave}>
                <td>{['para_notificar', 'prazo_vencido'].includes(aba) && <input type="checkbox" checked={marcadas.has(p.chave)} onChange={(e) => marcar(p, e.target.checked)} aria-label="Selecionar" />}</td>
                <td><span className="forte">{p.nome}</span>{p.cobrancas.map((c) => <div key={c.id} className="muted pequeno">{c.produto} · {nomeConta(c.integracao_id)}{aba === 'conferir' && kMap.get(c.id)?.duvidas?.length ? <div className="alerta-txt">{kMap.get(c.id)!.duvidas.join('; ')}</div> : null}</div>)}</td>
                <td className="pequeno">{dataBR(p.compra_em)}</td>
                <td className="pequeno">{dataBR(p.parou_em)}</td>
                <td className="num">{brl(p.principal)}</td>
                <td className="num forte">{brl(p.total)}</td>
                <td>{p.pendencias.length ? <Badge tom="alerta">sem {p.pendencias.join(', ')}</Badge> : <Badge tom={f.tom}>{f.rotulo}</Badge>}
                  {c0.prazo_ate && <div className={`pequeno ${c0.prazo_ate < hoje ? 'erro-txt' : 'muted'}`}>prazo {dataBR(c0.prazo_ate)}</div>}
                  {c0.whatsapp_avisado_em && <div className="muted pequeno">WhatsApp ✓</div>}
                  {aba === 'prazo_vencido' && semEndereco(ex.get(c0.id)) && <div className="alerta-txt pequeno">sem endereço completo</div>}</td>
                <td><div className="pg-acoes">
                  {aba === 'conferir' ? p.cobrancas.map((c) => <button key={c.id} type="button" className="btn btn-mini btn-contorno-ouro" onClick={() => setConferir(c)}>Conferir</button>)
                    : <button type="button" className="btn btn-mini" onClick={() => setCarta(p)}>Ver carta</button>}
                  {c0.fase_legal === 'notificada' && <button type="button" className="btn btn-mini btn-contorno" disabled={!p.telefone} onClick={() => avisarWhats(p)}><Icone nome="whats" tam={14} /> Avisar</button>}
                  {c0.boleto_url && <a className="btn btn-mini" href={c0.boleto_url} target="_blank" rel="noreferrer">Boleto</a>}
                </div></td>
              </tr>)
          })}</tbody>
        </table></div>)}

      {carta && config && <Modal titulo={`Carta · ${carta.nome}`} aberto onFechar={() => setCarta(null)} largo>
        <p className="muted pequeno">Assunto: {preencher(config.carta_assunto ?? '', valores(carta))}</p>
        <pre className="not-carta">{preencher(config.carta_modelo ?? '', valores(carta))}</pre>
        <p className="muted pequeno">O prazo e o link do boleto entram no envio. Os juros são calculados no dia do envio. WhatsApp: “{preencher(config.whatsapp_modelo ?? '', valores(carta))}”</p>
      </Modal>}
      {confirmar && <Modal titulo={confirmar === 'enviar' ? 'Enviar notificações' : 'Pedir negativação'} aberto onFechar={() => setConfirmar(null)}>
        <p>{prontas.length} de {escolhidas.length} pessoa(s) selecionada(s) estão prontas, somando <b>{brl(prontas.reduce((s, p) => s + p.total, 0))}</b>.{escolhidas.length > prontas.length && ' As outras ficam de fora (falta CPF, e-mail, endereço ou os 5 dias depois do prazo).'}</p>
        {confirmar === 'enviar' ? <p className="muted pequeno">Para cada pessoa: um boleto no Asaas com vencimento em {config?.prazo_dias ?? 5} dias (somando os cursos dela) e a carta por e-mail. Antes de enviar, o sistema confere de novo se a dívida continua em aberto na Hotmart. Depois, avise cada uma no WhatsApp pelo botão “Avisar”.</p>
          : <p className="muted pequeno">Antes de pedir, o sistema confere de novo na Hotmart se a pessoa pagou alguma parcela depois da notificação. O Asaas manda o pedido ao Serasa, que envia uma carta ao endereço da pessoa com mais 10 dias para pagar antes de negativar.</p>}
        <div className="modal-acoes"><button className="btn" onClick={() => setConfirmar(null)}>Cancelar</button><button className="btn btn-ouro" disabled={!prontas.length} onClick={() => executar(confirmar)}>{confirmar === 'enviar' ? `Enviar ${prontas.length}` : `Pedir ${prontas.length}`}</button></div>
      </Modal>}
      {conferir && <ConferirHotmart c={conferir} k={kMap.get(conferir.id)} eu={eu} aoFechar={() => setConferir(null)} aoSalvar={() => { setConferir(null); aoMudar(); conf.recarregar() }} />}
      {editar && config && <ConfigNotificacao cfg={config} eu={eu} aoFechar={() => setEditar(false)} aoSalvar={() => { setEditar(false); cfg.recarregar() }} />}
    </div>
  )
}
