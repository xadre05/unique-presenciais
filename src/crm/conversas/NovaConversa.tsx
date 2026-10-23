// CRM — NÚCLEO: começar uma conversa com alguém que ainda não escreveu. Pela API oficial da Meta só dá com um modelo
// aprovado; nos outros números, com texto livre.
import { useState } from 'react'
import { Campo, Erro, Modal } from '../../components/ui'
import { servidorWhats, type BaseCRM } from '../tipos'
import { telefoneBR } from '../nucleo'
import { EscolherModelo, type EnvioModelo } from './Modelos'

export function NovaConversa({ base, aoFechar, aoCriar }: { base: BaseCRM; aoFechar: () => void; aoCriar: (conversaId: string) => void }) {
  const numeros = base.canais.filter((k) => k.ativo && k.status === 'conectado')
  const [canalId, setCanalId] = useState(numeros.find((k) => k.tipo !== 'teste')?.id ?? numeros[0]?.id ?? '')
  const [telefone, setTelefone] = useState('')
  const [nome, setNome] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const canal = numeros.find((k) => k.id === canalId)
  const tel = telefoneBR(telefone)
  const iniciar = async (extra: { texto?: string; modelo?: EnvioModelo }) => {
    if (!tel) return setErro('Telefone inválido: DDD + número de celular.')
    setEnviando(true); setErro(null)
    try { const r = await servidorWhats<{ conversa: string }>({ acao: 'enviar', canal_id: canalId, telefone: tel, nome: nome.trim() || null, ...extra }); aoCriar(r.conversa) }
    catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }
  return (
    <Modal titulo="Nova conversa" aberto onFechar={aoFechar}>
      {!numeros.length ? <p className="nota">Nenhum número conectado.</p> : <>
        <div className="form-grade">
          {numeros.length > 1 && <Campo rotulo="Pelo número"><select value={canalId} onChange={(e) => setCanalId(e.target.value)}>{numeros.map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}</select></Campo>}
          <Campo rotulo="WhatsApp da pessoa (DDD + número)"><input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="61 99999-8888" inputMode="tel" /></Campo>
          <Campo rotulo="Nome (opcional)"><input value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        </div>
        {canal?.tipo === 'whatsapp_oficial' ? <>
          <p className="muted pequeno">Pelo WhatsApp oficial, a primeira mensagem tem de ser um modelo aprovado pela Meta. Quando a pessoa responder, a conversa fica livre por 24 h.</p>
          <EscolherModelo modelos={base.modelos.filter((m) => m.canal_id === canalId)} nomeContato={nome} enviando={enviando} aoEnviar={(m) => iniciar({ modelo: m })} aoCancelar={aoFechar} />
        </> : <>
          <Campo rotulo="Mensagem"><textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
          <div className="modal-acoes"><button className="btn" onClick={aoFechar}>Cancelar</button><button className="btn btn-ouro" disabled={enviando || !texto.trim()} onClick={() => iniciar({ texto })}>{enviando ? 'Enviando…' : 'Enviar'}</button></div>
        </>}
        <Erro msg={erro} />
      </>}
    </Modal>
  )
}
