// CRM — NÚCLEO: blocos da coluna Contexto que são da conversa (não do contato): resumo da IA e etiquetas.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Erro } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { horaCurta, type Conversa } from '../tipos'
import { resumirConversa } from './util'

export function ResumoIA({ conv, aoMudar }: { conv: Conversa; aoMudar?: () => void }) {
  const [texto, setTexto] = useState(conv.resumo ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const resumir = async () => {
    setOcupado(true); setErro(null)
    try { setTexto(await resumirConversa(conv.id)); aoMudar?.() } catch (e) { setErro((e as Error).message) }
    setOcupado(false)
  }
  return (<>
    {texto ? <p className="cx-resumo pequeno">{texto}</p> : <p className="muted pequeno">A IA lê a conversa e resume em 3 linhas: quem é, o que quer e o que falta.</p>}
    <div className="cx-ia">
      <span className="muted pequeno">{conv.resumo_em && texto === conv.resumo ? `Resumido ${horaCurta(conv.resumo_em)}` : ''}</span>
      <button className="btn btn-mini btn-contorno-ouro" onClick={resumir} disabled={ocupado}><Icone nome="floco" tam={14} /> {ocupado ? 'Lendo…' : texto ? 'Atualizar' : 'Resumir'}</button>
    </div>
    <Erro msg={erro} />
  </>)
}

export function EtiquetasConversa({ conv, sugestoes, aoMudar }: { conv: Conversa; sugestoes: string[]; aoMudar?: () => void }) {
  const [lista, setLista] = useState<string[]>(conv.etiquetas ?? [])
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async (n: string[]) => {
    setLista(n); setErro(null)
    const { error } = await supabase.from('crm_conversas').update({ etiquetas: n }).eq('id', conv.id)
    if (error) setErro(error.message); else aoMudar?.()
  }
  const add = (t: string) => { const x = t.trim().toLowerCase(); if (x && !lista.includes(x)) salvar([...lista, x]); setNova('') }
  const outras = sugestoes.filter((s) => !lista.includes(s)).slice(0, 8)
  return (<>
    <div className="cx-etiquetas">
      {lista.map((t) => <span key={t} className="ci-chip ouro">{t} <button onClick={() => salvar(lista.filter((x) => x !== t))} aria-label={`Tirar ${t}`}>×</button></span>)}
      {!lista.length && <span className="muted pequeno">Nenhuma etiqueta.</span>}
    </div>
    <input value={nova} placeholder="Nova etiqueta (Enter)" onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(nova) } }} />
    {outras.length > 0 && <div className="cx-etiquetas">{outras.map((t) => <button key={t} className="ci-chip" onClick={() => add(t)}>+ {t}</button>)}</div>}
    <Erro msg={erro} />
  </>)
}
