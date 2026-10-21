// Banco de imagens da marca: fotos do presencial, prints da plataforma e da página de vendas, bastidores e clipes curtos,
// cada um com uma frase do que é (e, se quiser, a campanha a que pertence). O Agente Editor de Vídeo usa estas imagens
// por cima da fala em todo vídeo, sem a equipe precisar subir de novo. Fica no armazenamento privado "arquivos".
import { useState } from 'react'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { BotaoEnviar, Miniatura } from './marketing/peca/arquivos'
import { gravarNoPerfil } from './LogosMarca'

export type ItemBanco = { caminho: string; nome: string; tipo: 'imagem' | 'video'; descricao?: string; campanha?: string }
export const bancoDe = (perfil: Record<string, unknown> | undefined) => (Array.isArray(perfil?.banco_imagens) ? perfil.banco_imagens : []) as ItemBanco[]
// o que entra num vídeo: o que é de todas as campanhas e o que é da campanha da peça
export const bancoParaCampanha = (banco: ItemBanco[], campanha?: string) => banco.filter((b) => !b.campanha || b.campanha === campanha)
const MAXIMO = 40

type Props = { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }

export function BancoImagens({ empresaId, perfil, aoSalvar }: Props) {
  const banco = bancoDe(perfil)
  const campanhas = ((Array.isArray(perfil.campanhas) ? perfil.campanhas : []) as { id: string; nome: string; encerrada?: boolean }[]).filter((c) => !c.encerrada)
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const gravar = async (lista: ItemBanco[]) => {
    setErro(null)
    const { error } = await gravarNoPerfil(empresaId, 'banco_imagens', lista)
    if (error) return setErro(msgErro(error))
    aoSalvar()
  }
  const mudar = (caminho: string, campos: Partial<ItemBanco>) => gravar(banco.map((b) => (b.caminho === caminho ? { ...b, ...campos } : b)))
  return (
    <div className="banco">
      <p className="muted pequeno">Suba uma vez e o Editor de Vídeo usa em todos os vídeos: fotos da turma no presencial, prints da plataforma e da página de vendas, bastidores, clipes curtos (até 10 MB). Escreva o que é cada um: é assim que o agente sabe em que momento usar. Antes e depois de paciente, só com autorização (escreva "autorizado").</p>
      {banco.length > 0 && (
        <div className="ev-midias">
          {banco.map((b) => (
            <div key={b.caminho} className="ev-midia">
              {b.tipo === 'video' ? <div className="ev-mini"><Icone nome="video" tam={26} /></div> : <Miniatura caminho={b.caminho} nome={b.nome} />}
              <span className="ev-nome" title={b.nome}>{b.nome}</span>
              <input type="text" placeholder="O que é (ex.: turma praticando no presencial)" value={rascunhos[b.caminho] ?? b.descricao ?? ''}
                onChange={(e) => setRascunhos((r) => ({ ...r, [b.caminho]: e.target.value }))}
                onBlur={(e) => { if (e.target.value.trim() !== (b.descricao ?? '')) mudar(b.caminho, { descricao: e.target.value.trim() || undefined }) }} />
              <span className="select-icone"><select value={b.campanha ?? ''} aria-label={`Campanha de ${b.nome}`} onChange={(e) => mudar(b.caminho, { campanha: e.target.value || undefined })}>
                <option value="">Todas as campanhas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span>
              <button type="button" className="btn btn-mini" onClick={() => gravar(banco.filter((x) => x.caminho !== b.caminho))}>Tirar</button>
            </div>
          ))}
        </div>
      )}
      {banco.length < MAXIMO && <BotaoEnviar pasta={`agentes/marca/${empresaId}/banco_imagens`} texto="Adicionar imagem ou clipe" classe="btn btn-contorno-ouro btn-mini"
        aceita="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
        aoEnviar={(caminho, nome) => gravar([...banco, { caminho, nome, tipo: /\.(mp4|mov|webm)$/i.test(caminho) ? 'video' : 'imagem' }])} />}
      <span className="muted pequeno">{banco.length} de {MAXIMO} · uma de cada vez</span>
      <Erro msg={erro} />
    </div>
  )
}
