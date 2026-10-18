// Logo de cada canal (ícones do pacote simple-icons), na cor que a tela usa para o canal.
// Canal sem ícone no pacote (LinkedIn) aparece como um selo com a inicial.
import { siFacebook, siInstagram, siPinterest, siThreads, siTiktok, siYoutube } from 'simple-icons'
import { REDES, type Rede } from './redes'

const CAMINHO: Partial<Record<Rede, string>> = {
  instagram: siInstagram.path, youtube: siYoutube.path, tiktok: siTiktok.path, facebook: siFacebook.path, pinterest: siPinterest.path, threads: siThreads.path,
}

export function LogoRede({ rede, tam = 16 }: { rede: Rede; tam?: number }) {
  const cor = REDES[rede].cor
  const caminho = CAMINHO[rede]
  if (!caminho) return <span className="mk-logo-selo" style={{ width: tam, height: tam, background: cor, fontSize: tam * 0.62 }} aria-hidden>{REDES[rede].nome[0]}</span>
  return <svg className="mk-logo-rede" width={tam} height={tam} viewBox="0 0 24 24" aria-hidden><path d={caminho} fill={cor} /></svg>
}
