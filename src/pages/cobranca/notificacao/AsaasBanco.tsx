// Boleto, Pix e negativação no Serasa pelo Asaas. A chave de API e o token do aviso (webhook) ficam cifrados no cofre do banco.
import { BlocoCredenciais, type CampoCred } from './BlocoCredenciais'
import { chamarNotificacao } from './chamar'

const URL_AVISO = 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/notificacao'

const CAMPOS: CampoCred[] = [
  { k: 'api_key', r: 'Chave de API do Asaas', d: 'No Asaas: Integrações → Chave de API → Gerar chave. Começa com $aact_', secreto: true },
  { k: 'webhook_token', r: 'Token do aviso (webhook)', d: 'Invente uma senha longa (só letras e números) e cole aqui e no webhook do Asaas', secreto: true },
]

const testar = async () => {
  const a = (await chamarNotificacao({ acao: 'testar' }))?.asaas
  if (!a?.ok) throw new Error(a?.erro ?? 'Não consegui falar com o Asaas.')
  return `O Asaas aceitou a chave: ${a.conta} (ambiente de ${a.ambiente}).`
}

export const AsaasBanco = () => (
  <BlocoCredenciais integracao="asaas" titulo="Boleto, Pix e negativação (Asaas)" campos={CAMPOS}
    acoes={[{ rotulo: 'Testar o Asaas', fazer: testar }]}
    rodape={<p className="muted pequeno">Aviso de pagamento: no Asaas, em Integrações → Webhooks, crie um webhook com a URL <code>{URL_AVISO}</code>, versão v3, o mesmo token
      que você colou acima, e os eventos de cobrança recebida/confirmada e de negativação. A negativação pela API precisa ser liberada pelo gerente do Asaas.</p>} />
)
