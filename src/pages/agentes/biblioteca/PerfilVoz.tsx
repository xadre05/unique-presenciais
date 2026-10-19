// Base da marca → Como a marca fala: o perfil de voz que vai em todo pedido ao agente.
// "Gerar a partir da biblioteca" pede ao agente uma proposta lida dos materiais; a equipe revisa, edita e salva.
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { msgErro } from '../../../lib/dados'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'

type Props = { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }

// lê o perfil de novo antes de gravar, para não apagar o que outra tela salvou
async function salvarVoz(empresaId: string, voz: string) {
  const { data: atual } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresaId).eq('agente_id', 'marketing').maybeSingle()
  const base = (atual?.perfil ?? {}) as Record<string, unknown>
  return supabase.from('agentes_empresa').upsert({ empresa_id: empresaId, agente_id: 'marketing', perfil: { ...base, voz: voz.trim() || undefined }, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,agente_id' })
}

export function PerfilVoz({ empresaId, perfil, aoSalvar }: Props) {
  const salvo = String(perfil.voz ?? '')
  const [texto, setTexto] = useState(salvo)
  const [gerando, setGerando] = useState(false)
  const [estado, setEstado] = useState<'salvo' | 'alterado' | 'proposta'>('salvo')
  const [erro, setErro] = useState<string | null>(null)

  const gerar = async () => {
    setErro(null); setGerando(true)
    const { data, error } = await supabase.functions.invoke('agentes', { body: { voz: true, empresa: empresaId } })
    setGerando(false)
    if (error || data?.erro) return setErro(data?.erro ?? 'O agente não conseguiu gerar agora. Tente de novo.')
    setTexto(String(data.perfil ?? '')); setEstado('proposta')
  }
  const salvar = async () => {
    setErro(null)
    const { error } = await salvarVoz(empresaId, texto)
    if (error) return setErro(msgErro(error))
    setEstado('salvo'); aoSalvar()
  }
  return (
    <div className="bib">
      <textarea rows={10} value={texto} onChange={(e) => { setTexto(e.target.value); setEstado('alterado') }} aria-label="Perfil de voz"
        placeholder="Como a marca explica, os termos e nomes próprios que usa, as expressões que repete, no que acredita e o que critica, o tom com quem está começando e com quem já atende." />
      {estado === 'proposta' && <span className="muted pequeno"><Icone nome="info" tam={14} /> Proposta do agente, lida da biblioteca. Revise, corrija o que não for a cara da marca e salve.</span>}
      <div className="ia-linha">
        <button type="button" className="btn btn-contorno" disabled={gerando} onClick={gerar}><Icone nome="floco" tam={16} /> {gerando ? 'Lendo a biblioteca… (até 1 minuto)' : salvo ? 'Gerar de novo a partir da biblioteca' : 'Gerar a partir da biblioteca'}</button>
        <button type="button" className="btn btn-contorno-ouro" disabled={estado === 'salvo'} onClick={salvar}>{estado === 'salvo' ? 'Salvo' : 'Salvar perfil de voz'}</button>
      </div>
      <Erro msg={erro} />
    </div>
  )
}
