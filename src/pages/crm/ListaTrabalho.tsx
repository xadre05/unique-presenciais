// Trabalhar uma lista: a vendedora abre o WhatsApp com a mensagem pronta e marca o que aconteceu.
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCadastros, useConsulta } from '../../lib/dados'
import { brl, dataBR, hojeISO } from '../../lib/format'
import { Badge, Erro, Modal, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { useAuth } from '../../auth'
import { linkWhats, preencherMensagem, telefoneLegivel } from '../../crm/nucleo'
import { SEGMENTOS, STATUS_LISTA, somar, type Campanha, type ItemLista, type Mensagem } from './comum'
import { BarraLista } from './Listas'
import { EditorMensagens } from './CriarLista'

type Aba = 'a_contatar' | 'retornar' | 'andamento' | 'comprou' | 'fim' | 'todos'
const ABERTOS = ['enviada', 'conversando', 'interessado']
const POR_VEZ = 40

const naAba = (i: ItemLista, a: Aba, hoje: string) => {
  const g = STATUS_LISTA[i.status]?.grupo
  if (a === 'todos') return true
  if (a === 'comprou') return g === 'comprou' || !!i.comprou_depois
  if (a === 'retornar') return !!i.retornar_em && i.retornar_em <= hoje && ABERTOS.includes(i.status)
  return g === a
}

export default function ListaTrabalho() {
  const { id = '' } = useParams()
  const { isAdmin, perfil } = useAuth()
  const camp = useConsulta<Campanha[]>(() => supabase.rpc('resumo_campanhas'), [id])
  const q = useConsulta<ItemLista[]>(() => supabase.rpc('contatos_da_lista', { p_campanha: id }), [id])
  const c = (camp.dados ?? []).find((x) => x.id === id)
  const [itens, setItens] = useState<ItemLista[] | null>(null)
  const lista = useMemo(() => itens ?? q.dados ?? [], [itens, q.dados])
  const [aba, setAba] = useState<Aba>('a_contatar')
  const [vend, setVend] = useState('')
  const [busca, setBusca] = useState('')
  const [qtd, setQtd] = useState(POR_VEZ)
  const [erro, setErro] = useState<string | null>(null)
  const [editarMsgs, setEditarMsgs] = useState(false)
  const [passar, setPassar] = useState(false)
  const hoje = hojeISO()

  const base = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return lista.filter((i) => (!vend || i.vendedora_id === vend) && (!t || `${i.nome ?? ''} ${i.telefone ?? ''} ${i.email ?? ''}`.toLowerCase().includes(t)))
  }, [lista, vend, busca])
  const conta = (a: Aba) => base.filter((i) => naAba(i, a, hoje)).length
  const visiveis = base.filter((i) => naAba(i, aba, hoje))

  const marcar = async (item: ItemLista, p: Record<string, unknown>) => {
    setErro(null)
    const novo: ItemLista = { ...item }
    if (p.status) novo.status = String(p.status)
    if (p.enviou) { novo.tentativas += 1; novo.ultimo_contato_em = new Date().toISOString(); if (item.status === 'a_contatar' && !p.status) novo.status = 'enviada' }
    if ('nota' in p) novo.nota = (p.nota as string) || null
    if ('retornar_em' in p) novo.retornar_em = (p.retornar_em as string) || null
    const trocar = (por: ItemLista) => setItens((ant) => (ant ?? q.dados ?? []).map((x) => (x.id === item.id ? por : x)))
    trocar(novo)
    const { error } = await supabase.rpc('marcar_contato_lista', { p_id: item.id, p })
    if (error) { setErro(error.message); trocar(item) }
  }

  const alterarCampanha = async (campos: Record<string, unknown>) => {
    const { error } = await supabase.from('campanhas').update(campos).eq('id', id)
    if (error) setErro(error.message); else camp.recarregar()
  }

  if (!q.carregando && !camp.carregando && !c) return <div className="pagina"><Vazio>Lista não encontrada. <Link to="/listas" className="link">Voltar</Link></Vazio></div>
  const t = somar(c?.por_vendedora ?? [])
  const ABAS: [Aba, string][] = [['a_contatar', 'A contatar'], ['retornar', 'Retornar hoje'], ['andamento', 'Em andamento'], ['comprou', 'Compraram'], ['fim', 'Encerrados'], ['todos', 'Todos']]

  return (
    <div className="pagina">
      <div className="migalha"><Link to="/listas" className="link"><Icone nome="esquerda" tam={14} /> {isAdmin ? 'Listas' : 'Minhas listas'}</Link></div>
      <header className="pagina-topo">
        <div>
          <h1>{c?.nome ?? 'Lista'} {c?.status === 'encerrada' && <Badge tom="apagado">Encerrada</Badge>}</h1>
          {c?.objetivo && <p className="muted">{c.objetivo}</p>}
        </div>
        {isAdmin && c && <div className="acoes">
          <button className="btn btn-contorno" onClick={() => setEditarMsgs(true)}>Mensagens</button>
          <button className="btn btn-contorno" onClick={() => setPassar(true)}>Passar contatos</button>
          <button className="btn" onClick={() => alterarCampanha(c.status === 'ativa' ? { status: 'encerrada', encerrada_em: new Date().toISOString() } : { status: 'ativa', encerrada_em: null })}>{c.status === 'ativa' ? 'Encerrar lista' : 'Reabrir'}</button>
        </div>}
      </header>

      {c && <section className="bloco">
        <BarraLista t={t} />
        <div className="card-lista-nums">
          <span><b>{t.total - t.a_contatar}</b> de {t.total} contatados</span>
          <span><b>{t.conversando}</b> responderam</span>
          <span className="ok-txt"><b>{t.compraram}</b> compraram</span>
        </div>
        {isAdmin && c.por_vendedora.length > 1 && (
          <div className="tabela-wrap"><table className="tabela compacta">
            <thead><tr><th>Vendedora</th><th className="num">Contatos</th><th className="num">A contatar</th><th className="num">Mensagem enviada</th><th className="num">Responderam</th><th className="num">Compraram</th><th className="num">Encerrados</th></tr></thead>
            <tbody>{c.por_vendedora.map((v) => <tr key={v.vendedora_id ?? '-'} className="linha-clicavel" onClick={() => setVend(vend === v.vendedora_id ? '' : v.vendedora_id ?? '')}>
              <td className={vend === v.vendedora_id ? 'ouro-txt forte' : ''}>{v.vendedora_nome}</td><td className="num">{v.total}</td><td className="num">{v.a_contatar}</td><td className="num">{v.enviada}</td><td className="num">{v.conversando}</td><td className="num ok-txt">{Math.max(v.comprou, v.compraram)}</td><td className="num">{v.encerrados}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>}

      <nav className="abas">
        {ABAS.map(([k, r]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => { setAba(k); setQtd(POR_VEZ) }}>{r} <span className="muted">{conta(k)}</span></button>)}
      </nav>
      <div className="filtros-lista">
        <label className="select-icone"><Icone nome="busca" /><input placeholder="Buscar nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        {isAdmin && c && c.por_vendedora.length > 1 && <label className="select-icone"><Icone nome="usuario" tam={16} /><select value={vend} onChange={(e) => setVend(e.target.value)}>
          <option value="">Todas as vendedoras</option>{c.por_vendedora.map((v) => <option key={v.vendedora_id ?? '-'} value={v.vendedora_id ?? ''}>{v.vendedora_nome}</option>)}
        </select></label>}
      </div>
      {aba === 'a_contatar' && conta('a_contatar') > 0 && <p className="muted pequeno">Mande no seu ritmo, com calma: muitas mensagens iguais em sequência fazem o WhatsApp bloquear o número. Personalize quando der.</p>}

      <Erro msg={erro || q.erro || camp.erro} />
      {!q.carregando && visiveis.length === 0 ? <Vazio>{aba === 'a_contatar' ? 'Ninguém para contatar aqui. 👏' : 'Nenhum contato nesta aba.'}</Vazio> : (
        <div className="itens-lista">
          {visiveis.slice(0, qtd).map((i) => <ItemCard key={i.id} i={i} msgs={c?.mensagens ?? []} atendente={perfil?.nome ?? ''} isAdmin={isAdmin} hoje={hoje} marcar={marcar} />)}
          {visiveis.length > qtd && <button className="btn btn-bloco" onClick={() => setQtd(qtd + POR_VEZ)}>Mostrar mais ({visiveis.length - qtd})</button>}
        </div>
      )}

      {editarMsgs && c && <EditarMensagens msgs={c.mensagens} onFechar={() => setEditarMsgs(false)} onSalvar={async (m) => { await alterarCampanha({ mensagens: m }); setEditarMsgs(false) }} />}
      {passar && c && <PassarContatos campanha={c} onFechar={() => setPassar(false)} onFeito={() => { setPassar(false); setItens(null); q.recarregar(); camp.recarregar() }} />}
    </div>
  )
}

function ItemCard({ i, msgs, atendente, isAdmin, hoje, marcar }: { i: ItemLista; msgs: Mensagem[]; atendente: string; isAdmin: boolean; hoje: string; marcar: (i: ItemLista, p: Record<string, unknown>) => void }) {
  const [m, setM] = useState(Math.min(i.tentativas > 0 ? 1 : 0, Math.max(0, msgs.length - 1)))
  const [anotando, setAnotando] = useState(false)
  const [nota, setNota] = useState(i.nota ?? '')
  const seg = SEGMENTOS[i.segmento ?? 'frio']
  const st = STATUS_LISTA[i.status]
  const texto = msgs[m] ? preencherMensagem(msgs[m].texto, { nome: i.nome, atendente }) : ''
  const link = linkWhats(i.telefone, texto)
  const atrasado = i.retornar_em && i.retornar_em <= hoje && ABERTOS.includes(i.status)
  return (
    <div className={`item-lista${i.comprou_depois ? ' comprou' : ''}`}>
      <div className="il-topo">
        <div>
          <b>{i.nome || 'Sem nome'}</b> <Badge tom={seg?.tom}>{seg?.rotulo}</Badge>
          <div className="muted pequeno">{telefoneLegivel(i.telefone)}{i.cidade ? ` · ${i.cidade}${i.uf ? '/' + i.uf : ''}` : ''}{isAdmin && i.vendedora_nome ? ` · ${i.vendedora_nome}` : ''}</div>
        </div>
        <Badge tom={st?.tom}>{st?.rotulo}</Badge>
      </div>
      {i.comprou_depois && <div className="il-comprou"><Icone nome="check" tam={15} /> Comprou depois da lista: {i.comprou_depois}</div>}
      {(i.produtos ?? []).length > 0 && <div className="pequeno">Já comprou: <span className="muted">{(i.produtos ?? []).join(', ')}{i.ultima_compra ? ` · última em ${dataBR(i.ultima_compra)}` : ''}{isAdmin && Number(i.total_liquido) > 0 ? ` · ${brl(i.total_liquido)}` : ''}</span></div>}
      {i.aluno_presencial && <div className="pequeno muted">Aluno(a) presencial</div>}
      {i.nota && !anotando && <div className="il-nota">“{i.nota}”</div>}
      {(i.tentativas > 0 || i.retornar_em) && <div className="muted pequeno">{i.tentativas > 0 && `${i.tentativas} mensagem(ns) · última em ${dataBR(i.ultimo_contato_em)}`}{i.retornar_em && <span className={atrasado ? ' ouro-txt' : ''}> · retornar em {dataBR(i.retornar_em)}</span>}</div>}

      {anotando ? (
        <div className="il-anotar">
          <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que ela respondeu, o que combinaram…" autoFocus />
          <div className="acoes"><button className="btn btn-mini" onClick={() => setAnotando(false)}>Cancelar</button><button className="btn btn-ouro btn-mini" onClick={() => { marcar(i, { nota }); setAnotando(false) }}>Salvar nota</button></div>
        </div>
      ) : (
        <div className="il-acoes">
          {link && !i.nao_contatar && i.status !== 'nao_quer' && i.status !== 'numero_errado' && (
            <div className="il-whats">
              <a className={`btn ${i.status === 'a_contatar' ? 'btn-ouro' : 'btn-contorno'}`} href={link} target="_blank" rel="noreferrer" onClick={() => marcar(i, { enviou: true })}><Icone nome="whats" tam={16} /> WhatsApp</a>
              {msgs.length > 1 && <select value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="Qual mensagem">{msgs.map((x, k) => <option key={k} value={k}>{x.titulo}</option>)}</select>}
            </div>
          )}
          <select value={i.status} onChange={(e) => marcar(i, { status: e.target.value })} aria-label="O que aconteceu">
            {Object.entries(STATUS_LISTA).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
          </select>
          <label className="il-data" title="Retornar em">
            <Icone nome="agenda" tam={15} />
            <input type="date" value={i.retornar_em ?? ''} min={hoje} onChange={(e) => marcar(i, { retornar_em: e.target.value })} />
          </label>
          <button className="btn btn-mini" onClick={() => { setNota(i.nota ?? ''); setAnotando(true) }}>Anotar</button>
        </div>
      )}
    </div>
  )
}

function EditarMensagens({ msgs, onFechar, onSalvar }: { msgs: Mensagem[]; onFechar: () => void; onSalvar: (m: Mensagem[]) => void }) {
  const [m, setM] = useState<Mensagem[]>(msgs.length ? msgs : [{ titulo: 'Primeira mensagem', texto: '' }])
  return (
    <Modal titulo="Mensagens prontas da lista" aberto onFechar={onFechar} largo>
      <EditorMensagens msgs={m} setMsgs={setM} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={() => onSalvar(m.filter((x) => x.texto.trim()))}>Salvar</button></div>
    </Modal>
  )
}

function PassarContatos({ campanha, onFechar, onFeito }: { campanha: Campanha; onFechar: () => void; onFeito: () => void }) {
  const cad = useCadastros()
  const [de, setDe] = useState(campanha.por_vendedora.find((v) => v.a_contatar > 0)?.vendedora_id ?? '')
  const [para, setPara] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const origem = campanha.por_vendedora.find((v) => (v.vendedora_id ?? '') === de)
  const passar = async () => {
    const { error } = await supabase.rpc('redistribuir_lista', { p_campanha: campanha.id, p_de: de || null, p_para: para })
    if (error) return setErro(error.message)
    onFeito()
  }
  return (
    <Modal titulo="Passar contatos não contatados" aberto onFechar={onFechar}>
      <p className="muted pequeno">Só passa quem ainda está “A contatar”. O que a vendedora já conversou continua com ela.</p>
      <label className="campo"><span className="campo-rotulo">De</span>
        <select value={de} onChange={(e) => setDe(e.target.value)}>{campanha.por_vendedora.map((v) => <option key={v.vendedora_id ?? '-'} value={v.vendedora_id ?? ''}>{v.vendedora_nome} ({v.a_contatar} a contatar)</option>)}</select>
      </label>
      <div className="campo"><span className="campo-rotulo">Para</span>
        {cad.vendedoras.filter((v) => v.ativa && v.id !== de).map((v) => <label key={v.id} className="check"><input type="checkbox" checked={para.includes(v.id)} onChange={(e) => setPara(e.target.checked ? [...para, v.id] : para.filter((x) => x !== v.id))} /> {v.nome}</label>)}
      </div>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={!para.length || !origem?.a_contatar} onClick={passar}>Passar {origem?.a_contatar ?? 0} contatos</button></div>
    </Modal>
  )
}
