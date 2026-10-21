// Banco de imagens da marca (mídias de apoio): fotos do presencial, prints da plataforma e da página de vendas,
// bastidores e clipes curtos. Cada uma tem título, descrição, etiquetas, campanha e a autorização de uso (antes e
// depois de paciente só com autorização). O Agente Editor de Vídeo usa estas mídias por cima da fala em todo vídeo,
// e é pela descrição que ele escolhe o momento certo. Grade com busca e filtros; ao clicar, o painel de detalhes.
import { useEffect, useMemo, useState } from 'react'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { BotaoEnviar, linkDe } from './marketing/peca/arquivos'
import { gravarNoPerfil } from './LogosMarca'

export type Categoria = 'foto' | 'print' | 'clipe'
export type ItemBanco = { caminho: string; nome: string; tipo: 'imagem' | 'video'; descricao?: string; campanha?: string; titulo?: string; categoria?: Categoria; etiquetas?: string[]; autorizado?: boolean }
export const bancoDe = (perfil: Record<string, unknown> | undefined) => (Array.isArray(perfil?.banco_imagens) ? perfil.banco_imagens : []) as ItemBanco[]
// o que entra num vídeo: o que é de todas as campanhas e o que é da campanha da peça
export const bancoParaCampanha = (banco: ItemBanco[], campanha?: string) => banco.filter((b) => !b.campanha || b.campanha === campanha)
// o que o agente lê de cada mídia
export const descricaoParaAgente = (b: ItemBanco) => [b.titulo, b.descricao, b.etiquetas?.length ? `etiquetas: ${b.etiquetas.join(', ')}` : '', b.autorizado ? 'uso autorizado' : ''].filter(Boolean).join(' · ') || undefined
const MAXIMO = 60
const categoriaDe = (b: ItemBanco): Categoria => b.categoria ?? (b.tipo === 'video' ? 'clipe' : 'foto')
const NOME_CAT: Record<Categoria, string> = { foto: 'Foto', print: 'Print', clipe: 'Clipe' }

function Capa({ b }: { b: ItemBanco }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let vivo = true; void linkDe(b.caminho).then((u) => vivo && setUrl(u)); return () => { vivo = false } }, [b.caminho])
  if (!url) return <div className="bi-capa"><Icone nome={b.tipo === 'video' ? 'video' : 'imagem'} tam={24} /></div>
  return <div className="bi-capa">{b.tipo === 'video' ? <video src={url} muted playsInline preload="metadata" /> : <img src={url} alt="" loading="lazy" />}
    <span className="bi-tipo"><Icone nome={b.tipo === 'video' ? 'video' : 'imagem'} tam={13} /></span></div>
}

function Detalhes({ b, campanhas, usos, aoMudar, aoTirar, aoFechar }: { b: ItemBanco; campanhas: { id: string; nome: string }[]; usos: number; aoMudar: (c: Partial<ItemBanco>) => void; aoTirar: () => void; aoFechar: () => void }) {
  const [titulo, setTitulo] = useState(b.titulo ?? '')
  const [descricao, setDescricao] = useState(b.descricao ?? '')
  const [etiqueta, setEtiqueta] = useState('')
  useEffect(() => { setTitulo(b.titulo ?? ''); setDescricao(b.descricao ?? '') }, [b.caminho]) // eslint-disable-line react-hooks/exhaustive-deps
  const salvar = () => aoMudar({ titulo: titulo.trim() || undefined, descricao: descricao.trim() || undefined })
  const mudou = titulo.trim() !== (b.titulo ?? '') || descricao.trim() !== (b.descricao ?? '')
  const addEtiqueta = () => { const e = etiqueta.trim().toLowerCase(); if (e && !(b.etiquetas ?? []).includes(e)) aoMudar({ etiquetas: [...(b.etiquetas ?? []), e] }); setEtiqueta('') }
  return (
    <aside className="bi-detalhes">
      <button type="button" className="btn btn-quadrado bi-fechar" onClick={aoFechar} aria-label="Fechar"><Icone nome="fechar" tam={16} /></button>
      <Capa b={b} />
      <label className="campo"><span>Título</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={b.nome} /></label>
      <label className="campo"><span>Descrição <small className="muted">(é por ela que o agente escolhe quando usar)</small></span>
        <textarea rows={3} maxLength={300} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: turma praticando em paciente no presencial de Brasília" />
        <small className="muted">{descricao.length}/300</small></label>
      <div className="campo"><span>Etiquetas</span>
        <div className="bi-etiquetas">{(b.etiquetas ?? []).map((e) => <span key={e}>{e} <button type="button" aria-label={`Tirar ${e}`} onClick={() => aoMudar({ etiquetas: (b.etiquetas ?? []).filter((x) => x !== e) })}>×</button></span>)}
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEtiqueta() } }} onBlur={addEtiqueta} placeholder="+ etiqueta" /></div></div>
      <div className="bi-duas">
        <label className="campo"><span>Campanha</span><span className="select-icone"><select value={b.campanha ?? ''} onChange={(e) => aoMudar({ campanha: e.target.value || undefined })}>
          <option value="">Todas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span></label>
        <label className="campo"><span>Tipo</span><span className="select-icone"><select value={categoriaDe(b)} onChange={(e) => aoMudar({ categoria: e.target.value as Categoria })}>
          {(['foto', 'print', 'clipe'] as Categoria[]).map((c) => <option key={c} value={c}>{NOME_CAT[c]}</option>)}</select></span></label>
      </div>
      <label className={`bi-autorizacao${b.autorizado ? ' ok' : ''}`}><input type="checkbox" checked={!!b.autorizado} onChange={(e) => aoMudar({ autorizado: e.target.checked })} />
        <span><b>Autorização de uso</b><small>{b.autorizado ? 'Confirmada: pode aparecer nos vídeos' : 'Marque se a pessoa da imagem autorizou (obrigatório em antes e depois)'}</small></span></label>
      <p className="muted pequeno"><Icone nome="video" tam={13} /> Usado em {usos} vídeo(s)</p>
      <div className="ia-linha">
        <button type="button" className="btn btn-ouro" disabled={!mudou} onClick={salvar}>Salvar alterações</button>
        <button type="button" className="link pequeno" onClick={aoTirar}>Tirar do banco</button>
      </div>
    </aside>
  )
}

