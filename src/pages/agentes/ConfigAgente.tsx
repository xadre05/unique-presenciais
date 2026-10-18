// Configurar um agente: ligado ou não, qual modelo do Claude usa, quanto pode gastar no mês e instruções só dele.
// Fica no perfil do agente (agentes_empresa.perfil), junto com o que já estiver lá.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { Campo, Erro } from '../../components/ui'
import { MODELOS } from './comum'

export type ConfigDoAgente = { modelo?: string; limite_mes_usd?: number | null; instrucoes?: string }

export function ConfigAgente({ empresaId, agenteId, ativo, perfil, aoSalvar }: { empresaId: string; agenteId: string; ativo: boolean; perfil: Record<string, unknown>; aoSalvar: () => void }) {
  const [ligado, setLigado] = useState(ativo)
  const [modelo, setModelo] = useState(String(perfil.modelo ?? ''))
  const [limite, setLimite] = useState(perfil.limite_mes_usd != null ? String(perfil.limite_mes_usd) : '')
  const [instrucoes, setInstrucoes] = useState(String(perfil.instrucoes ?? ''))
  const [storiesEco, setStoriesEco] = useState(perfil.stories_economico !== false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const salvar = async () => {
    setErro(null); setOk(false)
    const v = limite.replace(',', '.').trim()
    const novo = { ...perfil, modelo: modelo || null, limite_mes_usd: v ? Number(v) : null, instrucoes: instrucoes.trim() || null, ...(agenteId === 'marketing' ? { stories_economico: storiesEco } : {}) }
    const { error } = await supabase.from('agentes_empresa').upsert({ empresa_id: empresaId, agente_id: agenteId, ativo: ligado, perfil: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,agente_id' })
    if (error) return setErro(msgErro(error))
    setOk(true); aoSalvar()
  }
  return (
    <div className="form-grade">
      <label className="check"><input type="checkbox" checked={ligado} onChange={(e) => setLigado(e.target.checked)} /> Agente ligado (desligado, ele não aceita pedidos)</label>
      <div className="linha-campos">
        <Campo rotulo="Modelo do Claude" dica={modelo ? MODELOS[modelo]?.dica : 'Usa o modelo escolhido em Configurações'}>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
            <option value="">Padrão da empresa</option>
            {Object.entries(MODELOS).map(([k, m]) => <option key={k} value={k}>{m.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Limite deste agente no mês (US$)" dica="Em branco: só vale o limite da empresa"><input inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="Ex.: 5" /></Campo>
      </div>
      {agenteId === 'marketing' && <label className="check"><input type="checkbox" checked={storiesEco} onChange={(e) => setStoriesEco(e.target.checked)} /> Stories no modelo econômico (Haiku): os stories saem cerca de 20 vezes mais baratos; posts e reels continuam no modelo acima</label>}
      <Campo rotulo="Instruções só para este agente" dica="Ex.: sempre termine os stories com caixinha de pergunta; use 'você' e nunca 'vocês'; reels de até 30 segundos">
        <textarea rows={4} value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} />
      </Campo>
      <p className="muted pequeno">O que vale para todos os agentes (o que a empresa vende, público, tom, regras) fica em <b>Base da marca</b>.</p>
      <Erro msg={erro} />
      <div className="modal-acoes">{ok && <span className="ok-txt pequeno">Salvo ✓</span>}<button className="btn btn-ouro" onClick={salvar}>Salvar configuração</button></div>
    </div>
  )
}
