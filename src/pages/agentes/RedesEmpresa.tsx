// Redes sociais da empresa (Base da marca): quais canais a empresa usa e o perfil em cada um.
// Só os canais ligados aparecem nos filtros, no planejamento e na criação de peças; o agente escreve para eles.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { msgErro } from '../../lib/dados'
import { Erro } from '../../components/ui'
import { REDES, REDES_PADRAO, TODAS_REDES, nomeFormato, type CadastroRedes, type Rede } from './marketing/redes'
import { LogoRede } from './marketing/LogoRede'

function inicial(perfil: Record<string, unknown>): CadastroRedes {
  const salvo = perfil.redes as CadastroRedes | undefined
  if (salvo) return salvo
  // primeira vez: liga os 3 canais iniciais e aproveita o Instagram que já estava na base
  return Object.fromEntries(REDES_PADRAO.map((r) => [r, { ativa: true, perfil: r === 'instagram' ? String(perfil.instagram ?? '') : '' }]))
}

export function RedesEmpresa({ empresaId, perfil, aoSalvar }: { empresaId: string; perfil: Record<string, unknown>; aoSalvar: () => void }) {
  const [cad, setCad] = useState<CadastroRedes>(() => inicial(perfil))
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const mudar = (r: Rede, c: Partial<{ ativa: boolean; perfil: string }>) => { setOk(false); setCad((x) => ({ ...x, [r]: { ativa: x[r]?.ativa ?? false, perfil: x[r]?.perfil ?? '', ...c } })) }
  const ligadas = TODAS_REDES.filter((r) => cad[r]?.ativa).length

  const salvar = async () => {
    setErro(null); setOk(false)
    if (!ligadas) return setErro('Ligue pelo menos um canal.')
    const limpo = Object.fromEntries(TODAS_REDES.filter((r) => cad[r]).map((r) => [r, { ativa: !!cad[r]?.ativa, perfil: (cad[r]?.perfil ?? '').trim() || undefined }]))
    const { data: atual } = await supabase.from('agentes_empresa').select('perfil').eq('empresa_id', empresaId).eq('agente_id', 'marketing').maybeSingle()
    const base = (atual?.perfil ?? {}) as Record<string, unknown>
    const instagram = limpo.instagram?.perfil ?? base.instagram
    const { error } = await supabase.from('agentes_empresa').upsert({ empresa_id: empresaId, agente_id: 'marketing', perfil: { ...base, redes: limpo, instagram }, atualizado_em: new Date().toISOString() }, { onConflict: 'empresa_id,agente_id' })
    if (error) return setErro(msgErro(error))
    setOk(true); aoSalvar()
  }

  return (
    <div className="mk-redes-cad">
      {TODAS_REDES.map((r) => {
        const ativa = !!cad[r]?.ativa
        return (
          <div key={r} className={`mk-rede-linha${ativa ? ' ativa' : ''}`}>
            <span className="mk-rede-logo"><LogoRede rede={r} tam={26} /></span>
            <div className="mk-rede-info"><b>{REDES[r].nome}</b><span className="muted pequeno">{REDES[r].formatos.map((f) => nomeFormato(f, r)).join(' · ')}</span></div>
            <input value={cad[r]?.perfil ?? ''} placeholder={REDES[r].exemplo} disabled={!ativa} onChange={(e) => mudar(r, { perfil: e.target.value })} aria-label={`Perfil no ${REDES[r].nome}`} />
            <label className={`interruptor${ativa ? ' ligado' : ''}`}><input type="checkbox" checked={ativa} onChange={(e) => mudar(r, { ativa: e.target.checked })} />{ativa ? 'Usa' : 'Não usa'}</label>
          </div>
        )
      })}
      <p className="muted pequeno">Quer outro canal (ex.: X, Telegram, Spotify)? Peça para incluir: cada canal precisa dos formatos e do jeito de escrever dele.</p>
      <Erro msg={erro} />
      <div className="modal-acoes">{ok && <span className="ok-txt pequeno">Salvo ✓</span>}<button className="btn btn-ouro" onClick={salvar}>Salvar redes sociais</button></div>
    </div>
  )
}
