// Abas do editor da peça: Roteiro, Legenda, Direção visual e Versões. Recebem o rascunho e devolvem as mudanças.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'

export type Rascunho = { objetivo: string; roteiro: string[]; legenda: string; cta: string; hashtags: string; texto_arte: string; prompt_imagem: string; observacao: string }
export const rascunhoDe = (c: Peca['conteudo']): Rascunho => ({
  objetivo: c.objetivo ?? '', roteiro: c.roteiro ?? [], legenda: c.legenda ?? '', cta: c.cta ?? '', hashtags: (c.hashtags ?? []).join(' '),
  texto_arte: c.texto_arte ?? '', prompt_imagem: c.prompt_imagem ?? '', observacao: c.observacao ?? '',
})
export const NOME_ITEM: Record<string, [string, string]> = { carrossel: ['Lâminas', 'Lâmina'], stories: ['Telas', 'Tela'], reels: ['Cenas', 'Cena'], post: ['Texto da arte', 'Linha'], video: ['Blocos do roteiro', 'Bloco'] }

async function copiar(texto: string) { try { await navigator.clipboard.writeText(texto) } catch { /* sem permissão: ignora */ } }

export function AbaRoteiro({ peca, r, mudar }: { peca: Peca; r: Rascunho; mudar: (c: Partial<Rascunho>) => void }) {
  const [plural, singular] = NOME_ITEM[peca.tipo] ?? ['Roteiro', 'Item']
  const muda = (i: number, v: string) => mudar({ roteiro: r.roteiro.map((x, j) => (j === i ? v : x)) })
  return (
    <div className="mk-aba">
      <label className="mk-rotulo"><Icone nome="info" tam={16} /> Objetivo</label>
      <input value={r.objetivo} onChange={(e) => mudar({ objetivo: e.target.value })} />
      <label className="mk-rotulo"><Icone nome="lista" tam={16} /> {plural} · {r.roteiro.length}</label>
      <ol className="mk-itens">{r.roteiro.map((x, i) => (
        <li key={i}><span className="mk-num">{i + 1}</span><textarea rows={Math.min(4, Math.max(1, Math.ceil(x.length / 70)))} value={x} onChange={(e) => muda(i, e.target.value)} />
          <button className="mk-tirar" title={`Tirar ${singular.toLowerCase()}`} onClick={() => mudar({ roteiro: r.roteiro.filter((_, j) => j !== i) })}><Icone nome="fechar" tam={14} /></button></li>
      ))}</ol>
      <button className="btn btn-mini" onClick={() => mudar({ roteiro: [...r.roteiro, ''] })}><Icone nome="mais" tam={14} /> {singular}</button>
    </div>
  )
}

export function AbaLegenda({ r, mudar }: { r: Rascunho; mudar: (c: Partial<Rascunho>) => void }) {
  return (
    <div className="mk-aba">
      <label className="mk-rotulo">Legenda</label>
      <textarea rows={10} value={r.legenda} onChange={(e) => mudar({ legenda: e.target.value })} />
      <label className="mk-rotulo">Chamada para ação</label>
      <input value={r.cta} onChange={(e) => mudar({ cta: e.target.value })} />
      <label className="mk-rotulo">Hashtags</label>
      <input value={r.hashtags} onChange={(e) => mudar({ hashtags: e.target.value })} placeholder="#hof #harmonizacaofacial" />
    </div>
  )
}

export function AbaVisual({ r, mudar }: { r: Rascunho; mudar: (c: Partial<Rascunho>) => void }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="mk-aba">
      <label className="mk-rotulo">Texto que vai na arte / capa</label>
      <input value={r.texto_arte} onChange={(e) => mudar({ texto_arte: e.target.value })} />
      <label className="mk-rotulo">Pedido da imagem <button className="link pequeno" onClick={async () => { await copiar(r.prompt_imagem); setCopiado(true); setTimeout(() => setCopiado(false), 1800) }}>{copiado ? 'copiado ✓' : 'copiar'}</button></label>
      <textarea rows={6} value={r.prompt_imagem} onChange={(e) => mudar({ prompt_imagem: e.target.value })} placeholder="Cena, enquadramento, luz, cores da marca, texto na arte" />
      <label className="mk-rotulo">Observações (gravação, imagem, cuidados do conselho)</label>
      <textarea rows={3} value={r.observacao} onChange={(e) => mudar({ observacao: e.target.value })} />
    </div>
  )
}

export function AbaVersoes({ peca, aoRestaurar }: { peca: Peca; aoRestaurar: () => void }) {
  const a = peca.conteudo.anterior as Peca['conteudo'] | undefined
  if (!a) return <div className="mk-aba"><p className="muted">Ainda não há versão anterior. Cada ajuste do agente guarda a versão de antes aqui.</p></div>
  return (
    <div className="mk-aba">
      <p className="muted pequeno">Versão antes do último ajuste do agente.</p>
      {!!a.roteiro?.length && <ol className="peca-roteiro">{a.roteiro.map((x, i) => <li key={i}>{x}</li>)}</ol>}
      {a.legenda && <div className="peca-legenda">{a.legenda}</div>}
      <button className="btn btn-contorno btn-mini" onClick={aoRestaurar}>Voltar para esta versão</button>
    </div>
  )
}
