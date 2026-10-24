// Ritmo de envio pelo WhatsApp do próprio celular: o WhatsApp bloqueia quem manda muitas mensagens iguais em
// sequência. Conta quantas a vendedora mandou hoje e mostra quanto esperar até a próxima (2 a 3 minutos entre uma e
// outra, uma pausa maior a cada 5 e um teto de 50 por dia, como no guia). Só orienta: nunca trava o botão.
// Fica no navegador dela (é só uma ajuda de ritmo, não um registro: o registro é a marcação na lista).
import { useEffect, useState } from 'react'
import { Icone } from '../../components/Icone'

const ENTRE = 150, PAUSA = 12 * 60, BLOCO = 5, TETO = 50
type Dia = { dia: string; envios: number[] }

const chaveDe = (usuario: string) => `ritmo-envio:${usuario}`
const hojeLocal = () => new Date().toLocaleDateString('sv-SE')
function ler(usuario: string): Dia {
  try {
    const d = JSON.parse(localStorage.getItem(chaveDe(usuario)) ?? 'null') as Dia | null
    return d && d.dia === hojeLocal() ? d : { dia: hojeLocal(), envios: [] }
  } catch { return { dia: hojeLocal(), envios: [] } }
}
function gravar(usuario: string, d: Dia) { try { localStorage.setItem(chaveDe(usuario), JSON.stringify(d)) } catch { /* sem armazenamento: segue sem contar */ } }

// segundos que faltam para a próxima mensagem (0 = pode mandar)
function espera(d: Dia, agora: number) {
  const ultimo = d.envios[d.envios.length - 1]
  if (!ultimo) return 0
  const intervalo = d.envios.length % BLOCO === 0 ? PAUSA : ENTRE
  return Math.max(0, Math.round((ultimo + intervalo * 1000 - agora) / 1000))
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function useRitmo(usuario: string) {
  const [dia, setDia] = useState<Dia>(() => ler(usuario))
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { setDia(ler(usuario)) }, [usuario])
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const registrar = () => { const d = ler(usuario); const novo = { ...d, envios: [...d.envios, Date.now()] }; gravar(usuario, novo); setDia(novo) }
  return { enviadas: dia.envios.length, falta: espera(dia, agora), registrar }
}

export function PainelRitmo({ enviadas, falta }: { enviadas: number; falta: number }) {
  if (!enviadas) return <p className="muted pequeno ritmo-envio">Ritmo seguro: uma mensagem a cada 2 ou 3 minutos, uma pausa de 10 a 15 minutos a cada 5, e no máximo {TETO} por dia.</p>
  const pausaLonga = enviadas % BLOCO === 0 && falta > ENTRE
  return (
    <div className={`ritmo-envio${falta ? ' esperar' : ' pode'}`} role="status">
      <Icone nome={falta ? 'relogio' : 'check'} tam={16} />
      <span><b>{enviadas}</b> de {TETO} hoje</span>
      <span>{enviadas >= TETO ? 'Chegou no limite de hoje. Amanhã tem mais.' : falta ? `${pausaLonga ? 'Pausa' : 'Próxima'} em ${mmss(falta)}` : 'Pode mandar a próxima'}</span>
    </div>
  )
}
