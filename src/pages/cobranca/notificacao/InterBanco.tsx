// Boleto com Pix da notificação: integração com o Banco Inter (API Cobrança). O Inter entrega o Client ID, o Client
// Secret e um .zip com o certificado (.crt) e a chave (.key); tudo fica cifrado no cofre do banco.
import { BlocoCredenciais, type CampoCred } from './BlocoCredenciais'
import { chamarNotificacao } from './chamar'

const CAMPOS: CampoCred[] = [
  { k: 'client_id', r: 'Client ID', d: 'Inter Empresas → Integrar → a integração criada' },
  { k: 'client_secret', r: 'Client Secret', d: 'Aparece junto do Client ID', secreto: true },
  { k: 'certificado', r: 'Certificado (.crt)', d: 'Do .zip baixado na criação da integração (descompacte antes)', arquivo: '.crt,.pem,.cer' },
  { k: 'chave_privada', r: 'Chave (.key)', d: 'Do mesmo .zip', arquivo: '.key,.pem' },
  { k: 'conta', r: 'Conta corrente (opcional)', d: 'Só se a integração tiver mais de uma conta: número com o dígito', opcional: true },
]

const testar = async () => {
  const i = (await chamarNotificacao({ acao: 'testar' }))?.inter
  if (!i?.ok) throw new Error(i?.erro ?? 'Não consegui falar com o Inter.')
  return 'O Inter aceitou a integração.'
}
const ativarAviso = async () => {
  await chamarNotificacao({ acao: 'inter_aviso' })
  return 'Pronto: quando alguém pagar o boleto, o Inter avisa o sistema e a cobrança fecha sozinha.'
}

export const InterBanco = () => (
  <BlocoCredenciais integracao="inter" titulo="Boleto com Pix (Banco Inter)" campos={CAMPOS}
    acoes={[{ rotulo: 'Testar o Inter', fazer: testar }, { rotulo: 'Ativar aviso de pagamento', fazer: ativarAviso }]}
    rodape={<p className="muted pequeno">O boleto sai no valor já com multa e juros até o dia do envio e vence no prazo da carta. O Inter exige o endereço completo de quem vai pagar: quem não tem fica em “sem endereço”.</p>} />
)
