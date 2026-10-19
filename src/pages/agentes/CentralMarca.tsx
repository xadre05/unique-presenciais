// Base da marca: o que os agentes precisam saber da empresa, em 4 abas para não virar uma página sem fim.
// A marca (quem é, o que vende, como fala, rosto e visual) · Campanhas (ofertas com data) ·
// Conhecimento (biblioteca da empresa e referências de terceiros para modelar) · Canais (redes e Instagram ligado).
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { MarketingPerfil, type PerfilMarketing } from './MarketingPerfil'
import { RedesEmpresa } from './RedesEmpresa'
import { PessoasMarca } from './PessoasMarca'
import { LogosMarca } from './LogosMarca'
import { BibliotecaMarca } from './biblioteca/BibliotecaMarca'
import { PerfilVoz } from './biblioteca/PerfilVoz'
import { useConexao } from './instagram/dados'
import { CampanhasMarca } from './CampanhasMarca'
import { ReferenciasMarca } from './referencias/ReferenciasMarca'

type Aba = 'marca' | 'campanhas' | 'conhecimento' | 'canais'
const ABAS: { id: Aba; nome: string; sub: string }[] = [
  { id: 'marca', nome: 'A marca', sub: 'Quem é a empresa, o que vende sempre, como fala, quem aparece nas artes e o visual.' },
  { id: 'campanhas', nome: 'Campanhas', sub: 'Ofertas com data para começar e terminar (Black, lançamento). Na hora de planejar, você escolhe a campanha.' },
  { id: 'conhecimento', nome: 'Conhecimento', sub: 'O que o agente estuda: os materiais da própria empresa e os conteúdos de outras pessoas que servem de modelo.' },
  { id: 'canais', nome: 'Canais', sub: 'As redes que a empresa usa. Só as ligadas aparecem para planejar e criar peças.' },
]

// a conexão do Instagram fica em Configurações → Integrações; aqui só o aviso de como está
function StatusInstagram() {
  const c = useConexao(EMPRESA_UNIQUE).dados
  return (
    <p className="muted pequeno">{c?.status === 'conectado' ? `Instagram ligado (@${c.usuario ?? ''}): o agente lê os posts e os resultados todo dia.` : 'O Instagram ainda não está ligado para ler os resultados.'}{' '}
      <Link to="/agentes/central?aba=integracoes" className="link">Configurações → Integrações</Link></p>
  )
}

export default function CentralMarca() {
  const [params, setParams] = useSearchParams()
  const inicial = ABAS.find((a) => a.id === params.get('aba'))?.id ?? 'marca'
  const [aba, setAba] = useState<Aba>(inicial)
  const perfil = useConsulta<{ perfil: PerfilMarketing } | null>(() => supabase.from('agentes_empresa').select('perfil').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())
  const dados = (perfil.dados?.perfil ?? {}) as Record<string, unknown>
  const pronto = !perfil.carregando
  const trocar = (a: Aba) => { setAba(a); setParams({ aba: a }, { replace: true }) }
  const atual = ABAS.find((a) => a.id === aba)!
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Base da marca</h1><p className="muted">O que os agentes precisam saber para falar como a empresa.</p></div></header>
      <nav className="mk-abas-topo">{ABAS.map((a) => <button key={a.id} className={aba === a.id ? 'ativa' : ''} onClick={() => trocar(a.id)}>{a.nome}</button>)}</nav>
      <p className="muted base-sub">{atual.sub}</p>

      {aba === 'marca' && <>
        <section className="bloco"><h2>Sobre a marca</h2><p className="muted pequeno">O que a marca é e vende sempre. Oferta com data (Black, lançamento) vai na aba Campanhas.</p>
          {pronto && <MarketingPerfil empresaId={EMPRESA_UNIQUE} perfil={perfil.dados?.perfil ?? {}} aoSalvar={perfil.recarregar} />}</section>
        <section className="bloco"><h2>Como a marca fala</h2><p className="muted pequeno">Não precisa escrever do zero: clique em "Gerar a partir da biblioteca", revise e salve. Vai junto em todo pedido ao agente.</p>
          {pronto && <PerfilVoz empresaId={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} />}</section>
        <section className="bloco"><h2>Pessoas da marca</h2><p className="muted pequeno">Quem pode aparecer nas artes criadas pela IA. As fotos servem de referência para o rosto ficar parecido; só entram com a autorização de uso de imagem.</p>
          <PessoasMarca empresa={EMPRESA_UNIQUE} /></section>
        <section className="bloco"><h2>Identidade visual</h2><p className="muted pequeno">O logo real da empresa e imagens que mostram o estilo da marca. O Agente de Arte usa em toda arte.</p>
          {pronto && <LogosMarca empresaId={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} />}</section>
      </>}

      {aba === 'campanhas' && <section className="bloco"><h2>Campanhas</h2><p className="muted pequeno">Cada campanha tem período, oferta e regras próprias. As peças da campanha usam só essas informações.</p>
        {pronto && <CampanhasMarca empresaId={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} />}</section>}

      {aba === 'conhecimento' && <>
        <section className="bloco"><h2>Biblioteca da marca</h2><p className="muted pequeno">Os materiais da própria empresa: cursos, técnicas, protocolos. É daqui que o agente tira o conteúdo das peças.</p>
          <BibliotecaMarca empresa={EMPRESA_UNIQUE} /></section>
        <section className="bloco"><h2>Referências para modelar</h2><p className="muted pequeno">Posts e reels de outras pessoas que vocês gostariam de ter feito. Guarde e diga o que copiar; o agente estuda sozinho e passa a usar a forma (gancho, estrutura, edição), nunca o conteúdo. Só esta empresa vê.</p>
          <ReferenciasMarca empresa={EMPRESA_UNIQUE} /></section>
      </>}

      {aba === 'canais' && <section className="bloco"><h2>Redes sociais</h2><p className="muted pequeno">Os canais que a empresa usa. Só os ligados aparecem para planejar e criar peças.</p>
        {pronto && <RedesEmpresa empresaId={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} />}
        <StatusInstagram /></section>}
    </div>
  )
}
