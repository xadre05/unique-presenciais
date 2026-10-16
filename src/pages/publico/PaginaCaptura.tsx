// Página pública de inscrição da Unique (/f/<endereço>): o formulário do núcleo com a marca da escola.
import { useParams } from 'react-router-dom'
import FormularioPublico from '../../crm/FormularioPublico'

export default function PaginaCaptura() {
  const { slug = '' } = useParams()
  return <FormularioPublico slug={slug} marca={<div className="captura-marca"><img src="/logo-unique.png" alt="Unique HOF Academy" /></div>}
    aviso="Ao enviar, você aceita receber o contato da equipe Unique pelo WhatsApp. Você pode pedir para sair quando quiser." />
}
