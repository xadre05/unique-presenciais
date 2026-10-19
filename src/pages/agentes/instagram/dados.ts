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
export type Origem = 'agente' | 'fora'
export type MarcoFiltro = { nome: string; dia: string; descricao?: string | null }
export type FiltroAnalise = { de?: string; ate?: string; tipo?: string; origem?: Origem; periodos?: { nome: string; de: string; ate: string }[]; marco?: MarcoFiltro }
export type Conexao = {
  app_id: string | null; status: 'sem_app' | 'pronta' | 'conectado' | 'erro' | 'desligado'
  usuario: string | null; nome: string | null; foto: string | null; seguidores: number | null; publicacoes: number | null
  token_expira_em: string | null; conectado_em: string | null; sincronizado_em: string | null; erro: string | null
  revisao_semanal: boolean
}
export type Metricas = { alcance?: number; visualizacoes?: number; curtidas?: number; comentarios?: number; salvos?: number; compartilhamentos?: number; interacoes?: number; visitas_perfil?: number; seguidores_ganhos?: number; tempo_medio_ms?: number }
// origem: 'agente' = veio de uma peça do agente (ligada sozinha ou marcada à mão); vazio ou 'fora' = feito por fora
export type PostIG = { id: string; tipo: string; legenda: string | null; link: string | null; miniatura: string | null; publicado_em: string; metricas: Metricas; origem: Origem | null; peca_id: string | null }
export const origemDe = (p: Pick<PostIG, 'origem'>): Origem => (p.origem === 'agente' ? 'agente' : 'fora')

// endereço que o Instagram chama de volta depois do login (tem de estar cadastrado no app da Meta, igualzinho)
export const ENDERECO_RETORNO = `${SUPABASE_URL}/functions/v1/instagram`

export function useConexao(empresa: string) {
  return useConsulta<Conexao | null>(() => supabase.from('marca_conexoes').select('app_id,status,usuario,nome,foto,seguidores,publicacoes,token_expira_em,conectado_em,sincronizado_em,erro,revisao_semanal')
    .eq('empresa_id', empresa).eq('rede', 'instagram').maybeSingle(), [empresa])
}

export function usePostsInstagram(empresa: string) {
  return useConsulta<PostIG[]>(() => supabase.from('marca_posts').select('id,tipo,legenda,link,miniatura,publicado_em,metricas,origem,peca_id')
    .eq('empresa_id', empresa).eq('rede', 'instagram').order('publicado_em', { ascending: false }).limit(1500), [empresa])
}

export async function salvarApp(empresa: string, appId: string, segredo: string) {
  const { error } = await supabase.rpc('marca_salvar_app_instagram', { p_empresa: empresa, p_app_id: appId.trim(), p_segredo: segredo.trim() })
  if (error) throw new Error(msgErro(error))
}

type Acao = 'link' | 'sincronizar' | 'historico' | 'analisar' | 'revisao_semanal' | 'desligar'
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

// ===== seguidores dia a dia =====
// seguidores: foto do total tirada na leitura (vazio nos dias antes de começar); novos: o que o Instagram informa no dia
export type DiaSeguidores = { dia: string; seguidores: number | null; novos: number | null }

// o Instagram leva uns 2 dias para fechar os novos de um dia (até lá devolve 0); a leitura seguinte corrige.
// Por isso, 0 nos 2 últimos dias conta como "ainda sem número".
export function useSeguidores(empresa: string) {
  return useConsulta<DiaSeguidores[]>(async () => {
    const r = await supabase.from('marca_seguidores').select('dia,seguidores,novos')
      .eq('empresa_id', empresa).eq('rede', 'instagram').order('dia', { ascending: true }).limit(3000)
    const recente = somaDias(hojeBR(), -2)
    return { ...r, data: (r.data ?? []).map((x) => (x.novos === 0 && x.dia >= recente ? { ...x, novos: null } : x)) }
  }, [empresa])
}

// crescimento entre duas datas: a última foto do total antes do início (ou a primeira dentro) contra a última dentro;
// e a soma dos novos que o Instagram informou no intervalo
export function crescimento(h: DiaSeguidores[], de: string, ate: string) {
  const fotos = h.filter((x) => x.seguidores != null)
  const inicio = fotos.filter((x) => x.dia < de).at(-1) ?? fotos.find((x) => x.dia >= de && x.dia <= ate) ?? null
  const fim = fotos.filter((x) => x.dia >= de && x.dia <= ate).at(-1) ?? null
  const comNovos = h.filter((x) => x.novos != null && x.dia >= de && x.dia <= ate)
  return {
    inicio, fim,
    saldo: inicio && fim && inicio.dia !== fim.dia ? Number(fim.seguidores) - Number(inicio.seguidores) : null,
    novos: comNovos.length ? comNovos.reduce((s, x) => s + Number(x.novos ?? 0), 0) : null,
    diasComNovos: comNovos.length,
  }
}

export const comSinal = (v: number) => `${v >= 0 ? '+' : '−'}${milhar(Math.abs(v))}`
export const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)
export const somaDias = (dia: string, dias: number) => new Date(new Date(dia + 'T12:00:00Z').getTime() + dias * 86400000).toISOString().slice(0, 10)

// marca à mão se o post foi feito pelo agente ou por fora (a ligação automática não mexe no que foi marcado à mão)
export async function marcarOrigem(id: string, origem: Origem) {
  const { error } = await supabase.from('marca_posts').update({ origem }).eq('id', id)
  if (error) throw new Error(msgErro(error))
}
