// Detalhe de uma peça na Produção (modelo do GPT, 18/10/2026). O mesmo editor serve para peça avulsa ou do plano,
// e se adapta ao formato: Lâminas no carrossel, Roteiro no Reels/Shorts/vídeo, Telas no stories, Páginas no PDF,
// E-mail, Mensagem… (configuração em peca/editor.ts). Salva sozinho; cada sessão de edição vira uma versão.
// Peças: cabeçalho e régua (peca/CabecalhoPeca), abas, coluna da direita (peca/LadoPeca) e rodapé (peca/RodapePeca).
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import type { Peca, Trabalho } from '../comum'
import { lembrar } from '../memoria'
import { ehIdeia, moverPara } from './etapas'
import { ajustesDa } from './ajuste'
import { EMPRESA, pedirTrabalho, type Campanha } from './useMarketing'
import type { Plano } from './planos'
import { configDe, type AbaId } from './peca/editor'
import { versoesDe } from './peca/modelo'
import { alterarPeca, useEdicao } from './peca/useEdicao'
import { CabecalhoPeca } from './peca/CabecalhoPeca'
import { AbaItens } from './peca/AbaItens'
import { AbaCampos } from './peca/AbaCampos'
import { AbaDirecao } from './peca/AbaDirecao'
import { AbaVersoes } from './peca/AbaVersoes'
import { AbaEdicao } from './edicao/AbaEdicao'
import { LadoPeca } from './peca/LadoPeca'
import { RodapePeca } from './peca/RodapePeca'
import { ArteContexto, useArte } from './peca/AvisoArte'

const MOTIVOS = ['Texto longo demais', 'Faltou emoji', 'Emoji demais', 'Tom muito vendedor', 'Tom muito técnico', 'Não é o nosso assunto']
type Briefing = { objetivo?: string; publico?: string; duracao?: string; telas?: number; orientacao?: string }
type Props = { peca: Peca; trabalhos: Trabalho[]; campanhas: Campanha[]; planos: Plano[]; aoVoltar: () => void; aoMudar: () => void; abasTopo?: ReactNode }

function Ideia({ peca, rodando, aoGerar, aoEscrever }: { peca: Peca; rodando: boolean; aoGerar: () => void; aoEscrever: () => void }) {
  const b = ((peca.conteudo as { briefing?: Briefing }).briefing ?? {}) as Briefing
  const briefing = [b.objetivo, b.publico, b.duracao && `Duração: ${b.duracao}`, b.telas && `${b.telas} telas`, b.orientacao && `Gravação: ${b.orientacao}`].filter(Boolean)
  return (
    <div className="mk-ideia">
      <Icone nome="ideia" tam={30} />
      <p>{rodando ? 'O agente está escrevendo esta peça…' : 'Esta peça ainda é uma ideia.'}</p>
      {peca.conteudo.objetivo && <p className="muted">{peca.conteudo.objetivo}</p>}
      {briefing.length > 0 && <p className="pequeno muted">{briefing.join(' · ')}</p>}
      {rodando ? <div className="progresso"><div className="indeterminado" /><span>Escrevendo…</span></div> : (
        <div className="mk-ideia-botoes">
          <button className="btn btn-ouro" onClick={aoGerar}><Icone nome="floco" tam={16} /> Gerar rascunho com o agente</button>
          <button className="btn btn-contorno-ouro" onClick={aoEscrever} disabled={!!peca.conteudo.livre} title={peca.conteudo.livre ? 'Escolha o canal em Detalhes da peça' : ''}><Icone nome="documento" tam={16} /> Escrever eu mesmo</button>
        </div>
      )}
    </div>
  )
}

