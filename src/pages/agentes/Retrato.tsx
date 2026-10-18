// Retrato do agente (imagem feita no GPT). Sem imagem, usa o bonequinho desenhado. O estado aparece por cima.
import { Personagem, type Estado } from './Personagem'
import { visualDe } from './comum'

export function Retrato({ agente, estado, tam = 220 }: { agente: string; estado: Estado; tam?: number }) {
  const v = visualDe(agente)
  if (!v.foto) return <Personagem cor={v.cor} estado={estado} tam={tam} />
  return (
    <div className={`retrato est-${estado}`} style={{ width: tam, height: tam, ['--cor-agente' as string]: v.cor }}>
      <img src={v.foto} alt="" loading="lazy" />
      {estado === 'esperando' && <span className="retrato-balao">!</span>}
    </div>
  )
}
