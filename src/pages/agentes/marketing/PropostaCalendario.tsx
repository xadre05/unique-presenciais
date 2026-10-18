// Proposta de calendário (lado direito do Planejar conteúdos): as peças que o agente propôs, para editar,
// tirar, acrescentar, pedir ajuste à IA e aprovar. A aprovação cria as peças em Ideias; os roteiros vêm depois.
import { useEffect, useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import type { Peca } from '../comum'
import { mudarPeca } from './etapas'
import { REDES, nomeFormato, redeDe, useRedes, type Rede } from './redes'
import { LogoRede } from './LogoRede'

const semana = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')

function Linha({ p, aoMudar }: { p: Peca; aoMudar: () => void }) {
  const ativas = useRedes()
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(p.titulo)
  const [angulo, setAngulo] = useState(p.conteudo.objetivo ?? '')
  useEffect(() => { setTitulo(p.titulo); setAngulo(p.conteudo.objetivo ?? '') }, [p.id, p.atualizado_em]) // eslint-disable-line react-hooks/exhaustive-deps
  const rede = redeDe(p)
  const gravar = async (campos: Record<string, unknown>) => { await mudarPeca(p.id, campos); aoMudar() }
  return (
    <div className={`mk-prop-linha${editando ? ' editando' : ''}`} style={{ ['--cor-rede' as string]: REDES[rede].cor }}>
      <div className="mk-prop-resumo">
        <span className="mk-prop-data"><b>{p.dia ? `${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)}` : '—'}</b><small>{p.dia ? semana(p.dia) : ''}</small></span>
        <span className="mk-prop-canal"><LogoRede rede={rede} />{REDES[rede].nome}<small>{nomeFormato(p.tipo, rede)}</small></span>
        <span className="mk-prop-titulo">{p.titulo}{p.conteudo.objetivo && <small>{p.conteudo.objetivo}</small>}</span>
        <button type="button" className="btn btn-mini" onClick={() => setEditando(!editando)}><Icone nome="documento" tam={14} /> {editando ? 'Fechar' : 'Editar'}</button>
      </div>
      {editando && (
        <div className="mk-prop-editar">
          <label>Data<input type="date" value={p.dia ?? ''} onChange={(e) => gravar({ dia: e.target.value || null })} /></label>
          <label>Canal e formato<select value={`${rede}|${p.tipo}`} onChange={(e) => { const [r, t] = e.target.value.split('|'); gravar({ tipo: t, conteudo: { ...p.conteudo, rede: r } }) }}>
            {[...new Set([...ativas, redeDe(p)])].flatMap((r: Rede) => REDES[r].formatos.map((f) => <option key={`${r}|${f}`} value={`${r}|${f}`}>{REDES[r].nome} · {nomeFormato(f, r)}</option>))}</select></label>
          <label className="largo">Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo !== p.titulo && gravar({ titulo })} /></label>
          <label className="largo">Abordagem<input value={angulo} onChange={(e) => setAngulo(e.target.value)} onBlur={() => angulo !== (p.conteudo.objetivo ?? '') && gravar({ conteudo: { ...p.conteudo, objetivo: angulo } })} /></label>
          <button type="button" className="btn btn-mini" onClick={() => gravar({ status: 'descartada' })}><Icone nome="fechar" tam={14} /> Tirar do plano</button>
        </div>
      )}
    </div>
  )
}

type Props = {
  pecas: Peca[]; status: 'vazio' | 'aguardando' | 'proposta' | 'aprovado'; periodo: string; resumo: string | null; erro: string | null
  aoMudar: () => void; aoAcrescentar: () => void; aoAjustar: (instrucao: string) => void; aoSalvar: () => void; aoAprovar: () => void; enviando: boolean
}

export function PropostaCalendario(pr: Props) {
  const [ajuste, setAjuste] = useState('')
  const canais = new Set(pr.pecas.map((p) => redeDe(p))).size
  return (
    <section className="mk-painel mk-proposta-cal">
      <header className="mk-painel-cab">
        <span className="mk-convite-icone"><Icone nome="agenda" tam={22} /></span>
        <div><h3>Proposta de calendário</h3><span className="muted pequeno">{pr.pecas.length} peças • {canais} {canais === 1 ? 'canal' : 'canais'} • {pr.periodo}</span></div>
        {pr.status === 'proposta' && <span className="mk-ponto" style={{ ['--cor-etapa' as string]: '#e0a93b' }}>Aguardando sua revisão</span>}
        {pr.status === 'aprovado' && <span className="mk-ponto" style={{ ['--cor-etapa' as string]: '#4cbf73' }}>Aprovado</span>}
      </header>
      {pr.resumo && <p className="nota pequeno">{pr.resumo}</p>}
      {pr.status === 'vazio' && <div className="mk-vazio-grande"><Icone nome="floco" tam={30} /><p>Defina a direção ao lado e clique em <b>Sugerir planejamento</b>.</p><span className="muted pequeno">O agente propõe temas, canais, formatos e datas. Nada é escrito antes da sua aprovação.</span></div>}
      {pr.status === 'aguardando' && <div className="mk-aguardando"><div className="progresso"><div className="indeterminado" /><span>O agente está montando a proposta…</span></div></div>}
      {(pr.status === 'proposta' || pr.status === 'aprovado') && (<>
        <div className="mk-prop-lista">
          <div className="mk-prop-resumo mk-prop-cab"><span>Data</span><span>Canal / formato</span><span>Título da peça</span><span>Ações</span></div>
          {pr.pecas.map((p) => <Linha key={p.id} p={p} aoMudar={pr.aoMudar} />)}
        </div>
        <button type="button" className="btn btn-contorno-ouro btn-mini mk-add-linha" onClick={pr.aoAcrescentar}><Icone nome="mais" tam={14} /> Adicionar peça ao plano</button>
        <label className="mk-rotulo">Ajustar proposta com a IA (opcional)</label>
        <div className="mk-ajuste-linha">
          <span className="mk-ajuste-campo"><Icone nome="floco" tam={16} /><input value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder="Ex.: reduza vídeos e concentre posts em três dias" onKeyDown={(e) => e.key === 'Enter' && ajuste.trim() && (pr.aoAjustar(ajuste.trim()), setAjuste(''))} /></span>
          <button className="btn btn-contorno-ouro" disabled={!ajuste.trim() || pr.enviando} onClick={() => { pr.aoAjustar(ajuste.trim()); setAjuste('') }}><Icone nome="floco" tam={16} /> Ajustar proposta</button>
        </div>
      </>)}
      <Erro msg={pr.erro} />
      {pr.status === 'proposta' && (
        <footer className="mk-criar-rodape">
          <button className="btn btn-contorno-ouro" disabled={pr.enviando} onClick={pr.aoSalvar}><Icone nome="documento" tam={16} /> Salvar proposta</button>
          <button className="btn btn-ouro mk-aprovar" disabled={pr.enviando || !pr.pecas.length} onClick={pr.aoAprovar}><Icone nome="check" tam={16} /> Aprovar plano e criar {pr.pecas.length} {pr.pecas.length === 1 ? 'peça' : 'peças'}</button>
        </footer>
      )}
      <p className="pequeno muted"><Icone nome="info" tam={14} /> A aprovação cria as peças em Ideias. Os roteiros são produzidos depois, uma, algumas ou todas.</p>
    </section>
  )
}
