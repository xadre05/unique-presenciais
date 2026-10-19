// Cartão "Detalhes da peça" (coluna da direita): leitura por padrão; "Editar detalhes" abre os campos.
// Trocar canal ou formato de uma peça já escrita oferece pedir ao agente para adaptar o texto.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import type { Peca } from '../../comum'
import { REDES, nomeFormato, redeDe, useRedes, type Rede } from '../redes'
import { DURACOES, ehVideo } from '../formatos'
import { ehIdeia } from '../etapas'
import { instrucaoNovoFormato, pedirAjuste } from '../ajuste'
import { LogoRede } from '../LogoRede'
import type { Campanha } from '../useMarketing'
import type { Plano } from '../planos'
import { alterarPeca } from './useEdicao'

type Props = { peca: Peca; proporcao: string; campanhas: Campanha[]; planos: Plano[]; ocupada: boolean; antes: () => Promise<unknown>; aoMudar: () => void }
const dataBr = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : 'Sem data')

export function DetalhesPeca({ peca, proporcao, campanhas, planos, ocupada, antes, aoMudar }: Props) {
  const ativas = useRedes()
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [adaptar, setAdaptar] = useState<{ rede: Rede; tipo: string } | null>(null)
  const c = peca.conteudo
  const rede = redeDe(peca)
  const briefing = (c.briefing ?? {}) as { duracao?: string }
  const escrita = !ehIdeia(peca) && !!(c.roteiro?.length || c.legenda)
  const plano = planos.find((p) => p.id === c.plano)
  const campanha = campanhas.find((x) => x.id === c.campanha)

  const gravar = async (mudar: (cont: Record<string, unknown>) => Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    setErro(null); await antes()
    const m = await alterarPeca(peca.id, (p) => ({ ...extra, conteudo: mudar(p.conteudo) }))
    if (m) setErro(m); aoMudar()
  }
  const campo = (k: string, v: unknown) => gravar((cont) => ({ ...cont, [k]: v || undefined }))
  const trocar = async (r: Rede, tipo: string) => {
    await gravar((cont) => ({ ...cont, rede: r, livre: undefined }), { tipo })
    if (escrita && tipo !== peca.tipo) setAdaptar({ rede: r, tipo })
  }
  const pedirAdaptacao = async () => {
    if (!adaptar) return
    const m = await pedirAjuste(peca, `${instrucaoNovoFormato(nomeFormato(adaptar.tipo, adaptar.rede))} O canal agora é ${REDES[adaptar.rede].nome}: siga o jeito desse canal.`, { lembrar: false, tipo_novo: adaptar.tipo, nota: `Adaptada para ${nomeFormato(adaptar.tipo, adaptar.rede)}` })
    setAdaptar(null); if (m) setErro(m); aoMudar()
  }

  const linhas: [string, React.ReactNode][] = [
    ['Canal', c.livre ? 'O agente escolhe' : <span className="pp-canal"><LogoRede rede={rede} tam={16} />{REDES[rede].nome}</span>],
    ['Formato', c.livre ? '—' : nomeFormato(peca.tipo, rede)],
    ['Proporção', proporcao],
    ...(ehVideo(peca.tipo) ? [['Duração', briefing.duracao || 'Não definida'] as [string, string]] : []),
    ['Data planejada', dataBr(peca.dia)],
    ['Horário', c.horario || 'Não definido'],
    ['Campanha', campanha?.nome ?? 'Sem campanha'],
    ['Planejamento', plano?.nome ?? 'Avulsa'],
    ...(c.objetivo ? [['Objetivo', c.objetivo] as [string, string]] : []),
    // de onde o agente tirou o conteúdo (Biblioteca da marca)
    ...(c.fontes?.length ? [['Baseado em', c.fontes.join(' · ')] as [string, string]] : []),
  ]

  return (
    <section className="pp-cartao">
      <header><h3>Detalhes da peça</h3>
        <button className="btn btn-mini" onClick={() => setEditando(!editando)} disabled={ocupada}><Icone nome={editando ? 'check' : 'lapis'} tam={14} /> {editando ? 'Concluir' : 'Editar detalhes'}</button></header>
      {!editando ? (
        <dl className="pp-dl">{linhas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      ) : (
        <dl className="mk-detalhes">
          <dt>Canal</dt><dd><select value={c.livre ? '' : rede} onChange={(e) => { const r = e.target.value as Rede; trocar(r, REDES[r].formatos.includes(peca.tipo as never) ? peca.tipo : REDES[r].formatos[0]) }}>
            {c.livre && <option value="">O agente escolhe</option>}{[...new Set([...ativas, rede])].map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}</select></dd>
          <dt>Formato</dt><dd><select value={peca.tipo} disabled={!!c.livre} onChange={(e) => trocar(rede, e.target.value)}>{REDES[rede].formatos.map((f) => <option key={f} value={f}>{nomeFormato(f, rede)}</option>)}</select></dd>
          {ehVideo(peca.tipo) && <><dt>Duração</dt><dd><select value={briefing.duracao ?? ''} onChange={(e) => gravar((cont) => ({ ...cont, briefing: { ...((cont.briefing ?? {}) as object), duracao: e.target.value } }))}><option value="">—</option>{(DURACOES[peca.tipo as 'reels'] ?? []).map((d) => <option key={d}>{d}</option>)}</select></dd></>}
          <dt>Data planejada</dt><dd><input type="date" value={peca.dia ?? ''} onChange={(e) => gravar((cont) => cont, { dia: e.target.value || null })} /></dd>
          <dt>Horário</dt><dd><input type="time" value={c.horario ?? ''} onChange={(e) => campo('horario', e.target.value)} /></dd>
          <dt>Campanha</dt><dd><select value={c.campanha ?? ''} onChange={(e) => campo('campanha', e.target.value)}><option value="">Sem campanha</option>{campanhas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></dd>
          <dt>Planejamento</dt><dd><select value={String(c.plano ?? '')} onChange={(e) => campo('plano', e.target.value)}><option value="">Avulsa</option>{planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></dd>
          <dt>Objetivo</dt><dd><input defaultValue={c.objetivo ?? ''} onBlur={(e) => e.target.value !== (c.objetivo ?? '') && campo('objetivo', e.target.value.trim())} placeholder="Educar, atrair, vender…" /></dd>
        </dl>
      )}
      {adaptar && <div className="mk-aviso mk-aviso-info"><span>Agora é {REDES[adaptar.rede].nome} · {nomeFormato(adaptar.tipo, adaptar.rede)}. O texto ainda é do formato anterior.</span><button className="btn btn-ouro btn-mini" onClick={pedirAdaptacao}>Pedir ao agente para adaptar</button><button className="btn btn-mini" onClick={() => setAdaptar(null)}>Eu ajusto</button></div>}
      <Erro msg={erro} />
    </section>
  )
}
