// Coluna da direita do detalhe da peça: Detalhes (sempre) e um cartão que muda com a aba —
// arquivos do item e resumo (itens e textos), revisão da arte (aba visual) ou a versão selecionada (versões).
import type { Peca } from '../../comum'
import { infoFormato } from '../formatos'
import { nomeSituacao } from '../etapas'
import { configDe, nomesItem, type AbaId } from './editor'
import { conteudoDe, type Rascunho, type Versao } from './modelo'
import { estagioDe } from './progresso'
import { BotaoEnviar, Miniatura, pastaDa } from './arquivos'
import { ORIGEM } from './AbaVersoes'
import { DetalhesPeca } from './DetalhesPeca'
import { BotaoCriarArte } from './AvisoArte'
import type { Campanha } from '../useMarketing'
import type { Plano } from '../planos'

type Props = {
  peca: Peca; r: Rascunho; mudar: (c: Partial<Rascunho>) => void; aba: AbaId; atual: number; versao: Versao | undefined
  campanhas: Campanha[]; planos: Plano[]; ocupada: boolean; antes: () => Promise<unknown>; aoMudar: () => void
}
const minusc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function Linhas({ itens }: { itens: [string, React.ReactNode][] }) {
  return <dl className="pp-dl">{itens.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
}

function ArquivosItem({ peca, r, mudar, atual }: Pick<Props, 'peca' | 'r' | 'mudar' | 'atual'>) {
  const { singular } = nomesItem(peca.tipo)
  const i = Math.min(atual, Math.max(0, r.itens.length - 1))
  const arte = r.artes[i] ?? {}
  const guardar = (caminho?: string, nome?: string) => mudar({ artes: Array.from({ length: Math.max(r.itens.length, r.artes.length) }, (_, j) => (j === i ? { ...arte, arquivo: caminho, nome } : r.artes[j] ?? {})) })
  return (
    <section className="pp-cartao">
      <header><h3>Arquivos da {minusc(singular)}</h3></header>
      {arte.arquivo ? <Miniatura caminho={arte.arquivo} nome={arte.nome} proporcao={r.visual.proporcao} /> : <p className="muted pequeno">Nenhum arquivo para a {minusc(singular)} {i + 1}.</p>}
      <div className="pp-botoes-lado">
        <BotaoEnviar pasta={pastaDa(peca.id)} texto="Enviar arte pronta" aoEnviar={(c, n) => guardar(c, n)} />
        <BotaoCriarArte texto="Criar arte" classe="btn btn-contorno" />
      </div>
      {arte.arquivo && <button className="link pequeno" onClick={() => guardar(undefined, undefined)}>Tirar arquivo</button>}
    </section>
  )
}

function Resumo({ peca, r }: Pick<Props, 'peca' | 'r'>) {
  const cfg = configDe(peca.tipo)
  const { plural } = nomesItem(peca.tipo)
  const hashtags = r.hashtags.split(/\s+/).filter(Boolean).length
  const itens: [string, React.ReactNode][] = []
  if (cfg.abas.some((a) => a.id === 'itens')) itens.push([plural, r.itens.length])
  if (r.legenda) itens.push([cfg.legenda.find((c) => c.campo === 'legenda')?.rotulo ?? cfg.principal.find((c) => c.campo === 'legenda')?.rotulo ?? 'Texto', `${r.legenda.length} caracteres`])
  if (infoFormato(peca.tipo).campos.hashtags && cfg.legenda.length) itens.push(['Hashtags', hashtags])
  if (cfg.artes === 'por_item') itens.push(['Artes', `${r.artes.filter((a) => a.arquivo).length} de ${r.itens.length}`])
  itens.push(['Situação', nomeSituacao(peca)])
  return <section className="pp-cartao"><header><h3>Resumo {peca.tipo === 'carrossel' ? 'do carrossel' : 'da peça'}</h3></header><Linhas itens={itens} /></section>
}

function RevisaoArte({ peca, r }: Pick<Props, 'peca' | 'r'>) {
  const cfg = configDe(peca.tipo)
  const c = conteudoDe(peca)
  const total = cfg.artes === 'por_item' ? r.itens.length : cfg.artes ? 1 : 0
  const prontas = Array.from({ length: total }, (_, j) => r.artes[j]?.arquivo).filter(Boolean).length
  const s = estagioDe(peca)
  const proxima = s === 'texto' || s === 'ideia' ? `Aprovar o ${minusc(infoFormato(peca.tipo).material)}`
    : s === 'producao' ? (cfg.etapa2?.arquivos && prontas < total ? `Enviar ${total - prontas === 1 ? 'a arte que falta' : `as ${total - prontas} artes que faltam`}` : cfg.etapa2?.acao ?? 'Revisão final')
      : s === 'final' ? 'Aprovar a peça' : 'Nenhuma'
  return (
    <section className="pp-cartao"><header><h3>Revisão {cfg.rotuloArte === 'Arte' ? 'da arte' : `de ${minusc(cfg.rotuloArte)}`}</h3></header>
      <Linhas itens={[['Arquivos', `${prontas}/${total}`], ['Aprovação', <span className={`pp-selo${c.producao_ok ? ' ok' : ''}`}>{c.producao_ok ? 'Aprovada' : 'Pendente'}</span>], ['Próxima ação', proxima]]} />
    </section>
  )
}

function VersaoSelecionada({ versao }: { versao: Versao }) {
  const arquivos = (versao.dados.artes ?? []).filter((a) => a.arquivo).length
  return (
    <section className="pp-cartao"><header><h3>Versão selecionada</h3></header>
      <Linhas itens={[['Versão', `v${versao.n}`], ['Criada por', versao.por], ['Origem', ORIGEM[versao.origem]], ['Arquivos', arquivos],
        ['Aprovação', <span className={`pp-selo${versao.aprovada ? ' ok' : ''}`}>{versao.aprovada ? 'Aprovada' : 'Não aprovada'}</span>]]} />
    </section>
  )
}

export function LadoPeca(p: Props) {
  const cfg = configDe(p.peca.tipo)
  return (
    <aside className="pp-lado">
      <DetalhesPeca peca={p.peca} proporcao={p.r.visual.proporcao} campanhas={p.campanhas} planos={p.planos} ocupada={p.ocupada} antes={p.antes} aoMudar={p.aoMudar} />
      {p.aba === 'itens' && cfg.artes === 'por_item' && p.r.itens.length > 0 && <ArquivosItem {...p} />}
      {(p.aba === 'itens' || p.aba === 'principal' || p.aba === 'legenda') && <Resumo {...p} />}
      {p.aba === 'visual' && <RevisaoArte {...p} />}
      {p.aba === 'versoes' && p.versao && <VersaoSelecionada versao={p.versao} />}
    </aside>
  )
}
