// Menu Automações da área de Agentes: fica no espaço de trabalho, não dentro de um agente, porque serve a todos
// (marketing, atendimento, vendas). Hoje: comentário no Instagram → mensagem no direct com link, PDF ou WhatsApp.
import { EMPRESA } from '../marketing/useMarketing'
import { AbaAutomacoes } from './AbaAutomacoes'

export default function PaginaAutomacoes() {
  return (
    <div className="pagina larga">
      <header className="pagina-topo"><div><h1>Automações</h1>
        <p className="muted">Quem comenta a palavra-chave recebe uma mensagem no direct com um link, um PDF ou o caminho para o WhatsApp da equipe. Hoje: Instagram.</p></div></header>
      <AbaAutomacoes empresa={EMPRESA} />
    </div>
  )
}
