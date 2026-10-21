// Criativos de anúncio que o Agente Editor concluiu: ficam aqui, prontos para o Tráfego subir na campanha (não vão
// para a Produção do Marketing). Cada um com o vídeo para baixar e a campanha.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { edicaoDa, linkDoFinal, type VideoFinal } from '../marketing/edicao/dados'

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

function Baixar({ final }: { final: VideoFinal }) {
  const [erro, setErro] = useState(false)
  // a aba abre já no clique (senão o navegador bloqueia) e recebe o link quando ele fica pronto
  const abrir = async () => { const aba = window.open('about:blank', '_blank'); try { const url = await linkDoFinal(final); if (aba) aba.location.href = url } catch { aba?.close(); setErro(true) } }
  return <button type="button" className="btn btn-mini" onClick={abrir} title={erro ? 'Não consegui gerar o link' : undefined}><Icone nome="importar" tam={13} /> Baixar</button>
}

export function EntreguesTrafego({ pecas }: { pecas: Peca[] }) {
  const lista = pecas.filter((p) => edicaoDa(p.conteudo).concluida?.destino === 'trafego')
  if (!lista.length) return null
  return (
    <section className="bloco">
      <h2>Entregues ao Tráfego</h2>
      <p className="muted pequeno">Criativos de anúncio editados e prontos para subir na campanha.</p>
      <table className="tabela">
        <thead><tr><th>Criativo</th><th>Concluído</th><th /></tr></thead>
        <tbody>{lista.map((p) => {
          const e = edicaoDa(p.conteudo)
          return (
            <tr key={p.id}>
              <td>{p.titulo}</td><td>{dia(e.concluida!.em)}</td>
              <td className="ia-linha">{e.final && <Baixar final={e.final} />}<Link className="btn btn-mini" to={`/agentes/editor/video/${p.id}`}>Abrir</Link></td>
            </tr>
          )
        })}</tbody>
      </table>
    </section>
  )
}
