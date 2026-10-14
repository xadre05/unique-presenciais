import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { dataBR, dataHoraBR } from '../lib/format'
import type { Conta } from '../lib/types'
import type { Perfil } from '../auth'
import { useAuth } from '../auth'
import { Badge, Campo, Erro, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { RegrasConteudo, type Regra } from './Comissoes'

type PerfilC = Perfil & { criado_em: string }
type Papel = Perfil['papel']

const ABAS = [
  { id: 'equipe', nome: 'Equipe e acessos', icone: 'usuario' },
  { id: 'vendedoras', nome: 'Vendedoras', icone: 'alunos' },
  { id: 'cursos', nome: 'Cursos', icone: 'livro' },
  { id: 'contas', nome: 'Contas de recebimento', icone: 'moedas' },
  { id: 'comissoes', nome: 'Comissões', icone: 'comissoes' },
  { id: 'integracoes', nome: 'Integrações', icone: 'links' },
]

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

export default function Configuracoes() {
  const { aba = 'equipe' } = useParams()
  const navegar = useNavigate()
  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0]
  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Configurações</h1><p className="muted">Equipe, cadastros, comissões e integrações. Só administrador vê esta página, e toda alteração fica no Histórico.</p></div>
      </header>
      <nav className="abas">
        {ABAS.map((a) => <button key={a.id} className={a.id === atual.id ? 'ativa' : ''} onClick={() => navegar(`/configuracoes/${a.id}`)}><Icone nome={a.icone} tam={16} /> {a.nome}</button>)}
      </nav>
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
        <span><b>{pendentes.length} pessoa(s) aguardando liberação:</b> {pendentes.map((p) => p.nome || p.email).join(', ')}. Confira se é mesmo da equipe antes de liberar.</span>
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
      </aside>
    </div>
    {editar && <AlterarAcesso p={editar} vendedoras={cad.vendedoras} onFechar={() => setEditar(null)} onSalvo={() => { setEditar(null); perfis.recarregar(); cad.recarregar() }} />}
  </>)
}

