// Cobrança: a fila de quem deve (online e presencial), o registro de cada contato, o acordo, o que entrou dos acordos e a
// mensagem pronta do WhatsApp. A fila se enche sozinha no banco (de hora em hora); a vendedora só vê o que é dela.
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { whatsLink } from '../../lib/format'

export type ContaHotmart = { id: string; nome: string }
export type Etapa = 'a_contatar' | 'aguardando' | 'negociando' | 'acordo' | 'negativar' | 'negativado' | 'paga' | 'sem_acordo' | 'encerrada'
export type Cobranca = {
  id: string; origem: 'online' | 'presencial'; chave: string; integracao_id: string | null; matricula_id: string | null
  aluno_nome: string | null; email: string | null; telefone: string | null; produto: string | null
  valor_vencido: number | null; cobrancas_vencidas: number | null; valor_restante: number | null
  parou_em: string | null; ultimo_pagamento_em: string | null; negativar_ate: string | null; negativado_em: string | null
  responsavel_id: string | null; etapa: Etapa; promessa_em: string | null; retornar_em: string | null; tentativas: number
  ultimo_contato_em: string | null; acordo_valor: number | null; acordo_forma: string | null; acordo_parcelas: number | null
  acordo_primeiro_venc: string | null; acordo_obs: string | null; acordo_em: string | null; criado_em: string
  fase_legal: string | null; notificado_em: string | null; prazo_ate: string | null; boleto_url: string | null; boleto_valor: number | null; whatsapp_avisado_em: string | null
  boleto_id?: string | null; boleto_principal?: number | null; boleto_encargos?: number | null; notificacao_grupo?: string | null
  conferido_hotmart_em?: string | null; conferido_hotmart_por?: string | null; conferido_hotmart_obs?: string | null
}
export type Contato = { id: string; cobranca_id: string; canal: string; resultado: string | null; observacao: string | null; quem_nome: string | null; criado_em: string }
export type Recebimento = {
  id: string; cobranca_id: string; valor: number; recebido_em: string; forma: string | null; observacao: string | null; informado_nome: string | null
  conferido: boolean; vendedora_id: string | null; comissao_pct: number | null; comissao_valor: number | null; comissao_status: 'pendente' | 'liberada' | 'paga' | null
}

export const ETAPAS: Record<Etapa, { rotulo: string; tom: string }> = {
  a_contatar: { rotulo: 'A contatar', tom: 'alerta' }, aguardando: { rotulo: 'Aguardando resposta', tom: 'neutro' },
  negociando: { rotulo: 'Negociando', tom: 'info' }, acordo: { rotulo: 'Acordo fechado', tom: 'ouro' },
  negativar: { rotulo: 'Enviar para negativação', tom: 'erro' }, negativado: { rotulo: 'Negativado', tom: 'erro' },
  paga: { rotulo: 'Pagou', tom: 'ok' }, sem_acordo: { rotulo: 'Sem acordo', tom: 'neutro' }, encerrada: { rotulo: 'Encerrada', tom: 'neutro' },
}
export const FECHADAS: Etapa[] = ['paga', 'sem_acordo', 'encerrada']
export const aberta = (c: Pick<Cobranca, 'etapa'>) => !FECHADAS.includes(c.etapa)
export const FORMAS_ACORDO: [string, string][] = [['link_hotmart', 'Link novo da Hotmart'], ['pix', 'Pix'], ['boleto', 'Boleto'], ['cartao', 'Cartão'], ['outro', 'Outro']]

// a fila tem uma cobrança por pessoa e produto no online
export const chaveCobrancaOnline = (em: string, produtoId: number | null) => `online|${em}|${produtoId ?? ''}`
export const cobrancaAberta = (lista: Cobranca[] | null, chave: string) => (lista ?? []).find((x) => x.chave === chave && aberta(x)) ?? null
export const nomeCurtoConta = (nome: string) => nome.replace(/^Hotmart\s*[—-]\s*/i, '')

export const useContasHotmart = () => useConsulta<ContaHotmart[]>(() => supabase.from('integracoes').select('id,nome').eq('tipo', 'hotmart').order('ordem'), [])
export const useCobrancas = () => useConsulta<Cobranca[]>(() => supabase.from('cobrancas').select('*').order('parou_em', { ascending: true, nullsFirst: false }).limit(2000), [])
export const useContatos = (cobrancaId: string | null) => useConsulta<Contato[]>(() => supabase.from('cobranca_contatos').select('*').eq('cobranca_id', cobrancaId ?? '').order('criado_em', { ascending: false }), [cobrancaId])
export const useRecebimentos = (cobrancaId?: string) => useConsulta<Recebimento[]>(() => {
  const q = supabase.from('cobranca_recebimentos').select('*').order('recebido_em', { ascending: false })
  return cobrancaId ? q.eq('cobranca_id', cobrancaId) : q
}, [cobrancaId])

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

const falhou = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

// passar várias cobranças para alguém (só o administrador); null tira de quem estava
export async function distribuir(ids: string[], vendedora: string | null) {
  const { data, error } = await supabase.rpc('distribuir_cobrancas', { p_ids: ids, p_vendedora: vendedora })
  falhou(error)
  return Number(data ?? 0)
}

