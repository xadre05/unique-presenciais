// Quando a empresa não tem o Agente Editor de Vídeo: mostra quem ele é e leva para contratar.
// O vídeo já editado por outra pessoa não precisa dele: segue direto para a publicação.
import { Link } from 'react-router-dom'
import { Retrato } from '../../Retrato'
import { visualDe } from '../../comum'

export function ConviteEditor() {
  const a = visualDe('editor')
  return (
    <section className="ev-convite" style={{ ['--cor-agente' as string]: a.cor }}>
      <Retrato agente="editor" estado="parado" alto={140} />
      <div>
        <h4>Editar este vídeo com o Agente {a.nome}</h4>
        <p className="pequeno">{a.descricao}</p>
        <p className="muted pequeno">Ele é um agente à parte, que a sua empresa ainda não tem. O vídeo já veio editado? Não precisa dele: siga para a publicação normalmente.</p>
        <Link to="/agentes/editor" className="btn btn-ouro btn-mini">Conhecer o Editor de Vídeo</Link>
      </div>
    </section>
  )
}
