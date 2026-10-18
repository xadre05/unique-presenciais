// Logo de cada canal (ícones do pacote simple-icons), na cor que a tela usa para o canal.
// Canal sem ícone no pacote (LinkedIn) aparece como um selo com a inicial; e-mail e site usam ícones do sistema.
import { siFacebook, siInstagram, siPinterest, siThreads, siTiktok, siWhatsapp, siYoutube } from 'simple-icons'
import { Icone } from '../../../components/Icone'
import { REDES, type Rede } from './redes'

const CAMINHO: Partial<Record<Rede, string>> = {
  instagram: siInstagram.path, youtube: siYoutube.path, tiktok: siTiktok.path, facebook: siFacebook.path, pinterest: siPinterest.path, threads: siThreads.path, whatsapp: siWhatsapp.path,
}

export function LogoRede({ rede, tam = 16 }: { rede: Rede; tam?: number }) {
  const cor = REDES[rede].cor
  const caminho = CAMINHO[rede]
  if (rede === 'email' || rede === 'site') return <span className="mk-logo-icone" style={{ color: cor }}><Icone nome={rede === 'email' ? 'email' : 'globo'} tam={tam} /></span>
  if (!caminho) return <span className="mk-logo-selo" style={{ width: tam, height: tam, background: cor, fontSize: tam * 0.62 }} aria-hidden>{REDES[rede].nome[0]}</span>
  return <svg className="mk-logo-rede" width={tam} height={tam} viewBox="0 0 24 24" aria-hidden><path d={caminho} fill={cor} /></svg>
}
