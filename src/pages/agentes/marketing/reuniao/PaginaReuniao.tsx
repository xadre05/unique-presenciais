// Reunião de pauta (página): a entrada única para planejar com o agente. Primeiro "O que vamos planejar?";
// depois a conversa à esquerda e a ata à direita; com a ata pronta, "Montar o plano" mostra a proposta de
// calendário para revisar e aprovar. Regras em docs/agentes/REGRAS_AGENTE_MARKETING.md (Reunião de pauta).
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import type { Plano } from '../planos'
import type { Campanha } from '../useMarketing'
import { PropostaCalendario } from '../PropostaCalendario'
import { Caminho } from '../Caminho'
import { useReunioes, type TipoEscopo } from './dados'
import { useReuniao } from './useReuniao'
import { EscolhaEscopo } from './EscolhaEscopo'
import { ConversaReuniao } from './ConversaReuniao'
import { AtaReuniao } from './AtaReuniao'

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

type Props = {
  reuniaoId?: string; tipoInicial: TipoEscopo; dataInicial: string; campanhas: Campanha[]; planos: Plano[]
  aoVoltar: () => void; aoMudou: () => void; aoAbrirReuniao: (id: string) => void; aoCriarCampanha: () => void; aoIrProducao: (pecaId?: string) => void
}

function Aprovado({ n, aoEscrever, aoVoltar }: { n: number; aoEscrever: () => void; aoVoltar: () => void }) {
  return (
    <section className="mk-painel reu-aprovado">
      <span className="mk-convite-icone"><Icone nome="check" tam={24} /></span>
      <h3>Plano aprovado: {n} {n === 1 ? 'peça foi' : 'peças foram'} para Ideias.</h3>
      <p className="muted">Agora o agente pode escrever os textos. Depois você revisa cada peça e pede as artes.</p>
      <div className="ia-linha">
        <button className="btn btn-ouro" onClick={aoEscrever}><Icone nome="floco" tam={16} /> Escrever {n === 1 ? 'o texto' : 'os textos'} agora</button>
        <button className="btn btn-contorno-ouro" onClick={aoVoltar}>Deixar para depois</button>
      </div>
    </section>
  )
}

export function PaginaReuniao(pr: Props) {
  const recentes = useReunioes()
  const r = useReuniao({ reuniaoId: pr.reuniaoId, campanhas: pr.campanhas, planos: pr.planos, aoMudou: pr.aoMudou })
  const reu = r.reuniao
  const escrever = async () => { const ids = await r.escreverAgora(); if (ids) pr.aoIrProducao(ids.length === 1 ? ids[0] : undefined) }
  const passos = [{ texto: 'Agente de Marketing', aoClicar: pr.aoVoltar }, { texto: 'Reunião de pauta', aoClicar: reu ? r.novaReuniao : undefined }, ...(reu ? [{ texto: reu.titulo }] : [])]
  const sub = !reu ? 'Escolha o que planejar. O agente chega com o que levantou e vocês decidem juntos.'
    : r.conversando ? 'Converse com o agente. A ata ao lado mostra o que já foi combinado.'
      : 'Revise a proposta de calendário que saiu da reunião e aprove.'

  if (r.carregando) return <div className="mk-pagina-planejar"><Caminho passos={passos} /><div className="progresso"><div className="indeterminado" /><span>Abrindo a reunião…</span></div></div>
  return (
    <div className="mk-pagina-planejar reu">
      <Caminho passos={passos} />
      <div className="mk-titulo-aba"><h2>{reu ? `Reunião de pauta: ${reu.titulo}` : 'Reunião de pauta'}</h2><p className="muted">{sub}</p></div>
      {!reu && <EscolhaEscopo tipoInicial={pr.tipoInicial} dataInicial={pr.dataInicial} campanhas={pr.campanhas} recentes={recentes.dados ?? []}
        aoComecar={async (e, t) => { await r.comecar(e, t); recentes.recarregar() }} aoContinuar={pr.aoAbrirReuniao} aoAnotou={() => { pr.aoMudou(); pr.aoVoltar() }} aoCriarCampanha={pr.aoCriarCampanha} />}
      {reu && r.conversando && (
        <div className="reu-grade">
          <div className="reu-col">
            <ConversaReuniao falas={r.falas} pensando={r.pensando} aoFalar={r.falar} />
            {r.erro && <div className="ia-linha"><Erro msg={r.erro} /><button type="button" className="btn btn-mini" onClick={r.tentarDeNovo}><Icone nome="atualizar" tam={14} /> Tentar de novo</button></div>}
          </div>
          <AtaReuniao ata={r.ata} pronta={r.pronta} editavel montando={r.proposta.status === 'aguardando'} aoMudar={r.setAta} aoMontar={r.montar} />
        </div>
      )}
      {reu && !r.conversando && (
        <div className="mk-planejar-grade">
          <AtaReuniao ata={r.ata} pronta editavel={false} aoMudar={() => undefined} aoReabrir={reu.status === 'fechada' ? undefined : r.reabrir} />
          {r.aprovadas
            ? <Aprovado n={r.aprovadas.length} aoEscrever={escrever} aoVoltar={pr.aoVoltar} />
            : <PropostaCalendario pecas={r.proposta.lista} status={r.proposta.status} periodo={`${dm(r.plano?.inicio ?? reu.escopo.inicio)}–${dm(r.plano?.fim ?? reu.escopo.fim)}`} resumo={r.proposta.resumo} erro={r.proposta.erro ?? r.erro}
              textoVazio="A proposta não chegou. Volte à conversa e clique em Montar o plano de novo."
              aoMudar={r.proposta.pecas.recarregar} aoAcrescentar={() => r.proposta.acrescentar(r.plano?.inicio ?? reu.escopo.inicio)} aoAjustar={r.ajustar} aoSalvar={pr.aoVoltar} aoAprovar={r.aprovar} enviando={r.proposta.enviando || !!r.proposta.trabalho} />}
        </div>
      )}
      {!reu && <Erro msg={r.erro} />}
    </div>
  )
}
