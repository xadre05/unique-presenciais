// Página de uma peça na Produção: o mesmo editor para peça avulsa ou do plano. Conteúdo à esquerda
// (título, legenda, roteiro, direção visual e gravação, versões), detalhes à direita. A peça pode ser
// escrita pelo agente ou por você mesmo.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { textoDaPeca, type Peca, type Trabalho } from '../comum'
import { lembrar } from '../memoria'
import { ETAPA, ehIdeia, etapaDe, moverPara, mudarPeca } from './etapas'
import { AbaLegenda, AbaRoteiro, AbaVersoes, AbaVisual, rascunhoDe, type Rascunho } from './AbasPeca'
import { AjustePeca } from './AjustePeca'
import { DetalhesPeca } from './DetalhesPeca'
import { DURACOES, ehVideo, rotuloPeca } from './redes'
import { infoFormato } from './formatos'
import { ajustesDa } from './ajuste'
import { EMPRESA, pedirTrabalho, type Campanha } from './useMarketing'
import type { Plano } from './planos'

const MOTIVOS = ['Texto longo demais', 'Faltou emoji', 'Emoji demais', 'Tom muito vendedor', 'Tom muito técnico', 'Não é o nosso assunto']
type Briefing = { objetivo?: string; publico?: string; duracao?: string; telas?: number; orientacao?: string }

function Secao({ titulo, icone, aberta: inicial = false, children }: { titulo: string; icone: string; aberta?: boolean; children: React.ReactNode }) {
  const [aberta, setAberta] = useState(inicial)
  return (
    <section className={`mk-secao${aberta ? ' aberta' : ''}`}>
      <button type="button" className="mk-secao-cab" onClick={() => setAberta(!aberta)}><Icone nome={icone} tam={18} /><b>{titulo}</b><Icone nome="seta" tam={16} /></button>
      {aberta && <div className="mk-secao-corpo">{children}</div>}
    </section>
  )
}

type Props = { peca: Peca; trabalhos: Trabalho[]; campanhas: Campanha[]; planos: Plano[]; aoVoltar: () => void; aoMudar: () => void }

