// Central da marca: o que todos os agentes precisam saber da empresa (tom, ofertas, público, regras).
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { MarketingPerfil, type PerfilMarketing } from './MarketingPerfil'

export default function CentralMarca() {
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Central da marca</h1><p className="muted">A base que os agentes usam para falar como a Unique: o que vende, para quem, o tom e o que nunca fazer.</p></div></header>
      <section className="bloco">{!perfil.carregando && <MarketingPerfil empresaId={EMPRESA_UNIQUE} perfil={perfil.dados?.perfil ?? {}} aoSalvar={perfil.recarregar} />}</section>
    </div>
  )
}
