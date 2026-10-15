// CRM — NÚCLEO: disparos (mesma mensagem, com variações, para muitos contatos no ritmo do número).
// Quem chama decide os contatos (lista de ids); aqui não se sabe de onde eles vieram.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Badge, Campo, Erro, Modal, Vazio } from '../components/ui'
import { preencherMensagem } from './nucleo'
import { STATUS_CANAL, type BaseCRM } from './tipos'

type Resumo = {
  id: string; nome: string; status: 'rascunho' | 'enviando' | 'pausado' | 'concluido' | 'cancelado'; criado_em: string; iniciado_em: string | null
  concluido_em: string | null; origem: string | null; mensagens: string[]; canal_nome: string; ritmo_por_hora: number
  total: number; na_fila: number; enviados: number; erros: number; responderam: number
}
const STATUS: Record<Resumo['status'], { rotulo: string; tom: string }> = {
  rascunho: { rotulo: 'Não iniciado', tom: 'neutro' }, enviando: { rotulo: 'Enviando', tom: 'ouro' }, pausado: { rotulo: 'Pausado', tom: 'alerta' },
  concluido: { rotulo: 'Concluído', tom: 'ok' }, cancelado: { rotulo: 'Cancelado', tom: 'apagado' },
}

/** Quanto tempo leva no ritmo do número, contando só o horário em que ele envia. */
export function tempoEstimado(n: number, porHora: number, inicio = '08:00', fim = '20:00') {
  const horasDia = Math.max(1, (Number(fim.slice(0, 2)) * 60 + Number(fim.slice(3, 5)) - Number(inicio.slice(0, 2)) * 60 - Number(inicio.slice(3, 5))) / 60)
  const horas = n / Math.max(1, porHora)
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`
  if (horas <= horasDia) return `${Math.round(horas * 10) / 10} h`
  return `${Math.ceil(horas / horasDia)} dias (${Math.round(horasDia)} h por dia)`
}

export default function Disparos({ empresaId, base, novo }: { empresaId: string; base: BaseCRM; novo?: React.ReactNode }) {
  const [lista, setLista] = useState<Resumo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('crm_resumo_disparos', { p_empresa: empresaId })
    if (error) setErro(error.message); else setLista((data as Resumo[]) ?? [])
  }, [empresaId])
  useEffect(() => { carregar(); const t = setInterval(carregar, 20000); return () => clearInterval(t) }, [carregar])

  const mudar = async (id: string, campos: Record<string, unknown>) => {
    const { error } = await supabase.from('crm_disparos').update(campos).eq('id', id)
    if (error) setErro(error.message); else carregar()
  }
  return (
    <div>
      {novo}
      <Erro msg={erro} />
      {lista.length === 0 ? <Vazio>Nenhum disparo ainda.</Vazio> : (
        <div className="cards">
          {lista.map((d) => {
            const pct = d.total ? (100 * (d.enviados + d.erros)) / d.total : 0
            return (
              <div key={d.id} className="card-lista">
                <div className="card-lista-topo"><h3>{d.nome}</h3><Badge tom={STATUS[d.status].tom}>{STATUS[d.status].rotulo}</Badge></div>
                <div className="muted pequeno">{d.origem ? `${d.origem} · ` : ''}pelo {d.canal_nome} · {d.ritmo_por_hora}/hora</div>
                <div className="barra-lista"><div className="bl-comprou" style={{ width: `${d.total ? (100 * d.responderam) / d.total : 0}%` }} /><div className="bl-andamento" style={{ width: `${Math.max(0, pct - (d.total ? (100 * d.responderam) / d.total : 0))}%` }} /></div>
                <div className="card-lista-nums">
                  <span><b>{d.enviados}</b> de {d.total} enviados</span>
                  <span className="ok-txt"><b>{d.responderam}</b> responderam</span>
                  {d.erros > 0 && <span className="erro-txt"><b>{d.erros}</b> com erro</span>}
                  {d.na_fila > 0 && d.status !== 'cancelado' && <span>falta {tempoEstimado(d.na_fila, d.ritmo_por_hora)}</span>}
                </div>
                <div className="acoes">
                  {(d.status === 'rascunho' || d.status === 'pausado') && <button className="btn btn-ouro btn-mini" onClick={() => mudar(d.id, { status: 'enviando', iniciado_em: d.iniciado_em ?? new Date().toISOString() })}>{d.status === 'rascunho' ? 'Começar a enviar' : 'Continuar'}</button>}
                  {d.status === 'enviando' && <button className="btn btn-mini" onClick={() => mudar(d.id, { status: 'pausado' })}>Pausar</button>}
                  {['rascunho', 'enviando', 'pausado'].includes(d.status) && <button className="link pequeno" onClick={() => mudar(d.id, { status: 'cancelado' })}>cancelar</button>}
                </div>
                <details className="pequeno"><summary className="muted">Mensagens ({d.mensagens.length})</summary>{d.mensagens.map((m, i) => <p key={i} className="msg-previa">{m}</p>)}</details>
              </div>
            )
          })}
        </div>
      )}
      {base.canais.length === 0 && <p className="muted pequeno">Cadastre um número em Configurações para poder disparar.</p>}
    </div>
  )
}

/** Montar um disparo para uma lista de contatos já escolhida. */
export function NovoDisparo({ empresaId, base, contatoIds, origem, nomeSugerido, onFechar, onFeito }: {
  empresaId: string; base: BaseCRM; contatoIds: string[]; origem: string; nomeSugerido?: string; onFechar: () => void; onFeito: () => void
}) {
  const [nome, setNome] = useState(nomeSugerido ?? '')
  const [canal, setCanal] = useState(base.canais.find((k) => k.status === 'conectado')?.id ?? base.canais[0]?.id ?? '')
  const [msgs, setMsgs] = useState<string[]>(['Oi {nome}, tudo bem? ', ''])
  const [donos, setDonos] = useState<string[]>([])
  const [comecar, setComecar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const k = base.canais.find((x) => x.id === canal)
  const validas = msgs.map((m) => m.trim()).filter(Boolean)

  const criar = async () => {
    setErro(null); setSalvando(true)
    // respostas divididas entre as pessoas escolhidas (rodízio); sem ninguém = caem na fila
    const mapa = donos.length ? Object.fromEntries(contatoIds.map((id, i) => [id, donos[i % donos.length]])) : null
    const { data, error } = await supabase.rpc('crm_criar_disparo', {
      p_empresa: empresaId, p_nome: nome, p_canal: canal, p_mensagens: validas, p_contatos: contatoIds, p_atendente: null, p_origem: origem, p_donos: mapa,
    })
    if (!error && comecar) await supabase.from('crm_disparos').update({ status: 'enviando', iniciado_em: new Date().toISOString() }).eq('id', (data as { id: string }).id)
    setSalvando(false)
    if (error) return setErro(error.message)
    onFeito()
  }
  return (
    <Modal titulo="Novo disparo" aberto onFechar={onFechar} largo>
      <div className="nota pequeno"><b>{contatoIds.length.toLocaleString('pt-BR')}</b> contatos · {origem}. Quem pediu para não receber ou tem número errado fica de fora sozinho.</div>
      <div className="form-grade">
        <Campo rotulo="Nome do disparo"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Black 2026 — compradores" /></Campo>
        <Campo rotulo="Número que envia">
          <select value={canal} onChange={(e) => setCanal(e.target.value)}>
            {base.canais.map((x) => <option key={x.id} value={x.id}>{x.nome} — {STATUS_CANAL[x.status].rotulo} · {x.ritmo_por_hora}/hora</option>)}
          </select>
        </Campo>
      </div>
      {k && <p className="muted pequeno">No ritmo deste número ({k.ritmo_por_hora} por hora, das {k.janela_inicio.slice(0, 5)} às {k.janela_fim.slice(0, 5)}) leva cerca de <b>{tempoEstimado(contatoIds.length, k.ritmo_por_hora, k.janela_inicio, k.janela_fim)}</b>. O ritmo muda em Configurações → Números.</p>}

      <h3>Mensagens</h3>
      <p className="muted pequeno">Escreva 2 ou 3 versões do mesmo recado: cada pessoa recebe uma sorteada. Mensagens iguais em sequência são o que mais faz o WhatsApp bloquear o número. Use <b>{'{nome}'}</b> para o primeiro nome.</p>
      {msgs.map((m, i) => (
        <div key={i} className="editor-msg">
          <div className="editor-msg-topo"><b className="pequeno">Versão {i + 1}</b>{msgs.length > 1 && <button className="link pequeno" onClick={() => setMsgs(msgs.filter((_, j) => j !== i))}>remover</button>}</div>
          <textarea rows={4} value={m} onChange={(e) => setMsgs(msgs.map((x, j) => (j === i ? e.target.value : x)))} />
          {m.trim() && <div className="muted pequeno">Como chega: “{preencherMensagem(m, { nome: 'mariana' }).slice(0, 160)}”</div>}
        </div>
      ))}
      {msgs.length < 5 && <button className="btn btn-mini" onClick={() => setMsgs([...msgs, ''])}>+ outra versão</button>}

      <h3>Quem atende quem responder</h3>
      <div className="opcoes-vendedoras">
        {base.equipe.filter((m) => m.ativo).map((m) => (
          <label key={m.usuario_id} className="check"><input type="checkbox" checked={donos.includes(m.usuario_id)} onChange={(e) => setDonos(e.target.checked ? [...donos, m.usuario_id] : donos.filter((x) => x !== m.usuario_id))} /> {m.nome}</label>
        ))}
      </div>
      <p className="muted pequeno">{donos.length ? `Os contatos são divididos entre ${donos.length} pessoa(s); quem responder já cai na caixa de quem ficou com ele.` : 'Ninguém marcado: quem responder cai na Fila e qualquer pessoa da equipe pega.'}</p>

      <label className="check"><input type="checkbox" checked={comecar} onChange={(e) => setComecar(e.target.checked)} /> Começar a enviar agora</label>
      <Erro msg={erro} />
      <div className="modal-acoes">
        <button className="btn" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-ouro" onClick={criar} disabled={salvando || !canal || !validas.length || !nome.trim()}>{salvando ? 'Criando…' : comecar ? 'Criar e começar' : 'Criar (sem enviar ainda)'}</button>
      </div>
    </Modal>
  )
}
