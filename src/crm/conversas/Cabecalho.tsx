// CRM — NÚCLEO: topo da conversa — quem é, etapa, quem atende, responsável, adiar, resolver (com pesquisa de satisfação).
import { useState } from 'react'
import { Icone } from '../../components/Icone'
import { telefoneLegivel } from '../nucleo'
import { servidorWhats, type BaseCRM, type Conversa } from '../tipos'
import { Avatar } from '../Pecas'
import type { Presente } from './Presenca'
import { estaAdiada } from './util'

type Props = {
  conv: Conversa; base: BaseCRM; usuarioId: string; canalNome?: string; podePedirNota: boolean; outros: Presente[]
  onVoltar: () => void; abrirContato: () => void; assumir: (para?: string) => void; alterar: (c: Partial<Conversa>) => void
}

const emHoras = (h: number) => new Date(Date.now() + h * 3600e3)
const proximo = (dias: number, hora = 9) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(hora, 0, 0, 0); return d }
const proximaSegunda = () => { const d = new Date(); const falta = ((8 - d.getDay()) % 7) || 7; return proximo(falta) }
export const PERGUNTA_NOTA = 'Antes de encerrar: de 1 a 5, que nota você dá para o nosso atendimento? É só responder com o número.'

export function Cabecalho({ conv, base, usuarioId, canalNome, podePedirNota, outros, onVoltar, abrirContato, assumir, alterar }: Props) {
  const [menu, setMenu] = useState<'adiar' | 'resolver' | null>(null)
  const [quando, setQuando] = useState('')
  const etapa = base.etapas.find((e) => e.id === conv.contato?.etapa_id)
  const quem = conv.com_ia ? { r: 'IA atendendo', c: 'ia' } : conv.atendente_id ? { r: 'Humano atendendo', c: 'ok' } : { r: 'Na fila', c: 'alerta' }
  const adiar = (d: Date | null) => { setMenu(null); alterar(d ? { adiada_ate: d.toISOString(), adiada_em: new Date().toISOString() } : { adiada_ate: null, adiada_em: null }) }
  const resolver = async (pedirNota: boolean) => {
    setMenu(null)
    if (pedirNota) { try { await servidorWhats({ acao: 'enviar', conversa_id: conv.id, texto: PERGUNTA_NOTA }) } catch { /* sem nota, resolve igual */ } }
    alterar({ status: 'resolvida', ...(pedirNota ? { csat_pedido_em: new Date().toISOString() } : {}) })
  }
  const digitando = outros.find((o) => o.digitando)
  return (<>
    <header className="chat-topo">
      <button className="btn-icone so-celular" onClick={onVoltar} aria-label="Voltar"><Icone nome="esquerda" /></button>
      <button className="chat-quem" onClick={abrirContato}>
        <Avatar nome={conv.contato?.nome || conv.contato?.telefone} />
        <span className="chat-quem-txt">
          <span className="chat-nome"><b>{conv.contato?.nome || telefoneLegivel(conv.contato?.telefone)}</b>
            {etapa && <span className="chat-selo" style={{ borderColor: etapa.cor ?? undefined }}>{etapa.nome}</span>}
            <span className={`chat-selo ${quem.c}`}>• {quem.r}</span>
            {conv.csat_nota != null && <span className="chat-selo ok" title="Nota que a pessoa deu ao atendimento">Nota {conv.csat_nota}/5</span>}
            {estaAdiada(conv) && <span className="chat-selo alerta">Adiada até {new Date(conv.adiada_ate!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>}</span>
          <span className="muted pequeno">WhatsApp · {canalNome ?? '—'} · {telefoneLegivel(conv.contato?.telefone)}</span>
        </span>
      </button>
      <div className="chat-acoes">
        {!conv.atendente_id && <button className="btn btn-ouro btn-mini" onClick={() => assumir()}>Assumir</button>}
        {base.souAdmin ? (
          <label className="chat-resp"><span className="muted pequeno">Responsável:</span>
            <select value={conv.atendente_id ?? ''} onChange={(e) => e.target.value && assumir(e.target.value)} aria-label="Passar para">
              {!conv.atendente_id && <option value="">Ninguém (fila)</option>}
              {base.equipe.filter((m) => m.ativo).map((m) => <option key={m.usuario_id} value={m.usuario_id}>{m.nome}</option>)}
            </select>
          </label>
        ) : conv.atendente_id && <span className="muted pequeno">Responsável: {conv.atendente_id === usuarioId ? 'você' : base.nomeDe(conv.atendente_id)}</span>}
        <span className="ce-pop-ancora">
          <button className="btn btn-mini" onClick={() => setMenu(menu === 'adiar' ? null : 'adiar')} title="Tira da caixa e traz de volta na hora marcada (ou antes, se a pessoa escrever)"><Icone nome="relogio" tam={15} /> Adiar</button>
          {menu === 'adiar' && <div className="ce-pop ce-menu direita">
            <button onClick={() => adiar(emHoras(1))}>Daqui a 1 hora</button>
            <button onClick={() => adiar(emHoras(3))}>Daqui a 3 horas</button>
            <button onClick={() => adiar(proximo(1))}>Amanhã às 9h</button>
            <button onClick={() => adiar(proximaSegunda())}>Segunda às 9h</button>
            <div className="ce-menu-data"><input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /><button className="btn btn-mini" disabled={!quando} onClick={() => adiar(new Date(quando))}>Ok</button></div>
            {estaAdiada(conv) && <button onClick={() => adiar(null)}>Trazer de volta agora</button>}
          </div>}
        </span>
        {conv.status === 'aberta' ? (
          <span className="ce-pop-ancora">
            <button className="btn btn-ouro btn-mini" onClick={() => (podePedirNota ? setMenu(menu === 'resolver' ? null : 'resolver') : resolver(false))} title="Tira da caixa; volta sozinha se a pessoa escrever de novo"><Icone nome="check" tam={15} /> Resolver</button>
            {menu === 'resolver' && <div className="ce-pop ce-menu direita">
              <button onClick={() => resolver(false)}>Resolver</button>
              <button onClick={() => resolver(true)}>Resolver e pedir nota (1 a 5)</button>
            </div>}
          </span>
        ) : <button className="btn btn-mini" onClick={() => alterar({ status: 'aberta' })}>Reabrir</button>}
        <button className="btn btn-mini so-celular" onClick={abrirContato}>Contato</button>
      </div>
    </header>
    {outros.length > 0 && <div className="chat-presenca pequeno"><Icone nome="olho" tam={14} /> {digitando ? `${digitando.nome} está escrevendo nesta conversa…` : `${outros.map((o) => o.nome).join(', ')} também ${outros.length > 1 ? 'estão' : 'está'} com esta conversa aberta.`}</div>}
  </>)
}
