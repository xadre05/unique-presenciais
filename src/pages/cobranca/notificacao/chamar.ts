// chama a função da notificação e devolve a mensagem de erro dela (quando houver)
import { supabase } from '../../../lib/supabase'

export async function chamarNotificacao(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('notificacao', { body: corpo })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data
}
