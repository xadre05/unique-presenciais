// Retrato do agente (corpo inteiro, feito no GPT). O estado aparece por cima: brilho quando trabalha, "!" quando espera aprovação.
import { Personagem, type Estado } from './Personagem'
import { visualDe } from './comum'

export function Retrato({ agente, estado, alto = 220, aguardando }: { agente: string; estado: Estado; alto?: number; aguardando?: number }) {
  const v = visualDe(agente)
  if (!v.foto) return <Personagem cor={v.cor} estado={estado} tam={alto} />
  return (
    <div className={`retrato est-${estado}`} style={{ height: alto, ['--cor-agente' as string]: v.cor }}>
      <img src={v.foto} alt={`Agente ${v.nome}`} loading="lazy" />
      {estado === 'esperando' && <span className="retrato-balao" title={`${aguardando ?? ''} peça(s) esperando sua aprovação`}>{aguardando || '!'}</span>}
    </div>
  )
}
