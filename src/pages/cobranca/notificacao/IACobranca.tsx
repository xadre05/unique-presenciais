// Liga a IA de cobrança num número de WhatsApp do sistema (o mesmo cadastro de números do Atendimento). O número escolhido
// passa a ser respondido pela IA: cada mensagem que chega vai para a função "cobranca-agente".
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { msgErro, useConsulta } from '../../../lib/dados'
import { Badge, Campo, Erro } from '../../../components/ui'
import type { Config } from './modelo'

type Canal = { id: string; nome: string; tipo: string; status: string; config: Record<string, unknown> | null }
const FUNCAO = 'cobranca-agente'

async function marcarNumero(canais: Canal[], escolhido: string | null) {
  // tira a IA de cobrança de qualquer outro número e põe no escolhido
  for (const k of canais) {
    const tem = k.config?.ia_funcao === FUNCAO, deve = k.id === escolhido
    if (tem === deve) continue
    const config = { ...(k.config ?? {}) }
    if (deve) config.ia_funcao = FUNCAO; else delete config.ia_funcao
    const { error } = await supabase.from('crm_canais').update({ config }).eq('id', k.id)
    if (error) throw new Error(msgErro(error))
  }
}

export function IACobranca({ cfg, aoMudar }: { cfg: Config; aoMudar: () => void }) {
  const canais = useConsulta<Canal[]>(() => supabase.from('crm_canais').select('id,nome,tipo,status,config').eq('ativo', true).order('criado_em'), [])
  const [canal, setCanal] = useState(cfg.ia_canal_id ?? '')
  const [ligada, setLigada] = useState(cfg.ia_ligada)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const atual = (canais.dados ?? []).find((k) => k.id === canal)

  const salvar = async () => {
    setErro(null); setAviso(null)
    if (ligada && !canal) return setErro('Escolha o número.')
    try {
      await marcarNumero(canais.dados ?? [], ligada ? canal : null)
      const { error } = await supabase.from('cobranca_config').update({ ia_canal_id: canal || null, ia_ligada: ligada, atualizado_em: new Date().toISOString() }).eq('id', true)
      if (error) throw new Error(msgErro(error))
      setAviso('Salvo.'); aoMudar(); canais.recarregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui salvar.') }
  }

  return (
    <section className="not-email">
      <div className="bloco-topo"><h3>IA de cobrança no WhatsApp</h3>
        <Badge tom={cfg.ia_ligada ? 'ok' : 'neutro'}>{cfg.ia_ligada ? 'ligada' : 'desligada'}</Badge></div>
      <p className="muted pequeno">Manda o aviso da notificação, responde dúvidas com os dados da dívida, envia a segunda via e fecha acordo dentro dos limites abaixo. Quando não pode resolver (contestação, “já paguei”), avisa a equipe na lista.</p>
      <div className="not-config">
        <Campo rotulo="Número da cobrança" dica={atual?.tipo === 'teste' ? 'Número de teste: nada sai de verdade. Use "Testar a IA" em cada pessoa.' : 'Cadastre o número em Atendimento → Configurações.'}>
          <span className="select-icone"><select value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="">Escolha…</option>{(canais.dados ?? []).map((k) => <option key={k.id} value={k.id}>{k.nome}{k.status !== 'conectado' ? ' (desconectado)' : ''}</option>)}
          </select></span>
        </Campo>
        <label className="check"><input type="checkbox" checked={ligada} onChange={(e) => setLigada(e.target.checked)} /> IA ligada (responde sozinha)</label>
      </div>
      <div className="acoes"><button type="button" className="btn btn-contorno btn-mini" onClick={salvar}>Salvar</button>{aviso && <span className="muted pequeno">{aviso}</span>}</div>
      <Erro msg={erro || canais.erro} />
    </section>
  )
}
