// CRM — WhatsApp: modelos aprovados pela Meta (só API oficial). Texto livre só sai até 24 h depois da última mensagem
// da pessoa; fora disso (ou para começar conversa) precisa de um modelo aprovado. Aqui: puxar os modelos da conta e criar novos.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { graph, type Canal, type Segredos } from './conectores.ts'

const waba = (canal: Canal) => {
  const id = String(canal.config.waba_id ?? '')
  if (!id) throw new Error(`Falta o ID da conta do WhatsApp (WABA) no número "${canal.nome}" (Configurações → Números).`)
  return id
}

export async function sincronizarModelos(db: SupabaseClient, canal: Canal, seg: Segredos) {
  const d = await graph(seg.segredos.token ?? '', `${waba(canal)}/message_templates?fields=id,name,language,status,category,components,rejected_reason&limit=200`)
  const linhas = ((d.data ?? []) as any[]).map((t) => ({
    empresa_id: canal.empresa_id, canal_id: canal.id, nome: t.name, idioma: t.language, categoria: t.category, status: t.status,
    motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null, meta_id: t.id,
    corpo: String((t.components ?? []).find((c: any) => c.type === 'BODY')?.text ?? ''), atualizado_em: new Date().toISOString(),
  }))
  if (linhas.length) {
    const { error } = await db.from('crm_modelos').upsert(linhas, { onConflict: 'canal_id,nome,idioma' })
    if (error) throw new Error(error.message)
  }
  return linhas.length
}

// nome: só letras minúsculas, números e _ (regra da Meta). Variáveis no texto: {{1}}, {{2}}… com um exemplo para cada.
export async function criarModelo(db: SupabaseClient, canal: Canal, seg: Segredos, m: { nome: string; categoria: string; corpo: string; exemplo: string[] }) {
  const nome = m.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
  if (!nome) throw new Error('Dê um nome ao modelo.')
  const vars = [...new Set([...m.corpo.matchAll(/\{\{(\d+)\}\}/g)].map((x) => Number(x[1])))].sort((a, b) => a - b)
  if (vars.some((n, i) => n !== i + 1)) throw new Error('As variáveis precisam ser {{1}}, {{2}}, {{3}}… em sequência.')
  if (m.exemplo.filter((x) => x.trim()).length < vars.length) throw new Error('Preencha um exemplo para cada variável.')
  const corpo = { name: nome, language: 'pt_BR', category: m.categoria, components: [{ type: 'BODY', text: m.corpo, ...(vars.length ? { example: { body_text: [m.exemplo.slice(0, vars.length)] } } : {}) }] }
  const d = await graph(seg.segredos.token ?? '', `${waba(canal)}/message_templates`, 'POST', corpo)
  const { error } = await db.from('crm_modelos').upsert({ empresa_id: canal.empresa_id, canal_id: canal.id, nome, idioma: 'pt_BR', categoria: d.category ?? m.categoria, corpo: m.corpo,
    exemplo: m.exemplo, status: d.status ?? 'PENDING', meta_id: d.id, atualizado_em: new Date().toISOString() }, { onConflict: 'canal_id,nome,idioma' })
  if (error) throw new Error(error.message)
  return { nome, status: d.status ?? 'PENDING' }
}

/** O texto do modelo com as variáveis preenchidas (é o que fica gravado na conversa). */
export const textoDoModelo = (corpo: string, parametros: string[]) => corpo.replace(/\{\{(\d+)\}\}/g, (m, n) => parametros[Number(n) - 1] ?? m)
