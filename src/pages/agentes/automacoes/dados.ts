// Automações de comentário → direct: leitura e gravação das regras (marca_automacoes), o registro do que foi enviado
// (marca_automacao_envios) e as ações que passam pela função do Instagram (verificar agora, avisos instantâneos).
import { supabase } from '../../../lib/supabase'
import { useConsulta } from '../../../lib/dados'
import { acaoInstagram } from '../instagram/dados'

export type Alvo = 'todos' | 'post' | 'peca'
export type Automacao = {
  id: string; nome: string; ativa: boolean; alvo: Alvo; media_id: string | null; peca_id: string | null; palavras: string[]
  qualquer_comentario: boolean; respostas_publicas: string[]; mensagem: string; link: string | null; desde: string; criado_em: string
}
export type NovaAutomacao = Omit<Automacao, 'id' | 'desde' | 'criado_em' | 'ativa'>
export type Envio = { id: string; automacao_id: string | null; comentario_id: string; usuario: string | null; texto: string | null; status: 'enviando' | 'enviado' | 'erro'; erro: string | null; respondeu_em_publico: boolean; via: 'leitura' | 'aviso'; criado_em: string }
export type PostAlvo = { externo_id: string; tipo: string; legenda: string | null; miniatura: string | null; publicado_em: string; link: string | null; peca_id: string | null }
export type PecaAlvo = { id: string; titulo: string; dia: string | null; tipo: string; status: string }

export const NOME_ALVO: Record<Alvo, string> = { post: 'Um post publicado', peca: 'Uma peça do agente', todos: 'Qualquer post dos últimos 7 dias' }

export const useAutomacoes = (empresa: string) => useConsulta<Automacao[]>(() => supabase.from('marca_automacoes')
  .select('id,nome,ativa,alvo,media_id,peca_id,palavras,qualquer_comentario,respostas_publicas,mensagem,link,desde,criado_em')
  .eq('empresa_id', empresa).eq('rede', 'instagram').order('criado_em', { ascending: false }), [empresa])

export const useEnvios = (empresa: string) => useConsulta<Envio[]>(() => supabase.from('marca_automacao_envios')
  .select('id,automacao_id,comentario_id,usuario,texto,status,erro,respondeu_em_publico,via,criado_em')
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

export function previaMensagem(mensagem: string, link: string | null) {
  return [mensagem.replace(/\{nome\}/g, '@seguidora').trim(), link?.trim()].filter(Boolean).join('\n\n')
}
