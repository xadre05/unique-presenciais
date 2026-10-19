// Central da marca: o que todos os agentes precisam saber da empresa (tom, ofertas, público, regras).
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { MarketingPerfil, type PerfilMarketing } from './MarketingPerfil'
import { RedesEmpresa } from './RedesEmpresa'
import { PessoasMarca } from './PessoasMarca'
import { LogosMarca } from './LogosMarca'
import { BibliotecaMarca } from './biblioteca/BibliotecaMarca'
import { PerfilVoz } from './biblioteca/PerfilVoz'
import { ConexaoInstagram } from './instagram/ConexaoInstagram'
import { CampanhasMarca } from './CampanhasMarca'

export default function CentralMarca() {
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Base da marca</h1><p className="muted">A base que os agentes usam para falar como a Unique: o que vende, para quem, o tom e o que nunca fazer.</p></div></header>
      <section className="bloco"><h2>Redes sociais</h2><p className="muted pequeno">Os canais que a empresa usa. Só os ligados aparecem para planejar e criar peças.</p>
        {!perfil.carregando && <RedesEmpresa empresaId={EMPRESA_UNIQUE} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}
        <ConexaoInstagram empresa={EMPRESA_UNIQUE} /></section>
      <section className="bloco"><h2>Identidade visual</h2><p className="muted pequeno">O que o Agente de Arte usa em toda arte: o logo real da empresa e imagens que mostram o estilo da marca.</p>
        {!perfil.carregando && <LogosMarca empresaId={EMPRESA_UNIQUE} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}</section>
      <section className="bloco"><h2>Biblioteca da marca</h2><p className="muted pequeno">O conhecimento da empresa: cursos, técnicas, protocolos, como a marca ensina. É daqui que o agente tira o conteúdo das peças.</p>
        <BibliotecaMarca empresa={EMPRESA_UNIQUE} /></section>
      <section className="bloco"><h2>Como a marca fala</h2><p className="muted pequeno">O perfil de voz vai junto em todo pedido ao agente: o jeito de explicar, os termos, as expressões e o posicionamento da marca.</p>
        {!perfil.carregando && <PerfilVoz empresaId={EMPRESA_UNIQUE} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}</section>
      <section className="bloco"><h2>Pessoas da marca</h2><p className="muted pequeno">Quem pode aparecer nas artes criadas pela IA. As fotos servem de referência para o rosto ficar parecido; só entram com a autorização de uso de imagem.</p>
        <PessoasMarca empresa={EMPRESA_UNIQUE} /></section>
      <section className="bloco"><h2>Sobre a marca</h2><p className="muted pequeno">O que a marca é e vende sempre. Ofertas de um momento (Black, lançamento, data especial) ficam em Campanhas, logo abaixo.</p>{!perfil.carregando && <MarketingPerfil empresaId={EMPRESA_UNIQUE} perfil={perfil.dados?.perfil ?? {}} aoSalvar={perfil.recarregar} />}</section>
      <section className="bloco"><h2>Campanhas</h2><p className="muted pequeno">Cada campanha tem período, oferta e regras próprias. Na reunião de pauta você escolhe a campanha, e as peças dela usam só essas informações.</p>
        {!perfil.carregando && <CampanhasMarca empresaId={EMPRESA_UNIQUE} perfil={(perfil.dados?.perfil ?? {}) as Record<string, unknown>} aoSalvar={perfil.recarregar} />}</section>
    </div>
  )
}
