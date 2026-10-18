// Base da marca → Identidade visual: o logo real e as imagens de referência do estilo da marca (prints da página de
// vendas, posts que deram certo). O Agente de Arte manda essas imagens junto em toda arte: o logo entra sem ser
// redesenhado (sem logo cadastrado, ele é orientado a não inventar um) e as referências guiam fonte, cor e diagramação.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { BotaoEnviar, Miniatura } from './marketing/peca/arquivos'

export type ImagemMarca = { caminho: string; nome: string }
type Chave = 'logos' | 'estilo_refs'
type Props = { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }

// lê o perfil de novo antes de gravar, para não apagar o que outra tela salvou
async function gravarNoPerfil(empresaId: string, chave: Chave, lista: ImagemMarca[]) {
  const { data: atual } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresaId).eq('agente_id', 'marketing').maybeSingle()
  const base = (atual?.perfil ?? {}) as Record<string, unknown>
  return supabase.from('agentes_empresa').upsert({ empresa_id: empresaId, agente_id: 'marketing', perfil: { ...base, [chave]: lista }, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,agente_id' })
}

function ListaImagens({ empresaId, perfil, aoSalvar, chave, maximo, texto, dica }: Props & { chave: Chave; maximo: number; texto: string; dica: string }) {
  const imagens = (Array.isArray(perfil[chave]) ? perfil[chave] : []) as ImagemMarca[]
  const [erro, setErro] = useState<string | null>(null)
  const gravar = async (lista: ImagemMarca[]) => {
    setErro(null)
    const { error } = await gravarNoPerfil(empresaId, chave, lista)
    if (error) return setErro(msgErro(error))
    aoSalvar()
  }
  return (
    <>
      <div className="pp-refs">
        {imagens.map((l, i) => (
          <span key={l.caminho} className="pp-ref"><Miniatura caminho={l.caminho} nome={l.nome} />
            <button type="button" className="pp-cor-tirar" aria-label={`Tirar ${l.nome}`} onClick={() => gravar(imagens.filter((_, k) => k !== i))}><Icone nome="fechar" tam={12} /></button></span>
        ))}
        {imagens.length < maximo && <BotaoEnviar pasta={`agentes/marca/${empresaId}/${chave}`} texto={texto} classe="btn btn-contorno btn-mini" aceita="image/png,image/jpeg,image/webp"
          aoEnviar={(caminho, nome) => gravar([...imagens, { caminho, nome }])} />}
      </div>
      <span className="muted pequeno">{dica}</span>
      <Erro msg={erro} />
    </>
  )
}

export function LogosMarca(p: Props) {
  const temLogo = Array.isArray(p.perfil.logos) && p.perfil.logos.length > 0
  return (
    <div className="pessoas-marca">
      <h3 className="pp-rotulo">Logo</h3>
      <ListaImagens {...p} chave="logos" maximo={3} texto="Enviar logo"
        dica={`${temLogo ? 'A IA usa o primeiro logo nas artes, sem redesenhar.' : 'Sem logo, a IA não coloca logotipo nas artes.'} Prefira PNG com fundo transparente; até 3 versões (ex.: dourada, branca, preta).`} />
      <h3 className="pp-rotulo">Referências de estilo da marca</h3>
      <ListaImagens {...p} chave="estilo_refs" maximo={4} texto="Enviar referência"
        dica="Prints da página de vendas ou de posts que representam a marca. Vão junto em toda arte para manter fonte, cores e diagramação. Até 4." />
    </div>
  )
}
