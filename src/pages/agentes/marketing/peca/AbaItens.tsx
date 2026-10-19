// Aba dos itens da peça: lâminas (carrossel), cenas (vídeo curto), blocos (vídeo longo, live), telas (stories),
// páginas (PDF), intertítulos (artigo), opções (enquete), variações (mensagem, e-mail).
// Lista à esquerda (arrastar para mudar a ordem) e o item escolhido à direita, com o ajuste pela IA.
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'
import type { Peca, Trabalho } from '../../comum'
import { configDe, nomesItem } from './editor'
import type { Arte, Item, Rascunho } from './modelo'
import { BotaoCopiar, CampoEditor } from './CampoEditor'
import { AjusteIA, type Alcance } from './AjusteIA'
import { ImagensParaUsar } from './ImagensArte'
import { AjudaOrientacao } from './AjudaOrientacao'
import { dicaDe, usoDoItem } from './guiasOrientacao'
import { useNomesPessoas } from '../../PessoasMarca'
import { EMPRESA } from '../useMarketing'

type Props = {
  peca: Peca; r: Rascunho; mudar: (c: Partial<Rascunho>) => void; atual: number; setAtual: (i: number) => void
  rodando: Trabalho | null; ultimo: Trabalho | null; antes: () => Promise<unknown>; aoPedir: () => void
}
const VAZIO: Item = { titulo: '', texto: '', orientacao: '' }
const mover = <T,>(lista: T[], de: number, para: number) => { const l = [...lista]; const [x] = l.splice(de, 1); l.splice(para, 0, x); return l }
const minusc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function alcancesDe(tipo: string, n: number, item: Item): Alcance[] {
  const { singular, plural } = nomesItem(tipo)
  const nome = `${singular} ${n + 1}${item.titulo ? ` ("${item.titulo}")` : ''}`
  const orient = item.orientacao.trim() ? ` Orientação da equipe para este item: ${item.orientacao.trim()}.` : ''
  return [
    { id: 'item', nome: `Só esta ${minusc(singular)}`, instrucao: (p) => `Ajuste SOMENTE o item ${n + 1} do roteiro (${nome}). Pedido: ${p}.${orient} Mantenha todos os outros itens, a legenda e o resto exatamente como estão, com a mesma quantidade de itens.` },
    { id: 'todos', nome: `Todas as ${minusc(plural)}`, instrucao: (p) => `Ajuste os itens do roteiro (${minusc(plural)}). Pedido: ${p}. Mantenha a legenda, a chamada e o resto como estão.` },
    { id: 'peca', nome: 'Peça inteira', instrucao: (p) => p },
  ]
}

