// Resultados → Aprendizados: a revisão automática de toda segunda (ligar e fazer agora), o histórico de todas as
// análises (escolhe-se uma à esquerda e ela abre à direita, com os aprendizados para ensinar) e o que o agente já aprendeu.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import type { Lembranca } from '../memoria'
import { NOME_TIPO_ANALISE, pendentes, quando, type AnaliseGuardada } from './analises'
import { AprendidoResultados } from './AprendidoResultados'
import { VerAnalise } from './VerAnalise'

type Props = {
  empresa: string; analises: AnaliseGuardada[]; memoria: Lembranca[]; revisaoLigada: boolean; aoLigarRevisao: (v: boolean) => void
  analisando: boolean; aoRevisarAgora: () => void; aoMudar: () => void
}

export function AbaAprendizados({ empresa, analises, memoria, revisaoLigada, aoLigarRevisao, analisando, aoRevisarAgora, aoMudar }: Props) {
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const atual = analises.find((a) => a.id === escolhida) ?? analises[0] ?? null
  const faltam = analises.reduce((s, a) => s + pendentes(a).length, 0)
  return (
    <div className="ap-aba">
      <section className="mk-painel pe-bloco ap-revisao">
        <div><h4 className="pe-titulo">Revisão da semana</h4>
          <span className="muted pequeno">Toda segunda às 7h o agente compara a semana passada com as 4 anteriores e traz o que ensinar. Cerca de 10 créditos por semana.</span></div>
        <div className="ia-linha">
          <label className="ap-chave"><input type="checkbox" checked={revisaoLigada} onChange={(e) => aoLigarRevisao(e.target.checked)} /> <span>{revisaoLigada ? 'Ligada' : 'Desligada'}</span></label>
          <button type="button" className="btn btn-contorno-ouro" disabled={analisando} onClick={aoRevisarAgora}><Icone nome="floco" tam={15} /> {analisando ? 'Revisando…' : 'Revisar agora'}</button>
        </div>
      </section>
      <AprendidoResultados empresa={empresa} memoria={memoria} aoMudar={aoMudar} />
      <section className="mk-painel pe-bloco">
        <h4 className="pe-titulo">Todas as análises {faltam > 0 && <span className="ap-faltam">{faltam} {faltam === 1 ? 'aprendizado' : 'aprendizados'} para decidir</span>}</h4>
        {!analises.length ? <p className="muted pequeno">Nenhuma análise ainda. Peça uma na aba Período ou em Comparações.</p> : (
          <div className="ap-grade">
            <ul className="ap-historico">{analises.map((a) => { const f = pendentes(a).length; return (
              <li key={a.id}><button type="button" className={atual?.id === a.id ? 'ativa' : ''} onClick={() => setEscolhida(a.id)}>
                <span className="ap-tipo">{NOME_TIPO_ANALISE[a.tipo]}</span><b>{a.titulo ?? NOME_TIPO_ANALISE[a.tipo]}</b>
                <small className="muted">{quando(a.criado_em)}{f ? ` · ${f} para decidir` : ''}</small></button></li>) })}</ul>
            {atual && <VerAnalise empresa={empresa} analise={atual} aoMudar={aoMudar} />}
          </div>
        )}
      </section>
    </div>
  )
}
