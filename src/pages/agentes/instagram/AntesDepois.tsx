// Resultados → Comparações → "Antes × depois de uma data": escolhe-se um dia (ex.: quando começou a postar com o
// agente) e vê-se o depois (do dia até hoje) contra o mesmo número de dias antes. Datas importantes podem ser guardadas
// com um nome para voltar a elas com um clique. O botão pede ao agente se a mudança funcionou.
import { useState } from 'react'
import { Icone } from '../../../components/Icone'
import { hojeBR, somaDias, type DiaSeguidores, type FiltroAnalise, type PostIG } from './dados'
import type { AnaliseGuardada } from './analises'
import { antesEDepois, criarMarco, tirarMarco, type Marco } from './marcos'
import { TabelaPeriodos } from './TabelaPeriodos'
import { VerAnalise } from './VerAnalise'

type Props = {
  empresa: string; posts: PostIG[]; seguidores: DiaSeguidores[]; datas: Marco[]; aoMudarDatas: () => void
  analises: AnaliseGuardada[]; analisando: boolean; aoAnalisar: (f: FiltroAnalise) => void; aoMudar: () => void
}
const dataBR = (d: string) => d.split('-').reverse().join('/')

export function AntesDepois({ empresa, posts, seguidores, datas, aoMudarDatas, analises, analisando, aoAnalisar, aoMudar }: Props) {
  const [dia, setDia] = useState(() => datas[0]?.dia ?? somaDias(hojeBR(), -6))
  const [nome, setNome] = useState('')
  const [guardando, setGuardando] = useState(false)
  const guardada = datas.find((d) => d.dia === dia)
  const { dias, periodos } = antesEDepois({ dia })
  const analise = analises.find((a) => a.tipo === 'marco' && a.filtro.marco?.dia === dia && a.filtro.periodos?.at(-1)?.ate === periodos.at(-1)?.ate)
  const guardar = async () => { setGuardando(true); try { await criarMarco(empresa, { dia, nome, descricao: '' }); setNome(''); aoMudarDatas() } finally { setGuardando(false) } }
  const marco = { nome: guardada?.nome ?? `A partir de ${dataBR(dia)}`, dia, descricao: guardada?.descricao ?? null }
  return (
    <section className="mk-painel pe-bloco ad-bloco">
      <h4 className="pe-titulo">Antes × depois de uma data</h4>
      <span className="muted pequeno">Escolha o dia em que algo mudou. O depois vai do dia até hoje; o antes tem o mesmo número de dias.</span>
      <div className="ia-linha ad-escolha">
        <input type="date" value={dia} max={hojeBR()} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Data da mudança" />
        {datas.map((d) => <button key={d.id} type="button" className={`mk-chip${d.dia === dia ? ' ativo' : ''}`} onClick={() => setDia(d.dia)}>{dataBR(d.dia).slice(0, 5)} · {d.nome}</button>)}
      </div>
      {guardada
        ? <p className="pequeno"><b>{guardada.nome}</b> <button type="button" className="btn btn-mini" onClick={async () => { await tirarMarco(guardada.id); aoMudarDatas() }}><Icone nome="fechar" tam={12} /> Esquecer esta data</button></p>
        : <div className="ia-linha ad-guardar"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dar um nome a esta data (ex.: começamos com o agente)" />
          <button type="button" className="btn btn-mini" disabled={!nome.trim() || guardando} onClick={guardar}>Guardar a data</button></div>}
      {dias > 0 ? <TabelaPeriodos posts={posts} periodos={periodos} seguidores={seguidores} /> : <p className="muted pequeno">Escolha uma data até hoje.</p>}
      {dias > 0 && dias < 14 && <p className="muted pequeno">Com {dias} {dias === 1 ? 'dia' : 'dias'} a comparação ainda oscila; fica mais confiável a partir de 2 a 4 semanas.</p>}
      <div className="pe-pedir"><span className="muted pequeno">O agente diz se a mudança funcionou, o que melhorou e o que piorou. Cerca de 10 créditos.</span>
        <button type="button" className="btn btn-ouro" disabled={analisando || dias < 1} onClick={() => aoAnalisar({ periodos, marco })}><Icone nome="floco" tam={16} /> {analisando ? 'Analisando… (até 1 minuto)' : 'Pedir ao agente: funcionou?'}</button></div>
      {analise && <VerAnalise empresa={empresa} analise={analise} aoMudar={aoMudar} />}
    </section>
  )
}
