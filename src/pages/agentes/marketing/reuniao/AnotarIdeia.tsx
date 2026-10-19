// Anotar uma ideia sem o agente (regra "funciona sem IA"): título, canal, formato e data. Vira uma peça em Ideias,
// sem custo; depois dá para escrever à mão ("Escrever eu mesmo") ou pedir ao agente.
import { useState } from 'react'
import { Erro } from '../../../../components/ui'
import { Icone } from '../../../../components/Icone'
import { REDES, nomeFormato, useRedes, type Formato, type Rede } from '../redes'
import { pedirTrabalho } from '../useMarketing'

export function AnotarIdeia({ dataInicial, aoAnotou }: { dataInicial: string; aoAnotou: () => void }) {
  const redes = useRedes()
  const [aberta, setAberta] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [rede, setRede] = useState<Rede>(redes[0] ?? 'instagram')
  const [tipo, setTipo] = useState<Formato>(REDES[redes[0] ?? 'instagram'].formatos[0])
  const [dia, setDia] = useState(dataInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const anotar = async () => {
    if (!titulo.trim()) return setErro('Dê um título para a ideia.')
    setErro(null); setSalvando(true)
    const m = await pedirTrabalho('ideia', { pecas: [{ tipo, rede, dia: dia || undefined, titulo: titulo.trim() }] })
    setSalvando(false)
    if (m) return setErro(m)
    setTitulo(''); setAberta(false); aoAnotou()
  }
  if (!aberta) return <button type="button" className="btn btn-contorno reu-anotar" onClick={() => setAberta(true)}><Icone nome="lapis" tam={16} /> Anotar uma ideia sem o agente</button>
  return (
    <section className="mk-painel">
      <h4 className="reu-lado-titulo"><Icone nome="lapis" tam={18} /> Anotar uma ideia</h4>
      <span className="muted pequeno">Vai para Ideias sem custo. Depois você escreve à mão ou pede ao agente.</span>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: bastidor do presencial de sábado" aria-label="Título da ideia" />
      <div className="form-duas">
        <label>Canal<select value={rede} onChange={(e) => { const r = e.target.value as Rede; setRede(r); setTipo(REDES[r].formatos[0]) }}>{redes.map((r) => <option key={r} value={r}>{REDES[r].nome}</option>)}</select></label>
        <label>Formato<select value={tipo} onChange={(e) => setTipo(e.target.value as Formato)}>{REDES[rede].formatos.map((f) => <option key={f} value={f}>{nomeFormato(f, rede)}</option>)}</select></label>
      </div>
      <label>Data <small className="muted">(opcional)</small><input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
      <Erro msg={erro} />
      <div className="ia-linha"><button type="button" className="btn btn-contorno-ouro" disabled={salvando} onClick={anotar}>{salvando ? 'Anotando…' : 'Anotar ideia'}</button><button type="button" className="btn btn-mini" onClick={() => setAberta(false)}>Cancelar</button></div>
    </section>
  )
}
