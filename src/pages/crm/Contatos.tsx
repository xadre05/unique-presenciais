// Base de contatos da Unique (admin): todos os leads, alunos e compradores, cruzados com a Hotmart.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useConsulta } from '../../lib/dados'
import { brl, dataBR, dataHoraBR } from '../../lib/format'
import { Badge, Erro, Vazio } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { linkWhats, telefoneLegivel } from '../../crm/nucleo'
import { Avatar } from '../../crm/Pecas'
import { descreverFiltro, limparFiltro, SEGMENTOS, STATUS_LISTA, tipoAluno, ACESSO, type ContatoLinha, type Filtro } from './comum'
import ImportarContatos from './ImportarContatos'
import CriarLista from './CriarLista'
import { NovoDisparo } from '../../crm/Disparos'
import { useBaseCRM } from '../../crm/tipos'
import { EMPRESA_UNIQUE } from './comum'
import { useNavigate, useSearchParams } from 'react-router-dom'

const POR_PAGINA = 50
type Contagem = Record<string, { total: number; com_whats: number; livres: number }>
const ANOS = Array.from({ length: new Date().getFullYear() - 2020 }, (_, i) => String(2021 + i)).reverse()

export default function Contatos() {
  const [f, setF] = useState<Filtro>({ so_whats: true })
  const [buscaTxt, setBuscaTxt] = useState('')
  const [pagina, setPagina] = useState(1)
  const [params] = useSearchParams()
  const [aberto, setAberto] = useState<string | null>(params.get('abrir'))
  const [importar, setImportar] = useState(false)
  const [criar, setCriar] = useState(false)
  const [versao, setVersao] = useState(0)
  const [disparo, setDisparo] = useState<string[] | null>(null)
  const [maisFiltros, setMaisFiltros] = useState(false)
  const [erroDisparo, setErroDisparo] = useState<string | null>(null)
  const base = useBaseCRM(EMPRESA_UNIQUE)
  const nav = useNavigate()

  // busca só dispara depois que a pessoa para de digitar
  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, busca: buscaTxt.trim() })); setPagina(1) }, 350); return () => clearTimeout(t) }, [buscaTxt])

  const filtro = useMemo(() => limparFiltro(f), [f])
  const chave = JSON.stringify(filtro)
  const res = useConsulta<{ total: number; linhas: ContatoLinha[] }>(() => supabase.rpc('buscar_contatos', { p: filtro, p_limite: POR_PAGINA, p_offset: (pagina - 1) * POR_PAGINA }), [chave, pagina, versao])
  // os cartões de cima mostram a base inteira (sem o filtro de WhatsApp) e, embaixo, quantos têm WhatsApp
  const filtroCont = useMemo(() => { const { so_whats: _s, ...resto } = filtro; return resto as Filtro }, [filtro])
  const cont = useConsulta<Contagem>(() => supabase.rpc('contar_contatos', { p: filtroCont }), [JSON.stringify(filtroCont), versao])
  const arquivados = useConsulta<number>(() => supabase.rpc('contar_arquivados'), [versao])
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

  const ICONE_SEG: Record<string, string> = { comprador: 'carrinho', quase: 'relogio', marcado: 'check', frio: 'floco' }
  const totalTodos = soma('total')
  const whatsTodos = soma('com_whats')
  const poucoWhats = !!cont.dados && totalTodos > 0 && whatsTodos < totalTodos * 0.5
  const temFiltroExtra = !!(f.sem_produto || f.ano_compra || f.ano_entrada || f.fora_de_lista || f.arquivados)
  const paginas = Array.from({ length: Math.min(totalPag, 7) }, (_, i) => Math.max(1, Math.min(pagina - 3, totalPag - 6)) + i).filter((n) => n >= 1 && n <= totalPag)
  return (
    <div className="pagina at-pagina">
      <header className="pagina-topo at-titulo-pagina">
        <div><h1>Contatos</h1><p className="muted">Pessoas, histórico de compras e segmentos: leads do SellFlux, compradores da Hotmart e alunos, juntos por WhatsApp e e-mail.</p></div>
        <div className="acoes">
          <button className="btn btn-contorno" onClick={() => setImportar(true)}><Icone nome="importar" /> Importar contatos</button>
          <button className="btn btn-contorno" onClick={() => setCriar(true)} disabled={!disponiveis} title="Cria uma lista e divide entre as vendedoras; cada uma chama do próprio celular"><Icone nome="turmas" /> Distribuir para vendedoras</button>
          <button className="btn btn-ouro" disabled={!disponiveis} onClick={async () => {
            setErroDisparo(null)
            const { data, error } = await supabase.rpc('ids_contatos_filtrados', { p: filtro })
            if (error) setErroDisparo(error.message); else setDisparo(data as string[])
          }}><Icone nome="whats" /> Disparar pelo WhatsApp</button>
        </div>
      </header>

      <section className="at-segmentos">
        <button className={`at-seg${!f.segmento ? ' ativo' : ''}`} onClick={() => mudar('segmento', '')}>
          <span className="at-kpi-icone"><Icone nome="turmas" tam={20} /></span>
          <span className="at-seg-txt"><span>Todos</span><b>{cont.carregando && !cont.dados ? '…' : totalTodos.toLocaleString('pt-BR')}</b>{cont.dados && <small>{whatsTodos.toLocaleString('pt-BR')} com WhatsApp</small>}</span><Icone nome="seta" tam={16} />
        </button>
        {Object.entries(SEGMENTOS).map(([k, sg]) => (
          <button key={k} className={`at-seg${f.segmento === k ? ' ativo' : ''}`} onClick={() => mudar('segmento', f.segmento === k ? '' : k)} title={`${sg.explica} · ${(c[k]?.com_whats ?? 0).toLocaleString('pt-BR')} com WhatsApp · ${(c[k]?.livres ?? 0).toLocaleString('pt-BR')} fora de lista`}>
            <span className="at-kpi-icone"><Icone nome={ICONE_SEG[k] ?? 'usuario'} tam={20} /></span>
            <span className="at-seg-txt"><span>{sg.rotulo}</span><b>{cont.carregando && !cont.dados ? '…' : (c[k]?.total ?? 0).toLocaleString('pt-BR')}</b>{cont.dados && <small>{(c[k]?.com_whats ?? 0).toLocaleString('pt-BR')} com WhatsApp</small>}</span><Icone nome="seta" tam={16} />
          </button>
        ))}
      </section>

      {poucoWhats && (
        <div className="at-faixa">
          <span><b>Só {whatsTodos.toLocaleString('pt-BR')} de {totalTodos.toLocaleString('pt-BR')} contatos têm WhatsApp.</b> Os compradores da Hotmart entraram só com e-mail. Importe a lista do SellFlux e a exportação de vendas da Hotmart para trazer os telefones.</span>
          <button className="btn btn-mini btn-ouro" onClick={() => setImportar(true)}>Importar contatos</button>
        </div>
      )}
      <label className="select-icone at-busca"><Icone nome="busca" /><input placeholder="Nome, WhatsApp ou e-mail" value={buscaTxt} onChange={(e) => setBuscaTxt(e.target.value)} /></label>
      <div className="at-filtros">
        <label className="select-icone"><Icone nome="usuario" tam={16} /><select value={f.compra ?? ''} onChange={(e) => mudar('compra', e.target.value)}>
          <option value="">Aluno: todos</option><option value="sim">Já comprou (qualquer curso)</option><option value="nao">Nunca comprou</option>
          <option value="online">Aluno do online</option><option value="presencial">Aluno do presencial</option>
          <option value="so_online">Só online</option><option value="so_presencial">Só presencial</option><option value="ambos">Online + presencial</option>
        </select></label>
        <label className="select-icone"><Icone nome="carrinho" tam={16} /><select value={f.produto ?? ''} onChange={(e) => mudar('produto', e.target.value)}>
          <option value="">Produto comprado</option>{nomesProdutos.map((p) => <option key={p} value={p}>Comprou {p}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="relogio" tam={16} /><select value={f.acesso ?? ''} onChange={(e) => mudar('acesso', e.target.value)} title="Pela regra: Black é vitalício; o resto vale 1 ano a partir da compra">
          <option value="">Acesso: todos</option><option value="tem">Com acesso (vitalício ou em dia)</option><option value="vencido">Acesso vencido (qualquer)</option>
          {Object.entries(ACESSO).map(([k, a]) => <option key={k} value={k}>{a.rotulo}</option>)}
        </select></label>
        <button className={`btn${maisFiltros || temFiltroExtra ? ' btn-contorno-ouro' : ''}`} onClick={() => setMaisFiltros(!maisFiltros)}><Icone nome="filtro" tam={16} /> Mais filtros {maisFiltros ? '▴' : '▾'}</button>
      </div>
      {maisFiltros && <div className="at-filtros">
        <label className="select-icone"><Icone nome="fechar" tam={16} /><select value={f.sem_produto ?? ''} onChange={(e) => mudar('sem_produto', e.target.value)}>
          <option value="">Excluir produto</option>{nomesProdutos.map((p) => <option key={p} value={p}>Não comprou {p}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="agenda" tam={16} /><select value={f.ano_compra ?? ''} onChange={(e) => mudar('ano_compra', e.target.value)}>
          <option value="">Comprou em qualquer ano</option>{ANOS.map((a) => <option key={a} value={a}>Comprou em {a}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="relogio" tam={16} /><select value={f.ano_entrada ?? ''} onChange={(e) => mudar('ano_entrada', e.target.value)}>
          <option value="">Entrou em qualquer ano</option>{ANOS.map((a) => <option key={a} value={a}>Entrou em {a}</option>)}
        </select></label>
        <label className="select-icone"><Icone nome="arquivo" tam={16} /><select value={f.arquivados ?? ''} onChange={(e) => mudar('arquivados', e.target.value)}>
          <option value="">Sem os arquivados</option><option value="true">Com os arquivados</option><option value="so">Só os arquivados</option>
        </select></label>
        <label className="check"><input type="checkbox" checked={!!f.fora_de_lista} onChange={(e) => mudar('fora_de_lista', e.target.checked)} /> Só quem não está em outra lista ativa</label>
      </div>}
      <div className="at-chips">
        <button className={`at-chip${f.so_whats ? ' ativo' : ''}`} onClick={() => mudar('so_whats', !f.so_whats)}>{f.so_whats ? '☑' : '☐'} WhatsApp válido e aceita mensagem</button>
        {f.fora_de_lista && <button className="at-chip ativo" onClick={() => mudar('fora_de_lista', false)}>Fora de outra lista ×</button>}
        {(arquivados.dados ?? 0) > 0 && !f.arquivados && <span className="muted pequeno">{(arquivados.dados ?? 0).toLocaleString('pt-BR')} no arquivo (não aparecem)</span>}
        {Object.keys(filtro).length > 1 && <button className="link pequeno" onClick={() => { setF({ so_whats: true }); setBuscaTxt(''); setPagina(1) }}>× Limpar filtros</button>}
      </div>

      <Erro msg={res.erro || cont.erro || erroDisparo} />
      {res.carregando && !res.dados ? <Vazio>Carregando contatos…</Vazio> : total === 0 ? <Vazio>Nenhum contato com esses filtros.{totalTodos === 0 && ' A base ainda está vazia: use “Importar contatos”.'}</Vazio> : (
        <div className="tabela-wrap bloco sem-padding at-tabela">
          <table className="tabela tabela-pag at-tabela-contatos">
            <colgroup><col className="c-contato" /><col className="c-perfil" /><col className="c-aluno" /><col className="c-compras" /><col className="c-resp" /><col className="c-acao" /></colgroup>
            <thead><tr><th>Contato</th><th>Perfil</th><th>Aluno</th><th>Compras</th><th>Responsável</th><th></th></tr></thead>
            <tbody>
              {(res.dados?.linhas ?? []).map((x) => {
                const prods = x.produtos ?? []
                return (
                <tr key={x.id} className={`linha-clicavel${x.arquivado_em ? ' linha-arquivada' : ''}`} onClick={() => setAberto(x.id)} title="Abrir a ficha">
                  <td><div className="at-contato-cel"><Avatar nome={x.nome || x.telefone} /><div className="at-corta">
                    <div className="forte at-corta">{x.nome || 'Sem nome'}</div>
                    <div className="muted pequeno at-corta">{x.nao_contatar ? <span className="erro-txt">Não quer receber</span> : x.telefone_invalido ? <span className="erro-txt">Número errado</span> : telefoneLegivel(x.telefone)}</div>
                    {x.emails[0] && <div className="muted pequeno at-corta">{x.emails[0]}</div>}
                  </div></div></td>
                  <td><Badge tom={SEGMENTOS[x.segmento ?? 'frio']?.tom}>{SEGMENTOS[x.segmento ?? 'frio']?.rotulo}</Badge>{x.arquivado_em && <div><Badge tom="apagado">Arquivado</Badge></div>}</td>
                  <td>{tipoAluno(x.aluno_online, x.aluno_presencial)
                    ? <span className={`at-tipo-aluno${x.aluno_presencial ? ' presencial' : ''}`} title={x.cursos_presenciais?.length ? `Presencial: ${x.cursos_presenciais.join(', ')}` : undefined}>{tipoAluno(x.aluno_online, x.aluno_presencial)}</span>
                    : <span className="muted">—</span>}
                    {x.acesso && <div className={`pequeno at-corta at-acesso ${ACESSO[x.acesso]?.tom ?? ''}`} title={x.acesso_ate ? `Acesso até ${dataBR(x.acesso_ate)}` : undefined}>{x.acesso === 'vitalicio' ? 'Vitalício' : x.acesso === 'em_dia' || x.acesso === 'vence_60' ? `Acesso até ${dataBR(x.acesso_ate)}` : `Venceu ${dataBR(x.acesso_ate)}`}</div>}</td>
                  <td className="pequeno">{prods.length || Number(x.total_liquido) > 0 ? (<>
                    <div className="at-corta" title={prods.join('\n')}>{prods[0] ?? '—'}{prods.length > 1 && <span className="muted"> +{prods.length - 1}</span>}</div>
                    <div className="muted at-corta">{Number(x.total_liquido) > 0 ? <span className="num-mono">{brl(x.total_liquido)}</span> : null}{x.ultima_compra ? ` · ${dataBR(x.ultima_compra)}` : ''}</div>
                  </>) : <span className="muted">—</span>}</td>
                  <td className="pequeno"><div className="at-corta">{x.responsavel_id ? base.nomeDe(x.responsavel_id) : x.vendido_por ? <span title="Quem vendeu o curso presencial (não tem acesso ao Atendimento)">Vendeu: {x.vendido_por}</span> : <span className="muted">Sem responsável</span>}</div>
                    {x.lista_ativa && <div className="muted at-corta" title={x.lista_ativa}>Lista: {x.lista_ativa}</div>}</td>
                  <td className="celula-acao" onClick={(e) => e.stopPropagation()}>
                    {x.telefone && !x.nao_contatar && <a className="btn btn-contorno-ouro btn-mini btn-quadrado" href={linkWhats(x.telefone)!} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><Icone nome="whats" tam={16} /></a>}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          <div className="paginacao at-paginacao">
            <span className="muted pequeno"><b>{total.toLocaleString('pt-BR')}</b> contato(s) encontrados · {descreverFiltro(filtro)}</span>
            {totalPag > 1 && <div className="at-paginas">
              <button className="btn-icone" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} aria-label="Anterior"><Icone nome="esquerda" tam={16} /></button>
              {paginas.map((n) => <button key={n} className={n === pagina ? 'ativa' : ''} onClick={() => setPagina(n)}>{n}</button>)}
              <button className="btn-icone" disabled={pagina === totalPag} onClick={() => setPagina(pagina + 1)} aria-label="Próxima"><Icone nome="seta" tam={16} /></button>
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
  tentativas: number
  resumo: { segmento: string; produtos: string[]; total_liquido: number; primeira_compra: string | null; ultima_compra: string | null; reembolsou: boolean; aluno_presencial: boolean; aluno_online?: boolean; vendido_por?: string | null; cursos_presenciais?: string[]; acesso?: string | null; acesso_ate?: string | null } | null
  compras: { data_aprovacao: string | null; produto_nome: string | null; valor_liquido: number | null; status: string; recorrencia: number | null; parcelas_cartao: number | null }[]
  listas: { campanha: string; status: string; vendedora: string | null; nota: string | null; atualizado_em: string }[]
  eventos: { tipo: string; texto: string | null; dados: { status?: string } | null; criado_em: string; autor: string | null }[]
}
const TIPO_EVENTO: Record<string, string> = {
  whatsapp: 'Abriu o WhatsApp', arquivado: 'Foi para o arquivo', reativado: 'Saiu do arquivo', respondeu: 'Respondeu',
  sem_primeiro_contato: 'Voltou para a fila', lgpd_apagado: 'Dados apagados (LGPD)',
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
  const [apagar, setApagar] = useState(false)
  const rpc = async (nome: string, args: Record<string, unknown>) => {
    const { error } = await supabase.rpc(nome, args)
    if (error) return setErro(error.message)
    setApagar(false); q.recarregar(); onMudou()
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
            {d.resumo && tipoAluno(d.resumo.aluno_online, d.resumo.aluno_presencial) && <><dt>Aluno</dt><dd>{tipoAluno(d.resumo.aluno_online, d.resumo.aluno_presencial)}{d.resumo.cursos_presenciais?.length ? <span className="muted pequeno"> · {d.resumo.cursos_presenciais.join(', ')}</span> : null}</dd></>}
            {d.resumo?.acesso && <><dt>Acesso à plataforma</dt><dd><Badge tom={ACESSO[d.resumo.acesso]?.tom}>{ACESSO[d.resumo.acesso]?.rotulo}</Badge>{d.resumo.acesso_ate && <span className="muted pequeno"> · {['vencido_recente', 'vencido_antigo'].includes(d.resumo.acesso) ? 'venceu em' : 'até'} {dataBR(d.resumo.acesso_ate)}</span>}</dd></>}
            {d.resumo?.vendido_por && <><dt>Vendeu o presencial</dt><dd>{d.resumo.vendido_por}</dd></>}
            {d.resumo && Number(d.resumo.total_liquido) > 0 && <><dt>Total pago (líquido)</dt><dd>{brl(d.resumo.total_liquido)}</dd></>}
            <dt>Etiquetas</dt><dd className="pequeno">{k.tags.join(', ') || '—'}</dd>
            {d.tentativas > 0 && <><dt>Tentativas sem resposta</dt><dd>{d.tentativas}</dd></>}
          </dl>
          <div className="gaveta-acoes">
            {k.telefone && !k.nao_contatar && <a className="btn btn-ouro" href={linkWhats(k.telefone)!} target="_blank" rel="noreferrer"><Icone nome="whats" tam={16} /> Abrir WhatsApp</a>}
            {k.nao_contatar
              ? <button className="btn" onClick={() => alterar({ nao_contatar: false, nao_contatar_em: null, nao_contatar_motivo: null })}>Voltar a aceitar mensagens</button>
              : <button className="btn btn-contorno" onClick={() => alterar({ nao_contatar: true, nao_contatar_em: new Date().toISOString(), nao_contatar_motivo: 'Marcado pelo administrador' })}>Não quer receber mensagens</button>}
            {k.telefone && <button className="btn" onClick={() => alterar({ telefone_invalido: !k.telefone_invalido })}>{k.telefone_invalido ? 'Número está certo' : 'Número errado'}</button>}
          </div>
          {k.arquivado_em && <div className="aviso-arquivo">
            <div><Badge tom="apagado">No arquivo</Badge> <span className="muted pequeno">{k.arquivado_motivo} · {dataBR(k.arquivado_em)}</span></div>
            <div className="muted pequeno">Fora das listas, disparos e follow-ups. Volta sozinho se responder ou comprar.</div>
            {!k.nao_contatar && <button className="btn btn-mini" onClick={() => rpc('crm_arquivo', { p_contato: id, p_arquivar: false })}>Reativar</button>}
          </div>}
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
            <ul className="lista-compras">{d.eventos.slice(0, 30).map((e, i) => <li key={i}><span className="pequeno">{TIPO_EVENTO[e.tipo] ?? (e.dados?.status ? `Marcou: ${STATUS_LISTA[e.dados.status]?.rotulo ?? e.dados.status}` : 'Anotação')}{e.texto ? ` — “${e.texto}”` : ''}</span><span className="muted pequeno">{dataHoraBR(e.criado_em)} · {e.autor ?? ''}</span></li>)}</ul>
          </section>}
          <section className="zona-lgpd">
            {!k.arquivado_em && !k.nao_contatar && <button className="link pequeno" onClick={() => rpc('crm_arquivo', { p_contato: id, p_arquivar: true, p_motivo: 'Arquivado pelo administrador' })}>Arquivar (sai das listas e disparos, sem apagar)</button>}
            {!k.tags.includes('lgpd-apagado') && (apagar
              ? <div className="nota">A pessoa pediu para apagar os dados dela? Isso apaga nome, e-mails e o conteúdo das conversas e anotações. Fica só o número, marcado para nunca mais receber mensagem. Não dá para desfazer.
                  <div className="acoes"><button className="btn btn-mini btn-perigo" onClick={() => rpc('crm_apagar_dados', { p_contato: id })}>Apagar os dados</button><button className="link pequeno" onClick={() => setApagar(false)}>cancelar</button></div></div>
              : <button className="link pequeno erro-txt" onClick={() => setApagar(true)}>Apagar dados a pedido da pessoa (LGPD)</button>)}
          </section>
        </>)}
      </aside>
    </div>
  )
}
