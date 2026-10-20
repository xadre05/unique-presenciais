import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { dataBR } from '../lib/format'
import type { Conta } from '../lib/types'
import type { Perfil } from '../auth'
import { useAuth } from '../auth'
import { Badge, Campo, Erro, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { RegrasConteudo, type Regra } from './Comissoes'
import { AbaIntegracoes } from './Integracoes'
import { RegrasOnline } from './ComissoesOnline'

type PerfilC = Perfil & { criado_em: string }
type Papel = Perfil['papel']

// Cada área de trabalho tem a sua "Configurações", só com o que é dela.
export type AreaConfig = 'comercial' | 'financeiro' | 'controle'
const ABAS = [
  { id: 'vendedoras', nome: 'Vendedoras', icone: 'alunos', area: 'comercial' },
  { id: 'cursos', nome: 'Cursos', icone: 'livro', area: 'comercial' },
  { id: 'comissoes', nome: 'Comissões', icone: 'comissoes', area: 'comercial' },
  { id: 'contas', nome: 'Contas de recebimento', icone: 'moedas', area: 'financeiro' },
  { id: 'equipe', nome: 'Equipe e acessos', icone: 'usuario', area: 'controle' },
  { id: 'integracoes', nome: 'Integrações', icone: 'links', area: 'controle' },
] as const
const BASE: Record<AreaConfig, string> = { comercial: '/configuracoes', financeiro: '/financeiro/configuracoes', controle: '/controle/configuracoes' }
const TEXTO: Record<AreaConfig, string> = {
  comercial: 'Vendedoras, cursos e comissões. Só administrador vê esta página, e toda alteração fica no Histórico.',
  financeiro: 'Contas onde o dinheiro entra. Só administrador vê esta página, e toda alteração fica no Histórico.',
  controle: 'Quem entra no sistema (e em quais áreas) e as ligações com Hotmart, Asaas e notificação extrajudicial. Valem para todas as áreas.',
}

export const PAPEIS: Record<Papel, { rotulo: string; tom: string; situacao: string; descricao: string }> = {
  admin: { rotulo: 'Administrador', tom: 'ouro', situacao: 'Ativo', descricao: 'Vê tudo. Confirma recebimentos, libera e paga comissões, cria links, vê o histórico e mexe nas configurações.' },
  vendedora: { rotulo: 'Vendedora', tom: 'info', situacao: 'Ativo', descricao: 'Faz matrículas, informa pagamentos dos alunos e vê só as próprias comissões. Não confirma recebimento.' },
  pendente: { rotulo: 'Aguardando liberação', tom: 'alerta', situacao: 'Aguardando', descricao: 'Criou a conta, mas ainda não entra no sistema.' },
  inativo: { rotulo: 'Desativado', tom: 'neutro', situacao: 'Desativado', descricao: 'Não entra mais. Tudo o que a pessoa fez continua guardado no histórico.' },
}

const USOS: Record<string, { rotulo: string; tom: string; dica: string }> = {
  padrao: { rotulo: 'Padrão para novas vendas', tom: 'ouro', dica: 'Já vem escolhida na matrícula e na confirmação de pagamento.' },
  novas: { rotulo: 'Novas vendas', tom: 'info', dica: 'Aparece para escolher, mas não vem marcada.' },
  antigas: { rotulo: 'Só contratos antigos', tom: 'alerta', dica: 'Não aparece em vendas novas. Fica só para receber o que já foi vendido nela.' },
}
const TIPOS: Record<string, string> = { banco: 'Banco (Pix / transferência)', hotmart: 'Hotmart', especie: 'Dinheiro em espécie', outro: 'Outro' }

export default function Configuracoes({ area = 'comercial' }: { area?: AreaConfig }) {
  const { aba } = useParams()
  const navegar = useNavigate()
  const daArea = ABAS.filter((a) => a.area === area)
  const pedida = ABAS.find((a) => a.id === aba)
  // endereço antigo (ex.: /configuracoes/equipe) leva para a área certa
  if (pedida && pedida.area !== area) return <Navigate to={`${BASE[pedida.area]}/${pedida.id}`} replace />
  const atual = pedida ?? daArea[0]
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Configurações</h1><p className="muted">{TEXTO[area]}</p></div>
      </header>
      {daArea.length > 1 && <nav className="abas">
        {daArea.map((a) => <button key={a.id} className={a.id === atual.id ? 'ativa' : ''} onClick={() => navegar(`${BASE[area]}/${a.id}`)}><Icone nome={a.icone} tam={16} /> {a.nome}</button>)}
      </nav>}
      {atual.id === 'equipe' && <AbaEquipe />}
      {atual.id === 'vendedoras' && <AbaVendedoras />}
      {atual.id === 'cursos' && <AbaCursos />}
      {atual.id === 'contas' && <AbaContas />}
      {atual.id === 'comissoes' && <AbaComissoes />}
      {atual.id === 'integracoes' && <AbaIntegracoes />}
    </div>
  )
}

