// Coluna da direita da reunião: "Briefing em construção" (o que já foi combinado, com o que ainda falta marcado) e
// "Próximo passo". "Ajustar informações" e "Revisar briefing" abrem a ata completa para corrigir e montar o plano.
import { useState, type ReactNode } from 'react'
import { Modal } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { REDES, nomeFormato, type Rede } from '../redes'
import { ataCompleta, type Ata } from './dados'
import { AtaReuniao } from './AtaReuniao'

const dm = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const Falta = ({ texto }: { texto: string }) => <span className="br-falta"><Icone nome="alerta" tam={15} /> {texto}</span>

function canaisDa(a: Ata) {
  const comFormato = (a.canais ?? []).filter((c) => c.formatos?.length)
  if (!comFormato.length) return null
  return comFormato.map((c) => `${REDES[c.rede as Rede]?.nome ?? c.rede} (${c.formatos.map((f) => nomeFormato(f, c.rede as Rede)).join(', ')}${c.quantidade ? ` · ${c.quantidade}` : ''})`).join(' · ')
}

type Props = { ata: Ata; campanha?: string; pronta: boolean; montando: boolean; aoMudar: (a: Ata) => void; aoMontar: () => void }

export function BriefingReuniao({ ata, campanha, pronta, montando, aoMudar, aoMontar }: Props) {
  const [aberto, setAberto] = useState(false)
  const completo = ataCompleta(ata)
  const canais = canaisDa(ata)
  const linhas: { k: string; v: ReactNode }[] = [
    { k: 'Objetivo', v: ata.objetivo || <Falta texto="A definir" /> },
    { k: 'Campanha', v: ata.campanha || campanha || 'Sem campanha' },
    { k: 'Período', v: ata.inicio ? `${dm(ata.inicio)} – ${dm(ata.fim)}/${(ata.fim ?? ata.inicio).slice(0, 4)}` : <Falta texto="A definir" /> },
    { k: 'Público', v: ata.publico || <Falta texto="A definir" /> },
    { k: 'Canais', v: canais || <Falta texto="A confirmar" /> },
    { k: 'Assuntos', v: ata.assuntos?.length ? <ul className="br-assuntos">{ata.assuntos.slice(0, 4).map((s, i) => <li key={i}>{s.tema}</li>)}{ata.assuntos.length > 4 && <li className="muted">+ {ata.assuntos.length - 4}</li>}</ul> : <Falta texto="A combinar" /> },
    { k: 'Restrições', v: ata.evitar?.length ? ata.evitar.join('; ') : <span className="muted">Nenhuma</span> },
  ]
  return (
    <aside className="br-lado">
      <section className="mk-painel br-bloco">
        <header className="br-cab"><Icone nome="documento" tam={24} /><div><h3>Briefing em construção</h3><small className="muted">Atualizado a partir da conversa.</small></div></header>
        <dl className="br-linhas">{linhas.map(({ k, v }) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <button type="button" className="link br-ajustar" onClick={() => setAberto(true)}>Ajustar informações <Icone nome="seta_dir" tam={13} /></button>
      </section>
      <section className="mk-painel br-bloco">
        <header className="br-cab"><Icone nome="check" tam={24} /><div><h3>Próximo passo</h3></div></header>
        <p>{completo ? 'O briefing está completo. Confira e peça a proposta de conteúdos.' : 'Confira o briefing antes de pedir a proposta de conteúdos.'}</p>
        <button type="button" className={`btn ${completo || pronta ? 'btn-ouro' : 'btn-contorno-ouro'} br-revisar`} onClick={() => setAberto(true)}><Icone nome="documento" tam={16} /> Revisar briefing <Icone nome="seta_dir" tam={14} /></button>
        <small className="muted"><Icone nome="info" tam={13} /> A reunião ainda não cria peças.</small>
      </section>
      <Modal titulo="Revisar briefing" aberto={aberto} onFechar={() => setAberto(false)} largo>
        <AtaReuniao ata={ata} pronta={pronta} editavel montando={montando} aoMudar={aoMudar} aoMontar={() => { setAberto(false); aoMontar() }} />
      </Modal>
    </aside>
  )
}
