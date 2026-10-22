// De onde sai o e-mail da notificação: o Gmail da empresa (Google Workspace). Usuário que entra no Gmail, a senha de app
// dele e o remetente liberado em "Enviar e-mail como".
import { BlocoCredenciais, type CampoCred } from './BlocoCredenciais'
import { chamarNotificacao } from './chamar'

const CAMPOS: CampoCred[] = [
  { k: 'usuario', r: 'Usuário do Gmail', d: 'O e-mail que faz login (o dono do apelido de cobrança), ex.: administracao@suaempresa.com.br', exemplo: 'administracao@uniquehofacademy.com.br' },
  { k: 'senha_app', r: 'Senha de app', d: 'As 16 letras de myaccount.google.com/apppasswords (com ou sem espaços)', secreto: true },
  { k: 'remetente', r: 'Remetente', d: 'Nome e e-mail que o aluno vê, já liberado em "Enviar e-mail como"', exemplo: 'Unique HOF Academy - Cobrança <cobranca@uniquehofacademy.com.br>' },
]

const testar = async () => {
  const e = (await chamarNotificacao({ acao: 'testar' }))?.email
  if (!e?.ok) throw new Error(e?.erro ?? 'Não consegui testar.')
  return `Funcionou: o teste saiu de ${e.remetente} para ${e.para} (no Gmail, aparece em Enviados).`
}

export const EmailEnvio = () => <BlocoCredenciais integracao="email" titulo="E-mail de envio" campos={CAMPOS} acoes={[{ rotulo: 'Enviar e-mail de teste', fazer: testar }]} />
