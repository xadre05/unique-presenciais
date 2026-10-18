// Topo do detalhe da peça: trilha (Produção / Detalhe da peça), voltar para Todas as peças, avatar do agente,
// título (clica no lápis para editar), selos (canal, formato · itens, planejamento, situação), situação do
// salvamento, menu ⋯ e a régua de etapas (Texto → Arte/Gravação → Revisão final).
import { useEffect, useRef, useState } from 'react'
import { Voltar } from '../../../../components/Voltar'
import { Icone } from '../../../../components/Icone'
import { textoDaPeca, type Peca } from '../../comum'
import { REDES, nomeFormato, redeDe } from '../redes'
import { ETAPA, etapaDe, nomeSituacao, tamanho } from '../etapas'
import { LogoRede } from '../LogoRede'
import type { Plano } from '../planos'
import { passosDe, estagioDe } from './progresso'
import { copiarTexto } from './CampoEditor'
import type { Estado } from './useEdicao'

type Props = {
  peca: Peca; titulo: string; mudarTitulo: (t: string) => void; planos: Plano[]; estado: Estado; salvoEm: string | null; ocupado: boolean
  aoVoltar: () => void; aoVoltarRevisao: () => void; aoDescartar: () => void
}

function Salvamento({ estado, salvoEm }: { estado: Estado; salvoEm: string | null }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t) }, [])
  if (estado === 'salvando') return <span className="pp-salvo">Salvando…</span>
  if (estado === 'alterado') return <span className="pp-salvo">Alterações não salvas</span>
  if (estado === 'erro') return <span className="pp-salvo erro-txt">Não foi possível salvar</span>
  if (!salvoEm) return <span className="pp-salvo">Tudo salvo</span>
  const min = Math.floor((Date.now() - new Date(salvoEm).getTime()) / 60000)
  return <span className="pp-salvo">{min < 1 ? 'Salvo agora' : `Salvo há ${min} min`}</span>
}

function Menu({ itens }: { itens: { nome: string; icone: string; acao: () => void; perigo?: boolean }[] }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  return (
    <div className="pp-menu" ref={caixa}>
      <button type="button" className="btn btn-quadrado" aria-label="Mais opções" aria-expanded={aberto} onClick={() => setAberto(!aberto)}><Icone nome="pontos" /></button>
      {aberto && <div className="mk-menu" role="menu">{itens.map((i) => <button key={i.nome} role="menuitem" className={i.perigo ? 'perigo' : ''} onClick={() => { setAberto(false); i.acao() }}><Icone nome={i.icone} tam={15} /> {i.nome}</button>)}</div>}
    </div>
  )
}

export function CabecalhoPeca({ peca, titulo, mudarTitulo, planos, estado, salvoEm, ocupado, aoVoltar, aoVoltarRevisao, aoDescartar }: Props) {
  const [editando, setEditando] = useState(false)
  const rede = redeDe(peca)
  const livre = !!peca.conteudo.livre
  const plano = planos.find((p) => p.id === peca.conteudo.plano)
  const etapa = etapaDe(peca)
  const s = estagioDe(peca)
  const qtd = tamanho(peca)
  const menu = [
    { nome: 'Copiar conteúdo', icone: 'copiar', acao: () => copiarTexto(textoDaPeca(peca)) },
    ...(s !== 'texto' && s !== 'ideia' && s !== 'descartada' ? [{ nome: 'Voltar para revisão', icone: 'atualizar', acao: aoVoltarRevisao }] : []),
    ...(etapa !== 'publicado' ? [{ nome: s === 'ideia' ? 'Descartar ideia' : 'Descartar peça', icone: 'lixeira', acao: aoDescartar, perigo: true }] : []),
  ]
  return (
    <header className="pp-cabecalho">
      <nav className="pp-trilha"><button type="button" onClick={aoVoltar}><Icone nome="esquerda" tam={14} /> Produção</button><span>/</span><span>Detalhe da peça</span></nav>
      <Voltar aoClicar={aoVoltar} texto="Todas as peças" />
      <div className="pp-topo">
        <span className={`pp-avatar${ocupado ? ' trabalhando' : ''}`}><img src="/agentes/marketing-avatar.webp?v=1" alt="" /></span>
        <div className="pp-topo-txt">
          {editando
            ? <input className="pp-titulo-campo" autoFocus value={titulo} onChange={(e) => mudarTitulo(e.target.value)} onBlur={() => setEditando(false)} onKeyDown={(e) => e.key === 'Enter' && setEditando(false)} aria-label="Título da peça" />
            : <h1 className="pp-titulo">{titulo || peca.titulo}<button type="button" className="pp-lapis" aria-label="Editar título" onClick={() => setEditando(true)}><Icone nome="lapis" tam={16} /></button></h1>}
          <div className="pp-selos">
            <span className="pp-chip">{livre ? 'Canal a definir' : <><LogoRede rede={rede} tam={15} />{REDES[rede].nome}</>}</span>
            <span className="pp-chip">{livre ? 'Formato a definir' : nomeFormato(peca.tipo, rede)}{qtd ? ` · ${qtd}` : ''}</span>
            <span className="pp-chip">{plano ? plano.nome : 'Peça avulsa'}</span>
            {etapa !== 'descartada' && <span className="pp-chip pp-chip-situacao" style={{ ['--cor-etapa' as string]: s === 'final' || s === 'producao' ? '#4cbf73' : ETAPA[etapa].cor }}>{nomeSituacao(peca)}</span>}
          </div>
        </div>
        <div className="pp-topo-dir">
          <div className="pp-topo-acoes"><Salvamento estado={estado} salvoEm={salvoEm} /><Menu itens={menu} /></div>
          <ol className="pp-regua">
            {passosDe(peca).map((p, i) => (
              <li key={i} className={p.estado}><span className="pp-regua-ponto">{p.estado === 'feito' && <Icone nome="check" tam={14} />}</span><span>{p.nome}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </header>
  )
}
