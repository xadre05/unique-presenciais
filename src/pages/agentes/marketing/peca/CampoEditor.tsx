// Um campo de texto do editor da peça: rótulo, contador de caracteres (quando há limite) e dica.
import { useState } from 'react'
import { Icone } from '../../../../components/Icone'

type Props = { rotulo: string; valor: string; mudar: (v: string) => void; max?: number; linhas?: number; dica?: string; placeholder?: string; id?: string }

export function CampoEditor({ rotulo, valor, mudar, max, linhas, dica, placeholder, id }: Props) {
  const passou = max !== undefined && valor.length > max
  return (
    <div className="pp-campo">
      <div className="pp-campo-topo">
        <label className="pp-rotulo" htmlFor={id}>{rotulo}</label>
        {max !== undefined && <span className={`pp-conta${passou ? ' passou' : ''}`}>{valor.length}/{max}</span>}
      </div>
      {linhas
        ? <textarea id={id} rows={linhas} value={valor} onChange={(e) => mudar(e.target.value)} placeholder={placeholder} />
        : <input id={id} value={valor} onChange={(e) => mudar(e.target.value)} placeholder={placeholder} />}
      {dica && <span className="muted pequeno">{dica}</span>}
    </div>
  )
}

export async function copiarTexto(texto: string) { try { await navigator.clipboard.writeText(texto); return true } catch { return false } }

export function BotaoCopiar({ texto, rotulo = 'Copiar texto' }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" className="btn btn-mini" disabled={!texto.trim()} onClick={async () => { if (await copiarTexto(texto)) { setOk(true); setTimeout(() => setOk(false), 1800) } }}>
      <Icone nome={ok ? 'check' : 'copiar'} tam={14} /> {ok ? 'Copiado' : rotulo}
    </button>
  )
}
