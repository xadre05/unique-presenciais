// Vídeo sem gravar: a narração de IA (ElevenLabs) faz o papel do vídeo bruto. Fica guardada na nuvem (arquivos) e
// volta sozinha quando o Estúdio abre; as palavras já vêm com o tempo exato, então não há transcrição a pagar.
import { supabase } from '../../../../lib/supabase'
import { criarVideo } from '../dados'
import { deixarArquivo } from '../arquivoPendente'
import { narrar } from '../ia/servicos'

export type Narracao = { caminho: string; nome: string }

export async function baixarNarracao(n: Narracao): Promise<File | null> {
  const { data } = await supabase.storage.from('arquivos').download(n.caminho)
  return data ? new File([data], n.nome, { type: 'audio/mpeg' }) : null
}

// US$ 0,0003 por caractere (plano pago da ElevenLabs), câmbio aproximado de R$ 5,60
export const custoNarracao = (texto: string) => texto.trim().length * 0.0003 * 5.6

export type Previa = { caminho: string; palavras: { p: string; i: number; f: number }[]; duracao: number; arquivo: File; url: string }

export async function gerarNarracao(texto: string, voz: string): Promise<Previa> {
  const r = await narrar(texto, voz)
  const arquivo = await baixarNarracao({ caminho: r.caminho, nome: `narracao-${Date.now()}.mp3` })
  if (!arquivo) throw new Error('A narração foi gerada, mas não consegui baixá-la. Tente de novo.')
  return { ...r, arquivo, url: URL.createObjectURL(arquivo) }
}

export async function criarVideoSemGravar(o: { titulo: string; finalidade: 'anuncio' | 'organico'; campanha?: string; texto: string; voz: string }, p: Previa) {
  const r = await criarVideo({ titulo: o.titulo, finalidade: o.finalidade, campanha: o.campanha, roteiro: o.texto }, {
    narracao: { caminho: p.caminho, nome: p.arquivo.name, voz: o.voz },
    edicao: { arquivo: { nome: p.arquivo.name, tamanho: p.arquivo.size, duracao: p.duracao }, palavras: p.palavras, atualizado_em: new Date().toISOString() },
  })
  if (r.erro || !r.id) throw new Error(r.erro ?? 'Não consegui criar o vídeo.')
  deixarArquivo(r.id, p.arquivo)
  return r.id
}
