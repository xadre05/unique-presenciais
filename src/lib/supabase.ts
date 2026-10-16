import { createClient } from '@supabase/supabase-js'

// Chave publicável (pode ficar no navegador; a segurança vem das regras de acesso do banco).
// Um arquivo .env.local com VITE_SUPABASE_URL / VITE_SUPABASE_KEY substitui estes valores.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://gpvxzkmqiikuftbjvncd.supabase.co'
const url = SUPABASE_URL
const key = (import.meta.env.VITE_SUPABASE_KEY as string) || 'sb_publishable_roTrkahpsEOTei0039_vbw_xhMOvZ2s'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})
