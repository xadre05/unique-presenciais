// Base da marca → Campanhas: o que é de um momento (Black, lançamento, data comemorativa) fica aqui, com período,
// oferta e regras, separado do que a marca vende sempre (Sobre a marca). No planejamento, a equipe escolhe a campanha
// e as peças levam a campanha junto. Encerrar tira a campanha das listas; nada é apagado.
import { useState } from 'react'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { atualizarPerfil } from './memoria'
import type { Campanha } from './marketing/useMarketing'

type CampanhaGuardada = Campanha & { encerrada?: boolean }
const vazia = (): CampanhaGuardada => ({ id: crypto.randomUUID(), nome: '', inicio: '', fim: '', descricao: '' })
const dm = (iso?: string) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—')

function Formulario({ inicial, aoSalvar, aoCancelar }: { inicial: CampanhaGuardada; aoSalvar: (c: CampanhaGuardada) => Promise<string | null>; aoCancelar: () => void }) {
  const [c, setC] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const mudar = (x: Partial<CampanhaGuardada>) => setC((v) => ({ ...v, ...x }))
  const salvar = async () => {
    if (!c.nome.trim()) return setErro('Dê um nome para a campanha.')
    if (c.inicio && c.fim && c.fim < c.inicio) return setErro('O fim vem antes do começo.')
    setSalvando(true); setErro(await aoSalvar({ ...c, nome: c.nome.trim(), descricao: c.descricao?.trim() || undefined, inicio: c.inicio || undefined, fim: c.fim || undefined })); setSalvando(false)
  }
  return (
    <div className="mk-form camp-form">
      <label>Nome<input value={c.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Black Friday Limited Edition" /></label>
      <div className="form-duas">
        <label>Começa em<input type="date" value={c.inicio ?? ''} onChange={(e) => mudar({ inicio: e.target.value })} /></label>
        <label>Termina em<input type="date" value={c.fim ?? ''} onChange={(e) => mudar({ fim: e.target.value })} /></label>
      </div>
      <label>Oferta e regras da campanha <small className="muted">(fonte da verdade enquanto a campanha durar)</small>
        <textarea rows={7} value={c.descricao ?? ''} onChange={(e) => mudar({ descricao: e.target.value })} placeholder="O que é vendido nesta campanha, bônus, preço e condições, prazo, vagas, para quem é e a mensagem principal. O agente usa isto só nas peças desta campanha." /></label>
      <Erro msg={erro} />
      <div className="ia-linha"><button type="button" className="btn btn-contorno-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar campanha'}</button><button type="button" className="btn btn-mini" onClick={aoCancelar}>Cancelar</button></div>
    </div>
  )
}

export function CampanhasMarca({ empresaId, perfil, aoSalvar }: { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }) {
  const todas = (Array.isArray(perfil.campanhas) ? perfil.campanhas : []) as CampanhaGuardada[]
  const [editando, setEditando] = useState<CampanhaGuardada | null>(null)
  const [verEncerradas, setVerEncerradas] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const lista = todas.filter((c) => verEncerradas || !c.encerrada)
  const gravar = async (mudar: (l: CampanhaGuardada[]) => CampanhaGuardada[]) => {
    const { error } = await atualizarPerfil(empresaId, 'marketing', (p) => ({ ...p, campanhas: mudar((Array.isArray(p.campanhas) ? p.campanhas : []) as CampanhaGuardada[]) }))
    if (error) return msgErro(error)
    aoSalvar(); return null
  }
  const salvar = async (c: CampanhaGuardada) => {
    const e = await gravar((l) => (l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [...l, c]))
    if (!e) setEditando(null)
    return e
  }
  const encerrar = async (c: CampanhaGuardada, encerrada: boolean) => setErro(await gravar((l) => l.map((x) => (x.id === c.id ? { ...x, encerrada } : x))))
  return (
    <div className="camp">
      {lista.length ? (
        <ul className="camp-lista">{lista.map((c) => (
          <li key={c.id} className={c.encerrada ? 'encerrada' : ''}>
            <span className="camp-txt"><b>{c.nome}</b><small className="muted">{dm(c.inicio)} a {dm(c.fim)}{c.encerrada ? ' · encerrada' : ''}</small>{c.descricao && <small>{c.descricao.slice(0, 180)}{c.descricao.length > 180 ? '…' : ''}</small>}</span>
            <span className="ia-linha">
              <button type="button" className="btn btn-mini" onClick={() => setEditando(c)}><Icone nome="lapis" tam={13} /> Editar</button>
              <button type="button" className="btn btn-mini" onClick={() => encerrar(c, !c.encerrada)}>{c.encerrada ? 'Reabrir' : 'Encerrar'}</button>
            </span>
          </li>))}</ul>
      ) : <p className="muted pequeno">Nenhuma campanha ainda.</p>}
      {editando ? <Formulario key={editando.id} inicial={editando} aoSalvar={salvar} aoCancelar={() => setEditando(null)} />
        : <div className="ia-linha"><button type="button" className="btn btn-contorno-ouro" onClick={() => setEditando(vazia())}><Icone nome="mais" tam={15} /> Nova campanha</button>
          {todas.some((c) => c.encerrada) && <button type="button" className="btn btn-mini" onClick={() => setVerEncerradas(!verEncerradas)}>{verEncerradas ? 'Esconder encerradas' : 'Ver encerradas'}</button>}</div>}
      <Erro msg={erro} />
    </div>
  )
}
