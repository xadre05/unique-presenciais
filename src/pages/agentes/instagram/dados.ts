// Instagram ligado (Configurações → Integrações): a conexão (marca_conexoes), os posts com métricas (marca_posts) e as ações
// da função instagram (link de login, atualizar, analisar, desligar). Os segredos nunca chegam ao navegador.
import { supabase, SUPABASE_URL } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'

export type Analise = {
  resumo: string; em: string; posts: number; mediana: number
  funcionou: { padrao: string; porque: string; exemplos?: string[] }[]
  nao_funcionou: { padrao: string; porque: string; exemplos?: string[] }[]
  recomendacoes: string[]; aprendizados: string[]; comparacao?: string[]; filtro?: FiltroAnalise
}
export type FiltroAnalise = { de?: string; ate?: string; tipo?: string; periodos?: { nome: string; de: string; ate: string }[] }
export type Conexao = {
  app_id: string | null; status: 'sem_app' | 'pronta' | 'conectado' | 'erro' | 'desligado'
  usuario: string | null; nome: string | null; foto: string | null; seguidores: number | null; publicacoes: number | null
  token_expira_em: string | null; conectado_em: string | null; sincronizado_em: string | null; analise: Analise | null; erro: string | null
}
export type Metricas = { alcance?: number; visualizacoes?: number; curtidas?: number; comentarios?: number; salvos?: number; compartilhamentos?: number; interacoes?: number; visitas_perfil?: number; seguidores_ganhos?: number; tempo_medio_ms?: number }
export type PostIG = { id: string; tipo: string; legenda: string | null; link: string | null; miniatura: string | null; publicado_em: string; metricas: Metricas }

// endereço que o Instagram chama de volta depois do login (tem de estar cadastrado no app da Meta, igualzinho)
export const ENDERECO_RETORNO = `${SUPABASE_URL}/functions/v1/instagram`

export function useConexao(empresa: string) {
  return useConsulta<Conexao | null>(() => supabase.from('marca_conexoes').select('app_id,status,usuario,nome,foto,seguidores,publicacoes,token_expira_em,conectado_em,sincronizado_em,analise,erro')
    .eq('empresa_id', empresa).eq('rede', 'instagram').maybeSingle(), [empresa])
}

export function usePostsInstagram(empresa: string) {
  return useConsulta<PostIG[]>(() => supabase.from('marca_posts').select('id,tipo,legenda,link,miniatura,publicado_em,metricas')
    .eq('empresa_id', empresa).eq('rede', 'instagram').order('publicado_em', { ascending: false }).limit(1500), [empresa])
}

export async function salvarApp(empresa: string, appId: string, segredo: string) {
  const { error } = await supabase.rpc('marca_salvar_app_instagram', { p_empresa: empresa, p_app_id: appId.trim(), p_segredo: segredo.trim() })
  if (error) throw new Error(msgErro(error))
}

type Acao = 'link' | 'sincronizar' | 'historico' | 'analisar' | 'desligar'
export async function acaoInstagram<T = Record<string, unknown>>(empresa: string, acao: Acao, filtro?: FiltroAnalise): Promise<T> {
  // o login do Instagram volta para Configurações → Integrações, onde fica a conexão
  const voltar = `${window.location.origin}/agentes/central?aba=integracoes`
  const { data, error } = await supabase.functions.invoke('instagram', { body: { acao, empresa, voltar, filtro } })
  const d = data as (T & { erro?: string }) | null
  if (error || !d || d.erro) throw new Error(d?.erro ?? 'Não consegui falar com o Instagram agora. Tente de novo.')
  return d
}

// mediana de uma lista de números (0 se vazia)
export function mediana(ns: number[]) {
  const v = ns.filter((n) => n > 0).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : 0
}
export const milhar = (n?: number) => (n == null ? '—' : n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',')} mil` : n.toLocaleString('pt-BR'))

export const NOME_TIPO: Record<string, string> = { reels: 'Reels', carrossel: 'Carrossel', imagem: 'Imagem', video: 'Vídeo' }
export const n = (p: PostIG, k: keyof PostIG['metricas']) => Number(p.metricas[k] ?? 0)
