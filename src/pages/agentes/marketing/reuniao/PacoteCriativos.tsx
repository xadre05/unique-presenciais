// Pacote de criativos de uma campanha: anúncios (vídeo com 3 a 5 ganchos para testar e imagem), sequências de stories
// com link, reels para gravar e carrosséis, cada peça marcada como Anúncio ou Orgânico. O agente escreve tudo de uma vez
// lendo os materiais da campanha (página de vendas, roteiros, copy). Os orgânicos são espalhados pelos dias do período.
import { useEffect, useRef, useState } from 'react'
import { Erro, InputNumero } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { somaDias } from '../../comum'
import { criarTrabalho, type Campanha } from '../useMarketing'

type Item = { id: string; nome: string; curto: string; dica: string; tipo: string; finalidade: 'anuncio' | 'organico'; padrao: number; telas?: number; duracao?: string; tema: string }
const ITENS: Item[] = [
  { id: 'ad_video', nome: 'Anúncios em vídeo', curto: 'Anúncio em vídeo', dica: '3 a 5 ganchos para testar no mesmo vídeo · 9:16 e 4:5', tipo: 'reels', finalidade: 'anuncio', padrao: 3, duracao: 'até 30 s', tema: 'anúncio em vídeo para vender a oferta da campanha' },
  { id: 'ad_imagem', nome: 'Anúncios em imagem', curto: 'Anúncio em imagem', dica: 'Frase da arte com variações para testar · feed 4:5', tipo: 'post', finalidade: 'anuncio', padrao: 2, tema: 'anúncio em imagem para vender a oferta da campanha' },
  { id: 'stories', nome: 'Sequências de stories com link', curto: 'Stories com link', dica: '6 telas cada, terminando no link da página', tipo: 'stories', finalidade: 'organico', padrao: 3, telas: 6, tema: 'sequência de stories que leva para o link da página de vendas' },
  { id: 'reels', nome: 'Reels para gravar', curto: 'Reels', dica: 'Roteiro cena a cena para a especialista gravar', tipo: 'reels', finalidade: 'organico', padrao: 3, duracao: '30 a 60 s', tema: 'reels orgânico para gerar desejo e levar para a oferta' },
  { id: 'carrossel', nome: 'Carrosséis', curto: 'Carrossel', dica: 'Educativo que termina na oferta', tipo: 'carrossel', finalidade: 'organico', padrao: 2, tema: 'carrossel que educa e termina na oferta da campanha' },
]

const diasEntre = (a: string, b: string) => { const r: string[] = []; for (let d = a; d <= b && r.length < 60; d = somaDias(d, 1)) r.push(d); return r }

type Props = { campanha: Campanha; inicio: string; fim: string; aoEscreveu: (ids: string[]) => void; aoVoltar: () => void }

export function PacoteCriativos({ campanha, inicio, fim, aoEscreveu, aoVoltar }: Props) {
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(ITENS.map((i) => [i.id, i.padrao])))
  const [foco, setFoco] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const total = Object.values(qtd).reduce((s, n) => s + n, 0)
  // aberto pelo atalho da campanha: no celular o pacote fica abaixo da escolha do período
  const caixa = useRef<HTMLElement>(null)
  useEffect(() => { caixa.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [])

  const criar = async () => {
    if (!total) return setErro('Escolha pelo menos uma peça.')
    if (total > 30) return setErro('No máximo 30 peças por pacote.')
    setErro(null); setEnviando(true)
    const dias = diasEntre(inicio, fim)
    const organicos = ITENS.filter((i) => i.finalidade === 'organico').reduce((s, i) => s + (qtd[i.id] ?? 0), 0)
    let k = 0
    const novas = ITENS.flatMap((it) => Array.from({ length: qtd[it.id] ?? 0 }, (_, n) => {
      // anúncio roda a campanha toda (fica no primeiro dia); orgânico vai se espalhando pelos dias
      const dia = it.finalidade === 'anuncio' ? inicio : dias[Math.floor((k++ * dias.length) / Math.max(1, organicos)) % dias.length]
      return {
        tipo: it.tipo, rede: 'instagram', dia, campanha: campanha.id,
        titulo: `${it.curto} ${n + 1} · ${campanha.nome}`.slice(0, 90),
        tema: [it.tema, foco.trim()].filter(Boolean).join(' · '),
        briefing: { finalidade: it.finalidade, telas: it.telas, duracao: it.duracao, objetivo: it.finalidade === 'anuncio' ? 'vender' : undefined },
      }
    }))
    const { erro: e } = await criarTrabalho('escrever', { novas, tema: foco.trim() || null })
    if (e) { setErro(e); setEnviando(false); return }
    aoEscreveu([])
  }

  return (
    <section ref={caixa} className="mk-painel reu-direto">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="floco" tam={22} /></span>
        <div><h3>Pacote de criativos · {campanha.nome}</h3><span className="muted pequeno">O agente escreve tudo de uma vez, lendo os materiais da campanha (página de vendas, roteiros e copy). Você revisa cada peça na Produção.</span></div></header>
      <ul className="pac-lista">{ITENS.map((it) => (
        <li key={it.id}>
          <span className={`badge ${it.finalidade === 'anuncio' ? 'badge-ouro' : 'badge-info'}`}>{it.finalidade === 'anuncio' ? 'Anúncio' : 'Orgânico'}</span>
          <span className="pac-txt"><b>{it.nome}</b><small className="muted">{it.dica}</small></span>
          <InputNumero valor={qtd[it.id]} min={0} max={10} onChange={(v) => setQtd((q) => ({ ...q, [it.id]: v }))} />
        </li>))}</ul>
      <input className="reu-direto-tema" value={foco} maxLength={400} onChange={(e) => setFoco(e.target.value)} aria-label="Fase ou foco"
        placeholder="Fase ou foco (opcional). Ex.: aquecimento até dia 26, carrinho abre dia 27, últimas horas" />
      <Erro msg={erro} />
      <footer className="mk-criar-rodape">
        <button type="button" className="btn btn-mini" disabled={enviando} onClick={aoVoltar}>Voltar</button>
        <button type="button" className="btn btn-ouro" disabled={enviando || !total} onClick={criar}><Icone nome="floco" tam={16} /> {enviando ? 'Pedindo ao agente…' : `Criar pacote (${total} peças)`}</button>
      </footer>
    </section>
  )
}
