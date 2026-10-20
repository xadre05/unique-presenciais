// Automações (menu próprio da área de Agentes, vale para todos os agentes): comentário → direct (o "ManyChat nosso"). Lista das automações (ligar, editar,
// excluir), o registro do que foi enviado e o botão para conferir os comentários agora. O sistema confere sozinho a
// cada 2 minutos; com os avisos instantâneos da Meta, a mensagem sai na hora.
import { useState } from 'react'
import { Erro } from '../../../components/ui'
import { Icone } from '../../../components/Icone'
import { AvisosInstantaneos } from './AvisosInstantaneos'
import { FormAutomacao } from './FormAutomacao'
import { NOME_ALVO, NOME_DESTINO, excluirAutomacao, ligarAutomacao, useAutomacoes, useEnvios, usePecasAlvo, usePostsRecentes, useVendedoras, verificarAgora, type Automacao, type Envio, type PecaAlvo, type PostAlvo } from './dados'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function ondeVale(a: Automacao, posts: PostAlvo[], pecas: PecaAlvo[]) {
  if (a.alvo === 'todos') return NOME_ALVO.todos
  if (a.alvo === 'peca') { const p = pecas.find((x) => x.id === a.peca_id); return `Peça: ${p?.titulo ?? 'não encontrada'}${p && p.status !== 'postada' ? ' (vale quando for publicada)' : ''}` }
  const p = posts.find((x) => x.externo_id === a.media_id)
  return p ? `Post de ${new Date(p.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: ${(p.legenda ?? '').replace(/\s+/g, ' ').slice(0, 50)}` : 'Post publicado'
}

function CartaoAutomacao({ a, onde, envios, aoEditar, aoMudar }: { a: Automacao; onde: string; envios: Envio[]; aoEditar: () => void; aoMudar: () => void }) {
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const meus = envios.filter((e) => e.automacao_id === a.id)
  const agir = async (f: () => Promise<void>) => { setErro(null); try { await f(); aoMudar() } catch (e) { setErro((e as Error).message) } }
  return (
    <li className={`mk-painel au-cartao${a.ativa ? '' : ' desligada'}`}>
      <div className="au-cartao-topo"><b>{a.nome}</b><span className={`au-estado${a.ativa ? ' ligada' : ''}`}>{a.ativa ? 'Ligada' : 'Desligada'}</span></div>
      <small className="muted">{onde}</small>
      <div className="au-chips">{a.qualquer_comentario ? <span className="au-chip">qualquer comentário</span> : a.palavras.map((p) => <span key={p} className="au-chip">{p}</span>)}</div>
      <p className="au-msg">{a.mensagem}</p>
      <small className="au-link"><Icone nome={a.destino === 'whatsapp' ? 'whats' : a.destino === 'arquivo' ? 'pdf' : a.destino === 'link' ? 'links' : 'mensagem'} tam={13} /> {NOME_DESTINO[a.destino]}{a.destino === 'link' ? `: ${a.link || 'ainda sem link'}` : a.destino === 'arquivo' ? `: ${a.arquivo_nome ?? ''}` : a.destino === 'whatsapp' ? (a.whatsapp_modo === 'reveza' ? ' · reveza entre as vendedoras' : ' · número fixo') : ''}</small>
      <small className="muted">{meus.filter((e) => e.status === 'enviado').length} enviada(s) · {meus.filter((e) => e.cliques > 0).length} clicaram{meus.some((e) => e.status === 'erro') ? ` · ${meus.filter((e) => e.status === 'erro').length} com erro` : ''} · vale para comentários desde {quando(a.desde)}</small>
      <div className="au-cartao-acoes">
        <button type="button" className="btn btn-mini" onClick={() => agir(() => ligarAutomacao(a.id, !a.ativa))}>{a.ativa ? 'Desligar' : 'Ligar'}</button>
        <button type="button" className="btn btn-mini" onClick={aoEditar}><Icone nome="lapis" tam={13} /> Editar</button>
        {confirmar
          ? <><button type="button" className="btn btn-mini btn-perigo" onClick={() => agir(() => excluirAutomacao(a.id))}>Confirmar exclusão</button><button type="button" className="btn btn-mini" onClick={() => setConfirmar(false)}>Manter</button></>
          : <button type="button" className="btn btn-mini" onClick={() => setConfirmar(true)}><Icone nome="lixeira" tam={13} /> Excluir</button>}
      </div>
      <Erro msg={erro} />
    </li>
  )
}