export type Registro = { canal: string; resultado: string; observacao?: string; etapa?: Etapa; promessa_em?: string | null; retornar_em?: string | null }
export async function registrarContato(c: Pick<Cobranca, 'id' | 'etapa' | 'tentativas'>, r: Registro, quemNome: string) {
  const agora = new Date().toISOString()
  const { error } = await supabase.from('cobranca_contatos').insert({ cobranca_id: c.id, canal: r.canal, resultado: r.resultado, observacao: r.observacao?.trim() || null, quem_nome: quemNome })
  falhou(error)
  const campos: Record<string, unknown> = { ultimo_contato_em: agora, atualizado_em: agora }
  if (r.etapa) campos.etapa = r.etapa
  if (r.promessa_em !== undefined) campos.promessa_em = r.promessa_em
  if (r.retornar_em !== undefined) campos.retornar_em = r.retornar_em
  falhou((await supabase.from('cobrancas').update(campos).eq('id', c.id)).error)
}

// mandou mensagem: conta a tentativa e, se ainda não tinha falado, passa para "aguardando resposta"
export async function marcarEnviada(c: Cobranca, texto: string, quemNome: string) {
  await registrarContato(c, { canal: 'whatsapp', resultado: 'Mandei mensagem pelo WhatsApp', observacao: texto, etapa: c.etapa === 'a_contatar' ? 'aguardando' : undefined }, quemNome)
  falhou((await supabase.from('cobrancas').update({ tentativas: c.tentativas + 1 }).eq('id', c.id)).error)
}

export async function mudarCampos(id: string, campos: Partial<Cobranca>) {
  falhou((await supabase.from('cobrancas').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id)).error)
}

export type Acordo = { acordo_valor: number; acordo_forma: string; acordo_parcelas: number; acordo_primeiro_venc: string; acordo_obs: string }
export async function salvarAcordo(c: Cobranca, a: Acordo, quemNome: string) {
  falhou((await supabase.from('cobrancas').update({ ...a, acordo_obs: a.acordo_obs.trim() || null, acordo_em: new Date().toISOString(), etapa: 'acordo', atualizado_em: new Date().toISOString() }).eq('id', c.id)).error)
  const resumo = `Acordo: ${a.acordo_parcelas}x, total ${a.acordo_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, 1º vencimento ${a.acordo_primeiro_venc.split('-').reverse().join('/')}`
  falhou((await supabase.from('cobranca_contatos').insert({ cobranca_id: c.id, canal: 'outro', resultado: resumo, observacao: a.acordo_obs.trim() || null, quem_nome: quemNome })).error)
}

export async function informarRecebimento(cobrancaId: string, r: { valor: number; recebido_em: string; forma: string; observacao: string }, quemNome: string) {
  falhou((await supabase.from('cobranca_recebimentos').insert({ cobranca_id: cobrancaId, ...r, observacao: r.observacao.trim() || null, informado_nome: quemNome })).error)
}
export async function conferirRecebimento(id: string) { falhou((await supabase.rpc('conferir_recebimento_cobranca', { p_id: id })).error) }
export async function mudarComissao(ids: string[], status: 'liberada' | 'paga') {
  falhou((await supabase.from('cobranca_recebimentos').update({ comissao_status: status, ...(status === 'paga' ? { comissao_paga_em: new Date().toISOString().slice(0, 10) } : {}) }).in('id', ids)).error)
}

export const useConfigCobranca = () => useConsulta<{ pct_comissao: number | null }>(() => supabase.from('cobranca_config').select('pct_comissao').single(), [])
export async function salvarPctComissao(pct: number | null) { falhou((await supabase.from('cobranca_config').update({ pct_comissao: pct, atualizado_em: new Date().toISOString() }).eq('id', true)).error) }

const primeiroNome = (nome: string | null) => (nome ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (l) => l.toUpperCase()) ?? ''

// mensagem pronta (a cobradora pode mudar antes de mandar): uma para atraso recente, outra para dívida antiga
export function mensagemCobranca(c: Pick<Cobranca, 'aluno_nome' | 'produto' | 'cobrancas_vencidas' | 'origem' | 'parou_em'>, eu: string, marca: string) {
  const nome = primeiroNome(c.aluno_nome), quem = eu.split(' ')[0], produto = c.produto ?? 'seu curso'
  const meses = c.parou_em ? (Date.now() - new Date(c.parou_em + 'T12:00:00').getTime()) / (30 * 864e5) : 0
  if (c.origem === 'presencial') return `Oi, ${nome}! Tudo bem? Aqui é ${quem}, da ${marca}. Estou passando porque ficou em aberto o pagamento do ${produto}. Consegue regularizar? Se precisar, a gente combina a melhor forma para você.`
  if (meses > 6) return `Oi, ${nome}! Tudo bem? Aqui é ${quem}, da ${marca}. Estou entrando em contato sobre o parcelamento do ${produto}, que ficou com parcelas em aberto. Queremos resolver isso de um jeito bom para você: posso te passar uma condição especial para quitar?`
  const n = Number(c.cobrancas_vencidas ?? 1)
  return `Oi, ${nome}! Tudo bem? Aqui é ${quem}, da ${marca}. Vi que ${n > 1 ? `${n} parcelas` : 'a parcela'} do ${produto} não ${n > 1 ? 'passaram' : 'passou'} na Hotmart. Aconteceu alguma coisa com o cartão? Se quiser, te ajudo a regularizar agora para você não perder o acesso.`
}
export const linkWhatsComTexto = (telefone: string | null, texto: string) => { const l = whatsLink(telefone); return l ? `${l}?text=${encodeURIComponent(texto)}` : null }
