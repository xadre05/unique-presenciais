// Base da marca: o que os agentes precisam saber da empresa, em 4 abas para não virar uma página sem fim.
// A marca (quem é, o que vende, como fala, rosto e visual) · Campanhas (ofertas com data) ·
// Conhecimento (biblioteca da empresa e referências de terceiros para modelar) · Canais (redes e Instagram ligado).
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { EMPRESA_UNIQUE } from '../crm/comum'
import { Icone } from '../../components/Icone'
import { RedesEmpresa } from './RedesEmpresa'
import { useConexao } from './instagram/dados'
import { CampanhasMarca } from './campanhas/CampanhasMarca'
import { AbaMarca } from './marca/AbaMarca'
import { AbaConhecimento } from './marca/AbaConhecimento'

type Aba = 'marca' | 'campanhas' | 'conhecimento' | 'canais'
const ABAS: { id: Aba; nome: string; sub: string }[] = [
  { id: 'marca', nome: 'A marca', sub: 'Quem é a empresa, o que vende sempre, como fala, quem aparece nas artes e o visual.' },
  { id: 'campanhas', nome: 'Campanhas', sub: 'Ofertas, períodos e orientações de cada ação. Uma campanha pode vender produtos da marca ou nenhum (ex.: ganhar seguidores).' },
  { id: 'conhecimento', nome: 'Conhecimento', sub: 'Conteúdo aprovado da empresa e referências de criação de terceiros, com funções diferentes.' },
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
  const perfil = useConsulta<{ perfil: Record<string, unknown>; atualizado_em: string | null } | null>(() => supabase.from('agentes_empresa').select('perfil,atualizado_em').eq('empresa_id', EMPRESA_UNIQUE).eq('agente_id', 'marketing').maybeSingle())
  const dados = (perfil.dados?.perfil ?? {}) as Record<string, unknown>
  // depois da primeira leitura a página não some ao recarregar (senão perderia o que está sendo editado)
  const pronto = !perfil.carregando || perfil.dados !== null
  const [pendente, setPendente] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const mudarPendente = useCallback((p: boolean) => { setPendente(p); if (!p) setAviso(null) }, [])
  const trocar = (a: Aba) => {
    if (pendente && a !== aba) return setAviso('Salve ou descarte as alterações de "A marca" antes de trocar de aba (barra lá embaixo).')
    setAba(a); setParams({ aba: a }, { replace: true })
  }
  const quando = perfil.dados?.atualizado_em ? new Date(perfil.dados.atualizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
  const atual = ABAS.find((a) => a.id === aba)!
  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Base da marca</h1><p className="muted">O que os agentes precisam saber para falar como a empresa.</p></div>{quando && <span className="bm-quando muted pequeno"><Icone nome="relogio" tam={15} /> Última alteração: {quando}</span>}</header>
      <nav className="mk-abas-topo">{ABAS.map((a) => <button key={a.id} className={aba === a.id ? 'ativa' : ''} onClick={() => trocar(a.id)}>{a.nome}</button>)}</nav>
      <p className="muted base-sub">{atual.sub}</p>
      {aviso && <p className="nota pequeno erro-txt">{aviso}</p>}

      {aba === 'marca' && pronto && <AbaMarca empresa={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} aoMudarPendente={mudarPendente} />}

      {aba === 'campanhas' && pronto && <CampanhasMarca empresa={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} />}

      {aba === 'conhecimento' && <AbaConhecimento empresa={EMPRESA_UNIQUE} pagina={params.get('ref') === 'nova' || params.get('ref') === 'canal' ? params.get('ref') as 'nova' | 'canal' : null} aoPagina={(p) => setParams(p ? { aba: 'conhecimento', ref: p } : { aba: 'conhecimento' })} />}

      {aba === 'canais' && <section className="bloco"><h2>Redes sociais</h2><p className="muted pequeno">Os canais que a empresa usa. Só os ligados aparecem para planejar e criar peças.</p>
        {pronto && <RedesEmpresa empresaId={EMPRESA_UNIQUE} perfil={dados} aoSalvar={perfil.recarregar} />}
        <StatusInstagram /></section>}
    </div>
  )
}
