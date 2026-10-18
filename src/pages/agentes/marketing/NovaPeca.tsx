// Nova peça: uma só, para um dia. Pode virar só uma ideia (sem custo, o agente escreve depois)
// ou já sair escrita pelo agente.
import { useEffect, useState } from 'react'
import { Campo, Erro, InputNumero, Modal } from '../../../components/ui'
import { hojeISO } from '../comum'
import { LISTA_REDES, REDES, nomeFormato, type Formato, type Rede } from './redes'
import { pedirTrabalho, type Campanha } from './useMarketing'

export function NovaPeca({ aberto, aoFechar, campanhas, campanhaPadrao, diaPadrao, aoPedir, aoCriarCampanha }: {
  aberto: boolean; aoFechar: () => void; campanhas: Campanha[]; campanhaPadrao: string; diaPadrao?: string; aoPedir: () => void; aoCriarCampanha: () => void
}) {
  const [rede, setRede] = useState<Rede>('instagram')
  const [tipo, setTipo] = useState<Formato>('reels')
  const [dia, setDia] = useState(diaPadrao ?? hojeISO())
  const [titulo, setTitulo] = useState('')
  const [tema, setTema] = useState('')
  const [telas, setTelas] = useState(5)
  const [campanha, setCampanha] = useState(campanhaPadrao)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (aberto) { setCampanha(campanhaPadrao); setErro(null) } }, [aberto, campanhaPadrao]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (aberto && diaPadrao) setDia(diaPadrao) }, [aberto, diaPadrao]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (soIdeia: boolean) => {
    setErro(null)
    if (soIdeia && !titulo.trim()) return setErro('Para guardar como ideia, escreva um título.')
    setEnviando(true)
    const c = campanhas.find((x) => x.id === campanha) ?? null
    const msg = soIdeia
      ? await pedirTrabalho('ideia', { pecas: [{ tipo, rede, dia, titulo: titulo.trim(), tema: tema.trim(), campanha: c?.id }] })
      : await pedirTrabalho('semana', {
        modo: 'peca', rede, tipo_peca: tipo, semana_inicio: dia, dias: 1, stories_telas: telas, campanha: c,
        posts: tipo === 'post' || tipo === 'carrossel' || tipo === 'video' ? 1 : 0, reels: tipo === 'reels' ? 1 : 0, stories: tipo === 'stories' ? 1 : 0,
        foco: [titulo.trim(), tema.trim()].filter(Boolean).join(' — ') || null,
      })
    setEnviando(false)
    if (msg) return setErro(msg)
    setTitulo(''); setTema(''); aoPedir()
  }

  return (
    <Modal titulo="Nova peça" aberto={aberto} onFechar={aoFechar}>
      <div className="mk-form">
        <Campo rotulo="Rede">
          <div className="mk-chips">{LISTA_REDES.map((r) => <button key={r} type="button" className={`mk-chip${rede === r ? ' ativo' : ''}`} onClick={() => { setRede(r); if (!REDES[r].formatos.includes(tipo)) setTipo(REDES[r].formatos[0]) }}>{REDES[r].nome}</button>)}</div>
        </Campo>
        <Campo rotulo="Formato">
          <div className="mk-chips">{REDES[rede].formatos.map((t) => <button key={t} type="button" className={`mk-chip${tipo === t ? ' ativo' : ''}`} onClick={() => setTipo(t)}>{nomeFormato(t, rede)}</button>)}</div>
        </Campo>
        <div className="form-duas">
          <Campo rotulo="Dia"><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
          <Campo rotulo="Campanha"><select value={campanha} onChange={(e) => (e.target.value === '__nova' ? aoCriarCampanha() : setCampanha(e.target.value))}><option value="">Sem campanha</option>{campanhas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}<option value="__nova">+ Nova campanha…</option></select></Campo>
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
