// Bloco "Multiplicar criativos" dentro das partes: aparece quando há mais de uma abertura ou mais de um final.
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { combinacoes, criarCriativos } from './combinar'
import type { Parte } from './dados'

type Props = { peca: Peca; partes: Parte[]; ordem: number[]; ocupado: boolean; ouvirTodas: () => Promise<Parte[]> }

export function CombinarCriativos({ peca, partes, ordem, ocupado, ouvirTodas }: Props) {
  const [andamento, setAndamento] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [feitos, setFeitos] = useState(0)
  // a combinação igual ao vídeo que está sendo montado aqui não vira outro vídeo
  const combos = combinacoes(partes, ordem).filter((c) => c.indices.join() !== ordem.join())
  if (!combos.length) return null
  const aberturas = partes.filter((p) => p.papel === 'gancho' && !p.fora).length
  const finais = partes.filter((p) => p.papel === 'chamada' && !p.fora).length

  const criar = async () => {
    setErro(null); setFeitos(0)
    try {
      setAndamento('Ouvindo as partes…')
      const lidas = await ouvirTodas()
      const ids = await criarCriativos({ peca, partes: lidas, combos: combinacoes(lidas, ordem).filter((c) => c.indices.join() !== ordem.join()), aoProgresso: setAndamento })
      setFeitos(ids.length)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui criar os criativos.') } finally { setAndamento(null) }
  }

  return (
    <div className="pt-combinar">
      <p className="pequeno"><Icone nome="ideia" tam={14} /> <b>{aberturas > 1 ? `${aberturas} aberturas` : '1 abertura'} × {finais > 1 ? `${finais} finais` : '1 final'}</b>: além deste vídeo, dá para montar <b>mais {combos.length} criativo(s)</b> com o mesmo conteúdo no meio.</p>
      <ul className="pequeno muted">{combos.map((c) => <li key={c.indices.join()}>{c.rotulo}</li>)}</ul>
      {feitos > 0
        ? <p className="pequeno pt-ocupado">Pronto: {feitos} vídeo(s) novo(s) na lista de Vídeos do Editor, cada um com a fala já pronta. Abra cada um para editar (cada edição tem o custo normal do agente).</p>
        : <button type="button" className="btn btn-contorno-ouro btn-mini" disabled={ocupado || !!andamento} onClick={criar}>Criar os {combos.length} criativos</button>}
      {andamento && <p className="pequeno pt-ocupado">{andamento}</p>}
      {erro && <p className="nota pequeno"><Icone nome="alerta" tam={14} /> {erro}</p>}
    </div>
  )
}
