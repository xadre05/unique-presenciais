// O que a IA de cobrança sabe de cada pessoa: as dívidas abertas (achadas pelo telefone), o boleto, o prazo, os limites
// do acordo e a conversa até agora. Tudo vem do banco; a IA não inventa número.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

export type Divida = {
  id: string; produto: string; parou_em: string | null; principal: number; encargos: number; total: number
  boleto_id: string | null; boleto_banco: string | null; boleto_url: string | null; boleto_linha: string | null; boleto_pix: string | null
  prazo_ate: string | null; fase_legal: string | null; notificado_em: string | null; acordo_em: string | null
}
export type Cfg = {
  razao_social: string | null; cnpj: string | null; email_contato: string | null; multa_pct: number; juros_mes_pct: number
  acordo_tira_encargos: boolean; acordo_parcelas_max: number; acordo_prazo_max_dias: number; ia_canal_id: string | null; ia_ligada: boolean
}
export type Contexto = { conversa: string; contato: string; telefone: string; nome: string | null; dividas: Divida[]; historico: { de: 'pessoa' | 'nos'; texto: string; em: string }[] }

const FECHADAS = '(paga,sem_acordo,encerrada)'
const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')
// DDD + 8 últimos dígitos: o mesmo celular com ou sem o 9 e com ou sem o 55
export function chaveTelefone(t: unknown) {
  let d = digitos(t)
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : d
}

export async function config(db: SupabaseClient) {
  const { data } = await db.from('cobranca_config').select('*').eq('id', true).single()
  return data as Cfg
}

export async function dividasDoTelefone(db: SupabaseClient, telefone: string): Promise<Divida[]> {
  const chave = chaveTelefone(telefone)
  if (chave.length < 10) return []
  // o telefone guardado varia (com e sem 9): busca pelos 8 últimos dígitos e confere o DDD
  const { data } = await db.from('cobrancas').select('*').like('telefone', `%${chave.slice(-8)}`).not('etapa', 'in', FECHADAS)
  return ((data ?? []) as Record<string, unknown>[]).filter((c) => chaveTelefone(c.telefone) === chave).map((c) => {
    const principal = Number(c.boleto_principal ?? c.valor_vencido ?? 0)
    return {
      id: String(c.id), produto: String(c.produto ?? 'curso'), parou_em: (c.parou_em as string) ?? null, principal,
      encargos: Number(c.boleto_encargos ?? 0), total: Number(c.boleto_valor ?? principal),
      boleto_id: (c.boleto_id as string) ?? null, boleto_banco: (c.boleto_banco as string) ?? null, boleto_url: (c.boleto_url as string) ?? null,
      boleto_linha: (c.boleto_linha as string) ?? null, boleto_pix: (c.boleto_pix as string) ?? null, prazo_ate: (c.prazo_ate as string) ?? null,
      fase_legal: (c.fase_legal as string) ?? null, notificado_em: (c.notificado_em as string) ?? null, acordo_em: (c.acordo_em as string) ?? null,
    }
  })
}

export async function contexto(db: SupabaseClient, conversaId: string): Promise<Contexto | null> {
  const { data: conv } = await db.from('crm_conversas').select('id, contato_id').eq('id', conversaId).maybeSingle()
  if (!conv) return null
  const { data: contato } = await db.from('crm_contatos').select('nome, telefone').eq('id', conv.contato_id).single()
  const { data: msgs } = await db.from('crm_mensagens').select('direcao, tipo, texto, criado_em').eq('conversa_id', conversaId).order('criado_em', { ascending: false }).limit(30)
  const historico = ((msgs ?? []) as { direcao: string; tipo: string; texto: string | null; criado_em: string }[]).reverse().map((m) => ({
    de: (m.direcao === 'entrada' ? 'pessoa' : 'nos') as 'pessoa' | 'nos', em: m.criado_em,
    texto: m.texto?.trim() || `[enviou ${m.tipo === 'imagem' ? 'uma imagem' : m.tipo === 'documento' ? 'um documento' : m.tipo === 'audio' ? 'um áudio' : 'uma mídia'}]`,
  }))
  return { conversa: conversaId, contato: conv.contato_id, telefone: contato?.telefone ?? '', nome: contato?.nome ?? null, dividas: await dividasDoTelefone(db, contato?.telefone ?? ''), historico }
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

// o que vai para a IA ler (só dados; as regras ficam no sistema)
export function ficha(c: Contexto, cfg: Cfg, hoje: string) {
  const d = c.dividas
  const soma = (f: (x: Divida) => number) => Math.round(d.reduce((s, x) => s + f(x), 0) * 100) / 100
  const b = d.find((x) => x.boleto_id)
  const limite = new Date(new Date(hoje + 'T12:00:00Z').getTime() + cfg.acordo_prazo_max_dias * 864e5).toISOString().slice(0, 10)
  return [
    `HOJE: ${data(hoje)}`,
    `PESSOA: ${c.nome ?? '(sem nome)'} · WhatsApp ${c.telefone}`,
    `CREDORA: ${cfg.razao_social ?? 'Unique HOF Academy'}${cfg.cnpj ? ` (CNPJ ${cfg.cnpj})` : ''} · e-mail para comprovantes: ${cfg.email_contato ?? '—'}`,
    d.length ? `DÍVIDAS EM ABERTO (${d.length}):\n${d.map((x) => `- ${x.produto}: parcelas vencidas sem pagamento desde ${data(x.parou_em)}; valor das parcelas ${brl(x.principal)}${x.encargos ? ` + multa e juros ${brl(x.encargos)}` : ''}${x.notificado_em ? `; notificação extrajudicial enviada em ${data(x.notificado_em)}` : ''}${x.acordo_em ? `; acordo feito em ${data(x.acordo_em)}` : ''}`).join('\n')}` : 'DÍVIDAS EM ABERTO: nenhuma encontrada para este número.',
    d.length ? `TOTAL: parcelas ${brl(soma((x) => x.principal))}; com multa (${cfg.multa_pct}%) e juros (${cfg.juros_mes_pct}% ao mês) ${brl(soma((x) => x.total))}` : '',
    b ? `BOLETO ATUAL: ${brl(soma((x) => (x.boleto_id === b.boleto_id ? x.total : 0)))}, vence ${data(b.prazo_ate)} · link ${b.boleto_url ?? '—'}${b.boleto_linha ? ` · linha digitável ${b.boleto_linha}` : ''}${b.boleto_pix ? ` · Pix copia e cola ${b.boleto_pix}` : ''}` : 'BOLETO ATUAL: nenhum emitido ainda.',
    `LIMITES DO ACORDO: ${cfg.acordo_tira_encargos ? `pode tirar multa e juros (fica ${brl(soma((x) => x.principal))})` : 'não pode tirar multa e juros'}; ${cfg.acordo_parcelas_max > 1 ? `até ${cfg.acordo_parcelas_max} parcelas` : 'sem parcelamento (só à vista)'}; vencimento até ${data(limite)}.`,
  ].filter(Boolean).join('\n')
}
