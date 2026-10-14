import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { dataBR } from '../lib/format'
import type { Perfil } from '../auth'
import { useAuth } from '../auth'
import { Badge, Erro } from '../components/ui'

export default function Equipe() {
  const { perfil: eu } = useAuth()
  const perfis = useConsulta<(Perfil & { criado_em: string })[]>(() => supabase.from('perfis').select('*').order('criado_em'))
  const cad = useCadastros()
  const [erro, setErro] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState({ vendedora: '', curso: '', conta: '', contaTipo: 'banco' })

  const exec = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    setErro(null)
    const { error } = await p
    if (error) setErro(msgErro(error))
    perfis.recarregar(); cad.recarregar()
  }

  return (
    <div className="pagina">
      <header className="pagina-topo"><div><h1>Equipe e cadastros</h1><p className="muted">Quem pode entrar no sistema e as listas usadas nos formulários.</p></div></header>
      <Erro msg={erro} />
      <section className="bloco">
        <h2>Acessos</h2>
        <p className="muted pequeno">Quem cria conta entra como "aguardando". Libere como vendedora ou administrador. Vendedora informa pagamentos; só administrador confirma recebimento, mexe em comissão e vê o histórico.</p>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th>Acesso</th><th>É a vendedora…</th></tr></thead>
            <tbody>
              {(perfis.dados ?? []).map((p) => {
                const vinc = cad.vendedoras.find((v) => v.perfil_id === p.id)
                return (
                  <tr key={p.id}>
                    <td>{p.nome || '—'}</td><td>{p.email}</td><td>{dataBR(p.criado_em)}</td>
                    <td>
                      <select value={p.papel} disabled={p.id === eu?.id} onChange={(e) => exec(supabase.from('perfis').update({ papel: e.target.value }).eq('id', p.id))}>
                        <option value="pendente">Aguardando liberação</option><option value="vendedora">Vendedora</option><option value="admin">Administrador</option><option value="inativo">Desativado</option>
                      </select>
                      {p.papel === 'pendente' && <> <Badge tom="alerta">novo</Badge></>}
                    </td>
                    <td>
                      <select value={vinc?.id ?? ''} onChange={async (e) => {
                        if (vinc) await supabase.from('vendedoras').update({ perfil_id: null }).eq('id', vinc.id)
                        if (e.target.value) await exec(supabase.from('vendedoras').update({ perfil_id: p.id }).eq('id', e.target.value))
                        else { perfis.recarregar(); cad.recarregar() }
                      }}>
                        <option value="">—</option>
                        {cad.vendedoras.map((v) => <option key={v.id} value={v.id} disabled={!!v.perfil_id && v.perfil_id !== p.id}>{v.nome}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grade-3">
        <section className="bloco">
          <h2>Vendedoras</h2>
          <ul className="lista">{cad.vendedoras.map((v) => <li key={v.id}><span>{v.nome}</span><button className="link pequeno" onClick={() => exec(supabase.from('vendedoras').update({ ativa: !v.ativa }).eq('id', v.id))}>{v.ativa ? 'desativar' : 'reativar'}</button></li>)}</ul>
          <div className="linha-add"><input placeholder="Nome" value={novoNome.vendedora} onChange={(e) => setNovoNome({ ...novoNome, vendedora: e.target.value })} />
            <button className="btn btn-mini" onClick={() => { if (novoNome.vendedora.trim()) { exec(supabase.from('vendedoras').insert({ nome: novoNome.vendedora.trim() })); setNovoNome({ ...novoNome, vendedora: '' }) } }}>Adicionar</button></div>
        </section>
        <section className="bloco">
          <h2>Cursos</h2>
          <ul className="lista">{cad.cursos.map((c) => <li key={c.id}>{c.nome}</li>)}</ul>
          <div className="linha-add"><input placeholder="Nome do curso" value={novoNome.curso} onChange={(e) => setNovoNome({ ...novoNome, curso: e.target.value })} />
            <button className="btn btn-mini" onClick={() => { if (novoNome.curso.trim()) { exec(supabase.from('cursos').insert({ nome: novoNome.curso.trim() })); setNovoNome({ ...novoNome, curso: '' }) } }}>Adicionar</button></div>
        </section>
        <section className="bloco">
          <h2>Contas de recebimento</h2>
          <ul className="lista">{cad.contas.map((c) => <li key={c.id}><span>{c.nome}{!c.ativa && <span className="muted"> (desativada)</span>}<div className="muted pequeno">{c.observacao}</div></span><button className="link pequeno" onClick={() => exec(supabase.from('contas').update({ ativa: !c.ativa }).eq('id', c.id))}>{c.ativa ? 'desativar' : 'reativar'}</button></li>)}</ul>
          <div className="linha-add"><input placeholder="Nome da conta" value={novoNome.conta} onChange={(e) => setNovoNome({ ...novoNome, conta: e.target.value })} />
            <select value={novoNome.contaTipo} onChange={(e) => setNovoNome({ ...novoNome, contaTipo: e.target.value })}><option value="banco">Banco</option><option value="hotmart">Hotmart</option><option value="especie">Espécie</option><option value="outro">Outro</option></select>
            <button className="btn btn-mini" onClick={() => { if (novoNome.conta.trim()) { exec(supabase.from('contas').insert({ nome: novoNome.conta.trim(), tipo: novoNome.contaTipo })); setNovoNome({ ...novoNome, conta: '' }) } }}>Adicionar</button></div>
        </section>
      </div>
    </div>
  )
}
