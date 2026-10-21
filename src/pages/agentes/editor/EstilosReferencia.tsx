// Aba "Estilo da casa" do Editor: além do estilo padrão, os outros estilos que a equipe já ensinou (canais estudados e
// referências de vídeo). Não são escolhidos aqui: em cada vídeo, no passo "Estilo", escolhe-se qual usar.
import { Link } from 'react-router-dom'
import { Icone } from '../../../components/Icone'
import { useReferenciasVideo } from '../marketing/edicao/dados'

export function EstilosReferencia() {
  const refs = useReferenciasVideo()
  const lista = refs.dados ?? []
  return (
    <section className="bloco">
      <h2>Outros estilos</h2>
      <p className="muted pequeno">Estilos aprendidos com canais e vídeos de que a equipe gosta. Para usar um deles num vídeo, escolha no passo "Estilo" da edição; sem escolher, vale o estilo da casa.</p>
      {refs.carregando && !refs.dados ? <p className="muted pequeno">Carregando…</p>
        : !lista.length ? <p className="muted pequeno">Nenhum estilo ensinado ainda.</p>
          : <ul className="estilos-ref">{lista.map((r) => <li key={r.id}><Icone nome="video" tam={14} /> {r.nome || 'Referência'}{r.autor ? <span className="muted"> · {r.autor}</span> : null}</li>)}</ul>}
      <div className="ia-linha">
        <Link to="/agentes/marca?aba=conhecimento&ref=canal" className="btn btn-contorno-ouro btn-mini"><Icone nome="video" tam={14} /> Estudar um canal</Link>
        <Link to="/agentes/marca?aba=conhecimento&ref=nova" className="btn btn-contorno-ouro btn-mini"><Icone nome="mais" tam={14} /> Guardar um vídeo de referência</Link>
      </div>
    </section>
  )
}