function AlterarAcesso({ p, vendedoras, onFechar, onSalvo }: { p: PerfilC; vendedoras: { id: string; nome: string; perfil_id: string | null; ativa: boolean }[]; onFechar: () => void; onSalvo: () => void }) {
  const vincAtual = vendedoras.find((v) => v.perfil_id === p.id)?.id ?? ''
  const [papel, setPapel] = useState<Papel>(p.papel === 'pendente' ? 'vendedora' : p.papel)
  const [vend, setVend] = useState(vincAtual)
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const opcoes: Papel[] = ['vendedora', 'admin', 'inativo', ...(p.papel === 'pendente' ? ['pendente' as Papel] : [])]
  const vendFinal = papel === 'inativo' ? vincAtual : vend
  const mudouPapel = papel !== p.papel, mudouVend = vendFinal !== vincAtual
  const nomeVend = (id: string) => vendedoras.find((v) => v.id === id)?.nome ?? 'nenhuma'

  const salvar = async () => {
    setSalvando(true); setErro(null)
    if (mudouPapel) {
      const { error } = await supabase.from('perfis').update({ papel }).eq('id', p.id)
      if (error) { setSalvando(false); return setErro(msgErro(error)) }
    }
    if (mudouVend) {
      if (vincAtual) { const { error } = await supabase.from('vendedoras').update({ perfil_id: null }).eq('id', vincAtual); if (error) { setSalvando(false); return setErro(msgErro(error)) } }
      if (vendFinal) { const { error } = await supabase.from('vendedoras').update({ perfil_id: p.id }).eq('id', vendFinal); if (error) { setSalvando(false); return setErro(msgErro(error)) } }
    }
    onSalvo()
  }

  return (
    <Modal titulo={confirmar ? 'Confirmar alteração' : `Acesso de ${p.nome || p.email}`} aberto onFechar={onFechar}>
      {!confirmar ? (<>
        <p className="muted pequeno">{p.email} · conta criada em {dataBR(p.criado_em)}</p>
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
            <select value={vend} onChange={(e) => setVend(e.target.value)}>
              <option value="">Nenhuma</option>
              {vendedoras.filter((v) => v.ativa || v.id === vincAtual).map((v) => <option key={v.id} value={v.id} disabled={!!v.perfil_id && v.perfil_id !== p.id}>{v.nome}{v.perfil_id && v.perfil_id !== p.id ? ' (já tem login)' : ''}</option>)}
            </select>
          </Campo>
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
  const [ed, setEd] = useState<{ id?: string; nome: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const contagem = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of mats.dados ?? []) if (x.vendedora_id && x.status !== 'cancelada') m.set(x.vendedora_id, (m.get(x.vendedora_id) ?? 0) + 1)
    return m
  }, [mats.dados])
  const exec = async (pr: PromiseLike<{ error: { message: string } | null }>) => { setErro(null); const { error } = await pr; if (error) setErro(msgErro(error)); cad.recarregar() }
  const salvar = async () => {
    if (!ed?.nome.trim()) return
    await exec(ed.id ? supabase.from('vendedoras').update({ nome: ed.nome.trim() }).eq('id', ed.id) : supabase.from('vendedoras').insert({ nome: ed.nome.trim() }))
    setEd(null)
  }
  const vs = [...cad.vendedoras].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome))

  return (<>
    <div className="bloco-topo">
      <p className="muted pequeno" style={{ margin: 0 }}>Vendedora é o nome que fica na matrícula e recebe comissão. <b>Cadastrar vendedora não dá acesso ao sistema</b>: o acesso é liberado em <Link to="/configuracoes/equipe" className="link">Equipe e acessos</Link>.</p>
      <button className="btn btn-ouro" onClick={() => setEd({ nome: '' })}><Icone nome="mais" /> Nova vendedora</button>
    </div>
    <Erro msg={erro} />
    <section className="bloco sem-padding">
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Vendedora</th><th>Login vinculado</th><th className="num">Matrículas</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {vs.map((v) => {
              const login = (perfis.dados ?? []).find((p) => p.id === v.perfil_id)
              return (
                <tr key={v.id} className={v.ativa ? '' : 'linha-apagada'}>
                  <td className="forte">{v.nome}</td>
                  <td className="pequeno">{login ? <>{login.email} {login.papel === 'inativo' && <Badge>login desativado</Badge>}</> : <span className="muted">sem login</span>}</td>
                  <td className="num">{contagem.get(v.id) ?? 0}</td>
                  <td><Badge tom={v.ativa ? 'ok' : 'neutro'}>{v.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                  <td className="celula-acao acao-curta">
                    <button className="btn btn-contorno btn-mini" onClick={() => setEd({ id: v.id, nome: v.nome })}>Renomear</button>{' '}
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
      <Modal titulo={ed.id ? 'Renomear vendedora' : 'Nova vendedora'} aberto onFechar={() => setEd(null)}>
        <Campo rotulo="Nome" dica="Como aparece nas matrículas e comissões."><input value={ed.nome} autoFocus onChange={(e) => setEd({ ...ed, nome: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && salvar()} /></Campo>
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
    <section className="bloco"><RegrasConteudo regras={regras.dados ?? []} cursos={cad.cursos} isAdmin onSalvo={() => regras.recarregar()} /></section>
  </>)
}

/* ───────────── Integrações ───────────── */

type ProdutoHotmart = { id: number; nome: string; status: string | null; formato: string | null; curso_id: string | null; mostrar: boolean; sincronizado_em: string }

function AbaIntegracoes() {
  const cad = useCadastros()
  const produtos = useConsulta<ProdutoHotmart[]>(() => supabase.from('hotmart_produtos').select('*').order('nome'))
  const [sinc, setSinc] = useState<{ rodando: boolean; msg: string | null; erro: string | null }>({ rodando: false, msg: null, erro: null })
  const [todos, setTodos] = useState(false)
  const ps = (produtos.dados ?? []).filter((p) => p.status !== 'DELETED')
  const ligados = ps.filter((p) => p.curso_id || p.mostrar)
  const ultima = ps.map((p) => p.sincronizado_em).sort().at(-1)
  const visiveis = todos ? ps : ps.filter((p) => p.curso_id || p.mostrar || p.status === 'ACTIVE')

  const sincronizar = async () => {
    setSinc({ rodando: true, msg: null, erro: null })
    const { data, error } = await supabase.functions.invoke('hotmart-ofertas', { method: 'POST' })
    let erro: string | null = null
    if (error) { try { erro = (await (error as { context?: Response }).context?.json())?.erro ?? error.message } catch { erro = error.message } }
    setSinc({ rodando: false, erro, msg: erro ? null : `${data.produtos} produtos lidos · ${data.novos} links novos · ${data.atualizados} atualizados · ${data.desativados} desativados.` })
    produtos.recarregar()
  }
  const atualizar = async (id: number, campos: Partial<ProdutoHotmart>) => { await supabase.from('hotmart_produtos').update(campos).eq('id', id); produtos.recarregar() }

  return (<>
    <section className="bloco">
      <div className="bloco-topo">
        <div>
          <h2><Icone nome="links" className="ouro" /> Hotmart — Unique HOF Academy</h2>
          <p className="muted pequeno" style={{ margin: 0 }}>Traz as ofertas (links de pagamento) dos produtos ligados a um curso. Só leitura: o sistema não altera nada na Hotmart.</p>
        </div>
        <div className="config-status">
          {ps.length > 0 ? <Badge tom="ok">Conectada</Badge> : <Badge tom="alerta">Aguardando credenciais</Badge>}
          <button className="btn btn-contorno" disabled={sinc.rodando} onClick={sincronizar}><Icone nome="historico" /> {sinc.rodando ? 'Buscando…' : 'Atualizar da Hotmart'}</button>
        </div>
      </div>
      {ps.length > 0 && <p className="muted pequeno">{ps.length} produtos na Hotmart · {ligados.length} trazendo ofertas{ultima && ` · última atualização ${dataHoraBR(ultima)}`}</p>}
      {sinc.msg && <div className="nota pequeno"><Icone nome="check" tam={14} className="ok" /> {sinc.msg} <Link to="/links" className="link">Ver links</Link></div>}
      <Erro msg={sinc.erro} />

      {ps.length === 0 ? (
        <div className="nota pequeno">
          <b>Para ligar a Hotmart (uma vez só):</b>
          <ol>
            <li>Na Hotmart da <b>Unique HOF Academy</b>: Ferramentas → <b>Credenciais Hotmart</b> → Criar credencial (produção). Ela mostra Client ID, Client Secret e Basic.</li>
            <li>No Supabase, projeto unique-presenciais: <b>Edge Functions → Secrets</b>. Crie <code>HOTMART_CLIENT_ID</code>, <code>HOTMART_CLIENT_SECRET</code> e <code>HOTMART_BASIC</code>, colando cada valor.</li>
            <li>Volte aqui e clique em <b>Atualizar da Hotmart</b>. Os produtos aparecem abaixo para você ligar aos cursos.</li>
          </ol>
          <span>As credenciais ficam só no servidor: ninguém vê pelo sistema, e não precisam ser enviadas por chat.</span>
        </div>
      ) : (<>
        <div className="bloco-topo" style={{ marginTop: 10 }}>
          <h3 style={{ margin: 0 }}>Produtos e cursos</h3>
          <label className="check pequeno"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Mostrar também os inativos</label>
        </div>
        <div className="tabela-wrap">
          <table className="tabela compacta">
            <thead><tr><th>Produto na Hotmart</th><th>Situação</th><th>Curso no sistema</th><th>Trazer ofertas</th></tr></thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id}>
                  <td className="forte">{p.nome}<div className="muted pequeno">#{p.id}</div></td>
                  <td>{p.status === 'ACTIVE' ? <Badge tom="ok">Ativo</Badge> : <Badge>{p.status ?? '—'}</Badge>}</td>
                  <td><select value={p.curso_id ?? ''} onChange={(e) => atualizar(p.id, { curso_id: e.target.value || null })}>
                    <option value="">—</option>{cad.cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select></td>
                  <td><input type="checkbox" checked={p.mostrar || !!p.curso_id} disabled={!!p.curso_id} title={p.curso_id ? 'Produto ligado a curso sempre traz as ofertas' : ''} onChange={(e) => atualizar(p.id, { mostrar: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted pequeno">Ofertas novas (inclusive as criadas para um aluno específico) entram sozinhas em Links de pagamento. Ofertas apagadas na Hotmart ficam desativadas aqui.</p>
      </>)}
    </section>

    <section className="bloco">
      <h2><Icone nome="relogio" className="ouro" /> Próximas integrações</h2>
      <ul className="lista-confirma pequeno">
        <li><b>Hotmart — vendas e parcelas:</b> confirmar sozinho os pagamentos feitos pela Hotmart e as vendas do online por SCK. <Badge tom="alerta">a fazer</Badge></li>
        <li><b>Sicoob — extrato:</b> importar o extrato para conferir os Pix informados pela equipe. <Badge tom="alerta">a fazer</Badge></li>
      </ul>
    </section>
  </>)
}