export function PaginaPeca({ peca, trabalhos, campanhas, planos, aoVoltar, aoMudar, abasTopo }: Props) {
  const cfg = configDe(peca.tipo)
  const ed = useEdicao(peca, aoMudar)
  const { r, mudar } = ed
  // ?edicao=1 (vindo do Agente Editor de Vídeo) abre direto na aba de edição
  const abaInicial = (): AbaId => { const c = configDe(peca.tipo); return new URLSearchParams(window.location.search).get('edicao') && c.abas.some((a) => a.id === 'edicao') ? 'edicao' : c.abas[0].id }
  const [aba, setAba] = useState<AbaId>(abaInicial)
  const [atual, setAtual] = useState(0)
  const [motivo, setMotivo] = useState<string | null>(null)
  const versoes = versoesDe(peca)
  const [sel, setSel] = useState(0)
  useEffect(() => { setAba(abaInicial()); setAtual(0); setMotivo(null) }, [peca.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSel(versoes.at(-2)?.n ?? versoes.at(-1)?.n ?? 0) }, [peca.id, versoes.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const abaAtiva = cfg.abas.some((a) => a.id === aba) ? aba : cfg.abas[0].id
  const { rodando, ultimo } = ajustesDa(peca, trabalhos)
  const ideia = ehIdeia(peca) || (!!rodando && !peca.conteudo.legenda && !peca.conteudo.roteiro?.length)
  const pendencia = peca.conteudo.pendencia

  const gerar = async () => { ed.setErro(null); const m = await pedirTrabalho('escrever', { peca_ids: [peca.id] }); if (m) ed.setErro(m); aoMudar() }
  const escrever = async () => { await moverPara(peca, 'producao'); aoMudar() }
  const descartar = async (razao: string) => {
    if (razao.trim()) await lembrar(EMPRESA, 'marketing', `Evitar: ${razao.trim()} (recusou "${peca.titulo.slice(0, 60)}")`, 'descarte')
    setMotivo(null); await ed.acoes.descartar(); aoVoltar()
  }
  const comum = { peca, r, mudar, rodando, ultimo, antes: ed.salvarSeFaltar, aoPedir: aoMudar }
  const arte = useArte(peca, trabalhos, ed.salvarSeFaltar, aoMudar, (i) => (i === null
    ? { titulo: r.texto_arte, apoio: r.apoio }
    : { titulo: r.itens[i]?.titulo ?? '', apoio: r.itens[i]?.texto ?? '' }))
  const nomeAba = (id: AbaId) => cfg.abas.find((a) => a.id === id)?.nome ?? ''

  return (
    <ArteContexto.Provider value={arte}>
    <div className="pp">
      <CabecalhoPeca peca={peca} titulo={r.titulo} mudarTitulo={(t) => mudar({ titulo: t })} planos={planos} estado={ed.estado} salvoEm={ed.salvoEm} ocupado={!!rodando}
        aoVoltar={aoVoltar} aoVoltarRevisao={ed.acoes.voltarRevisao} aoDescartar={() => setMotivo('')} />
      {abasTopo}
      {pendencia && !ideia && (
        <div className="mk-aviso"><Icone nome="alerta" tam={20} /><span><b>Confirmar com a equipe</b><br />{pendencia}</span>
          <Link to="/agentes/marca" className="link pequeno">Revisar oferta →</Link>
          <button className="btn btn-mini" onClick={async () => { await alterarPeca(peca.id, (p) => ({ conteudo: { ...p.conteudo, pendencia: undefined } })); aoMudar() }}>Já confirmei</button></div>
      )}
      {motivo !== null && (
        <div className="peca-motivo">
          <span className="pequeno">Por que descartar? <span className="muted">O agente aprende e evita da próxima vez.</span></span>
          <div className="peca-motivo-chips">{MOTIVOS.map((m) => <button key={m} type="button" className="btn btn-mini" onClick={() => descartar(m)}>{m}</button>)}</div>
          <div className="peca-ajuste"><input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo…" />
            <button className="btn btn-ouro btn-mini" onClick={() => descartar(motivo)}>Descartar</button><button className="btn btn-mini" onClick={() => descartar('')}>Sem motivo</button><button className="btn btn-mini" onClick={() => setMotivo(null)}>Cancelar</button></div>
        </div>
      )}
      <Erro msg={ed.erro} />
      <div className="pp-corpo">
        <div className="pp-principal">
          {ideia ? <Ideia peca={peca} rodando={!!rodando} aoGerar={gerar} aoEscrever={escrever} /> : (<>
            <nav className="pp-abas" role="tablist">
              {cfg.abas.map((a) => (
                <button key={a.id} role="tab" aria-selected={abaAtiva === a.id} className={abaAtiva === a.id ? 'ativa' : ''} onClick={() => setAba(a.id)}>
                  <Icone nome={a.icone} tam={18} /> {a.id === 'versoes' ? `Versões · ${versoes.length}` : a.nome}
                </button>
              ))}
            </nav>
            <fieldset className="pp-painel" disabled={!!rodando}>
              {abaAtiva === 'itens' && <AbaItens {...comum} atual={atual} setAtual={setAtual} />}
              {abaAtiva === 'principal' && <AbaCampos {...comum} campos={cfg.principal} nomeAba={nomeAba('principal')} pergunta={`O que deseja ajustar em "${nomeAba('principal')}"?`} />}
              {abaAtiva === 'legenda' && <AbaCampos {...comum} campos={cfg.legenda} nomeAba={nomeAba('legenda')} pergunta={nomeAba('legenda') === 'Legenda' ? 'O que deseja ajustar na legenda?' : `O que deseja ajustar em "${nomeAba('legenda')}"?`} />}
              {abaAtiva === 'visual' && <AbaDirecao {...comum} atual={atual} setAtual={setAtual} nomeAba={nomeAba('visual')} />}
              {abaAtiva === 'edicao' && <AbaEdicao peca={peca} aoMudar={aoMudar} />}
              {abaAtiva === 'versoes' && <AbaVersoes tipo={peca.tipo} versoes={versoes} sel={sel} setSel={setSel} />}
            </fieldset>
          </>)}
        </div>
        <LadoPeca peca={peca} r={r} mudar={mudar} aba={ideia ? 'principal' : abaAtiva} atual={atual} versao={versoes.find((v) => v.n === sel)}
          campanhas={campanhas} planos={planos} ocupada={!!rodando} antes={ed.salvarSeFaltar} aoMudar={aoMudar} />
      </div>
      {!ideia && <RodapePeca peca={peca} r={r} aba={abaAtiva} estado={ed.estado} salvar={ed.salvar} acoes={ed.acoes} ocupado={!!rodando}
        versao={versoes.find((v) => v.n === sel)} atual={versoes.at(-1)} aoVoltarEdicao={() => setAba(cfg.abas[0].id)} />}
    </div>
    </ArteContexto.Provider>
  )
}
