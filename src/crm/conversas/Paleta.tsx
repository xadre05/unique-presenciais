// CRM — NÚCLEO: busca rápida de comandos (Ctrl+K): achar uma conversa pelo nome ou número, trocar de aba, começar
// conversa. Atalhos: Ctrl+K abre · Esc fecha · ↑ ↓ escolhem · Enter executa.
import { useMemo, useState } from 'react'
import { Icone } from '../../components/Icone'
import { telefoneLegivel } from '../nucleo'
import type { Conversa } from '../tipos'

export type Comando = { id: string; rotulo: string; dica?: string; icone: string; fazer: () => void }

export function Paleta({ comandos, convs, abrirConversa, aoFechar }: { comandos: Comando[]; convs: Conversa[]; abrirConversa: (id: string) => void; aoFechar: () => void }) {
  const [busca, setBusca] = useState('')
  const [pos, setPos] = useState(0)
  const termo = busca.trim().toLowerCase()
  const itens = useMemo<Comando[]>(() => {
    const cmds = comandos.filter((c) => !termo || c.rotulo.toLowerCase().includes(termo))
    const conv = termo.length < 2 ? [] : convs.filter((c) => `${c.contato?.nome ?? ''} ${c.contato?.telefone ?? ''}`.toLowerCase().includes(termo)).slice(0, 8)
      .map((c) => ({ id: c.id, rotulo: c.contato?.nome || telefoneLegivel(c.contato?.telefone), dica: c.ultima_mensagem ?? '', icone: 'whats', fazer: () => abrirConversa(c.id) }))
    return [...conv, ...cmds]
  }, [comandos, convs, termo, abrirConversa])
  const executar = (c?: Comando) => { if (c) { c.fazer(); aoFechar() } }
  return (
    <div className="pal-fundo" onClick={aoFechar}>
      <div className="pal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Busca rápida">
        <label className="select-icone"><Icone nome="busca" tam={16} />
          <input autoFocus value={busca} placeholder="Buscar conversa ou comando…" onChange={(e) => { setBusca(e.target.value); setPos(0) }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') aoFechar()
              else if (e.key === 'ArrowDown') { e.preventDefault(); setPos(Math.min(pos + 1, itens.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setPos(Math.max(pos - 1, 0)) }
              else if (e.key === 'Enter') executar(itens[pos])
            }} /></label>
        <ul>{itens.map((c, i) => <li key={c.id}><button className={i === pos ? 'sel' : ''} onMouseEnter={() => setPos(i)} onClick={() => executar(c)}>
          <Icone nome={c.icone} tam={16} /><span><b>{c.rotulo}</b>{c.dica && <span className="muted pequeno">{c.dica.slice(0, 70)}</span>}</span></button></li>)}
          {!itens.length && <li className="muted pequeno pal-vazio">Nada encontrado.</li>}</ul>
        <p className="muted pequeno pal-dica">Ctrl+K abre · ↑ ↓ escolhem · Enter executa · Esc fecha</p>
      </div>
    </div>
  )
}
