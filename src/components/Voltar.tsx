// Botão de voltar: seta num quadradinho + texto, sem sublinhado (substitui os links "← …").
import { Link } from 'react-router-dom'
import { Icone } from './Icone'

export function Voltar({ para, aoClicar, texto }: { para?: string; aoClicar?: () => void; texto: string }) {
  const conteudo = <><span className="voltar-seta"><Icone nome="esquerda" tam={16} /></span><span>{texto}</span></>
  return para
    ? <Link to={para} className="voltar">{conteudo}</Link>
    : <button type="button" className="voltar" onClick={aoClicar}>{conteudo}</button>
}
