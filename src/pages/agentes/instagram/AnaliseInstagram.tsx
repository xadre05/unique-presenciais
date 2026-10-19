// Análises do agente sobre os posts do Instagram: em cima, o pedido (PedirAnalise: o que analisar e um botão só);
// embaixo, o histórico (análise do filtro, comparação de períodos, marco e revisão semanal), com a mais recente aberta.
// Cada análise traz resumo, o que mudou, o que funcionou e o que não (com o porquê), recomendações e os aprendizados
// para ensinar ao agente.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import type { Analise } from './dados'
import { NOME_TIPO_ANALISE, pendentes, type AnaliseGuardada } from './analises'
import { Aprendizados } from './Aprendizados'
import { PedirAnalise, type OpcaoAnalise } from './PedirAnalise'

type Props = {
  empresa: string; analises: AnaliseGuardada[]; opcoes: OpcaoAnalise[]; analisando: boolean; aoPedir: (o: OpcaoAnalise) => void
  revisaoLigada: boolean; aoLigarRevisao: (ligada: boolean) => void; aoMudar: () => void
}

function Padroes({ titulo, itens, classe }: { titulo: string; itens: Analise['funcionou']; classe: string }) {
  if (!itens?.length) return null
  return (
    <div className={`ig-padroes ${classe}`}><h5>{titulo}</h5>
      <ul>{itens.map((x, i) => <li key={i}><b>{x.padrao}</b><span>{x.porque}</span>{!!x.exemplos?.length && <small className="muted">Ex.: {x.exemplos.join(' · ')}</small>}</li>)}</ul>
    </div>
  )
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const nomeNaLista = (a: AnaliseGuardada) => {
  const faltam = pendentes(a).length
  return `${quando(a.criado_em)} · ${a.titulo ?? NOME_TIPO_ANALISE[a.tipo]}${faltam ? ` · ${faltam} para decidir` : ''}`
}

export function AnaliseInstagram({ empresa, analises, opcoes, analisando, aoPedir, revisaoLigada, aoLigarRevisao, aoMudar }: Props) {
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const atual = analises.find((a) => a.id === escolhida) ?? analises[0] ?? null
  const r = atual?.resultado
  return (
    <section className="mk-painel ig-analise">
      <header className="mk-painel-cab"><span className="mk-convite-icone"><Icone nome="ideia" tam={22} /></span>
        <div><h3>Pedir análise ao agente</h3>
          <span className="muted pequeno">Ele lê os números, diz o que funcionou e por quê e propõe o que ensinar a ele mesmo.</span></div>
      </header>
      <PedirAnalise opcoes={opcoes} analisando={analisando} aoPedir={aoPedir} revisaoLigada={revisaoLigada} aoLigarRevisao={aoLigarRevisao} />
      {analises.length > 0 && <h5 className="reu-subtitulo ig-hist-titulo">Histórico de análises</h5>}
      {analises.length > 1 && (
        <label className="ig-historico"><span className="muted pequeno">Abrir outra</span>
          <span className="select-icone"><select value={atual?.id ?? ''} onChange={(e) => setEscolhida(e.target.value)}>
            {analises.map((a) => <option key={a.id} value={a.id}>{nomeNaLista(a)}</option>)}</select></span></label>
      )}
      {atual && r && (<>
        <p className="ig-titulo-analise"><b>{atual.titulo ?? NOME_TIPO_ANALISE[atual.tipo]}</b> <span className="muted pequeno">· {quando(atual.criado_em)} · {r.posts} posts · alcance mediano {r.mediana}</span></p>
        <p>{r.resumo}</p>
        {!!r.comparacao?.length && <><h5 className="reu-subtitulo">O que mudou entre os períodos</h5><ul className="ig-recom">{r.comparacao.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        <div className="ig-padroes-grade">
          <Padroes titulo="Funcionou" itens={r.funcionou} classe="bom" />
          <Padroes titulo="Não funcionou" itens={r.nao_funcionou} classe="ruim" />
        </div>
        {!!r.recomendacoes?.length && <><h5 className="reu-subtitulo">Recomendações</h5><ul className="ig-recom">{r.recomendacoes.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        <Aprendizados key={atual.id} empresa={empresa} analise={atual} aoMudar={aoMudar} />
      </>)}
    </section>
  )
}
