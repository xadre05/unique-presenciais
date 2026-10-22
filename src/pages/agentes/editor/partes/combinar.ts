// Cabeça, corpo e cauda: quem grava várias aberturas (ganchos) e vários finais (chamadas) multiplica os criativos.
// Cada combinação abertura × final, com o mesmo conteúdo no meio, vira um vídeo novo no Editor, já com a fala pronta.
import type { ArquivoBruto, Edicao } from '../../marketing/edicao/dados'
import type { Peca } from '../../comum'
import { criarVideo } from '../dados'
import { deixarPartes } from '../arquivoPendente'
import { juntarVideos } from './juntar'
import { infoDa, juntarPalavras, nomeDoJuntado, type Parte } from './dados'

export type Combinacao = { indices: number[]; rotulo: string }
const MAXIMO = 20

// as aberturas e os finais entram na ordem da lista; o conteúdo do meio segue a ordem montada (ou a da lista)
export function combinacoes(partes: Parte[], ordem: number[]): Combinacao[] {
  const validas = partes.map((_, k) => k).filter((k) => !partes[k].fora)
  const ganchos = validas.filter((k) => partes[k].papel === 'gancho')
  const finais = validas.filter((k) => partes[k].papel === 'chamada')
  if (ganchos.length < 2 && finais.length < 2) return []
  const naOrdem = ordem.filter((k) => partes[k].papel === 'corpo')
  const corpo = naOrdem.length ? naOrdem : validas.filter((k) => partes[k].papel === 'corpo')
  const lista: Combinacao[] = []
  for (const [i, g] of (ganchos.length ? ganchos : [-1]).entries()) {
    for (const [j, f] of (finais.length ? finais : [-1]).entries()) {
      const indices = [g, ...corpo, f].filter((k) => k >= 0)
      const rotulo = [ganchos.length > 1 ? `Abertura ${i + 1}` : '', finais.length > 1 ? `Final ${j + 1}` : ''].filter(Boolean).join(' · ')
      lista.push({ indices, rotulo })
    }
  }
  return lista.slice(0, MAXIMO)
}

type Opcoes = { peca: Peca; partes: Parte[]; combos: Combinacao[]; aoProgresso: (texto: string) => void }

// cria um vídeo para cada combinação: junta as partes só para saber o tamanho exato (o vídeo não fica guardado)
// e deixa as partes escolhidas na memória da página, para o vídeo novo abrir com elas
export async function criarCriativos({ peca, partes, combos, aoProgresso }: Opcoes) {
  const c = peca.conteudo as { campanha?: string; roteiro?: string[]; briefing?: { finalidade?: 'anuncio' | 'organico' } }
  const criados: string[] = []
  for (const [n, combo] of combos.entries()) {
    const titulo = `${peca.titulo} · ${combo.rotulo}`
    const escolhidas = combo.indices.map((k) => partes[k])
    aoProgresso(`Montando o criativo ${n + 1} de ${combos.length}…`)
    const { arquivo, duracoes } = escolhidas.length > 1
      ? await juntarVideos(escolhidas.map((p) => p.arquivo), nomeDoJuntado(titulo))
      : { arquivo: escolhidas[0].arquivo, duracoes: [escolhidas[0].duracao ?? 0] }
    const infos: ArquivoBruto[] = escolhidas.map((p, k) => ({ ...infoDa(p), duracao: duracoes[k] }))
    const edicao: Edicao = { arquivo: { nome: arquivo.name, tamanho: arquivo.size, duracao: duracoes.reduce((s, d) => s + d, 0) }, palavras: juntarPalavras(escolhidas, duracoes), partes: infos }
    const r = await criarVideo({ titulo, finalidade: c.briefing?.finalidade ?? 'anuncio', campanha: c.campanha, roteiro: (c.roteiro ?? []).join('\n\n') }, { edicao, criativo_de: peca.id })
    if (r.erro || !r.id) throw new Error(r.erro ?? 'Não consegui criar o vídeo.')
    deixarPartes(r.id, partes.map((p) => p.arquivo))
    criados.push(r.id)
  }
  return criados
}