/* ───────────── Equipe e acessos ───────────── */

function AbaEquipe() {
  const { perfil: eu } = useAuth()
  const perfis = useConsulta<PerfilC[]>(() => supabase.from('perfis').select('*').order('criado_em'))
  const cad = useCadastros()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [editar, setEditar] = useState<PerfilC | null>(null)
  const todos = perfis.dados ?? []
  const pendentes = todos.filter((p) => p.papel === 'pendente')
  const termo = busca.trim().toLowerCase()
  const lista = todos.filter((p) => (!termo || `${p.nome} ${p.email}`.toLowerCase().includes(termo)) && (!filtro || p.papel === filtro))
    .sort((a, b) => (a.papel === 'pendente' ? -1 : 0) - (b.papel === 'pendente' ? -1 : 0) || (a.nome || a.email || '').localeCompare(b.nome || b.email || ''))

  return (<>
    <Erro msg={perfis.erro} />
    {pendentes.length > 0 && (
      <div className="faixa-alerta">
        <Icone nome="alerta" tam={20} />
        <span><b>{pendentes.length} pessoa(s) aguardando liberação:</b> {pendentes.map((p) => { const v = cad.vendedoras.find((x) => x.email && x.email.toLowerCase() === p.email?.toLowerCase() && !x.perfil_id); return (p.nome || p.email) + (v ? ` (e-mail confere com a vendedora ${v.nome})` : '') }).join(', ')}. Confira se é mesmo da equipe antes de liberar.</span>
        <button className="btn btn-contorno btn-mini" onClick={() => setEditar(pendentes[0])}>Liberar</button>
      </div>
    )}
    <div className="config-grade">
      <section className="bloco sem-padding">
        <div className="filtros-alunos" style={{ padding: '14px 16px 0' }}>
          <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
          <label className="select-icone"><Icone nome="usuario" tam={16} /><select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os perfis</option>{Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select></label>
        </div>
        {lista.length === 0 && !perfis.carregando ? <Vazio>Ninguém com esses filtros.</Vazio> : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Pessoa</th><th>Perfil</th><th>Situação</th><th>Desde</th><th>Vendedora vinculada</th><th></th></tr></thead>
              <tbody>
                {lista.map((p) => {
                  const vinc = cad.vendedoras.find((v) => v.perfil_id === p.id)
                  const sou = p.id === eu?.id
                  return (
                    <tr key={p.id} className={p.papel === 'inativo' ? 'linha-apagada' : ''}>
                      <td><div className="forte">{p.nome || '—'}{sou && <span className="muted pequeno"> (você)</span>}</div><div className="muted pequeno">{p.email}</div></td>
                      <td>{p.papel === 'admin' || p.papel === 'vendedora' ? <Badge tom={PAPEIS[p.papel].tom}>{PAPEIS[p.papel].rotulo}</Badge> : <span className="muted">—</span>}</td>
                      <td><Badge tom={p.papel === 'pendente' ? 'alerta' : p.papel === 'inativo' ? 'neutro' : 'ok'}>{PAPEIS[p.papel].situacao}</Badge></td>
                      <td className="pequeno">{dataBR(p.criado_em)}</td>
                      <td className="pequeno">{vinc ? vinc.nome : <span className="muted">—</span>}</td>
                      <td className="celula-acao">{sou ? <span className="muted pequeno" title="Outro administrador precisa alterar o seu acesso">—</span> : <button className="btn btn-contorno btn-mini" onClick={() => setEditar(p)}>{p.papel === 'pendente' ? 'Liberar' : 'Alterar acesso'}</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="bloco config-lado">
        <h2><Icone nome="info" className="ouro" /> Perfis de acesso</h2>
        {(['admin', 'vendedora', 'pendente', 'inativo'] as Papel[]).map((k) => (
          <div key={k} className="perfil-item"><Badge tom={PAPEIS[k].tom}>{PAPEIS[k].rotulo}</Badge><p className="muted pequeno">{PAPEIS[k].descricao}</p></div>
        ))}
        <p className="muted pequeno"><b>Login ≠ vendedora.</b> O login é quem entra no sistema; a vendedora é o nome que recebe matrícula e comissão. Ligue os dois para a vendedora ver as próprias vendas.</p>
        <Link to="/configuracoes/vendedoras" className="btn btn-contorno btn-bloco"><Icone nome="mais" tam={16} /> Cadastrar vendedora (antes de ela criar a conta)</Link>
      </aside>
    </div>
    {editar && <AlterarAcesso p={editar} vendedoras={cad.vendedoras} onFechar={() => { setEditar(null); perfis.recarregar(); cad.recarregar() }} onSalvo={() => { setEditar(null); perfis.recarregar(); cad.recarregar() }} />}
  </>)
}

const NOVA = '__nova'
const primeiroNome = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0]?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || ''

function AlterarAcesso({ p, vendedoras, onFechar, onSalvo }: { p: PerfilC; vendedoras: { id: string; nome: string; perfil_id: string | null; ativa: boolean; email?: string | null }[]; onFechar: () => void; onSalvo: () => void }) {
  const vincAtual = vendedoras.find((v) => v.perfil_id === p.id)?.id ?? ''
  // vendedora cadastrada antes com o mesmo e-mail da conta: já vem escolhida
  const pelaEmail = vendedoras.find((v) => !v.perfil_id && v.ativa && v.email && v.email.toLowerCase() === p.email?.toLowerCase())
    // senão, vendedora antiga (sem login) com o mesmo primeiro nome — para não perder o histórico de vendas dela
    ?? (() => { const pn = primeiroNome(p.nome); return pn ? vendedoras.find((v) => !v.perfil_id && v.ativa && primeiroNome(v.nome) === pn) : undefined })()
  const [papel, setPapel] = useState<Papel>(p.papel === 'pendente' ? 'vendedora' : p.papel)
  // sem cadastro de vendedora para ela: já sugere criar um com o nome e o e-mail da conta
  const [vend, setVend] = useState(vincAtual || pelaEmail?.id || (p.papel === 'pendente' || p.papel === 'vendedora' ? NOVA : ''))
  const [funcao, setFuncao] = useState('Vendedora')
  const [dados, setDados] = useState({ nome: p.nome ?? '', email: p.email ?? '' })
  const [editandoDados, setEditandoDados] = useState(false)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const salvarDados = async () => {
    setErro(null); setSalvandoDados(true)
    const { data, error } = await supabase.functions.invoke('equipe', { body: { acao: 'alterar_dados', perfil_id: p.id, nome: dados.nome, email: dados.email } })
    setSalvandoDados(false)
    const msg = (data as { erro?: string } | null)?.erro ?? (error ? 'Não consegui salvar. Tente de novo.' : null)
    if (msg) return setErro(msg)
    p.nome = dados.nome.trim(); p.email = dados.email.trim().toLowerCase(); setEditandoDados(false)
  }
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const opcoes: Papel[] = ['vendedora', 'admin', 'inativo', ...(p.papel === 'pendente' ? ['pendente' as Papel] : [])]
  const vendFinal = papel === 'inativo' ? vincAtual : vend
  const mudouPapel = papel !== p.papel, mudouVend = vendFinal !== vincAtual
  const nomeVend = (id: string) => id === NOVA ? `${p.nome || p.email} (novo cadastro, ${funcao})` : vendedoras.find((v) => v.id === id)?.nome ?? 'nenhuma'

  const salvar = async () => {
    setSalvando(true); setErro(null)
    if (mudouPapel) {
      const { error } = await supabase.from('perfis').update({ papel }).eq('id', p.id)
      if (error) { setSalvando(false); return setErro(msgErro(error)) }
    }
    if (mudouVend) {
      if (vincAtual) { const { error } = await supabase.from('vendedoras').update({ perfil_id: null }).eq('id', vincAtual); if (error) { setSalvando(false); return setErro(msgErro(error)) } }
      if (vendFinal === NOVA) {
        const { error } = await supabase.from('vendedoras').insert({ nome: (p.nome || p.email || '').trim(), email: p.email?.toLowerCase() ?? null, funcao, perfil_id: p.id })
        if (error) { setSalvando(false); return setErro(error.message.includes('vendedoras_email_unico') ? 'Já existe uma vendedora com esse e-mail. Escolha ela na lista.' : msgErro(error)) }
      } else if (vendFinal) { const { error } = await supabase.from('vendedoras').update({ perfil_id: p.id }).eq('id', vendFinal); if (error) { setSalvando(false); return setErro(msgErro(error)) } }
    }
    onSalvo()
  }

  return (
    <Modal titulo={confirmar ? 'Confirmar alteração' : `Acesso de ${p.nome || p.email}`} aberto onFechar={onFechar}>
      {!confirmar ? (<>
        {!editandoDados ? (
          <div className="nota pequeno"><b>{p.nome || '—'}</b> · {p.email} · conta criada em {dataBR(p.criado_em)} <button className="link" onClick={() => setEditandoDados(true)}>corrigir nome ou e-mail</button></div>
        ) : (
          <div className="bloco" style={{ padding: 12 }}>
            <div className="form-grade">
              <Campo rotulo="Nome completo"><input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} /></Campo>
              <Campo rotulo="E-mail de login" dica="Depois de salvar, ela entra com esse e-mail e a mesma senha."><input type="email" value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} /></Campo>
            </div>
            <div className="modal-acoes"><button className="btn" onClick={() => { setEditandoDados(false); setDados({ nome: p.nome ?? '', email: p.email ?? '' }) }}>Cancelar</button><button className="btn btn-ouro" disabled={salvandoDados} onClick={salvarDados}>{salvandoDados ? 'Salvando…' : 'Salvar dados'}</button></div>
          </div>
        )}
        <div className="opcoes-papel">
          {opcoes.map((k) => (
            <label key={k} className={`opcao-papel ${papel === k ? 'marcada' : ''}`}>
              <input type="radio" name="papel" checked={papel === k} onChange={() => setPapel(k)} />
              <div><b>{PAPEIS[k].rotulo}</b>{k === p.papel && <span className="muted pequeno"> · atual</span>}<div className="muted pequeno">{PAPEIS[k].descricao}</div></div>
            </label>
          ))}
        </div>
        {papel !== 'inativo' && papel !== 'pendente' && (
          <Campo rotulo="Vendedora vinculada" dica={papel === 'vendedora' ? 'Obrigatório para ela fazer matrícula e ver as próprias comissões.' : 'Opcional. Só se o administrador também vende.'}>
            {pelaEmail && vend === pelaEmail.id && !vincAtual && <p className="ok-txt pequeno" style={{ margin: '0 0 6px' }}>✓ {pelaEmail.email && pelaEmail.email.toLowerCase() === p.email?.toLowerCase() ? 'E-mail confere' : 'Mesmo nome'} da vendedora {pelaEmail.nome} — as vendas e comissões dela continuam.</p>}
            {vend === NOVA && <p className="muted pequeno" style={{ margin: '0 0 6px' }}>Se ela já vendia antes, escolha o nome dela na lista para manter o histórico de vendas e comissões.</p>}
            <select value={vend} onChange={(e) => setVend(e.target.value)}>
              <option value="">Nenhuma</option>
              {!vincAtual && <option value={NOVA}>+ Criar cadastro de vendedora: {p.nome || p.email}</option>}
              {vendedoras.filter((v) => v.ativa || v.id === vincAtual).map((v) => <option key={v.id} value={v.id} disabled={!!v.perfil_id && v.perfil_id !== p.id}>{v.nome}{v.perfil_id && v.perfil_id !== p.id ? ' (já tem login)' : ''}</option>)}
            </select>
          </Campo>
        )}
        {papel !== 'inativo' && papel !== 'pendente' && vend === NOVA && (
          <Campo rotulo="Função" dica="Só para identificar. A comissão segue as mesmas regras de todas."><select value={funcao} onChange={(e) => setFuncao(e.target.value)}><option>Vendedora</option><option>CS / suporte</option><option>Gestão</option></select></Campo>
        )}
        {papel === 'inativo' && <p className="nota pequeno">Desativar o login não apaga nada: matrículas, pagamentos e comissões continuam no nome da vendedora.</p>}
        {papel === 'vendedora' && !vend && <p className="nota pequeno">Sem vendedora vinculada, ela entra no sistema mas não consegue fazer matrícula.</p>}
        <Erro msg={erro} />
        <div className="modal-acoes">
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-ouro" disabled={!mudouPapel && !mudouVend} onClick={() => setConfirmar(true)}>Continuar</button>
        </div>
      </>) : (<>
        <p>Você vai alterar o acesso de <b>{p.nome || p.email}</b>:</p>
        <ul className="lista-confirma">
          {mudouPapel && <li>Perfil: <b>{PAPEIS[p.papel].rotulo}</b> → <b>{PAPEIS[papel].rotulo}</b></li>}
          {mudouVend && <li>Vendedora vinculada: <b>{nomeVend(vincAtual)}</b> → <b>{nomeVend(vendFinal)}</b></li>}
        </ul>
        {papel === 'admin' && <p className="nota pequeno">Administrador vê os valores de todos, confirma recebimentos e paga comissões. Confira se é isso mesmo.</p>}
        <p className="muted pequeno">A alteração fica registrada no Histórico com seu nome, data e hora.</p>
        <Erro msg={erro} />
        <div className="modal-acoes">
          <button className="btn" onClick={() => setConfirmar(false)}>Voltar</button>
          <button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Confirmar alteração'}</button>
        </div>
      </>)}
    </Modal>
  )
}

/* ───────────── Vendedoras ───────────── */

function AbaVendedoras() {
  const cad = useCadastros()
  const perfis = useConsulta<PerfilC[]>(() => supabase.from('perfis').select('*'))
  const mats = useConsulta<{ vendedora_id: string | null; status: string }[]>(() => supabase.from('matriculas').select('vendedora_id,status'))
  const [ed, setEd] = useState<{ id?: string; nome: string; email: string; funcao: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of mats.dados ?? []) if (x.vendedora_id && x.status !== 'cancelada') m.set(x.vendedora_id, (m.get(x.vendedora_id) ?? 0) + 1)
    return m
  }, [mats.dados])
  const exec = async (pr: PromiseLike<{ error: { message: string } | null }>) => { setErro(null); const { error } = await pr; if (error) setErro(msgErro(error)); cad.recarregar() }
  const salvar = async () => {
    if (!ed?.nome.trim()) return
    const email = ed.email.trim().toLowerCase()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro('E-mail inválido.')
    const reg = { nome: ed.nome.trim(), email: email || null, funcao: ed.funcao.trim() || null }
    setErro(null)
    const { error } = ed.id ? await supabase.from('vendedoras').update(reg).eq('id', ed.id) : await supabase.from('vendedoras').insert(reg)
    if (error) return setErro(error.message.includes('vendedoras_email_unico') ? 'Esse e-mail já está em outra vendedora.' : msgErro(error))
    cad.recarregar(); setEd(null)
  }
  const vs = [...cad.vendedoras].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome))

  return (<>
    <div className="bloco-topo">
      <p className="muted pequeno" style={{ margin: 0 }}>Quem vende e ganha comissão (vendedora, CS, suporte…). Cadastre aqui com o <b>e-mail</b> da pessoa: quando ela criar a conta no sistema com esse e-mail, a ligação já vem pronta e você só confirma em <Link to="/configuracoes/equipe" className="link">Equipe e acessos</Link>. Cadastrar aqui não dá acesso sozinho.</p>
      <button className="btn btn-ouro" onClick={() => setEd({ nome: '', email: '', funcao: '' })}><Icone nome="mais" /> Nova vendedora</button>
    </div>
    <Erro msg={erro} />
    <section className="bloco sem-padding">
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Vendedora</th><th>E-mail e login</th><th className="num">Matrículas</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {vs.map((v) => {
              const login = (perfis.dados ?? []).find((p) => p.id === v.perfil_id)
              return (
                <tr key={v.id} className={v.ativa ? '' : 'linha-apagada'}>
                  <td><div className="forte">{v.nome}</div>{v.funcao && <div className="muted pequeno">{v.funcao}</div>}</td>
                  <td className="pequeno">{login ? <>{login.email} <Badge tom={login.papel === 'inativo' ? 'neutro' : 'ok'}>{login.papel === 'inativo' ? 'login desativado' : 'com acesso'}</Badge></>
                    : (() => { const espera = v.email ? (perfis.dados ?? []).find((p) => p.email?.toLowerCase() === v.email!.toLowerCase()) : undefined
                      return v.email ? <>{v.email} {espera ? <Badge tom="alerta">criou a conta — liberar</Badge> : <span className="muted">· ainda não criou a conta</span>}</> : <span className="muted">sem e-mail</span> })()}</td>
                  <td className="num">{contagem.get(v.id) ?? 0}</td>
                  <td><Badge tom={v.ativa ? 'ok' : 'neutro'}>{v.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                  <td className="celula-acao acao-curta">
                    <button className="btn btn-contorno btn-mini" onClick={() => setEd({ id: v.id, nome: v.nome, email: v.email ?? '', funcao: v.funcao ?? '' })}>Editar</button>{' '}
                    <button className="btn btn-mini" onClick={() => exec(supabase.from('vendedoras').update({ ativa: !v.ativa }).eq('id', v.id))}>{v.ativa ? 'Desativar' : 'Reativar'}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
    <p className="muted pequeno">Desativar tira a vendedora das listas de novas matrículas. Vendas e comissões antigas continuam no nome dela.</p>
    {ed && (
      <Modal titulo={ed.id ? 'Editar vendedora' : 'Nova vendedora'} aberto onFechar={() => setEd(null)}>
        <Campo rotulo="Nome" dica="Como aparece nas matrículas e comissões."><input value={ed.nome} autoFocus onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
        <Campo rotulo="E-mail" dica="O mesmo que ela vai usar para criar a conta no sistema. É assim que o sistema reconhece quem é."><input type="email" value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} placeholder="nome@email.com" /></Campo>
        <Campo rotulo="Função (opcional)" dica="Ex.: Vendedora, CS / suporte. Só para identificar."><input value={ed.funcao} onChange={(e) => setEd({ ...ed, funcao: e.target.value })} /></Campo>
        <p className="muted pequeno">A comissão segue as mesmas regras (presencial por matrícula; online 10% lead dela / 5% campanha). Para o online, cadastre o nome que ela vai usar no link da Hotmart em Comissões → links das vendedoras.</p>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={() => setEd(null)}>Cancelar</button><button className="btn btn-ouro" disabled={!ed.nome.trim()} onClick={salvar}>Salvar</button></div>
      </Modal>
    )}
  </>)
}

/* ───────────── Cursos ───────────── */

type CursoC = { id: string; nome: string; descricao: string | null; ativo: boolean }

function AbaCursos() {
  const cursos = useConsulta<CursoC[]>(() => supabase.from('cursos').select('id,nome,descricao,ativo').order('nome'))
  const turmas = useConsulta<{ curso_id: string; status: string }[]>(() => supabase.from('turmas').select('curso_id,status'))
  const [ed, setEd] = useState<Partial<CursoC> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const conta = (id: string) => (turmas.dados ?? []).filter((t) => t.curso_id === id)
  const salvar = async () => {
    if (!ed?.nome?.trim()) return
    setErro(null)
    const reg = { nome: ed.nome.trim(), descricao: ed.descricao?.trim() || null, ativo: ed.ativo ?? true }
    const { error } = ed.id ? await supabase.from('cursos').update(reg).eq('id', ed.id) : await supabase.from('cursos').insert(reg)
    if (error) return setErro(msgErro(error))
    setEd(null); cursos.recarregar()
  }
  const lista = [...(cursos.dados ?? [])].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))

  return (<>
    <div className="bloco-topo">
      <p className="muted pequeno" style={{ margin: 0 }}>Os cursos organizam turmas, links de pagamento e regras de comissão.</p>
      <button className="btn btn-ouro" onClick={() => setEd({ nome: '', ativo: true })}><Icone nome="mais" /> Novo curso</button>
    </div>
    <Erro msg={cursos.erro} />
    <section className="bloco sem-padding">
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Curso</th><th className="num">Turmas</th><th className="num">Abertas</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {lista.map((c) => {
              const ts = conta(c.id)
              return (
                <tr key={c.id} className={c.ativo ? '' : 'linha-apagada'}>
                  <td><div className="forte">{c.nome}</div>{c.descricao && <div className="muted pequeno">{c.descricao}</div>}</td>
                  <td className="num">{ts.length}</td>
                  <td className="num">{ts.filter((t) => t.status === 'planejada' || t.status === 'confirmada').length}</td>
                  <td><Badge tom={c.ativo ? 'ok' : 'neutro'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                  <td className="celula-acao"><button className="btn btn-contorno btn-mini" onClick={() => setEd(c)}>Editar</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
    <p className="muted pequeno">Curso inativo some das listas de novas turmas e links. As turmas antigas continuam.</p>
    {ed && (
      <Modal titulo={ed.id ? 'Editar curso' : 'Novo curso'} aberto onFechar={() => setEd(null)}>
        <Campo rotulo="Nome do curso"><input value={ed.nome ?? ''} autoFocus onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
        <Campo rotulo="Descrição (opcional)"><input value={ed.descricao ?? ''} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></Campo>
        <label className="check"><input type="checkbox" checked={ed.ativo ?? true} onChange={(e) => setEd({ ...ed, ativo: e.target.checked })} /> Curso ativo</label>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={() => setEd(null)}>Cancelar</button><button className="btn btn-ouro" disabled={!ed.nome?.trim()} onClick={salvar}>Salvar</button></div>
      </Modal>
    )}
  </>)
}

/* ───────────── Contas de recebimento ───────────── */

function AbaContas() {
  const cad = useCadastros()
  const [ed, setEd] = useState<Partial<Conta> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async () => {
    if (!ed?.nome?.trim() || !ed.tipo) return
    setErro(null)
    const reg = { nome: ed.nome.trim(), tipo: ed.tipo, uso: ed.uso ?? 'novas', observacao: ed.observacao?.trim() || null, ativa: ed.ativa ?? true }
    const { data, error } = ed.id ? await supabase.from('contas').update(reg).eq('id', ed.id).select('id').single() : await supabase.from('contas').insert(reg).select('id').single()
    if (error) return setErro(msgErro(error))
    // só uma conta padrão por tipo: as outras do mesmo tipo passam a "Novas vendas"
    if (reg.uso === 'padrao') {
      const outras = cad.contas.filter((c) => c.tipo === reg.tipo && c.uso === 'padrao' && c.id !== data.id)
      for (const o of outras) await supabase.from('contas').update({ uso: 'novas' }).eq('id', o.id)
    }
    setEd(null); cad.recarregar()
  }
  const lista = [...cad.contas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || (a.uso === 'padrao' ? -1 : 0) - (b.uso === 'padrao' ? -1 : 0) || a.nome.localeCompare(b.nome))

  return (<>
    <div className="bloco-topo">
      <p className="muted pequeno" style={{ margin: 0 }}>Onde o dinheiro entra. O <b>uso</b> define o que aparece para a equipe em vendas novas.</p>
      <button className="btn btn-ouro" onClick={() => setEd({ nome: '', tipo: 'banco', uso: 'novas', ativa: true })}><Icone nome="mais" /> Nova conta</button>
    </div>
    <section className="bloco sem-padding">
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Conta</th><th>Tipo</th><th>Uso</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {lista.map((c) => {
              const u = USOS[c.uso ?? 'novas']
              return (
                <tr key={c.id} className={c.ativa ? '' : 'linha-apagada'}>
                  <td><div className="forte">{c.nome}</div>{c.observacao && <div className="muted pequeno">{c.observacao}</div>}</td>
                  <td className="pequeno">{TIPOS[c.tipo] ?? c.tipo}</td>
                  <td><Badge tom={u.tom}>{u.rotulo}</Badge></td>
                  <td><Badge tom={c.ativa ? 'ok' : 'neutro'}>{c.ativa ? 'Ativa' : 'Desativada'}</Badge></td>
                  <td className="celula-acao"><button className="btn btn-contorno btn-mini" onClick={() => setEd(c)}>Editar</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
    <div className="nota pequeno">
      <b>Como o uso funciona:</b> {Object.values(USOS).map((u) => <span key={u.rotulo}><br />• <b>{u.rotulo}</b>: {u.dica}</span>)}
      <br />Desativar a conta tira ela de tudo; os pagamentos já registrados nela continuam.
    </div>
    {ed && (
      <Modal titulo={ed.id ? 'Editar conta' : 'Nova conta de recebimento'} aberto onFechar={() => setEd(null)}>
        <Campo rotulo="Nome da conta" dica="Ex.: Sicoob Unique, Hotmart Unique HOF"><input value={ed.nome ?? ''} autoFocus onChange={(e) => setEd({ ...ed, nome: e.target.value })} /></Campo>
        <Campo rotulo="Tipo"><select value={ed.tipo} onChange={(e) => setEd({ ...ed, tipo: e.target.value })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <div className="campo"><span className="campo-rotulo">Uso</span>
          <div className="opcoes-papel">
            {Object.entries(USOS).map(([k, u]) => (
              <label key={k} className={`opcao-papel ${(ed.uso ?? 'novas') === k ? 'marcada' : ''}`}>
                <input type="radio" name="uso" checked={(ed.uso ?? 'novas') === k} onChange={() => setEd({ ...ed, uso: k as Conta['uso'] })} />
                <div><b>{u.rotulo}</b><div className="muted pequeno">{u.dica}</div></div>
              </label>
            ))}
          </div>
        </div>
        <Campo rotulo="Observação (opcional)"><input value={ed.observacao ?? ''} onChange={(e) => setEd({ ...ed, observacao: e.target.value })} /></Campo>
        <label className="check"><input type="checkbox" checked={ed.ativa ?? true} onChange={(e) => setEd({ ...ed, ativa: e.target.checked })} /> Conta ativa</label>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={() => setEd(null)}>Cancelar</button><button className="btn btn-ouro" disabled={!ed.nome?.trim()} onClick={salvar}>Salvar</button></div>
      </Modal>
    )}
  </>)
}

/* ───────────── Comissões ───────────── */

function AbaComissoes() {
  const cad = useCadastros()
  const regras = useConsulta<Regra[]>(() => supabase.from('comissao_regra_versoes').select('*').order('vigente_desde', { ascending: false }))
  return (<>
    <p className="muted pequeno">Mudança de regra vale a partir da data que você escolher. Comissões já pagas ou ajustadas à mão não mudam; as em aberto de vendas a partir dessa data são recalculadas. Ajuste de uma comissão específica é feito em <Link to="/comissoes" className="link">Comissões</Link>, com motivo.</p>
    <Erro msg={regras.erro} />
    <section className="bloco"><h2><Icone nome="turmas" className="ouro" /> Comissão do presencial (por matrícula)</h2><RegrasConteudo regras={regras.dados ?? []} cursos={cad.cursos} isAdmin onSalvo={() => regras.recarregar()} /></section>
    <RegrasOnline />
  </>)
}
