// Planejar sem reunião: a equipe já sabe o que quer postar. Uma linha por peça (canal, formato, dia e sobre o quê);
// "Mandar o agente escrever" cria as peças e já pede os textos; "Só guardar em Ideias" cria as peças sem custo.
import { useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { REDES, nomeFormato, useRedes, type Formato, type Rede } from '../redes'
import { EMPRESA, criarTrabalho, pedirTrabalho, type Campanha } from '../useMarketing'

type Linha = { rede: Rede; tipo: Formato; dia: string; tema: string }
type Props = { inicio: string; fim: string; campanha?: Campanha; aoEscreveu: (ids: string[]) => void; aoGuardou: () => void; aoVoltar: () => void }

// as peças são criadas pela função do agente; o lote marca quais são estas para pedir os textos logo depois
async function idsDoLote(lote: string, quantas: number) {
  for (let i = 0; i < 15; i++) {
    const { data } = await supabase.from('agentes_pecas').select('id').eq('empresa_id', EMPRESA).eq('conteudo->>lote', lote)
    if ((data?.length ?? 0) >= quantas) return data!.map((p) => p.id as string)
    await new Promise((ok) => setTimeout(ok, 1000))
  }
  throw new Error('As peças demoraram para aparecer. Elas estão em Ideias; peça os textos por lá.')
}

export function DecidirDireto({ inicio, fim, campanha, aoEscreveu, aoGuardou, aoVoltar }: Props) {
  const redes = useRedes()
  const nova = (): Linha => { const r = redes[0] ?? 'instagram'; return { rede: r, tipo: REDES[r].formatos[0], dia: inicio, tema: '' } }
  const [linhas, setLinhas] = useState<Linha[]>(() => [nova()])
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (i: number, x: Partial<Linha>) => setLinhas((l) => l.map((v, j) => (j === i ? { ...v, ...x } : v)))

  const criar = async (escrever: boolean) => {
    if (linhas.some((l) => !l.tema.trim())) return setErro('Diga sobre o que é cada peça.')
    setErro(null); setEnviando(escrever ? 'Criando as peças…' : 'Guardando…')
    try {
      const lote = crypto.randomUUID()
      const pecas = linhas.map((l) => ({ tipo: l.tipo, rede: l.rede, dia: l.dia || undefined, titulo: l.tema.trim().slice(0, 90), tema: l.tema.trim(), campanha: campanha?.id, lote }))
      const m = await pedirTrabalho('ideia', { pecas })
      if (m) throw new Error(m)
      if (!escrever) return aoGuardou()
      const ids = await idsDoLote(lote, pecas.length)
      setEnviando('Pedindo os textos ao agente…')
      const { erro: e } = await criarTrabalho('escrever', { peca_ids: ids })
      if (e) throw new Error(e)
      aoEscreveu(ids)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível criar as peças.'); setEnviando(null) }
  }

  return (
    <section className="mk-painel reu-direto">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="lista" tam={22} /></span>
        <div><h3>O que vai ser postado</h3><span className="muted pequeno">Uma linha por peça.{campanha ? ` Todas usam a oferta e as regras de ${campanha.nome}.` : ''} O agente escreve exatamente o que está aqui.</span></div></header>
      <ol className="reu-direto-lista">{linhas.map((l, i) => (
        <li key={i}>
          <select aria-label="Canal" value={l.rede} onChange={(e) => { const r = e.target.value as Rede; mudar(i, { rede: r, tipo: REDES[r].formatos[0] }) }}>{redes.map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}</select>
          <select aria-label="Formato" value={l.tipo} onChange={(e) => mudar(i, { tipo: e.target.value as Formato })}>{REDES[l.rede].formatos.map((f) => <option key={f} value={f}>{nomeFormato(f, l.rede)}</option>)}</select>
          <input type="date" aria-label="Dia" value={l.dia} min={inicio} max={fim} onChange={(e) => mudar(i, { dia: e.target.value })} />
          <input className="reu-direto-tema" aria-label="Sobre o quê" value={l.tema} maxLength={500} onChange={(e) => mudar(i, { tema: e.target.value })} placeholder="Sobre o quê? Ex.: anunciar que a Black abre dia 27, sem preço" />
          {linhas.length > 1 && <button type="button" className="reu-tirar" aria-label="Tirar peça" onClick={() => setLinhas((v) => v.filter((_, j) => j !== i))}><Icone nome="fechar" tam={13} /></button>}
        </li>))}</ol>
      <button type="button" className="btn btn-mini" onClick={() => setLinhas((v) => [...v, { ...nova(), dia: v.at(-1)?.dia ?? inicio }])}><Icone nome="mais" tam={13} /> Mais uma peça</button>
      <Erro msg={erro} />
      <footer className="mk-criar-rodape">
        <button type="button" className="btn btn-mini" disabled={!!enviando} onClick={aoVoltar}>Voltar</button>
        <span className="ia-linha">
          <button type="button" className="btn btn-contorno-ouro" disabled={!!enviando} onClick={() => criar(false)}>Só guardar em Ideias</button>
          <button type="button" className="btn btn-ouro" disabled={!!enviando} onClick={() => criar(true)}><Icone nome="floco" tam={16} /> {enviando ?? `Mandar o agente escrever (${linhas.length})`}</button>
        </span>
      </footer>
    </section>
  )
}
