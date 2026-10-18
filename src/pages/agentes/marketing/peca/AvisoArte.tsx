// Botão "Criar arte" enquanto o Agente de Arte não está ligado: em vez de ficar apagado, explica o que falta.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icone } from '../../../../components/Icone'

export function BotaoCriarArte({ texto, classe = 'btn btn-contorno-ouro' }: { texto: string; classe?: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" className={classe} onClick={() => setAberto(!aberto)}><Icone nome="floco" tam={16} /> {texto}</button>
      {aberto && (
        <div className="mk-aviso mk-aviso-info pp-aviso-arte">
          <Icone nome="info" tam={18} />
          <span><b>O Agente de Arte ainda não está ligado.</b> Ele usa a IA de imagem da OpenAI e falta a chave dela em <Link to="/agentes/central" className="link">Configurações</Link>.
            Enquanto isso, faça a arte onde preferir (Canva, ChatGPT, designer) seguindo a orientação desta peça e use <b>Enviar arte pronta</b>.</span>
        </div>
      )}
    </>
  )
}
