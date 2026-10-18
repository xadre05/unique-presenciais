// Central da marca: o que todos os agentes precisam saber da empresa (tom, ofertas, público, regras).
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { MarketingPerfil, type PerfilMarketing } from './MarketingPerfil'
import { RedesEmpresa } from './RedesEmpresa'
import { PessoasMarca } from './PessoasMarca'

export default function CentralMarca() {
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Base da marca</h1><p className="muted">A base que os agentes usam para falar como a Unique: o que vende, para quem, o tom e o que nunca fazer.</p></div></header>
      <section className="bloco"><h2>Redes sociais</h2><p className="muted pequeno">Os canais que a empresa usa. Só os ligados aparecem para planejar e criar peças.</p>
        {!perfil.carregando && <RedesEmpresa empresaId={EMPRESA_UNIQUE} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}</section>
      <section className="bloco"><h2>Pessoas da marca</h2><p className="muted pequeno">Quem pode aparecer nas artes criadas pela IA. As fotos servem de referência para o rosto ficar parecido; só entram com a autorização de uso de imagem.</p>
        <PessoasMarca empresa={EMPRESA_UNIQUE} /></section>
      <section className="bloco"><h2>Sobre a marca</h2>{!perfil.carregando && <MarketingPerfil empresaId={EMPRESA_UNIQUE} perfil={perfil.dados?.perfil ?? {}} aoSalvar={perfil.recarregar} />}</section>
    </div>
  )
}
