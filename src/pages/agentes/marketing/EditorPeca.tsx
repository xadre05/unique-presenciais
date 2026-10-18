// Editor da peça na Produção: cabeçalho (formato, dia, horário), abas, pendência da oferta, ajuste com o agente
// e as decisões (salvar, aprovar, descartar, postada).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { msgErro } from '../../../lib/dados'
import { Badge, Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { TIPO_PECA, textoDaPeca, type Peca, type Trabalho } from '../comum'
import { lembrar } from '../memoria'
import { ETAPA, ehIdeia, etapaDe, moverPara, mudarPeca } from './etapas'
import { instrucaoEscrever, instrucaoNovoFormato, pedirAjuste } from './ajuste'
import { AbaLegenda, AbaRoteiro, AbaVersoes, AbaVisual, NOME_ITEM, rascunhoDe, type Rascunho } from './AbasPeca'
import { AjustePeca } from './AjustePeca'
import { EMPRESA } from './useMarketing'

const ABAS = [['roteiro', 'Roteiro'], ['legenda', 'Legenda'], ['visual', 'Direção visual'], ['versoes', 'Versões']] as const
const MOTIVOS = ['Texto longo demais', 'Faltou emoji', 'Emoji demais', 'Tom muito vendedor', 'Tom muito técnico', 'Não é o nosso assunto']

export function EditorPeca({ peca, rodando, ultimo, aoMudar }: { peca: Peca; rodando: Trabalho | null; ultimo: Trabalho | null; aoMudar: () => void }) {
  const [aba, setAba] = useState<(typeof ABAS)[number][0]>('roteiro')
  const [r, setR] = useState<Rascunho>(() => rascunhoDe(peca.conteudo))
  const [sujo, setSujo] = useState(false)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [tipoNovo, setTipoNovo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => { setR(rascunhoDe(peca.conteudo)); setSujo(false); setTipoNovo(null); setMotivo(null) }, [peca.id, peca.atualizado_em]) // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (c: Partial<Rascunho>) => { setR((x) => ({ ...x, ...c })); setSujo(true) }
  const gravar = async (campos: Record<string, unknown>) => { setErro(null); const { error } = await mudarPeca(peca.id, campos); if (error) return setErro(msgErro(error)); aoMudar() }
  const salvar = () => gravar({ conteudo: { ...peca.conteudo, ...r, roteiro: r.roteiro.map((x) => x.trim()).filter(Boolean), hashtags: r.hashtags.split(/\s+/).filter(Boolean) } })
  const restaurar = () => { const { anterior, ...atual } = peca.conteudo; gravar({ conteudo: { ...(anterior as object), campanha: atual.campanha, anterior: atual } }) }
  const mover = async (etapa: Parameters<typeof moverPara>[1]) => { const { error } = await moverPara(peca, etapa); if (error) return setErro(msgErro(error)); aoMudar() }
  const agente = async (instrucao: string, opcoes: { lembrar?: boolean; tipo_novo?: string } = {}) => { const m = await pedirAjuste(peca, instrucao, { lembrar: false, ...opcoes }); if (m) setErro(m); setTipoNovo(null); aoMudar() }
  const descartar = async (razao: string) => {
    if (razao.trim()) await lembrar(EMPRESA, 'marketing', `Evitar: ${razao.trim()} (recusou "${peca.titulo.slice(0, 60)}")`, 'descarte')
    setMotivo(null); await gravar({ status: 'descartada' })
  }

  const etapa = etapaDe(peca)
  const [plural] = NOME_ITEM[peca.tipo] ?? ['itens']
  const pendencia = peca.conteudo.pendencia

  return (
    <div className="mk-editor">
      <header className="mk-editor-topo">
        <div><h2>{peca.titulo}</h2>
          <span className="muted">{TIPO_PECA[peca.tipo]}{r.roteiro.length ? ` · ${r.roteiro.length} ${plural.toLowerCase()}` : ''}</span></div>
        {etapa !== 'descartada' && <Badge tom={etapa === 'pronto' ? 'ok' : etapa === 'publicado' ? 'info' : 'alerta'}>{ETAPA[etapa].nome}</Badge>}
      </header>
      <div className="mk-editor-campos">
        <label>Formato<select value={tipoNovo ?? peca.tipo} disabled={!!rodando} onChange={(e) => setTipoNovo(e.target.value === peca.tipo ? null : e.target.value)}>{Object.entries(TIPO_PECA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Dia<input type="date" value={peca.dia ?? ''} onChange={(e) => gravar({ dia: e.target.value || null })} /></label>
        <label>Horário<input type="time" value={peca.conteudo.horario ?? ''} onChange={(e) => gravar({ conteudo: { ...peca.conteudo, horario: e.target.value } })} /></label>
      </div>
      {tipoNovo && (
        <div className="mk-aviso mk-aviso-info"><span>Mudar para {TIPO_PECA[tipoNovo]}: o agente reescreve a peça no novo formato.</span>
          <button className="btn btn-ouro btn-mini" onClick={() => agente(instrucaoNovoFormato(tipoNovo), { tipo_novo: tipoNovo })}>Pedir ao agente</button><button className="btn btn-mini" onClick={() => setTipoNovo(null)}>Cancelar</button></div>
      )}

      {ehIdeia(peca) && !rodando ? (
        <div className="mk-ideia">
          <Icone nome="ideia" tam={30} /><p>Esta peça ainda é uma ideia{peca.conteudo.objetivo ? `: ${peca.conteudo.objetivo}` : '.'}</p>
          <button className="btn btn-ouro" onClick={() => agente(instrucaoEscrever(peca))}>O agente escreve esta peça</button>
        </div>
      ) : (<>
        <nav className="mk-abas">{ABAS.map(([k, n]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>{n}</button>)}</nav>
        {aba === 'roteiro' && <AbaRoteiro peca={peca} r={r} mudar={mudar} />}
        {aba === 'legenda' && <AbaLegenda r={r} mudar={mudar} />}
        {aba === 'visual' && <AbaVisual r={r} mudar={mudar} />}
        {aba === 'versoes' && <AbaVersoes peca={peca} aoRestaurar={restaurar} />}
      </>)}

      {pendencia && etapa !== 'publicado' && (
        <div className="mk-aviso"><Icone nome="alerta" tam={20} /><span><b>Confirmar com a equipe</b><br />{pendencia}</span>
          <Link to="/agentes/marca" className="link pequeno">Revisar oferta →</Link>
          <button className="btn btn-mini" onClick={() => gravar({ conteudo: { ...peca.conteudo, pendencia: undefined } })}>Já confirmei</button></div>
      )}
      {!ehIdeia(peca) && <AjustePeca peca={peca} rodando={rodando} ultimo={ultimo} aoPedir={aoMudar} />}
      {ehIdeia(peca) && rodando && <AjustePeca peca={peca} rodando={rodando} ultimo={ultimo} aoPedir={aoMudar} />}

      {motivo !== null && (
        <div className="peca-motivo">
          <span className="pequeno">Por que descartar? <span className="muted">O agente aprende e evita da próxima vez.</span></span>
          <div className="peca-motivo-chips">{MOTIVOS.map((m) => <button key={m} type="button" className="btn btn-mini" onClick={() => descartar(m)}>{m}</button>)}</div>
          <div className="peca-ajuste"><input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo…" />
            <button className="btn btn-ouro btn-mini" onClick={() => descartar(motivo)}>Descartar</button><button className="btn btn-mini" onClick={() => descartar('')}>Sem motivo</button><button className="btn btn-mini" onClick={() => setMotivo(null)}>Cancelar</button></div>
        </div>
      )}
      <Erro msg={erro} />
      <footer className="mk-editor-acoes">
        <button className="btn btn-contorno-ouro" disabled={!sujo} onClick={salvar}>Salvar edição</button>
        <button className="btn btn-mini" onClick={() => navigator.clipboard?.writeText(textoDaPeca(peca))}>Copiar tudo</button>
        <span className="peca-espaco" />
        {(etapa === 'revisao' || etapa === 'producao') && <button className="btn btn-ouro" disabled={!!pendencia || sujo} title={pendencia ? 'Resolva a pendência da oferta para aprovar' : sujo ? 'Salve a edição antes' : ''} onClick={() => mover('pronto')}>Aprovar</button>}
        {etapa === 'pronto' && <button className="btn btn-contorno" onClick={() => mover('publicado')}>Marcar como postada</button>}
        {(etapa === 'pronto' || etapa === 'publicado') && <button className="btn btn-mini" onClick={() => mover('revisao')}>Voltar para revisão</button>}
        {etapa !== 'publicado' && <button className="btn btn-mini" onClick={() => setMotivo('')}>Descartar</button>}
      </footer>
    </div>
  )
}
