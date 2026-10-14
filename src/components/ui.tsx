import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export function Badge({ tom = 'neutro', children }: { tom?: string; children: ReactNode }) {
  return <span className={`badge badge-${tom}`}>{children}</span>
}

export function Modal({ titulo, aberto, onFechar, children, largo }: { titulo: string; aberto: boolean; onFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    if (aberto) window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={`modal ${largo ? 'modal-largo' : ''}`} role="dialog" aria-label={titulo}>
        <div className="modal-topo">
          <h3>{titulo}</h3>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span className="campo-rotulo">{rotulo}</span>
      {children}
      {dica && <span className="campo-dica">{dica}</span>}
    </label>
  )
}

/** Valor em reais com máscara (digita os números, os centavos se ajustam) e setas para subir/descer. */
export function InputMoeda({ valor, onChange, passo = 100, autoFocus }: { valor: number | null; onChange: (v: number | null) => void; passo?: number; autoFocus?: boolean }) {
  const txt = valor === null || valor === undefined ? '' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const mudar = (s: string) => {
    const dig = s.replace(/\D/g, '')
    if (!dig) return onChange(null)
    onChange(Number(dig) / 100)
  }
  const somar = (d: number) => onChange(Math.max(0, Math.round(((valor ?? 0) + d) * 100) / 100))
  return (
    <div className="moeda">
      <span className="moeda-prefixo">R$</span>
      <input inputMode="numeric" value={txt} autoFocus={autoFocus} onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); somar(passo) } if (e.key === 'ArrowDown') { e.preventDefault(); somar(-passo) } }} />
      <div className="moeda-setas">
        <button type="button" tabIndex={-1} onClick={() => somar(passo)} aria-label="Aumentar">▲</button>
        <button type="button" tabIndex={-1} onClick={() => somar(-passo)} aria-label="Diminuir">▼</button>
      </div>
    </div>
  )
}

export function InputNumero({ valor, onChange, min = 1, max = 36, sufixo, placeholder }: { valor: number; onChange: (v: number) => void; min?: number; max?: number; sufixo?: string; placeholder?: string }) {
  const lim = (v: number) => Math.min(max, Math.max(min, v || min))
  return (
    <div className="moeda">
      <input inputMode="numeric" value={placeholder && !valor ? '' : valor} placeholder={placeholder} onChange={(e) => onChange(lim(Number(e.target.value.replace(/\D/g, ''))))} />
      {sufixo && <span className="moeda-prefixo">{sufixo}</span>}
      <div className="moeda-setas">
        <button type="button" tabIndex={-1} onClick={() => onChange(lim(valor + 1))} aria-label="Aumentar">▲</button>
        <button type="button" tabIndex={-1} onClick={() => onChange(lim(valor - 1))} aria-label="Diminuir">▼</button>
      </div>
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>
}

export function Erro({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <div className="erro">{msg}</div>
}

export async function enviarArquivo(pasta: string, arquivo: File): Promise<string> {
  const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'bin'
  const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('arquivos').upload(caminho, arquivo, { upsert: false })
  if (error) throw new Error('Não consegui enviar o arquivo: ' + error.message)
  return caminho
}

export function LinkArquivo({ caminho, children }: { caminho: string | null; children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)
  if (!caminho) return null
  const abrir = async () => {
    if (url) return window.open(url, '_blank')
    const { data } = await supabase.storage.from('arquivos').createSignedUrl(caminho, 600)
    if (data?.signedUrl) { setUrl(data.signedUrl); window.open(data.signedUrl, '_blank') }
  }
  return <button type="button" className="link" onClick={abrir}>{children}</button>
}

export function Kpi({ rotulo, valor, tom, sub }: { rotulo: string; valor: string; tom?: string; sub?: string }) {
  return (
    <div className={`kpi ${tom ? 'kpi-' + tom : ''}`}>
      <div className="kpi-rotulo">{rotulo}</div>
      <div className="kpi-valor">{valor}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

export function Marca({ grande }: { grande?: boolean }) {
  return (
    <div className={`marca-logo${grande ? ' grande' : ''}`}>
      <img src="/logo-unique.png" alt="Unique HOF Academy" />
      <span className="marca-sub">Presenciais</span>
    </div>
  )
}

// Percentual com máscara (vírgula) e setas de 0,5 em 0,5.
export function InputPercent({ valor, onChange, passo = 0.5, max = 100 }: { valor: number | null; onChange: (v: number | null) => void; passo?: number; max?: number }) {
  const txt = valor === null || valor === undefined ? '' : String(valor).replace('.', ',')
  const lim = (v: number) => Math.min(max, Math.max(0, Math.round(v * 100) / 100))
  const mudar = (s: string) => {
    const limpo = s.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '')
    if (limpo === '') return onChange(null)
    if (limpo.endsWith(',')) return onChange(Number(limpo.slice(0, -1)) || 0)
    onChange(lim(Number(limpo.replace(',', '.'))))
  }
  return (
    <div className="moeda">
      <input inputMode="decimal" value={txt} onChange={(e) => mudar(e.target.value)} placeholder="0" />
      <span className="moeda-prefixo" style={{ paddingRight: 10 }}>%</span>
      <div className="moeda-setas">
        <button type="button" tabIndex={-1} onClick={() => onChange(lim((valor ?? 0) + passo))} aria-label="Aumentar">▲</button>
        <button type="button" tabIndex={-1} onClick={() => onChange(lim((valor ?? 0) - passo))} aria-label="Diminuir">▼</button>
      </div>
    </div>
  )
}