export function AbaItens({ peca, r, mudar, atual, setAtual, rodando, ultimo, antes, aoPedir }: Props) {
  const cfg = configDe(peca.tipo)
  const { singular, plural } = nomesItem(peca.tipo)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const i = Math.min(atual, Math.max(0, r.itens.length - 1))
  const item = r.itens[i]
  const porItem = cfg.artes === 'por_item'
  const nomesPessoas = useNomesPessoas(EMPRESA, r.visual.pessoas ?? [])
  const completo = !!(cfg.item.titulo && cfg.item.texto)

  const mudarItem = (c: Partial<Item>) => mudar({ itens: r.itens.map((x, j) => (j === i ? { ...x, ...c } : x)) })
  const artesAlinhadas = (n: number): Arte[] => Array.from({ length: n }, (_, j) => r.artes[j] ?? {})
  const adicionar = () => { mudar({ itens: [...r.itens, { ...VAZIO }], ...(porItem ? { artes: artesAlinhadas(r.itens.length + 1) } : {}) }); setAtual(r.itens.length) }
  const tirar = () => { mudar({ itens: r.itens.filter((_, j) => j !== i), ...(porItem ? { artes: artesAlinhadas(r.itens.length).filter((_, j) => j !== i) } : {}) }); setAtual(Math.max(0, i - 1)) }
  const soltar = (para: number) => {
    if (arrastando === null || arrastando === para) return setArrastando(null)
    mudar({ itens: mover(r.itens, arrastando, para), ...(porItem ? { artes: mover(artesAlinhadas(r.itens.length), arrastando, para) } : {}) })
    setAtual(para); setArrastando(null)
  }
  const nomeDe = (x: Item) => x.titulo || x.texto.split('\n')[0] || `${singular} sem texto`

  return (
    <div className="pp-itens">
      <aside className="pp-lista">
        <header><b>{plural}</b><span className="muted pequeno">{r.itens.length}</span></header>
        <ol>
          {r.itens.map((x, j) => (
            <li key={j} draggable className={`${j === i ? 'ativo' : ''}${arrastando === j ? ' arrastando' : ''}`}
              onDragStart={(e) => { setArrastando(j); e.dataTransfer.effectAllowed = 'move' }} onDragOver={(e) => e.preventDefault()} onDrop={() => soltar(j)} onDragEnd={() => setArrastando(null)}>
              <button type="button" onClick={() => setAtual(j)}>
                <span className="pp-num">{j + 1}</span>
                <span className="pp-lista-nome">{cfg.item.capa && j === 0 && <small>Capa</small>}{nomeDe(x)}</span>
                <span className="pp-arrastar" title="Arraste para mudar a ordem"><Icone nome="arrastar" tam={16} /></span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="pp-adicionar" onClick={adicionar}><Icone nome="mais" tam={16} /> Adicionar {minusc(singular)}</button>
      </aside>

      <section className="pp-item">
        {!item ? (
          <div className="pp-vazio"><Icone nome="lista" tam={28} /><p>{peca.tipo === 'texto' ? 'Sem enquete. Adicione opções de resposta para virar enquete.' : `Nenhuma ${minusc(singular)} ainda.`}</p>
            <button className="btn btn-contorno-ouro" onClick={adicionar}><Icone nome="mais" tam={16} /> Adicionar {minusc(singular)}</button></div>
        ) : (<>
          <header className="pp-item-topo">
            <b>{singular} {i + 1} de {r.itens.length}{cfg.item.capa && i === 0 ? ' · Capa' : ''}</b>
            <div className="pp-item-setas">
              <button className="btn btn-quadrado" aria-label="Anterior" disabled={i === 0} onClick={() => setAtual(i - 1)}><Icone nome="esquerda" /></button>
              <button className="btn btn-quadrado" aria-label="Próximo" disabled={i >= r.itens.length - 1} onClick={() => setAtual(i + 1)}><Icone nome="seta_dir" /></button>
              <button className="btn btn-quadrado" aria-label={`Tirar ${minusc(singular)}`} title={`Tirar ${minusc(singular)}`} onClick={tirar}><Icone nome="lixeira" /></button>
            </div>
          </header>
          {cfg.item.titulo && <CampoEditor id={`item-t-${i}`} rotulo={cfg.item.titulo} valor={item.titulo} mudar={(v) => mudarItem({ titulo: v.replace(/\n/g, ' ') })} max={cfg.item.maxTitulo} />}
          {cfg.item.texto && <CampoEditor id={`item-x-${i}`} rotulo={cfg.item.texto} valor={item.texto} mudar={(v) => mudarItem({ texto: v })} max={cfg.item.maxTexto} linhas={peca.tipo === 'video' || peca.tipo === 'live' ? 7 : 4} />}
          {completo && <CampoEditor id={`item-o-${i}`} rotulo={`Orientação para esta ${minusc(singular)}`} valor={item.orientacao} mudar={(v) => mudarItem({ orientacao: v })} linhas={2}
            placeholder={dicaDe(usoDoItem(peca.tipo)) ?? 'Ex.: destacar o benefício principal'} dica="Fica com a peça e vai junto quando você pede ajuste à IA." />}
          {completo && usoDoItem(peca.tipo) && <AjudaOrientacao uso={usoDoItem(peca.tipo)!} tipo={peca.tipo} valor={item.orientacao} mudar={(v) => mudarItem({ orientacao: v })}
            pessoas={nomesPessoas} imagens={porItem ? (r.artes[i]?.elementos ?? []).map((x) => x.nome) : []} />}
          {porItem && <ImagensParaUsar pecaId={peca.id} lista={r.artes[i]?.elementos ?? []} onde={`nesta ${minusc(singular)}`}
            mudar={(elementos) => mudar({ artes: Array.from({ length: Math.max(r.itens.length, r.artes.length) }, (_, j) => (j === i ? { ...r.artes[j], elementos } : r.artes[j] ?? {})) })} />}
          <div className="pp-item-rodape">
            <span className="muted pequeno"><Icone nome="info" tam={14} /> Texto editável{porItem ? ` · ${r.artes[i]?.arquivo ? 'arte enviada' : 'arte ainda não gerada'}` : ''}</span>
            <BotaoCopiar texto={[item.titulo, item.texto].filter(Boolean).join('\n')} />
          </div>
          <AjusteIA peca={peca} rodando={rodando} ultimo={ultimo} titulo={`O que deseja ajustar nesta ${minusc(singular)}?`}
            placeholder={peca.tipo === 'reels' ? 'Ex.: o gancho está fraco; comece com uma pergunta' : 'Ex.: deixe o título mais curto e direto'}
            alcances={alcancesDe(peca.tipo, i, item)} antes={antes} aoPedir={aoPedir} />
        </>)}
      </section>
    </div>
  )
}
