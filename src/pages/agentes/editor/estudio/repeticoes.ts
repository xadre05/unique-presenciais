// Tomadas repetidas na fala: a pessoa fala uma frase, não gosta e repete na hora. Procura trechos de 4 palavras que
// voltam a aparecer logo depois (até 40 s) e marca do começo da primeira tentativa até o começo da repetição, que é o
// que deve sair. Vai para o agente como lista pronta, para ele não depender de perceber sozinho.
import type { Palavra } from '../../marketing/edicao/linhaTempo'

const TAM = 4
const JANELA_S = 40
const limpa = (p: string) => p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '')

export type Repeticao = { de: number; ate: number } // números das palavras que saem (inclusive)

export function acharRepeticoes(palavras: Palavra[]): Repeticao[] {
  const t = palavras.map((w) => limpa(w.p))
  const chave = (i: number) => t.slice(i, i + TAM).join(' ')
  const achadas: Repeticao[] = []
  for (let i = 0; i + TAM <= t.length; i++) {
    if (t.slice(i, i + TAM).some((x) => !x)) continue
    const k = chave(i)
    for (let j = i + TAM; j + TAM <= t.length && palavras[j].i - palavras[i].i <= JANELA_S; j++) {
      if (chave(j) !== k) continue
      // sai a primeira tentativa inteira (do começo até onde a repetição começa); pula o resto do trecho repetido
      const desvio = j - i
      achadas.push({ de: i, ate: j - 1 })
      while (i + desvio < t.length && t[i] === t[i + desvio]) i++
      i--
      break
    }
  }
  // junta as que se sobrepõem: várias tentativas seguidas viram um trecho só, até a última tentativa
  const juntas: Repeticao[] = []
  for (const r of achadas.sort((a, b) => a.de - b.de)) {
    const u = juntas[juntas.length - 1]
    if (u && r.de <= u.ate + 1) u.ate = Math.max(u.ate, r.ate)
    else juntas.push({ ...r })
  }
  return juntas
}

export function avisoRepeticoes(palavras: Palavra[]) {
  const r = acharRepeticoes(palavras)
  if (!r.length) return ''
  const linhas = r.slice(0, 80).map((x) => `- palavras ${x.de} a ${x.ate} (${palavras[x.de].i.toFixed(1)} s): "${palavras.slice(x.de, Math.min(x.ate + 1, x.de + 12)).map((w) => w.p).join(' ')}${x.ate - x.de > 11 ? '…' : ''}" → sai; fica a repetição logo depois`)
  return `TOMADAS REPETIDAS JÁ ENCONTRADAS (a pessoa errou e repetiu a frase na hora). Estas palavras NÃO entram nos trechos; fica sempre a última tentativa, inteira:\n${linhas.join('\n')}`
}

// O agente ASSISTE as tentativas: para cada frase repetida, uma foto do meio de cada tentativa. Ele compara expressão,
// olhar para a câmera, luz e se a fala saiu sem tropeço, e escolhe qual fica (inteira). Até 12 repetições por edição.
export type FotoTomada = { t: number; miniatura: string }
export async function tomadasParaAgente(palavras: Palavra[], fotografar: (tempos: number[]) => Promise<FotoTomada[]>) {
  const r = acharRepeticoes(palavras).slice(0, 12)
  if (!r.length) return { fotos: [] as FotoTomada[], aviso: '' }
  const ultima = palavras.length - 1
  const pares = r.map((x) => {
    const tam = Math.min(x.ate - x.de, 40)
    const b0 = Math.min(x.ate + 1, ultima), b1 = Math.min(b0 + tam, ultima)
    const meio = (a: number, z: number) => (palavras[a].i + palavras[z].f) / 2
    return { ...x, b0, b1, ta: meio(x.de, x.ate), tb: meio(b0, b1) }
  })
  const fotos = await fotografar(pares.flatMap((p) => [p.ta, p.tb]))
  const linhas = pares.map((p, k) => `${k + 1}. "${palavras.slice(p.de, Math.min(p.ate + 1, p.de + 10)).map((w) => w.p).join(' ')}…" — tentativa A: palavras ${p.de} a ${p.ate} (foto em ${p.ta.toFixed(1)} s); tentativa B: começa na palavra ${p.b0} (foto em ${p.tb.toFixed(1)} s)`)
  const aviso = [
    'TOMADAS REPETIDAS (a pessoa errou e repetiu a frase na hora). Para cada uma, olhe as duas fotos do vídeo bruto nos segundos indicados e escolha a MELHOR tentativa: expressão, olhar para a câmera, luz, postura e fala sem tropeço. Se ficarem parecidas, fica a última. Só UMA tentativa entra, inteira; a outra sai toda.',
    ...linhas,
    'No "resumo", diga em uma linha por repetição qual tentativa ficou e por quê (ex.: "frase do gancho: fiquei com a A, ela olha para a câmera e a luz está melhor").',
  ].join('\n')
  return { fotos: fotos.length ? fotos : [], aviso: fotos.length ? aviso : avisoRepeticoes(palavras) }
}
