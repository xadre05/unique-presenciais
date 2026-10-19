// Acesso aos dados da Biblioteca da marca: fontes (arquivos, textos, conversas com o tutor) e trechos pesquisáveis.
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { dividirEmTrechos, type TipoFonte } from './lerArquivo'

export type Fonte = { id: string; tipo: string; titulo: string; origem: string | null; status: string; erro: string | null; caracteres: number; trechos: number; criado_em: string }
export type Achado = { trecho_id: string; fonte_id: string; fonte_titulo: string; fonte_tipo: string; conteudo: string; relevancia: number }

export function useFontes(empresa: string) {
  return useConsulta<Fonte[]>(() => supabase.from('marca_fontes').select('id,tipo,titulo,origem,status,erro,caracteres,trechos,criado_em')
    .eq('empresa_id', empresa).eq('ativo', true).order('criado_em', { ascending: false }), [empresa])
}

// cria a fonte, grava os trechos em lotes e só então marca como pronta (a busca ignora fonte ainda processando)
export async function guardarTexto(empresa: string, titulo: string, tipo: TipoFonte, texto: string, origem?: string) {
  const trechos = dividirEmTrechos(texto)
  if (!trechos.length) throw new Error('Não encontrei texto neste arquivo. Se for um PDF escaneado (imagem), ele precisa ter o texto selecionável.')
  const { data: fonte, error } = await supabase.from('marca_fontes').insert({ empresa_id: empresa, titulo: titulo.trim() || 'Sem título', tipo, origem, status: 'processando' }).select('id').single()
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