function Registro({ envios, nomes, vendedoras }: { envios: Envio[]; nomes: Map<string, string>; vendedoras: Map<string, string> }) {
  if (!envios.length) return <p className="muted pequeno">Nenhum comentário respondido ainda. Para testar, comente a palavra-chave no post com a sua conta.</p>
  return (
    <div className="ig-lista"><table className="tabela ig-tabela au-registro">
      <thead><tr><th>Quando</th><th>Quem</th><th>Comentário</th><th>Automação</th><th>Situação</th><th>Clicou</th></tr></thead>
      <tbody>{envios.map((e) => (
        <tr key={e.id}><td>{quando(e.criado_em)}</td><td>{e.usuario ? `@${e.usuario}` : '—'}</td><td className="au-coment">{e.texto}</td><td>{e.automacao_id ? nomes.get(e.automacao_id) ?? '—' : 'excluída'}</td>
          <td>{e.status === 'enviado' ? <span className="ig-acima">Enviado{e.respondeu_em_publico ? ' + resposta pública' : ''}{e.via === 'aviso' ? ' · na hora' : ''}</span>
            : e.status === 'erro' ? <span className="ig-abaixo" title={e.erro ?? ''}>Erro: {e.erro}</span> : <span className="muted">Enviando…</span>}</td>
          <td>{e.clicou_em ? <span>{quando(e.clicou_em)}{e.cliques > 1 ? ` (${e.cliques}×)` : ''}{e.vendedora_id ? ` · ${vendedoras.get(e.vendedora_id) ?? 'vendedora'}` : ''}</span> : <span className="muted">—</span>}</td></tr>))}
      </tbody>
    </table></div>
  )
}

export function AbaAutomacoes({ empresa }: { empresa: string }) {
  const automacoes = useAutomacoes(empresa), envios = useEnvios(empresa), posts = usePostsRecentes(empresa), pecas = usePecasAlvo(empresa), equipe = useVendedoras()
  const [form, setForm] = useState<{ editar: Automacao | null } | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const lista = automacoes.dados ?? [], registro = envios.dados ?? []
  const nomes = new Map(lista.map((a) => [a.id, a.nome]))
  const recarregar = () => { automacoes.recarregar(); envios.recarregar() }
  const verificar = async () => {
    setVerificando(true); setErro(null); setAviso(null)
    try { const r = await verificarAgora(empresa); setAviso(`Conferi ${r.posts} post(s): ${r.enviados} mensagem(ns) nova(s) enviada(s).`); envios.recarregar() } catch (e) { setErro((e as Error).message) }
    setVerificando(false)
  }

  return (
    <section className="mk-plano au-aba">
      <div className="mk-painel au-como">
        <div><b>Como funciona</b>
          <span className="muted pequeno">O sistema confere os comentários dos posts escolhidos a cada 2 minutos e responde no direct (uma vez por comentário). Até a Meta aprovar o app, só quem tem papel no app recebe a mensagem: dá para testar com a sua conta.</span></div>
        <div className="au-como-acoes">
          <button type="button" className="btn btn-contorno" disabled={verificando || !lista.some((a) => a.ativa)} onClick={verificar}><Icone nome="atualizar" tam={15} /> {verificando ? 'Conferindo…' : 'Conferir agora'}</button>
          <button type="button" className="btn btn-ouro" onClick={() => setForm({ editar: null })}><Icone nome="mais" tam={16} /> Nova automação</button>
        </div>
      </div>
      {aviso && <p className="nota pequeno">{aviso}</p>}
      <Erro msg={erro ?? automacoes.erro} />
      {!automacoes.carregando && !lista.length && (
        <div className="mk-vazio-grande"><Icone nome="mensagem" tam={30} /><p>Nenhuma automação ainda.</p>
          <span className="muted pequeno">Crie uma para um post: escolha a palavra-chave (ex.: BLACK), a mensagem e o link.</span></div>
      )}
      <ul className="au-lista">{lista.map((a) => <CartaoAutomacao key={a.id} a={a} onde={ondeVale(a, posts.dados ?? [], pecas.dados ?? [])} envios={registro} aoEditar={() => setForm({ editar: a })} aoMudar={recarregar} />)}</ul>
      <section className="mk-painel pe-bloco">
        <div className="au-registro-topo"><h4 className="pe-titulo">Mensagens enviadas</h4><button type="button" className="btn btn-mini" onClick={() => envios.recarregar()}><Icone nome="atualizar" tam={13} /> Atualizar</button></div>
        <Registro envios={registro} nomes={nomes} vendedoras={new Map((equipe.dados ?? []).map((v) => [v.id, v.nome]))} />
      </section>
      <AvisosInstantaneos empresa={empresa} />
      {form && <FormAutomacao empresa={empresa} editar={form.editar} posts={posts.dados ?? []} pecas={pecas.dados ?? []} aoFechar={() => setForm(null)} aoSalvar={() => { setForm(null); recarregar() }} />}
    </section>
  )
}
