// "O que a pessoa recebe" numa automação: só a mensagem, um link, um PDF ou uma conversa no WhatsApp. No WhatsApp,
// reveza entre as vendedoras (o número de cada uma se cadastra aqui mesmo) ou vai para um número fixo. Tudo chega por
// um link rastreado: dá para saber quem clicou e com qual vendedora a conversa ficou.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { NOME_DESTINO, enviarArquivo, salvarWhatsappVendedora, useVendedoras, whatsappValido, type Automacao, type Destino } from './dados'

export type DestinoForm = Pick<Automacao, 'destino' | 'link' | 'arquivo_caminho' | 'arquivo_nome' | 'whatsapp_modo' | 'whatsapp_numero' | 'whatsapp_texto' | 'vendedoras'>
type Props = { empresa: string; valor: DestinoForm; aoMudar: (v: Partial<DestinoForm>) => void }

const ICONE: Record<Destino, string> = { nenhum: 'mensagem', link: 'links', arquivo: 'pdf', whatsapp: 'whats' }
const alternar = (l: string[], x: string) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x])

function Vendedoras({ valor, aoMudar }: Pick<Props, 'valor' | 'aoMudar'>) {
  const lista = useVendedoras()
  const [numeros, setNumeros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const guardar = async (id: string) => {
    const n = numeros[id]
    if (n == null) return
    setErro(null)
    try { await salvarWhatsappVendedora(id, n); lista.recarregar() } catch (e) { setErro((e as Error).message) }
  }
  const todas = !valor.vendedoras.length
  return (
    <div className="au-vendedoras">
      <small className="muted">Cada clique vai para a vendedora que recebeu menos conversas nos últimos 30 dias. {todas ? 'Participam todas as que têm WhatsApp.' : 'Só as marcadas participam.'}</small>
      {(lista.dados ?? []).map((v) => {
        const numero = numeros[v.id] ?? v.whatsapp ?? ''
        return (
          <div key={v.id} className="au-vendedora">
            <label className="pp-check"><input type="checkbox" checked={todas || valor.vendedoras.includes(v.id)} onChange={() => aoMudar({ vendedoras: alternar(todas ? (lista.dados ?? []).map((x) => x.id) : valor.vendedoras, v.id) })} /> {v.nome}</label>
            <input value={numero} placeholder="WhatsApp com DDD" inputMode="tel" aria-label={`WhatsApp de ${v.nome}`} onChange={(e) => setNumeros((m) => ({ ...m, [v.id]: e.target.value }))} onBlur={() => guardar(v.id)} />
            {numero && !whatsappValido(numero) && <small className="ig-abaixo">confira o número</small>}
          </div>
        )
      })}
      <Erro msg={erro} />
    </div>
  )
}

export function DestinoAutomacao({ empresa, valor, aoMudar }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const subir = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro(null); setEnviando(true)
    try { aoMudar({ arquivo_caminho: await enviarArquivo(empresa, arquivo), arquivo_nome: arquivo.name }) } catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }
  return (
    <div className="au-destino">
      <div className="au-alvos" role="radiogroup" aria-label="O que a pessoa recebe">
        {(Object.keys(NOME_DESTINO) as Destino[]).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={valor.destino === d} className={`au-alvo${valor.destino === d ? ' ativo' : ''}`} onClick={() => aoMudar({ destino: d })}><Icone nome={ICONE[d]} tam={15} /> {NOME_DESTINO[d]}</button>))}
        <span className="au-alvo desligado" title="Em breve: a mensagem faz uma pergunta e o próximo passo depende da resposta">Uma pergunta (em breve)</span>
      </div>
      {valor.destino === 'link' && <>
        <input value={valor.link ?? ''} onChange={(e) => aoMudar({ link: e.target.value })} placeholder="https://…" inputMode="url" aria-label="Link" />
        <small className="muted">Pode deixar em branco e colocar quando a página estiver no ar. Sem link, a mensagem vai só com o texto.</small></>}
      {valor.destino === 'arquivo' && <>
        <label className="btn btn-contorno au-subir"><Icone nome="importar" tam={15} /> {enviando ? 'Enviando…' : valor.arquivo_nome ? 'Trocar arquivo' : 'Escolher PDF'}
          <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => subir(e.target.files?.[0])} /></label>
        {valor.arquivo_nome && <small className="au-link"><Icone nome="pdf" tam={13} /> {valor.arquivo_nome}</small>}
        <small className="muted">Até 10 MB. A pessoa recebe um link que abre o arquivo.</small></>}
      {valor.destino === 'whatsapp' && <>
        <div className="au-alvos">
          <button type="button" className={`au-alvo${valor.whatsapp_modo === 'reveza' ? ' ativo' : ''}`} onClick={() => aoMudar({ whatsapp_modo: 'reveza' })}>Reveza entre as vendedoras</button>
          <button type="button" className={`au-alvo${valor.whatsapp_modo === 'numero' ? ' ativo' : ''}`} onClick={() => aoMudar({ whatsapp_modo: 'numero' })}>Um número fixo</button>
        </div>
        {valor.whatsapp_modo === 'reveza' ? <Vendedoras valor={valor} aoMudar={aoMudar} />
          : <input value={valor.whatsapp_numero ?? ''} onChange={(e) => aoMudar({ whatsapp_numero: e.target.value })} placeholder="WhatsApp com DDD" inputMode="tel" aria-label="Número do WhatsApp" />}
        <label className="au-rotulo">Mensagem que já vem escrita no WhatsApp<input value={valor.whatsapp_texto ?? ''} onChange={(e) => aoMudar({ whatsapp_texto: e.target.value })} placeholder="Oi! Vim pelo Instagram e quero saber mais." /></label>
        <small className="muted">O sistema junta um código no fim, para a vendedora saber de qual post a pessoa veio.</small></>}
      <Erro msg={erro} />
    </div>
  )
}
