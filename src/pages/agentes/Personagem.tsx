// Bonequinho de cada agente na sala (desenho próprio). O jeito muda com o estado:
// trabalhando (digita no notebook), esperando aprovação (balão com "!"), parado (cochilando), em breve (apagado).
export type Estado = 'trabalhando' | 'esperando' | 'parado' | 'erro' | 'em_breve'

export function Personagem({ cor, estado, tam = 120 }: { cor: string; estado: Estado; tam?: number }) {
  return (
    <svg className={`personagem est-${estado}`} width={tam} height={tam} viewBox="0 0 120 120" role="img" aria-label={`agente ${estado}`}>
      <ellipse cx="60" cy="110" rx="34" ry="5" className="pers-sombra" />
      <g className="pers-corpo">
        {/* antena */}
        <line x1="60" y1="14" x2="60" y2="26" stroke={cor} strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="12" r="5" fill={cor} className="pers-luz" />
        {/* cabeça com visor */}
        <rect x="30" y="26" width="60" height="44" rx="18" fill={cor} />
        <rect x="38" y="35" width="44" height="26" rx="11" className="pers-visor" />
        {estado === 'parado'
          ? <g className="pers-olhos"><path d="M47 49 q5 4 10 0" /><path d="M63 49 q5 4 10 0" /></g>
          : estado === 'erro'
            ? <g className="pers-olhos"><path d="M48 44 l8 8 M56 44 l-8 8" /><path d="M64 44 l8 8 M72 44 l-8 8" /></g>
            : <g className="pers-olhos"><circle cx="52" cy="48" r="4.5" /><circle cx="68" cy="48" r="4.5" /></g>}
        {/* corpo e braços */}
        <rect x="40" y="72" width="40" height="28" rx="12" fill={cor} opacity=".85" />
        <rect x="27" y="76" width="12" height="7" rx="3.5" fill={cor} className="pers-braco-e" />
        <rect x="81" y="76" width="12" height="7" rx="3.5" fill={cor} className="pers-braco-d" />
      </g>
      {estado === 'trabalhando' && (
        <g className="pers-note">
          <path d="M30 104 h60 l-6 -16 h-48 z" className="pers-note-base" />
          <g className="pers-digitos"><circle cx="50" cy="96" r="2" /><circle cx="60" cy="96" r="2" /><circle cx="70" cy="96" r="2" /></g>
        </g>
      )}
      {estado === 'esperando' && (
        <g className="pers-balao"><circle cx="98" cy="24" r="13" /><text x="98" y="30" textAnchor="middle">!</text></g>
      )}
      {estado === 'parado' && <text x="92" y="26" className="pers-zz">z z</text>}
    </svg>
  )
}
