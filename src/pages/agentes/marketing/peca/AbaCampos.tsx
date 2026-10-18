// Aba de campos de texto: Legenda (legenda, chamada, hashtags), Título e descrição do vídeo, Corpo do e-mail,
// Texto da arte da imagem, Artigo… Os campos de cada formato vêm de editor.ts.
import type { Peca, Trabalho } from '../../comum'
import { infoFormato } from '../formatos'
import { redeDe } from '../redes'
import { limiteLegenda, type Campo, type CampoTexto } from './editor'
import type { Rascunho } from './modelo'
import { BotaoCopiar, CampoEditor } from './CampoEditor'
import { AjusteIA, type Alcance } from './AjusteIA'

type Props = {
  peca: Peca; r: Rascunho; mudar: (c: Partial<Rascunho>) => void; campos: Campo[]; nomeAba: string; pergunta: string
  rodando: Trabalho | null; ultimo: Trabalho | null; antes: () => Promise<unknown>; aoPedir: () => void
}
const DICA_CAMPO: Partial<Record<CampoTexto, string>> = { titulo: 'titulo', legenda: 'legenda', cta: 'cta', hashtags: 'hashtags', texto_arte: 'texto_arte', apoio: 'roteiro', prompt_imagem: 'prompt_imagem', observacao: 'observacao' }
const valor = (r: Rascunho, c: CampoTexto) => (c === 'titulo' ? r.titulo : r[c])

function alcancesDe(campos: Campo[], nomeAba: string): Alcance[] {
  const lista = (cs: Campo[]) => cs.map((c) => `${c.rotulo} (campo ${DICA_CAMPO[c.campo]})`).join(', ')
  const so = (cs: Campo[]) => (p: string) => `Ajuste SOMENTE estes campos: ${lista(cs)}. Pedido: ${p}. Mantenha todos os outros campos exatamente como estão.`
  const alcances: Alcance[] = [{ id: 'aba', nome: `${nomeAba} completa`.replace(/^(Texto da arte|Artigo|E-mail|Texto) completa$/, '$1 completo').replace(' e descrição completa', ' e descrição'), instrucao: so(campos) }]
  const cta = campos.find((c) => c.campo === 'cta')
  if (cta && campos.length > 1) alcances.push({ id: 'cta', nome: `Só ${cta.rotulo.toLowerCase()}`, instrucao: so([cta]) })
  const hash = campos.find((c) => c.campo === 'hashtags')
  if (hash) alcances.push({ id: 'hashtags', nome: 'Só as hashtags', instrucao: so([hash]) })
  alcances.push({ id: 'peca', nome: 'Peça inteira', instrucao: (p) => p })
  return alcances
}

export function AbaCampos({ peca, r, mudar, campos, nomeAba, pergunta, rodando, ultimo, antes, aoPedir }: Props) {
  const comHashtags = infoFormato(peca.tipo).campos.hashtags
  const visiveis = campos.filter((c) => c.campo !== 'hashtags' || comHashtags)
  const limite = limiteLegenda(redeDe(peca))
  const tudo = visiveis.map((c) => valor(r, c.campo)).filter((v) => v.trim()).join('\n\n')
  return (
    <div className="pp-campos">
      {visiveis.map((c) => (
        <CampoEditor key={c.campo} id={`campo-${c.campo}`} rotulo={c.rotulo} valor={valor(r, c.campo)} linhas={c.linhas} dica={c.dica}
          max={c.max ?? (c.campo === 'legenda' ? limite : undefined)} placeholder={c.campo === 'hashtags' ? '#harmonizacaofacial #hof' : undefined}
          mudar={(v) => mudar(c.campo === 'titulo' ? { titulo: v } : { [c.campo]: v })} />
      ))}
      <div className="pp-item-rodape"><span className="muted pequeno">Texto pronto para colar no canal.</span><BotaoCopiar texto={tudo} rotulo={`Copiar ${nomeAba.toLowerCase()}`} /></div>
      <AjusteIA peca={peca} rodando={rodando} ultimo={ultimo} titulo={pergunta} placeholder="Ex.: deixe mais curto e termine com uma pergunta"
        alcances={alcancesDe(visiveis, nomeAba)} antes={antes} aoPedir={aoPedir} />
    </div>
  )
}