type Props = { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void; usos?: Record<string, number> }

export function BancoImagens({ empresaId, perfil, aoSalvar, usos = {} }: Props) {
  const banco = bancoDe(perfil)
  const campanhas = ((Array.isArray(perfil.campanhas) ? perfil.campanhas : []) as { id: string; nome: string; encerrada?: boolean }[]).filter((c) => !c.encerrada)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [campanha, setCampanha] = useState('')
  const [cat, setCat] = useState<Categoria | ''>('')
  const [aberto, setAberto] = useState<string | null>(null)
  const gravar = async (lista: ItemBanco[]) => {
    setErro(null)
    const { error } = await gravarNoPerfil(empresaId, 'banco_imagens', lista)
    if (error) return setErro(msgErro(error))
    aoSalvar()
  }
  const mudar = (caminho: string, campos: Partial<ItemBanco>) => gravar(banco.map((b) => (b.caminho === caminho ? { ...b, ...campos } : b)))
  const termo = busca.trim().toLowerCase()
  const lista = useMemo(() => banco.filter((b) => (!campanha || b.campanha === campanha) && (!cat || categoriaDe(b) === cat)
    && (!termo || [b.titulo, b.nome, b.descricao, ...(b.etiquetas ?? [])].join(' ').toLowerCase().includes(termo))), [banco, campanha, cat, termo])
  const conta = (c: Categoria | '') => banco.filter((b) => !c || categoriaDe(b) === c).length
  const item = banco.find((b) => b.caminho === aberto)
  const nomeCampanha = (id?: string) => campanhas.find((c) => c.id === id)?.nome

  return (
    <div className={`bi${item ? ' com-detalhes' : ''}`}>
      <div className="bi-topo">
        <input type="search" className="bi-busca" placeholder="Buscar por descrição ou etiqueta" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="select-icone"><select value={campanha} onChange={(e) => setCampanha(e.target.value)} aria-label="Campanha"><option value="">Campanha: todas</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></span>
        {banco.length < MAXIMO && <BotaoEnviar pasta={`agentes/marca/${empresaId}/banco_imagens`} texto="Adicionar mídia" classe="btn btn-ouro"
          aceita="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
          aoEnviar={(caminho, nome) => { const video = /\.(mp4|mov|webm)$/i.test(caminho); void gravar([...banco, { caminho, nome, tipo: video ? 'video' : 'imagem', categoria: video ? 'clipe' : 'foto' }]); setAberto(caminho) }} />}
      </div>
      <div className="bi-chips">{(['', 'foto', 'print', 'clipe'] as (Categoria | '')[]).map((c) => (
        <button key={c || 'todas'} type="button" className={cat === c ? 'ativo' : ''} onClick={() => setCat(c)}>{c ? `${NOME_CAT[c]}s` : 'Todas'} <span>{conta(c)}</span></button>))}</div>
      <Erro msg={erro} />
      <div className="bi-corpo">
        {!lista.length ? <p className="muted">{banco.length ? 'Nenhuma mídia com esse filtro.' : 'Nenhuma mídia ainda. Adicione fotos do presencial, prints da plataforma e da página de vendas, bastidores e clipes curtos (até 10 MB cada).'}</p> : (
          <div className="bi-grade">{lista.map((b) => (
            <button key={b.caminho} type="button" className={`bi-cartao${aberto === b.caminho ? ' aberto' : ''}`} onClick={() => setAberto(b.caminho)}>
              <Capa b={b} />
              <b>{b.titulo || b.nome}</b>
              <small className="muted">{b.descricao || 'Sem descrição: clique para descrever'}</small>
              <span className="bi-selos">{b.campanha && <span className="ouro">{nomeCampanha(b.campanha) ?? 'Campanha'}</span>}<span>{NOME_CAT[categoriaDe(b)]}</span>{b.autorizado && <span className="ok">Autorizado</span>}</span>
            </button>
          ))}</div>
        )}
        {item && <Detalhes b={item} campanhas={campanhas} usos={usos[item.caminho] ?? 0} aoMudar={(c) => void mudar(item.caminho, c)}
          aoTirar={() => { setAberto(null); void gravar(banco.filter((x) => x.caminho !== item.caminho)) }} aoFechar={() => setAberto(null)} />}
      </div>
      <p className="bi-aviso pequeno"><Icone nome="info" tam={14} /> Aqui entram mídias de apoio (até 10 MB cada). O vídeo a editar vai em Vídeos → "Arraste um vídeo para editar", sem limite de tamanho.</p>
      <span className="muted pequeno">{banco.length} de {MAXIMO}</span>
    </div>
  )
}
