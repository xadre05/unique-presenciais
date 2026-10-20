// Mensagem de cobrança pelo WhatsApp: o texto vem pronto (dá para mudar), abre o WhatsApp da pessoa e o envio fica
// registrado na cobrança. O WhatsApp abre primeiro (o navegador bloqueia janelas abertas depois de esperar o banco).
import { useState } from 'react'
import { Erro, Modal } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { linkWhatsComTexto, mensagemCobranca, type Cobranca } from './dados'

type Dados = Pick<Cobranca, 'aluno_nome' | 'produto' | 'cobrancas_vencidas' | 'telefone' | 'origem' | 'parou_em'>
type Props = { dados: Dados; eu: string; marca: string; aoFechar: () => void; aoEnviar: (texto: string) => Promise<void> }

export function MensagemWhats({ dados, eu, marca, aoFechar, aoEnviar }: Props) {
  const [texto, setTexto] = useState(() => mensagemCobranca(dados, eu, marca))
  const [erro, setErro] = useState<string | null>(null)
  const link = linkWhatsComTexto(dados.telefone, texto)
  const enviar = async () => {
    if (!link) return
    window.open(link, '_blank', 'noopener')
    try { await aoEnviar(texto); aoFechar() } catch (e) { setErro(`O WhatsApp abriu, mas não consegui registrar: ${(e as Error).message}`) }
  }
  return (
    <Modal titulo={`WhatsApp · ${dados.aluno_nome ?? ''}`} aberto onFechar={aoFechar}>
      <div className="cob-form">
        <span className="muted pequeno">Para {dados.telefone ?? 'telefone não encontrado'}</span>
        <textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensagem" />
        <small className="muted">Revise antes de mandar. O envio fica registrado na cobrança. Mande no seu ritmo: muitas mensagens iguais em sequência fazem o WhatsApp bloquear o número.</small>
      </div>
      <Erro msg={erro ?? (!link ? 'Não achei o telefone desta pessoa.' : null)} />
      <div className="cob-acoes"><button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-ouro" disabled={!link} onClick={enviar}><Icone nome="whats" tam={16} /> Abrir WhatsApp</button></div>
    </Modal>
  )
}
