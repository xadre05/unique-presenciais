// Depois que o agente planeja a edição, cada cena animada que ele descreveu vira código (função editor-criativo) e passa
// por uma revisão: o navegador desenha 4 quadros da cena, o agente vê as fotos, dá nota e corrige o que estiver ruim
// (uma rodada, para o custo não crescer). Cena que já existia com a mesma descrição reaproveita o código.
import { supabase } from '../../../../lib/supabase'
import { EMPRESA } from '../useMarketing'
import { Cenas } from './cenas'
import type { CenaPlano, Palavra, Plano } from './linhaTempo'
import { codigoDoModelo, ehModeloCena } from './modelosCena'

type Resposta = { codigo: string; nota?: number; critica?: string }
async function pedirCena(corpo: Record<string, unknown>): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke('editor-criativo', { body: { acao: 'cena', empresa: EMPRESA, ...corpo } })
  if (error) throw new Error(error.message)
  if (data?.erro) throw new Error(data.erro)
  return data as Resposta
}

// 4 fotos da cena (pequenas) para o agente revisar; fundo cinza para ver a área transparente do cartão
async function fotosDaCena(codigo: string, d: number, vertical: boolean) {
  const [L, A] = vertical ? [360, 640] : [640, 360]
  const c = new Cenas([codigo], L, A)
  try {
    const tela = Object.assign(document.createElement('canvas'), { width: L, height: A })
    const ctx = tela.getContext('2d')!
    const fotos: { t: number; miniatura: string }[] = []
    for (const p of [0.15, 0.4, 0.7, 0.97]) {
      const t = Math.round(d * p * 10) / 10
      const bmp = await c.quadroExato(0, t, d)
      if (!bmp) return { erro: c.erros.get(0) ?? 'A cena não desenhou nada.', fotos }
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(0, 0, L, A); ctx.drawImage(bmp, 0, 0, L, A)
      fotos.push({ t, miniatura: tela.toDataURL('image/jpeg', 0.75).split(',')[1] })
    }
    return { erro: null, fotos }
  } finally { c.fechar() }
}

async function escreverUma(pecaId: string, cena: CenaPlano, palavras: Palavra[], vertical: boolean): Promise<CenaPlano> {
  const d = Math.max(1.5, (palavras[cena.ate]?.f ?? 0) - (palavras[cena.de]?.i ?? 0))
  // cena da biblioteca: o código já está pronto, só confere se desenha (sem custo de agente); se falhar, o agente escreve
  if (ehModeloCena(cena.modelo)) {
    const codigo = codigoDoModelo(cena.modelo, cena.dados, cena.layout)
    const visto = await fotosDaCena(codigo, d, vertical)
    if (!visto.erro) return { ...cena, codigo, nota: undefined, erro: undefined }
  }
  const base = { peca: pecaId, descricao: cena.descricao, duracao: d, L: vertical ? 1080 : 1920, A: vertical ? 1920 : 1080, layout: cena.layout ?? 'cheia' }
  try {
    let { codigo } = await pedirCena(base)
    const primeiro = codigo
    const visto = await fotosDaCena(codigo, d, vertical)
    const revisao = await pedirCena({ ...base, codigo, ...(visto.erro ? { erro: visto.erro } : { quadros: visto.fotos }) })
    codigo = revisao.codigo
    // a correção também pode quebrar: confere de novo e, se quebrou, fica a primeira versão que desenhava
    const conferido = await fotosDaCena(codigo, d, vertical)
    if (conferido.erro) return visto.erro ? { ...cena, erro: conferido.erro } : { ...cena, codigo: primeiro }
    return { ...cena, codigo, nota: revisao.nota, erro: undefined }
  } catch (e) {
    return { ...cena, erro: (e as Error).message }
  }
}

export async function escreverCenas(pecaId: string, plano: Plano, palavras: Palavra[], vertical: boolean, anterior?: Plano): Promise<Plano> {
  const cenas = plano.cenas ?? []
  if (!cenas.length) return plano
  const prontas = await Promise.all(cenas.map((c) => {
    const igual = anterior?.cenas?.find((x) => x.codigo && x.descricao.trim() === c.descricao.trim() && (x.layout ?? 'cheia') === (c.layout ?? 'cheia') && x.modelo === c.modelo && JSON.stringify(x.dados ?? null) === JSON.stringify(c.dados ?? null))
    return igual ? Promise.resolve({ ...c, codigo: igual.codigo, nota: igual.nota }) : escreverUma(pecaId, c, palavras, vertical)
  }))
  return { ...plano, cenas: prontas }
}
