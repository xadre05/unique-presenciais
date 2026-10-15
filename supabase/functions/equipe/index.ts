// Ajustes de conta da equipe feitos pelo administrador (ex.: corrigir e-mail digitado errado).
// Ação: alterar_dados { perfil_id, nome, email }. Só administrador.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: admin } = await usuario.rpc('is_admin')
  if (admin !== true) return json({ erro: 'Só o administrador pode alterar dados da equipe.' }, 403)

  const corpo = await req.json().catch(() => ({}))
  if (corpo.acao !== 'alterar_dados') return json({ erro: 'Ação desconhecida.' }, 400)
  const id = String(corpo.perfil_id ?? '')
  const nome = String(corpo.nome ?? '').trim()
  const email = String(corpo.email ?? '').trim().toLowerCase()
  if (!id || !nome) return json({ erro: 'Informe o nome.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ erro: 'E-mail inválido.' }, 400)

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: atual, error: e0 } = await db.auth.admin.getUserById(id)
  if (e0 || !atual?.user) return json({ erro: 'Conta não encontrada.' }, 404)
  if ((atual.user.email ?? '').toLowerCase() !== email) {
    const { error } = await db.auth.admin.updateUserById(id, { email, email_confirm: true, user_metadata: { ...(atual.user.user_metadata ?? {}), nome } })
    if (error) return json({ erro: /already|registered|exists/i.test(error.message) ? 'Esse e-mail já é de outra conta.' : error.message }, 400)
  }
  // grava no perfil com o login do administrador, para ficar no Histórico com o nome dele
  const { error: e1 } = await usuario.from('perfis').update({ nome, email }).eq('id', id)
  if (e1) return json({ erro: e1.message }, 400)
  await usuario.from('vendedoras').update({ email }).eq('perfil_id', id)
  return json({ ok: true })
})
