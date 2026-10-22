// E-mail da notificação: sai pelo Gmail da empresa (Google Workspace), com a senha de app de um usuário e o remetente
// configurado em "Enviar e-mail como" (ex.: Unique HOF Academy - Cobrança <cobranca@...>). Porta 465 (SSL): as funções
// do Supabase não abrem a 587. O número da mensagem (Message-ID) fica no histórico como prova do envio.
import nodemailer from 'npm:nodemailer@6.9.16'

export type CredEmail = Record<string, string>

export const emailPronto = (c: CredEmail) => !!(c.usuario && c.senha_app && c.remetente)

export async function enviarEmail(c: CredEmail, para: string, assunto: string, texto: string, responderPara: string | null) {
  if (!emailPronto(c)) throw new Error('E-mail: falta o usuário, a senha de app ou o remetente em Integrações.')
  const envio = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: c.usuario.trim(), pass: c.senha_app.replace(/\s+/g, '') } })
  try {
    const r = await envio.sendMail({ from: c.remetente, to: para, subject: assunto, text: texto, ...(responderPara ? { replyTo: responderPara } : {}) })
    return String(r.messageId ?? '')
  } catch (e) {
    const msg = (e as Error).message
    throw new Error(/535|auth|credential|password|Username/i.test(msg) ? 'E-mail: o Gmail recusou o usuário ou a senha de app.' : `E-mail: ${msg}`)
  } finally { envio.close() }
}