export function PaginaPeca({ peca, trabalhos, campanhas, planos, aoVoltar, aoMudar }: Props) {
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(peca.conteudo))
  const [titulo, setTitulo] = useState(peca.titulo)
  const [sujo, setSujo] = useState(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { setR(rascunhoDe(peca.conteudo)); setTitulo(peca.titulo); setSujo(false); setMotivo(null) }, [peca.id, peca.atualizado_em]) // eslint-disable-line react-hooks/exhaustive-deps
  const { rodando, ultimo } = ajustesDa(peca, trabalhos)
  const b = ((peca.conteudo as { briefing?: Briefing }).briefing ?? {}) as Briefing
  const etapa = etapaDe(peca)
  const plano = planos.find((p) => p.id === peca.conteudo.plano)
  const pendencia = peca.conteudo.pendencia
  const campos = infoFormato(peca.tipo).campos

  const mudar = (c: Partial<Rascunho>) => { setR((x) => ({ ...x, ...c })); setSujo(true) }
  const gravar = async (campos: Record<string, unknown>) => { setErro(null); const { error } = await mudarPeca(peca.id, campos); if (error) return setErro(msgErro(error)); aoMudar() }
  const salvar = () => gravar({ titulo: titulo.trim() || peca.titulo, conteudo: { ...peca.conteudo, ...r, roteiro: r.roteiro.map((x) => x.trim()).filter(Boolean), hashtags: r.hashtags.split(/\s+/).filter(Boolean) } })
  const restaurar = () => { const { anterior, ...atual } = peca.conteudo; gravar({ conteudo: { ...(anterior as object), rede: atual.rede, campanha: atual.campanha, plano: atual.plano, briefing: (atual as { briefing?: unknown }).briefing, anterior: atual } }) }
  const mover = async (e: Parameters<typeof moverPara>[1]) => { const { error } = await moverPara(peca, e); if (error) return setErro(msgErro(error)); aoMudar() }
  const gerar = async () => { setErro(null); const m = await pedirTrabalho('escrever', { peca_ids: [peca.id] }); if (m) setErro(m); aoMudar() }
  const descartar = async (razao: string) => {
    if (razao.trim()) await lembrar(EMPRESA, 'marketing', `Evitar: ${razao.trim()} (recusou "${peca.titulo.slice(0, 60)}")`, 'descarte')
    setMotivo(null); await gravar({ status: 'descartada' }); aoVoltar()
  }

  return (
    <div className="mk-pagina-peca">
      <div className="mk-principal">
        <nav className="mk-trilha pequeno"><button className="link" onClick={aoVoltar}>Produção</button> / <span>{peca.titulo}</span></nav>
        <button className="link pequeno" onClick={aoVoltar}>← Todas as peças</button>
        <h2 className="mk-peca-titulo">{peca.titulo}</h2>
        <div className="mk-chips-peca">
          <span className="mk-chip-info">{peca.conteudo.livre ? 'Canal a definir' : rotuloPeca(peca)}</span>
          <span className="mk-chip-info">{plano ? plano.nome : 'Peça avulsa'}</span>
          {etapa !== 'descartada' && <span className="mk-ponto mk-chip-info" style={{ ['--cor-etapa' as string]: ETAPA[etapa].cor }}>{ETAPA[etapa].nome}</span>}
        </div>

        {ehIdeia(peca) || (rodando && !peca.conteudo.legenda && !peca.conteudo.roteiro?.length) ? (
          <div className="mk-ideia">
            <Icone nome="ideia" tam={30} />
            <p>{rodando ? 'O agente está escrevendo esta peça…' : 'Esta peça ainda é uma ideia.'}</p>
            {peca.conteudo.objetivo && <p className="muted">{peca.conteudo.objetivo}</p>}
            {[b.objetivo, b.publico, b.duracao && `Duração: ${b.duracao}`, b.telas && `${b.telas} telas`, b.orientacao && `Gravação: ${b.orientacao}`].filter(Boolean).length > 0 &&
              <p className="pequeno muted">{[b.objetivo, b.publico, b.duracao && `Duração: ${b.duracao}`, b.telas && `${b.telas} telas`, b.orientacao && `Gravação: ${b.orientacao}`].filter(Boolean).join(' · ')}</p>}
            {!rodando && <div className="mk-ideia-botoes">
              <button className="btn btn-ouro" onClick={gerar}><Icone nome="floco" tam={16} /> Gerar rascunho com o agente</button>
              <button className="btn btn-contorno-ouro" onClick={() => mover('producao')} disabled={!!peca.conteudo.livre} title={peca.conteudo.livre ? 'Escolha o canal em Detalhes da peça' : ''}><Icone nome="documento" tam={16} /> Escrever eu mesmo</button>
            </div>}
            {rodando && <div className="progresso"><div className="indeterminado" /><span>Escrevendo…</span></div>}
          </div>
        ) : (
          <section className="mk-conteudo">
            <h3>Conteúdo desta peça</h3>
            <label className="mk-rotulo">{campos.titulo}</label>
            <input value={titulo} onChange={(e) => { setTitulo(e.target.value); setSujo(true) }} />
            {ehVideo(peca.tipo) && (
              <div className="mk-duracao"><label className="mk-rotulo">Duração desejada</label>
                <select value={b.duracao ?? ''} onChange={(e) => gravar({ conteudo: { ...peca.conteudo, briefing: { ...b, duracao: e.target.value } } })}><option value="">—</option>{(DURACOES[peca.tipo as 'reels'] ?? []).map((d) => <option key={d}>{d}</option>)}</select></div>
            )}
            <Secao titulo={campos.secaoLegenda} icone="documento" aberta><AbaLegenda peca={peca} r={r} mudar={mudar} /></Secao>
            <Secao titulo={campos.secaoRoteiro} icone="lista" aberta><AbaRoteiro peca={peca} r={r} mudar={mudar} /></Secao>
            <Secao titulo={campos.secaoVisual} icone="video"><AbaVisual peca={peca} r={r} mudar={mudar} /></Secao>
            <Secao titulo="Versões" icone="historico"><AbaVersoes peca={peca} aoRestaurar={restaurar} /></Secao>
          </section>
        )}

        {pendencia && etapa !== 'publicado' && (
          <div className="mk-aviso"><Icone nome="alerta" tam={20} /><span><b>Confirmar com a equipe</b><br />{pendencia}</span>
            <Link to="/agentes/marca" className="link pequeno">Revisar oferta →</Link>
            <button className="btn btn-mini" onClick={() => gravar({ conteudo: { ...peca.conteudo, pendencia: undefined } })}>Já confirmei</button></div>
        )}
        {!ehIdeia(peca) && <AjustePeca peca={peca} rodando={rodando} ultimo={ultimo} aoPedir={aoMudar} />}
        {motivo !== null && (
          <div className="peca-motivo">
            <span className="pequeno">Por que descartar? <span className="muted">O agente aprende e evita da próxima vez.</span></span>
            <div className="peca-motivo-chips">{MOTIVOS.map((m) => <button key={m} type="button" className="btn btn-mini" onClick={() => descartar(m)}>{m}</button>)}</div>
            <div className="peca-ajuste"><input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo…" />
              <button className="btn btn-ouro btn-mini" onClick={() => descartar(motivo)}>Descartar</button><button className="btn btn-mini" onClick={() => descartar('')}>Sem motivo</button><button className="btn btn-mini" onClick={() => setMotivo(null)}>Cancelar</button></div>
          </div>
        )}
        <Erro msg={erro} />
        {!ehIdeia(peca) && (
          <footer className="mk-editor-acoes">
            <button className="btn btn-contorno-ouro" disabled={!sujo} onClick={salvar}><Icone nome="documento" tam={16} /> Salvar edição</button>
            {(etapa === 'revisao' || etapa === 'producao') && <button className="btn btn-ouro" disabled={!!pendencia || sujo} title={pendencia ? 'Resolva a pendência da oferta para aprovar' : sujo ? 'Salve a edição antes' : ''} onClick={() => mover('pronto')}><Icone nome="check" tam={16} /> Aprovar</button>}
            {etapa === 'pronto' && <button className="btn btn-contorno" onClick={() => mover('publicado')}>Marcar como postada</button>}
            <span className="peca-espaco" />
            <button className="btn btn-mini" onClick={() => navigator.clipboard?.writeText(textoDaPeca(peca))}>Copiar tudo</button>
            {(etapa === 'pronto' || etapa === 'publicado') && <button className="btn btn-mini" onClick={() => mover('revisao')}>Voltar para revisão</button>}
            {etapa !== 'publicado' && <button className="btn btn-mini" onClick={() => setMotivo('')}>Descartar</button>}
          </footer>
        )}
        {ehIdeia(peca) && <div className="mk-editor-acoes"><span className="peca-espaco" /><button className="btn btn-mini" onClick={() => setMotivo('')}>Descartar ideia</button></div>}
        <p className="pequeno muted"><Icone nome="info" tam={14} /> As alterações valem só para esta peça.</p>
      </div>
      <DetalhesPeca peca={peca} campanhas={campanhas} planos={planos} aoMudar={aoMudar} ocupada={!!rodando} />
    </div>
  )
}
