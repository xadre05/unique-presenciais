// Acesso aos dados da Biblioteca da marca: fontes (arquivos, textos, conversas com o tutor) e trechos pesquisáveis.
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { dividirEmTrechos, type TipoFonte } from './lerArquivo'

// aprovada: o agente usa como fonte; a validar: fica guardada, mas fora das buscas até alguém revisar
export type Fonte = { id: string; tipo: string; titulo: string; origem: string | null; status: string; erro: string | null; caracteres: number; trechos: number; criado_em: string; aprovada: boolean }
export type Achado = { trecho_id: string; fonte_id: string; fonte_titulo: string; fonte_tipo: string; conteudo: string; relevancia: number }

export function useFontes(empresa: string) {
  return useConsulta<Fonte[]>(() => supabase.from('marca_fontes').select('id,tipo,titulo,origem,status,erro,caracteres,trechos,criado_em,aprovada')
    .eq('empresa_id', empresa).eq('ativo', true).order('criado_em', { ascending: false }), [empresa])
}

// cria a fonte, grava os trechos em lotes e só então marca como pronta (a busca ignora fonte ainda processando)
export async function guardarTexto(empresa: string, titulo: string, tipo: TipoFonte, texto: string, origem?: string, aprovada = true) {
  const trechos = dividirEmTrechos(texto)
  if (!trechos.length) throw new Error('Não encontrei texto neste arquivo. Se for um PDF escaneado (imagem), ele precisa ter o texto selecionável.')
  const { data: fonte, error } = await supabase.from('marca_fontes').insert({ empresa_id: empresa, titulo: titulo.trim() || 'Sem título', tipo, origem, status: 'processando', aprovada }).select('id').single()
  if (error) throw new Error(msgErro(error))
  try {
    for (let i = 0; i < trechos.length; i += 100) {
      const lote = trechos.slice(i, i + 100).map((conteudo, j) => ({ fonte_id: fonte.id, empresa_id: empresa, ordem: i + j, conteudo }))
      const { error: e } = await supabase.from('marca_trechos').insert(lote)
      if (e) throw new Error(msgErro(e))
    }
    await supabase.rpc('marca_fonte_contar', { p_fonte: fonte.id })
    await supabase.from('marca_fontes').update({ status: 'pronta' }).eq('id', fonte.id)
    return trechos.length
  } catch (e) {
    await supabase.from('marca_fontes').update({ status: 'erro', erro: e instanceof Error ? e.message : 'Falhou ao guardar.' }).eq('id', fonte.id)
    throw e
  }
}

export const tirarFonte = (id: string) => supabase.from('marca_fontes').update({ ativo: false }).eq('id', id)

export async function buscar(empresa: string, consulta: string, limite = 5) {
  const { data, error } = await supabase.rpc('marca_buscar', { p_empresa: empresa, p_consulta: consulta, p_limite: limite })
  if (error) throw new Error(msgErro(error))
  return (data ?? []) as Achado[]
}

export async function aprovarFonte(id: string, aprovada: boolean) {
  const { error } = await supabase.from('marca_fontes').update({ aprovada }).eq('id', id)
  if (error) throw new Error(msgErro(error))
}

// o texto inteiro de uma fonte, juntando os trechos na ordem (para revisar)
export async function textoDaFonte(id: string) {
  const { data, error } = await supabase.from('marca_trechos').select('conteudo').eq('fonte_id', id).order('ordem').limit(2000)
  if (error) throw new Error(msgErro(error))
  return (data ?? []).map((t) => t.conteudo as string).join('\n\n')
}

// texto corrigido na revisão: vira uma fonte nova (já aprovada ou não) e a antiga sai da biblioteca
export async function substituirFonte(empresa: string, antiga: Fonte, titulo: string, texto: string, aprovada: boolean) {
  await guardarTexto(empresa, titulo, antiga.tipo as TipoFonte, texto, antiga.origem ?? undefined, aprovada)
  await tirarFonte(antiga.id)
}
