// Planejar → Canais: para quais redes este planejamento cria conteúdo. Um clique liga ou desliga cada rede (cada
// canal recebe as próprias peças, no formato dele). "O agente sugere na reunião" deixa a escolha para a conversa —
// vale só para a reunião; no pedido direto e no reaproveitar entram todas as redes ligadas.
import { Icone } from '../../../../components/Icone'
import { REDES, type Rede } from '../redes'
import { LogoRede } from '../LogoRede'

type Props = { ativas: Rede[]; canais: string[]; agente: boolean; aoMudar: (c: string[]) => void; aoAgente: (v: boolean) => void }

const AJUDA_AGENTE = 'Na reunião o agente propõe com você em quais redes postar e em quais formatos. Não gasta nada a mais. Vale só para a reunião: no pedido direto e no reaproveitar, entram todas as redes ligadas.'

export function CanaisPlanejar({ ativas, canais, agente, aoMudar, aoAgente }: Props) {
  const alternar = (r: Rede) => {
    if (!canais.includes(r)) return aoMudar([...canais, r])
    if (canais.length > 1) aoMudar(canais.filter((c) => c !== r))
  }
  return (
    <div className="pl-canais">
      <div className="pl-canais-linha">
        {ativas.map((r) => {
          const ligado = !agente && canais.includes(r)
          return (
            <button key={r} type="button" className={`pl-canal${ligado ? ' ativo' : ''}`} disabled={agente} aria-pressed={ligado} onClick={() => alternar(r)}
              title={ligado ? `Clique para tirar ${REDES[r].nome}` : `Clique para incluir ${REDES[r].nome}`}>
              <LogoRede rede={r} tam={16} /> {REDES[r].nome}<span className="pl-canal-marca">{ligado && <Icone nome="check" tam={12} />}</span>
            </button>
          )
        })}
        <button type="button" className={`pl-agente${agente ? ' ativo' : ''}`} aria-pressed={agente} onClick={() => aoAgente(!agente)} title={AJUDA_AGENTE}>
          <span className="pl-canal-marca">{agente && <Icone nome="check" tam={12} />}</span> O agente sugere na reunião
        </button>
      </div>
      <small className="muted pl-canais-ajuda"><Icone nome="info" tam={13} />
        {agente ? ' ' + AJUDA_AGENTE : ' Clique para ligar ou desligar cada rede. Cada canal recebe as próprias peças, no formato dele (Reels no Instagram, Shorts no YouTube…). Vale para os três caminhos abaixo.'}</small>
    </div>
  )
}
