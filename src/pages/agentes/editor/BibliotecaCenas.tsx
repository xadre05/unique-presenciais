// Vitrine da biblioteca de cenas prontas (página de Estilos): cada modelo desenhado com um exemplo, para a equipe ver
// o que o agente pode colocar no vídeo. Usa o mesmo desenhista das cenas do Estúdio (isolado num iframe).
import { useEffect, useRef } from 'react'
import { Cenas } from '../marketing/edicao/cenas'
import { MODELOS_CENA, codigoDoModelo, type ModeloCena } from '../marketing/edicao/modelosCena'

const NOME: Record<ModeloCena, string> = { lista_check: 'Lista com check', numero: 'Número em destaque', recibo: 'Recibo da oferta', capitulo: 'Capítulo', comparacao: 'Comparação', passos: 'Passo a passo' }
const IDS = Object.keys(MODELOS_CENA) as ModeloCena[]
const L = 270, A = 480

export function BibliotecaCenas() {
  const telas = useRef<(HTMLCanvasElement | null)[]>([])
  useEffect(() => {
    const cenas = new Cenas(IDS.map((id) => codigoDoModelo(id, JSON.parse(MODELOS_CENA[id].dados), 'cheia')), L, A)
    let vivo = true
    void (async () => {
      for (const [n] of IDS.entries()) {
        const bmp = await cenas.quadroExato(n, 3, 4)
        const c = telas.current[n]
        if (vivo && bmp && c) c.getContext('2d')?.drawImage(bmp, 0, 0, L, A)
      }
    })()
    return () => { vivo = false; cenas.fechar() }
  }, [])
  return (
    <section className="est-cenas">
      <h3>Cenas prontas</h3>
      <p className="muted pequeno">O agente usa estas animações, no padrão da marca, sempre que a fala combina: ele escolhe a cena e preenche com o que foi dito.</p>
      <div className="est-cenas-grade">
        {IDS.map((id, n) => (
          <figure key={id}>
            <canvas ref={(c) => { telas.current[n] = c }} width={L} height={A} />
            <figcaption><b>{NOME[id]}</b><span className="muted pequeno">{MODELOS_CENA[id].quando}</span></figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
