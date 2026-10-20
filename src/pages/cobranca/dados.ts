// Cobrança pelo sistema: contas da Hotmart (para filtrar o online), as cobranças passadas para as vendedoras, o
// registro de cada contato e a mensagem pronta do WhatsApp. A vendedora só vê as cobranças passadas para ela.
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { whatsLink } from '../../lib/format'

export type ContaHotmart = { id: string; nome: string }
export type SituacaoCobranca = 'aberta' | 'prometeu' | 'negociando' | 'sem_resposta' | 'nao_vai_pagar' | 'paga' | 'encerrada'
export type Cobranca = {
  id: string; origem: 'online' | 'presencial'; chave: string; integracao_id: string | null; aluno_nome: string | null; email: string | null; telefone: string | null
  produto: string | null; valor_vencido: number | null; cobrancas_vencidas: number | null; venceu_em: string | null; responsavel_id: string | null
  situacao: SituacaoCobranca; promessa_em: string | null; ultimo_contato_em: string | null; criado_em: string
}
export type Contato = { id: string; cobranca_id: string; canal: string; resultado: string | null; observacao: string | null; quem_nome: string | null; criado_em: string }
// o que identifica uma compra parcelada do online (a mesma chave usada no banco para saber quando voltou a pagar)
export type CompraChave = { em: string; produto_id: number | null; oferta_codigo: string | null; np: number }

export const SITUACAO_COBRANCA: Record<SituacaoCobranca, { rotulo: string; tom: string }> = {
  aberta: { rotulo: 'A cobrar', tom: 'alerta' }, prometeu: { rotulo: 'Prometeu pagar', tom: 'info' }, negociando: { rotulo: 'Negociando', tom: 'info' },
  sem_resposta: { rotulo: 'Sem resposta', tom: 'alerta' }, nao_vai_pagar: { rotulo: 'Não vai pagar', tom: 'erro' }, paga: { rotulo: 'Pagou', tom: 'ok' }, encerrada: { rotulo: 'Encerrada', tom: 'neutro' },
}
export const ABERTAS: SituacaoCobranca[] = ['aberta', 'prometeu', 'negociando', 'sem_resposta']

export const chaveOnline = (c: CompraChave) => `${c.em}|${c.produto_id ?? ''}|${c.oferta_codigo ?? ''}|${c.np}`
export const nomeCurtoConta = (nome: string) => nome.replace(/^Hotmart\s*[—-]\s*/i, '')

export const useContasHotmart = () => useConsulta<ContaHotmart[]>(() => supabase.from('integracoes').select('id,nome').eq('tipo', 'hotmart').order('ordem'), [])
export const useCobrancas = () => useConsulta<Cobranca[]>(() => supabase.from('cobrancas').select('*').order('atualizado_em', { ascending: false }).limit(500), [])
export const useContatos = (cobrancaId: string | null) => useConsulta<Contato[]>(() => supabase.from('cobranca_contatos').select('*').eq('cobranca_id', cobrancaId ?? '').order('criado_em', { ascending: false }), [cobrancaId])

// telefone de cada e-mail, pelo CRM (todos os contatos do CRM guardam o e-mail em minúsculas)
export async function telefonesPorEmail(emails: string[]) {
  const mapa = new Map<string, string>()
  const lista = [...new Set(emails.map((e) => e.toLowerCase()))]
  for (let i = 0; i < lista.length; i += 100) {
    const { data } = await supabase.from('crm_contatos').select('telefone,emails').overlaps('emails', lista.slice(i, i + 100)).not('telefone', 'is', null)
    for (const c of (data ?? []) as { telefone: string; emails: string[] }[]) for (const e of c.emails ?? []) if (!mapa.has(e)) mapa.set(e, c.telefone)
  }
  return mapa
}

type NovaCobranca = Pick<Cobranca, 'chave' | 'integracao_id' | 'aluno_nome' | 'email' | 'telefone' | 'produto' | 'valor_vencido' | 'cobrancas_vencidas' | 'venceu_em'>

// cria a cobrança (só o administrador) ou troca a responsável da que já está aberta
export async function passarCobranca(existente: Cobranca | null, nova: NovaCobranca, responsavel: string | null, quemNome: string) {
  let id = existente?.id
  if (id) {
    const { error } = await supabase.from('cobrancas').update({ responsavel_id: responsavel, atualizado_em: new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { data, error } = await supabase.from('cobrancas').insert({ ...nova, origem: 'online', responsavel_id: responsavel }).select('id').single()
    if (error) throw new Error(error.message)
    id = data.id
  }
  await supabase.from('cobranca_contatos').insert({ cobranca_id: id, canal: 'sistema', resultado: responsavel ? 'Cobrança passada para a vendedora' : 'Cobrança sem responsável', quem_nome: quemNome })
  return id as string
}

export type Registro = { canal: string; resultado: string; observacao?: string; situacao?: SituacaoCobranca; promessa_em?: string | null }
export async function registrarContato(cobrancaId: string, r: Registro, quemNome: string) {
  const agora = new Date().toISOString()
  const { error } = await supabase.from('cobranca_contatos').insert({ cobranca_id: cobrancaId, canal: r.canal, resultado: r.resultado, observacao: r.observacao?.trim() || null, quem_nome: quemNome })
  if (error) throw new Error(error.message)
  const campos: Record<string, unknown> = { ultimo_contato_em: agora, atualizado_em: agora }
  if (r.situacao) campos.situacao = r.situacao
  if (r.promessa_em !== undefined) campos.promessa_em = r.promessa_em
  const { error: e2 } = await supabase.from('cobrancas').update(campos).eq('id', cobrancaId)
  if (e2) throw new Error(e2.message)
}

const primeiroNome = (nome: string | null) => (nome ?? '').trim().split(/\s+/)[0]?.replace(/^./, (l) => l.toUpperCase()) ?? ''

// mensagem pronta (a vendedora pode mudar antes de mandar)
export function mensagemCobranca(c: { aluno_nome: string | null; produto: string | null; cobrancas_vencidas: number | null }, eu: string, marca: string) {
  const n = Number(c.cobrancas_vencidas ?? 1)
  return `Oi, ${primeiroNome(c.aluno_nome)}! Tudo bem? Aqui é ${eu.split(' ')[0]}, da ${marca}. Vi que ${n > 1 ? `${n} cobranças` : 'a cobrança'} do ${c.produto ?? 'seu curso'} não ${n > 1 ? 'passaram' : 'passou'} na Hotmart. Aconteceu alguma coisa com o cartão? Se quiser, te ajudo a regularizar agora para você não perder o acesso.`
}
export const linkWhatsComTexto = (telefone: string | null, texto: string) => { const l = whatsLink(telefone); return l ? `${l}?text=${encodeURIComponent(texto)}` : null }
