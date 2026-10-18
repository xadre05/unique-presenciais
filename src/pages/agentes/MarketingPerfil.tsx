// O que o agente de Marketing precisa saber da empresa. É a "memória" dele: vale para toda semana que ele montar.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { Campo, Erro } from '../../components/ui'

export type PerfilMarketing = Partial<Record<'empresa' | 'o_que_vende' | 'publico' | 'tom' | 'evitar' | 'conselho' | 'instagram', string>>

const CAMPOS: { k: keyof PerfilMarketing; rotulo: string; dica: string; linhas: number }[] = [
  { k: 'empresa', rotulo: 'Empresa', dica: 'Quem é, em uma frase', linhas: 1 },
  { k: 'o_que_vende', rotulo: 'O que vende', dica: 'Produtos, cursos ou procedimentos e o que cada um entrega', linhas: 4 },
  { k: 'publico', rotulo: 'Para quem', dica: 'Quem compra e o que essa pessoa quer', linhas: 3 },
  { k: 'tom', rotulo: 'Tom de voz', dica: 'Como a marca fala', linhas: 2 },
  { k: 'evitar', rotulo: 'Nunca fazer', dica: 'Palavras e promessas proibidas', linhas: 2 },
  { k: 'conselho', rotulo: 'Regras do conselho', dica: 'CFO, CFM, CRBM: o que a publicidade não pode ter', linhas: 2 },
  { k: 'instagram', rotulo: 'Instagram (opcional)', dica: 'Ex.: @suaclinica', linhas: 1 },
]

export function MarketingPerfil({ empresaId, perfil, aoSalvar }: { empresaId: string; perfil: PerfilMarketing; aoSalvar: () => void }) {
  const [f, setF] = useState<PerfilMarketing>(perfil)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const salvar = async () => {
    setErro(null); setOk(false)
    const limpo = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]).filter(([, v]) => v !== '' && v != null))
    // mantém a configuração do agente (modelo, limite, instruções) que mora no mesmo perfil
    const { data: atual } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresaId).eq('agente_id', 'marketing').maybeSingle()
    const base = Object.fromEntries(Object.entries((atual?.perfil ?? {}) as Record<string, unknown>).filter(([k]) => !CAMPOS.some((c) => c.k === k)))
    const { error } = await supabase.from('agentes_empresa').upsert({ empresa_id: empresaId, agente_id: 'marketing', perfil: { ...base, ...limpo }, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,agente_id' })
    if (error) return setErro(msgErro(error))
    setOk(true); aoSalvar()
  }
  return (
    <div className="form-grade">
      {CAMPOS.map((c) => (
        <Campo key={c.k} rotulo={c.rotulo} dica={c.dica}>
          {c.linhas > 1
            ? <textarea rows={c.linhas} value={f[c.k] ?? ''} onChange={(e) => setF((x) => ({ ...x, [c.k]: e.target.value }))} />
            : <input value={f[c.k] ?? ''} onChange={(e) => setF((x) => ({ ...x, [c.k]: e.target.value }))} />}
        </Campo>
      ))}
      <Erro msg={erro} />
      <div className="modal-acoes">{ok && <span className="ok-txt pequeno">Salvo ✓</span>}<button className="btn btn-ouro" onClick={salvar}>Salvar a base da marca</button></div>
    </div>
  )
}
