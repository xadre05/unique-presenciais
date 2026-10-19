// Automações de comentário → direct: leitura e gravação das regras (marca_automacoes), o registro do que foi enviado
// (marca_automacao_envios) e as ações que passam pela função do Instagram (verificar agora, avisos instantâneos).
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { acaoInstagram } from '../instagram/dados'

export type Alvo = 'todos' | 'post' | 'peca'
export type Destino = 'nenhum' | 'link' | 'arquivo' | 'whatsapp'
export type Automacao = {
  id: string; nome: string; ativa: boolean; alvo: Alvo; media_id: string | null; peca_id: string | null; palavras: string[]
  qualquer_comentario: boolean; respostas_publicas: string[]; mensagem: string; link: string | null; desde: string; criado_em: string
  destino: Destino; arquivo_caminho: string | null; arquivo_nome: string | null; whatsapp_modo: 'reveza' | 'numero'
  whatsapp_numero: string | null; whatsapp_texto: string | null; vendedoras: string[]
}
export type NovaAutomacao = Omit<Automacao, 'id' | 'desde' | 'criado_em' | 'ativa'>
export type Envio = {
  id: string; automacao_id: string | null; comentario_id: string; usuario: string | null; texto: string | null; status: 'enviando' | 'enviado' | 'erro'; erro: string | null
  respondeu_em_publico: boolean; via: 'leitura' | 'aviso'; criado_em: string; cliques: number; clicou_em: string | null; vendedora_id: string | null
}
export type Vendedora = { id: string; nome: string; whatsapp: string | null }
export type PostAlvo = { externo_id: string; tipo: string; legenda: string | null; miniatura: string | null; publicado_em: string; link: string | null; peca_id: string | null }
export type PecaAlvo = { id: string; titulo: string; dia: string | null; tipo: string; status: string }

export const NOME_ALVO: Record<Alvo, string> = { post: 'Um post publicado', peca: 'Uma peça do agente', todos: 'Qualquer post dos últimos 7 dias' }
export const NOME_DESTINO: Record<Destino, string> = { nenhum: 'Só a mensagem', link: 'Um link', arquivo: 'Um arquivo (PDF)', whatsapp: 'Conversa no WhatsApp' }
const COLUNAS = 'id,nome,ativa,alvo,media_id,peca_id,palavras,qualquer_comentario,respostas_publicas,mensagem,link,desde,criado_em,destino,arquivo_caminho,arquivo_nome,whatsapp_modo,whatsapp_numero,whatsapp_texto,vendedoras'

export const useAutomacoes = (empresa: string) => useConsulta<Automacao[]>(() => supabase.from('marca_automacoes')
  .select(COLUNAS)
  .eq('empresa_id', empresa).eq('rede', 'instagram').order('criado_em', { ascending: false }), [empresa])

export const useEnvios = (empresa: string) => useConsulta<Envio[]>(() => supabase.from('marca_automacao_envios')
  .select('id,automacao_id,comentario_id,usuario,texto,status,erro,respondeu_em_publico,via,criado_em,cliques,clicou_em,vendedora_id')
  .eq('empresa_id', empresa).order('criado_em', { ascending: false }).limit(60), [empresa])

export const usePostsRecentes = (empresa: string) => useConsulta<PostAlvo[]>(() => supabase.from('marca_posts')
  .select('externo_id,tipo,legenda,miniatura,publicado_em,link,peca_id').eq('empresa_id', empresa).eq('rede', 'instagram')
  .order('publicado_em', { ascending: false }).limit(30), [empresa])

// peças do agente para o Instagram que ainda vão ou já foram para o ar (a automação vale quando forem publicadas)
export const usePecasAlvo = (empresa: string) => useConsulta<PecaAlvo[]>(() => supabase.from('agentes_pecas')
  .select('id,titulo,dia,tipo,status').eq('empresa_id', empresa).eq('agente_id', 'marketing').in('status', ['rascunho', 'aprovada', 'postada'])
  .or('conteudo->>rede.is.null,conteudo->>rede.eq.instagram').order('dia', { ascending: false }).limit(60), [empresa])

// palavras digitadas separadas por vírgula ou quebra de linha, sem repetir
export const palavrasDe = (texto: string) => [...new Set(texto.split(/[,\n]/).map((p) => p.trim()).filter(Boolean))].slice(0, 10)

export async function salvarAutomacao(empresa: string, a: NovaAutomacao, id?: string) {
  const linha = { ...a, link: a.link?.trim() || null, mensagem: a.mensagem.trim(), nome: a.nome.trim(), atualizado_em: new Date().toISOString() }
  const { error } = id
    ? await supabase.from('marca_automacoes').update(linha).eq('id', id)
    : await supabase.from('marca_automacoes').insert({ ...linha, empresa_id: empresa, rede: 'instagram' })
  if (error) throw new Error(error.message)
}

export async function ligarAutomacao(id: string, ativa: boolean) {
  // religar vale só para comentários feitos a partir de agora
  const { error } = await supabase.from('marca_automacoes').update({ ativa, ...(ativa ? { desde: new Date().toISOString() } : {}), atualizado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function excluirAutomacao(id: string) {
  const { error } = await supabase.from('marca_automacoes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const verificarAgora = (empresa: string) => acaoInstagram<{ posts: number; enviados: number }>(empresa, 'automacoes_agora')
export const prepararAviso = (empresa: string) => acaoInstagram<{ endereco: string; codigo: string; ultimo_aviso: string | null }>(empresa, 'aviso_preparar')
export const assinarAvisos = (empresa: string) => acaoInstagram<{ success?: boolean }>(empresa, 'aviso_assinar')

// vendedoras ativas (com o WhatsApp que recebe as conversas do revezamento)
export const useVendedoras = () => useConsulta<Vendedora[]>(() => supabase.from('vendedoras').select('id,nome,whatsapp').eq('ativa', true).order('nome'), [])

export async function salvarWhatsappVendedora(id: string, whatsapp: string) {
  const { error } = await supabase.from('vendedoras').update({ whatsapp: whatsapp.trim() || null }).eq('id', id)
  if (error) throw new Error(error.message)
}

export const digitosWhatsapp = (t: string) => { const d = t.replace(/\D/g, ''); return d.length === 10 || d.length === 11 ? `55${d}` : d }
export const whatsappValido = (t: string | null | undefined) => digitosWhatsapp(t ?? '').length >= 12

// PDF que a pessoa recebe: fica no armazenamento privado; o link entregue é temporário, gerado no clique
export async function enviarArquivo(empresa: string, arquivo: File) {
  if (arquivo.size > 10 * 1024 * 1024) throw new Error('O arquivo passa de 10 MB.')
  const caminho = `automacoes/${empresa}/${crypto.randomUUID()}-${arquivo.name.replace(/[^\w.-]+/g, '_').slice(-60)}`
  const { error } = await supabase.storage.from('arquivos').upload(caminho, arquivo, { contentType: arquivo.type || 'application/pdf' })
  if (error) throw new Error(error.message)
  return caminho
}

// como a mensagem chega: o texto e, quando há destino, o link rastreado (um por pessoa)
export function previaMensagem(mensagem: string, comLink: boolean) {
  return [mensagem.replace(/\{nome\}/g, '@seguidora').trim(), comLink ? 'https://…/instagram?ir=a1b2c3d4' : ''].filter(Boolean).join('\n\n')
}
