// Nova peça: uma só, para um dia. Pode virar só uma ideia (sem custo, o agente escreve depois)
// ou já sair escrita pelo agente.
import { useEffect, useState } from 'react'
import { Campo, Erro, InputNumero, Modal } from '../../../components/ui'
import { TIPO_PECA, hojeISO } from '../comum'
import { pedirTrabalho, type Campanha } from './useMarketing'

type Tipo = 'post' | 'carrossel' | 'reels' | 'stories'

export function NovaPeca({ aberto, aoFechar, campanhas, campanhaPadrao, diaPadrao, aoPedir }: {
  aberto: boolean; aoFechar: () => void; campanhas: Campanha[]; campanhaPadrao: string; diaPadrao?: string; aoPedir: () => void
}) {
  const [tipo, setTipo] = useState<Tipo>('reels')
  const [dia, setDia] = useState(diaPadrao ?? hojeISO())
  const [titulo, setTitulo] = useState('')
  const [tema, setTema] = useState('')
  const [telas, setTelas] = useState(5)
  const [campanha, setCampanha] = useState(campanhaPadrao)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (aberto) { setDia(diaPadrao ?? hojeISO()); setCampanha(campanhaPadrao); setErro(null) } }, [aberto]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (soIdeia: boolean) => {
    setErro(null)
    if (soIdeia && !titulo.trim()) return setErro('Para guardar como ideia, escreva um título.')
    setEnviando(true)
    const c = campanhas.find((x) => x.id === campanha) ?? null
    const msg = soIdeia
      ? await pedirTrabalho('ideia', { pecas: [{ tipo, dia, titulo: titulo.trim(), tema: tema.trim(), campanha: c?.id }] })
      : await pedirTrabalho('semana', {
        modo: 'peca', tipo_peca: tipo, semana_inicio: dia, dias: 1, stories_telas: telas, campanha: c,
        posts: tipo === 'post' || tipo === 'carrossel' ? 1 : 0, reels: tipo === 'reels' ? 1 : 0, stories: tipo === 'stories' ? 1 : 0,
        foco: [titulo.trim(), tema.trim()].filter(Boolean).join(' — ') || null,
      })
    setEnviando(false)
    if (msg) return setErro(msg)
    setTitulo(''); setTema(''); aoPedir()
  }

  return (
    <Modal titulo="Nova peça" aberto={aberto} onFechar={aoFechar}>
      <div className="mk-form">
        <Campo rotulo="Formato">
          <div className="mk-chips">{(Object.keys(TIPO_PECA) as Tipo[]).map((t) => <button key={t} type="button" className={`mk-chip${tipo === t ? ' ativo' : ''}`} onClick={() => setTipo(t)}>{TIPO_PECA[t]}</button>)}</div>
        </Campo>
        <div className="form-duas">
          <Campo rotulo="Dia"><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
          <Campo rotulo="Campanha"><select value={campanha} onChange={(e) => setCampanha(e.target.value)}><option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        </div>
        {tipo === 'stories' && <Campo rotulo="Telas na sequência"><InputNumero valor={telas} min={2} max={15} onChange={(v) => setTelas(v ?? 5)} /></Campo>}
        <Campo rotulo="Título ou ideia"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Os 3 bônus da Black" /></Campo>
        <Campo rotulo="Sobre o quê (opcional)" dica="Gancho, mensagem, para quem é"><textarea rows={3} value={tema} onChange={(e) => setTema(e.target.value)} /></Campo>
        <Erro msg={erro} />
        <div className="modal-acoes">
          <button className="btn" disabled={enviando} onClick={() => enviar(true)} title="Fica na coluna Ideias, sem custo. O agente escreve quando você pedir.">Guardar como ideia</button>
          <button className="btn btn-ouro" disabled={enviando} onClick={() => enviar(false)}>{enviando ? 'Enviando…' : 'O agente escreve agora'}</button>
        </div>
      </div>
    </Modal>
  )
}
