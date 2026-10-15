// Base de contatos da Unique (admin): todos os leads, alunos e compradores, cruzados com a Hotmart.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, dataHoraBR } from '../../lib/format'
import { Badge, Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { linkWhats, telefoneLegivel } from '../../crm/nucleo'
import { descreverFiltro, limparFiltro, SEGMENTOS, STATUS_LISTA, type ContatoLinha, type Filtro } from './comum'
import ImportarContatos from './ImportarContatos'
import CriarLista from './CriarLista'
import { NovoDisparo } from '../../crm/Disparos'
import { useBaseCRM } from '../../crm/tipos'
import { EMPRESA_UNIQUE } from './comum'
import { useNavigate } from 'react-router-dom'

const POR_PAGINA = 50
type Contagem = Record<string, { total: number; com_whats: number; livres: number }>
const ANOS = Array.from({ length: new Date().getFullYear() - 2020 }, (_, i) => String(2021 + i)).reverse()

export default function Contatos() {
  const [f, setF] = useState<Filtro>({ so_whats: true })
  const [buscaTxt, setBuscaTxt] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aberto, setAberto] = useState<string | null>(null)
  const [importar, setImportar] = useState(false)
  const [criar, setCriar] = useState(false)
  const [versao, setVersao] = useState(0)
  const [disparo, setDisparo] = useState<string[] | null>(null)
  const [erroDisparo, setErroDisparo] = useState<string | null>(null)
  const base = useBaseCRM(EMPRESA_UNIQUE)
  const nav = useNavigate()

  // busca só dispara depois que a pessoa para de digitar
  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, busca: buscaTxt.trim() })); setPagina(1) }, 350); return () => clearTimeout(t) }, [buscaTxt])

  const filtro = useMemo(() => limparFiltro(f), [f])
  const chave = JSON.stringify(filtro)
  const res = useConsulta<{ total: number; linhas: ContatoLinha[] }>(() => supabase.rpc('buscar_contatos', { p: filtro, p_limite: POR_PAGINA, p_offset: (pagina - 1) * POR_PAGINA }), [chave, pagina, versao])
  const cont = useConsulta<Contagem>(() => supabase.rpc('contar_contatos', { p: filtro }), [chave, versao])
  const produtos = useConsulta<{ nome: string }[]>(() => supabase.from('hotmart_produtos').select('nome').order('nome'))
  const nomesProdutos = useMemo(() => [...new Set((produtos.dados ?? []).map((p) => p.nome))], [produtos.dados])

  const mudar = (k: keyof Filtro, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setPagina(1) }
  const c = cont.dados ?? {}
  const soma = (k: 'total' | 'com_whats' | 'livres') => Object.values(c).reduce((s, x) => s + x[k], 0)
  const total = res.dados?.total ?? 0
  const totalPag = Math.max(1, Math.ceil(total / POR_PAGINA))
  const disponiveis = f.segmento === 'comprador_ou_quase'
    ? (['comprador', 'quase'] as const).reduce((s, k) => s + (c[k]?.[f.fora_de_lista ? 'livres' : 'com_whats'] ?? 0), 0)
    : f.segmento ? (c[f.segmento]?.[f.fora_de_lista ? 'livres' : 'com_whats'] ?? 0) : soma(f.fora_de_lista ? 'livres' : 'com_whats')

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Contatos</h1><p className="muted">Toda a base: leads do SellFlux, compradores da Hotmart e alunos presenciais, juntos por WhatsApp e e-mail.</p></div>
        <div className="acoes">
          <button className="btn btn-contorno" onClick={() => setImportar(true)}><Icone nome="importar" /> Importar contatos</button>
          <button className="btn btn-contorno" onClick={() => setCriar(true)} disabled={!disponiveis} title="Cada vendedora chama do próprio celular"><Icone nome="lista" /> Dividir para as vendedoras</button>
          <button className="btn btn-ouro btn-grande" disabled={!disponiveis} onClick={async () => {
            setErroDisparo(null)
            const { data, error } = await supabase.rpc('ids_contatos_filtrados', { p: filtro })
            if (error) setErroDisparo(error.message); else setDisparo(data as string[])
          }}><Icone nome="whats" /> Disparar pelo WhatsApp da empresa</button>
        </div>
      </header>

      <section className="segmentos-crm">
        {Object.entries(SEGMENTOS).map(([k, s]) => (
          <button key={k} className={`seg-card${f.segmento === k ? ' ativo' : ''}`} onClick={() => mudar('segmento', f.segmento === k ? '' : k)} title={s.explica}>
            <span className="seg-rotulo"><Badge tom={s.tom}>{s.rotulo}</Badge></span>
            <span className="seg-num">{cont.carregando && !cont.dados ? '…' : (c[k]?.total ?? 0).toLocaleString('pt-BR')}</span>
            <span className="muted pequeno">{(c[k]?.com_whats ?? 0).toLocaleString('pt-BR')} com WhatsApp · {(c[k]?.livres ?? 0).toLocaleString('pt-BR')} fora de lista</span>
          </button>
        ))}
      </section>

      <div className="filtros-contatos">
        <label className="select-icone busca-larga"><Icone nome="busca" /><input placeholder="Nome, WhatsApp ou e-mail" value={buscaTxt} onChange={(e) => setBuscaTxt(e.target.value)} /></label>
        <label className="select-icone"><Icone nome="alunos" tam={16} /><select value={f.segmento ?? ''} onChange={(e) => mudar('segmento', e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="comprador_ou_quase">Compradores + quase compraram</option>
          {Object.entries(SEGMENTOS).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="sacola" tam={16} /><select value={f.produto ?? ''} onChange={(e) => mudar('produto', e.target.value)}>
          <option value="">Comprou qualquer produto</option>{nomesProdutos.map((p) => <option key={p} value={p}>Comprou {p}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="fechar" tam={16} /><select value={f.sem_produto ?? ''} onChange={(e) => mudar('sem_produto', e.target.value)}>
          <option value="">Sem excluir por produto</option>{nomesProdutos.map((p) => <option key={p} value={p}>Não comprou {p}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="agenda" tam={16} /><select value={f.ano_compra ?? ''} onChange={(e) => mudar('ano_compra', e.target.value)}>
          <option value="">Comprou em qualquer ano</option>{ANOS.map((a) => <option key={a} value={a}>Comprou em {a}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="relogio" tam={16} /><select value={f.ano_entrada ?? ''} onChange={(e) => mudar('ano_entrada', e.target.value)}>
          <option value="">Entrou em qualquer ano</option>{ANOS.map((a) => <option key={a} value={a}>Entrou em {a}</option>)}
        </select></label>
      </div>
      <div className="filtros-check">
        <label className="check"><input type="checkbox" checked={!!f.so_whats} onChange={(e) => mudar('so_whats', e.target.checked)} /> Só quem tem WhatsApp válido e aceita mensagem</label>
        <label className="check"><input type="checkbox" checked={!!f.fora_de_lista} onChange={(e) => mudar('fora_de_lista', e.target.checked)} /> Só quem não está em outra lista ativa</label>
        {Object.keys(filtro).length > 1 && <button className="link pequeno" onClick={() => { setF({ so_whats: true }); setBuscaTxt(''); setPagina(1) }}>limpar filtros</button>}
      </div>

      <Erro msg={res.erro || cont.erro || erroDisparo} />
      {res.carregando && !res.dados ? <Vazio>Carregando contatos…</Vazio> : total === 0 ? <Vazio>Nenhum contato com esses filtros.{soma('total') === 0 && ' A base ainda está vazia: use “Importar contatos”.'}</Vazio> : (
        <div className="tabela-wrap bloco sem-padding">
          <table className="tabela tabela-pag">
            <thead><tr><th>Contato</th><th>WhatsApp</th><th>Tipo</th><th>O que comprou</th><th className="num">Total pago</th><th>Última compra</th><th>Lista</th><th></th></tr></thead>
            <tbody>
              {(res.dados?.linhas ?? []).map((x) => (
                <tr key={x.id} className="linha-clicavel" onClick={() => setAberto(x.id)}>
                  <td><span className="forte">{x.nome || 'Sem nome'}</span><div className="muted pequeno">{x.emails[0] ?? ''}{x.cidade ? ` · ${x.cidade}${x.uf ? '/' + x.uf : ''}` : ''}</div></td>
                  <td className="pequeno">{x.nao_contatar ? <Badge tom="erro">Não quer receber</Badge> : x.telefone_invalido ? <Badge tom="erro">Número errado</Badge> : telefoneLegivel(x.telefone)}</td>
                  <td><Badge tom={SEGMENTOS[x.segmento ?? 'frio']?.tom}>{SEGMENTOS[x.segmento ?? 'frio']?.rotulo}</Badge>{x.aluno_presencial && <div className="muted pequeno">aluno presencial</div>}</td>
                  <td className="pequeno">{(x.produtos ?? []).slice(0, 2).join(', ') || '—'}{(x.produtos ?? []).length > 2 && <span className="muted"> +{(x.produtos ?? []).length - 2}</span>}</td>
                  <td className="num">{Number(x.total_liquido) > 0 ? brl(x.total_liquido) : '—'}</td>
                  <td className="pequeno">{x.ultima_compra ? dataBR(x.ultima_compra) : '—'}</td>
                  <td className="pequeno">{x.lista_ativa ?? '—'}</td>
                  <td className="celula-acao" onClick={(e) => e.stopPropagation()}>
                    {x.telefone && !x.nao_contatar && <a className="btn btn-contorno btn-mini btn-quadrado" href={linkWhats(x.telefone)!} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><Icone nome="whats" tam={16} /></a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="paginacao" style={{ padding: '0 16px 14px' }}>
            <span className="muted pequeno">{total.toLocaleString('pt-BR')} contato(s) · {descreverFiltro(filtro)}</span>
            {totalPag > 1 && <div className="acoes">
              <button className="btn btn-mini" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}><Icone nome="esquerda" tam={14} /> Anterior</button>
              <span className="muted pequeno">{pagina} de {totalPag}</span>
              <button className="btn btn-mini" disabled={pagina === totalPag} onClick={() => setPagina(pagina + 1)}>Próximo <Icone nome="seta" tam={14} /></button>
            </div>}
          </div>
        </div>
      )}

      {aberto && <FichaContato id={aberto} onFechar={() => setAberto(null)} onMudou={() => setVersao((v) => v + 1)} />}
      {importar && <ImportarContatos onFechar={() => setImportar(false)} onFeito={() => setVersao((v) => v + 1)} />}
      {disparo && <NovoDisparo empresaId={EMPRESA_UNIQUE} base={base} contatoIds={disparo} origem={descreverFiltro(filtro)} onFechar={() => setDisparo(null)} onFeito={() => nav('/atendimento/disparos')} />}
      {criar && <CriarLista filtro={filtro} disponiveis={disponiveis} onFechar={() => setCriar(false)} />}
    </div>
  )
}

type Ficha = {
  contato: ContatoLinha & { observacoes: string | null; instagram: string | null; nao_contatar_motivo: string | null; criado_em: string }
  resumo: { segmento: string; produtos: string[]; total_liquido: number; primeira_compra: string | null; ultima_compra: string | null; reembolsou: boolean; aluno_presencial: boolean } | null
  compras: { data_aprovacao: string | null; produto_nome: string | null; valor_liquido: number | null; status: string; recorrencia: number | null; parcelas_cartao: number | null }[]
  listas: { campanha: string; status: string; vendedora: string | null; nota: string | null; atualizado_em: string }[]
  eventos: { tipo: string; texto: string | null; dados: { status?: string } | null; criado_em: string; autor: string | null }[]
}
const STATUS_HOTMART: Record<string, string> = { APPROVED: 'Aprovado', COMPLETE: 'Completo', REFUNDED: 'Reembolsado', CHARGEBACK: 'Chargeback', CANCELLED: 'Cancelado' }

function FichaContato({ id, onFechar, onMudou }: { id: string; onFechar: () => void; onMudou: () => void }) {
  const q = useConsulta<Ficha>(() => supabase.rpc('detalhe_contato', { p_id: id }), [id])
  const [erro, setErro] = useState<string | null>(null)
  const d = q.dados
  const alterar = async (campos: Record<string, unknown>) => {
    const { error } = await supabase.from('crm_contatos').update(campos).eq('id', id)
    if (error) return setErro(error.message)
    q.recarregar(); onMudou()
  }
  const k = d?.contato
  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <aside className="gaveta" onClick={(e) => e.stopPropagation()}>
        <div className="gaveta-topo">
          <div>
            <div className="muted pequeno">Contato</div>
            <h2>{k?.nome || 'Sem nome'}</h2>
            {d?.resumo && <Badge tom={SEGMENTOS[d.resumo.segmento]?.tom}>{SEGMENTOS[d.resumo.segmento]?.rotulo}</Badge>}
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <Erro msg={q.erro || erro} />
        {k && (<>
          <dl className="gaveta-dados">
            <dt>WhatsApp</dt><dd>{telefoneLegivel(k.telefone)}</dd>
            <dt>E-mail</dt><dd className="pequeno">{k.emails.join(', ') || '—'}</dd>
            <dt>Cidade</dt><dd>{k.cidade ? `${k.cidade}${k.uf ? '/' + k.uf : ''}` : '—'}</dd>
            {k.instagram && <><dt>Instagram</dt><dd>{k.instagram}</dd></>}
            <dt>Entrou em</dt><dd>{dataBR(k.entrou_em)} <span className="muted pequeno">· {k.origem ?? ''}</span></dd>
            {d.resumo && Number(d.resumo.total_liquido) > 0 && <><dt>Total pago (líquido)</dt><dd>{brl(d.resumo.total_liquido)}</dd></>}
            <dt>Etiquetas</dt><dd className="pequeno">{k.tags.join(', ') || '—'}</dd>
          </dl>
          <div className="gaveta-acoes">
            {k.telefone && !k.nao_contatar && <a className="btn btn-ouro" href={linkWhats(k.telefone)!} target="_blank" rel="noreferrer"><Icone nome="whats" tam={16} /> Abrir WhatsApp</a>}
            {k.nao_contatar
              ? <button className="btn" onClick={() => alterar({ nao_contatar: false, nao_contatar_em: null, nao_contatar_motivo: null })}>Voltar a aceitar mensagens</button>
              : <button className="btn btn-contorno" onClick={() => alterar({ nao_contatar: true, nao_contatar_em: new Date().toISOString(), nao_contatar_motivo: 'Marcado pelo administrador' })}>Não quer receber mensagens</button>}
            {k.telefone && <button className="btn" onClick={() => alterar({ telefone_invalido: !k.telefone_invalido })}>{k.telefone_invalido ? 'Número está certo' : 'Número errado'}</button>}
          </div>
          {k.nao_contatar && <p className="erro-txt pequeno">Não recebe mensagens{k.nao_contatar_motivo ? ` (${k.nao_contatar_motivo})` : ''}. Fica fora de todas as listas novas.</p>}

          <section>
            <h3>Compras na Hotmart</h3>
            {d.compras.length === 0 ? <p className="muted pequeno">Nenhuma compra com os e-mails deste contato.</p> : (
              <ul className="lista-compras">
                {d.compras.slice(0, 40).map((p, i) => (
                  <li key={i}><span>{p.produto_nome}{p.recorrencia && p.recorrencia > 1 ? <span className="muted"> · parcela {p.recorrencia}</span> : ''}</span>
                    <span className="muted pequeno">{dataBR(p.data_aprovacao)} · {brl(p.valor_liquido)} {!['APPROVED', 'COMPLETE'].includes(p.status) && <Badge tom="erro">{STATUS_HOTMART[p.status] ?? p.status}</Badge>}</span></li>
                ))}
              </ul>
            )}
          </section>
          {d.listas.length > 0 && <section>
            <h3>Listas</h3>
            <ul className="lista-compras">{d.listas.map((l, i) => <li key={i}><span>{l.campanha}</span><span className="pequeno"><Badge tom={STATUS_LISTA[l.status]?.tom}>{STATUS_LISTA[l.status]?.rotulo}</Badge> {l.vendedora ?? ''}</span>{l.nota && <span className="muted pequeno">“{l.nota}”</span>}</li>)}</ul>
          </section>}
          {d.eventos.length > 0 && <section>
            <h3>O que aconteceu</h3>
            <ul className="lista-compras">{d.eventos.slice(0, 30).map((e, i) => <li key={i}><span className="pequeno">{e.tipo === 'whatsapp' ? 'Abriu o WhatsApp' : e.dados?.status ? `Marcou: ${STATUS_LISTA[e.dados.status]?.rotulo ?? e.dados.status}` : 'Anotação'}{e.texto ? ` — “${e.texto}”` : ''}</span><span className="muted pequeno">{dataHoraBR(e.criado_em)} · {e.autor ?? ''}</span></li>)}</ul>
          </section>}
        </>)}
      </aside>
    </div>
  )
}
