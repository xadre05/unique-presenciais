import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta, minhaVendedoraId } from '../lib/dados'
import { brl, dataBR, FORMAS, SITUACAO_PARCELA, whatsLink } from '../lib/format'
import type { ParcelaV } from '../lib/types'
import { Badge, Erro, LinkArquivo, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import { AcaoParcela, Historia, type Acao } from './MatriculaDetalhe'
import { turmaCurta } from './Agenda'
import { PagamentosOnline } from './Online'

const POR_PAGINA = 25
const ehHotmart = (p: ParcelaV) => p.forma.startsWith('hotmart')
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0]

function linkCobranca(p: ParcelaV) {
  const base = whatsLink(p.aluno_whatsapp)
  if (!base) return null
  const msg = `Olá, ${primeiroNome(p.aluno_nome)}! Tudo bem? Aqui é da Unique HOF Academy. ` +
    `Consta em aberto a parcela ${p.numero}/${p.total_parcelas} do curso ${turmaCurta(p.turma_nome)}, no valor de ${brl(p.valor)}` +
    (p.vencimento ? `, com vencimento em ${dataBR(p.vencimento)}` : '') +
    `. Consegue verificar para a gente? Se já pagou, é só nos mandar o comprovante e desconsiderar esta mensagem.`
  return `${base}?text=${encodeURIComponent(msg)}`
}

export default function Pagamentos() {
  const { isAdmin, perfil } = useAuth()
  const [params, setParams] = useSearchParams()
  const area = isAdmin && params.get('area') === 'online' ? 'online' : 'presencial'
  const cad = useCadastros()
  const minha = minhaVendedoraId(cad.vendedoras, isAdmin ? null : perfil?.id)
  const [situacao, setSituacao] = useState('pendentes')
  const [turma, setTurma] = useState('')
  const [conta, setConta] = useState('')
  const [vendedora, setVendedora] = useState(isAdmin ? '' : 'minhas')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aberta, setAberta] = useState<ParcelaV | null>(null)
  const [acao, setAcao] = useState<Acao | null>(null)

  const q = useConsulta<ParcelaV[]>(() => {
    let x = supabase.from('v_parcelas').select('*').order('vencimento', { ascending: true, nullsFirst: true }).limit(3000)
    if (situacao === 'pendentes') x = x.in('situacao', ['atrasada', 'aguardando_conferencia', 'a_vencer', 'sem_vencimento'])
    else if (situacao) x = x.eq('situacao', situacao)
    if (turma) x = x.eq('turma_id', turma)
    if (conta) x = x.eq('conta_id', conta)
    const vid = vendedora === 'minhas' ? minha : vendedora
    if (vendedora === 'minhas' && !minha) x = x.eq('vendedora_id', '00000000-0000-0000-0000-000000000000')
    else if (vid) x = x.eq('vendedora_id', vid)
    if (de) x = x.gte('vencimento', de)
    if (ate) x = x.lte('vencimento', ate)
    return x
  }, [situacao, turma, conta, vendedora, de, ate, minha])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const ordem: Record<string, number> = { atrasada: 0, sem_vencimento: 1, aguardando_conferencia: 2, a_vencer: 3, recebida: 4, cancelada: 5 }
    return (q.dados ?? [])
      .filter((p) => !t || p.aluno_nome.toLowerCase().includes(t))
      .sort((a, b) => (ordem[a.situacao] ?? 9) - (ordem[b.situacao] ?? 9) || (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
  }, [q.dados, busca])
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pag = Math.min(pagina, totalPaginas)
  const visiveis = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)

  // vendedora vendo a equipe: os totais em dinheiro continuam só das vendas dela
  const baseResumo = isAdmin ? lista : lista.filter((p) => p.vendedora_id === minha)
  const emAberto = baseResumo.filter((p) => ['atrasada', 'a_vencer', 'sem_vencimento'].includes(p.situacao))
  const soma = (xs: ParcelaV[], campo: 'valor' | 'valor_recebido' = 'valor') => xs.reduce((s, p) => s + Number(p[campo] ?? p.valor ?? 0), 0)
  const vencidas = baseResumo.filter((p) => p.situacao === 'atrasada')
  const semVenc = baseResumo.filter((p) => p.situacao === 'sem_vencimento')
  const conferir = baseResumo.filter((p) => p.situacao === 'aguardando_conferencia')
  const recebidas = baseResumo.filter((p) => p.situacao === 'recebida')
  const filtrosAtivos = situacao !== 'pendentes' || turma || conta || vendedora !== (isAdmin ? '' : 'minhas') || de || ate || busca
  const limpar = () => { setSituacao('pendentes'); setTurma(''); setConta(''); setVendedora(isAdmin ? '' : 'minhas'); setDe(''); setAte(''); setBusca(''); setPagina(1) }
  const mudar = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(e.target.value); setPagina(1) }

  const exportar = () => {
    const cab = ['Aluno', 'Turma', 'Vendedora', 'Parcela', 'Forma', 'Conta', 'Vencimento', 'Valor da parcela', 'Recebido (líquido)', 'Data recebimento', 'Situação', 'Dias de atraso', 'Observação']
    const linhas = lista.map((p) => [p.aluno_nome, p.turma_nome, p.vendedora_nome ?? '', `${p.numero}/${p.total_parcelas}`, FORMAS[p.forma], p.conta_nome ?? '', dataBR(p.vencimento), String(p.valor).replace('.', ','), p.valor_recebido !== null ? String(p.valor_recebido).replace('.', ',') : '', dataBR(p.data_recebimento), SITUACAO_PARCELA[p.situacao]?.rotulo, String(p.dias_atraso), p.observacao ?? ''])
    const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'pagamentos-presenciais.csv'
    a.click()
  }

  const acaoPrincipal = (p: ParcelaV) => {
    if (p.situacao === 'sem_vencimento') return <button className="btn btn-contorno btn-mini" onClick={() => setAcao({ tipo: 'editar', parcela: p })}>Definir data</button>
    if (p.situacao === 'atrasada') {
      const l = linkCobranca(p)
      return l ? <a className="btn btn-contorno btn-mini" href={l} target="_blank" rel="noreferrer"><Icone nome="whats" tam={14} /> Cobrar</a>
        : <button className="btn btn-contorno btn-mini" onClick={() => setAberta(p)}>Ver detalhes</button>
    }
    if (p.situacao === 'a_vencer') return <button className="btn btn-contorno btn-mini" onClick={() => setAcao({ tipo: 'informar', parcela: p })}>Informar pagamento</button>
    if (p.situacao === 'aguardando_conferencia') return isAdmin
      ? <button className="btn btn-ouro btn-mini" onClick={() => setAcao({ tipo: 'confirmar', parcela: p })}>Conferir</button>
      : <button className="btn btn-mini" disabled>Em conferência</button>
    return <button className="btn btn-contorno btn-mini" onClick={() => setAberta(p)}>Ver detalhes</button>
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Pagamentos</h1><p className="muted">Parcelas, cobranças e conferência de recebimentos.</p></div>
        {area === 'presencial' && <div className="acoes"><button className="btn btn-contorno btn-grande" onClick={exportar}><Icone nome="exportar" /> Exportar CSV</button></div>}
      </header>
      {isAdmin && <nav className="abas">
        <button className={area === 'presencial' ? 'ativa' : ''} onClick={() => setParams({})}><Icone nome="turmas" tam={16} /> Presencial</button>
        <button className={area === 'online' ? 'ativa' : ''} onClick={() => setParams({ area: 'online' })}><Icone nome="links" tam={16} /> Online <span className="muted">Hotmart</span></button>
      </nav>}
      {area === 'online' ? <PagamentosOnline /> : (<>

      <label className="select-icone busca-larga"><Icone nome="busca" /><input placeholder="Buscar aluno…" value={busca} onChange={mudar(setBusca)} /></label>
      <div className="filtros-pagamentos">
        <label className="select-icone"><select value={situacao} onChange={mudar(setSituacao)}>
          <option value="pendentes">Em aberto (tudo que falta)</option>
          <option value="atrasada">Vencidas</option>
          <option value="sem_vencimento">Sem vencimento</option>
          <option value="aguardando_conferencia">Aguardando conferência</option>
          <option value="a_vencer">A vencer</option>
          <option value="recebida">Recebidas</option>
          <option value="considerada_paga">Consideradas pagas (baixa)</option>
          <option value="cancelada">Canceladas</option>
          <option value="">Todas</option>
        </select></label>
        <label className="select-icone"><select value={turma} onChange={mudar(setTurma)}><option value="">Todas as turmas</option>{cad.turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label className="select-icone"><select value={conta} onChange={mudar(setConta)}><option value="">Todas as contas</option>{cad.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label className="select-icone"><select value={vendedora} onChange={mudar(setVendedora)}>{!isAdmin && <option value="minhas">Minhas vendas</option>}<option value="">{isAdmin ? 'Todas as vendedoras' : 'Toda a equipe'}</option>{cad.vendedoras.filter((v) => isAdmin || (v.ativa && v.id !== minha)).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label>
        <div className="filtro-datas">
          <span className="muted">Vencimento</span>
          <label className="select-icone"><Icone nome="agenda" tam={16} /><input type="date" value={de} onChange={mudar(setDe)} title="De" /></label>
          <label className="select-icone"><Icone nome="agenda" tam={16} /><input type="date" value={ate} onChange={mudar(setAte)} title="Até" /></label>
        </div>
        {filtrosAtivos && <button className="link" onClick={limpar}>Limpar filtros</button>}
      </div>

      <h2 className="titulo-secao">Resumo do filtro atual{!isAdmin && vendedora !== 'minhas' && <span className="muted pequeno"> · os valores somam só as suas vendas</span>}</h2>
      <section className="resumo-pag">
        {situacao === 'recebida' ? (
          <div className="resumo-item"><span className="resumo-icone ic-ok"><Icone nome="check" tam={22} /></span><div><div className="muted">Recebidas</div><b>{recebidas.length}</b> parcelas · <b className="ok-txt">{brl(soma(recebidas, 'valor_recebido'))}</b> líquido</div></div>
        ) : (<>
          <div className="resumo-item"><span className="resumo-icone"><Icone nome="documento" tam={22} /></span><div><div className="muted">Parcelas em aberto</div><b className="resumo-num">{emAberto.length}</b></div></div>
          <div className="resumo-item"><span className="resumo-icone"><Icone nome="dinheiro" tam={22} /></span><div><div className="muted">Saldo em aberto</div><b className="resumo-num">{brl(soma(emAberto))}</b><div className="muted pequeno">inclui as vencidas</div></div></div>
          <div className="resumo-item"><span className="resumo-icone ic-erro"><Icone nome="alerta" tam={22} /></span><div><div className="muted">Vencidas</div><b className="resumo-num erro-txt">{brl(soma(vencidas))}</b><div className="erro-txt pequeno">{vencidas.length} parcela(s) · parte do saldo em aberto</div></div></div>
          {conferir.length > 0 && <div className="resumo-item"><span className="resumo-icone ic-info"><Icone nome="relogio" tam={22} /></span><div><div className="muted">Aguardando conferência</div><b className="resumo-num info-txt">{brl(soma(conferir, 'valor_recebido'))}</b><div className="muted pequeno">{conferir.length} informado(s), fora do saldo</div></div></div>}
        </>)}
      </section>

      {semVenc.length > 0 && situacao !== 'sem_vencimento' && (
        <div className="faixa-alerta">
          <Icone nome="alerta" tam={20} />
          <span><b>{semVenc.length} parcela(s) sem vencimento</b> · {brl(soma(semVenc))}</span>
          <button className="btn btn-contorno btn-mini" onClick={() => { setSituacao('sem_vencimento'); setPagina(1) }}>Definir datas</button>
        </div>
      )}

      <Erro msg={q.erro} />
      {lista.length === 0 && !q.carregando ? <Vazio>Nenhuma parcela com esses filtros.</Vazio> : (<>
        <div className="tabela-wrap">
          <table className="tabela tabela-pag">
            <thead><tr><th>Aluno</th><th>Turma</th><th>Parcela</th><th>Forma e conta</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th><th>Ação</th></tr></thead>
            <tbody>
              {visiveis.map((p) => {
                const s = SITUACAO_PARCELA[p.situacao]
                return (
                  <tr key={p.id} className="linha-clicavel" onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) return; setAberta(p) }}>
                    <td><span className="forte">{p.aluno_nome}</span>{p.vendedora_nome && <div className="muted pequeno">Vendedora: {p.vendedora_nome}</div>}</td>
                    <td className="pequeno">{turmaCurta(p.turma_nome)}</td>
                    <td>{p.eh_matricula ? 'Matrícula' : `${p.numero}/${p.total_parcelas}`}</td>
                    <td className="pequeno">{(FORMAS[p.forma] ?? p.forma).replace(/^Hotmart — /, '')}<div className="muted">{p.conta_nome ?? 'Conta não informada'}</div></td>
                    <td>{p.vencimento ? dataBR(p.vencimento) : '—'}{p.situacao === 'atrasada' && <div className="erro-txt pequeno">{p.dias_atraso} {p.dias_atraso === 1 ? 'dia' : 'dias'} em atraso</div>}</td>
                    <td className="num">{brl(p.situacao === 'recebida' || p.situacao === 'aguardando_conferencia' ? p.valor_recebido ?? p.valor : p.valor)}</td>
                    <td><Badge tom={s?.tom}>{s?.rotulo}</Badge></td>
                    <td className="celula-acao">{acaoPrincipal(p)}<button className="btn-icone pequeno" title="Ver detalhes" onClick={() => setAberta(p)}>⋮</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="paginacao">
          <span className="muted">{(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, lista.length)} de {lista.length} parcelas</span>
          {totalPaginas > 1 && <div className="acoes">
            <button className="btn btn-mini" disabled={pag === 1} onClick={() => setPagina(pag - 1)}><Icone nome="esquerda" tam={14} /> Anterior</button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).filter((n) => n === 1 || n === totalPaginas || Math.abs(n - pag) <= 1).map((n, i, arr) => (
              <span key={n}>{i > 0 && arr[i - 1] !== n - 1 && <span className="muted"> … </span>}<button className={`btn btn-mini${n === pag ? ' btn-contorno' : ''}`} onClick={() => setPagina(n)}>{n}</button></span>
            ))}
            <button className="btn btn-mini" disabled={pag === totalPaginas} onClick={() => setPagina(pag + 1)}>Próximo <Icone nome="seta" tam={14} /></button>
          </div>}
        </div>
      </>)}

      </>)}
      {aberta && <PainelParcela p={aberta} isAdmin={isAdmin} onFechar={() => setAberta(null)} onAcao={(a) => { setAcao(a) }} />}
      {acao?.parcela && (
        <AcaoParcela acao={acao} matriculaId={acao.parcela.matricula_id} totalParcelas={acao.parcela.total_parcelas} contas={cad.contas} isAdmin={isAdmin}
          onFechar={() => setAcao(null)} onSalvo={() => { setAcao(null); setAberta(null); q.recarregar() }} />
      )}
    </div>
  )
}

function PainelParcela({ p, isAdmin, onFechar, onAcao }: { p: ParcelaV; isAdmin: boolean; onFechar: () => void; onAcao: (a: Acao) => void }) {
  const hist = useConsulta<Parameters<typeof Historia>[0]['itens']>(
    () => isAdmin ? supabase.from('historico').select('*').eq('registro_id', p.id).order('em', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }), [p.id])
  const s = SITUACAO_PARCELA[p.situacao]
  const taxas = p.valor_recebido !== null ? Number(p.valor) - Number(p.valor_recebido) : null
  const cobrar = p.situacao === 'atrasada' ? linkCobranca(p) : null
  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <aside className="gaveta" onClick={(e) => e.stopPropagation()}>
        <div className="gaveta-topo">
          <div>
            <div className="muted pequeno">{turmaCurta(p.turma_nome)}</div>
            <h2>{p.aluno_nome}</h2>
            <div>{p.eh_matricula ? 'Matrícula' : `Parcela ${p.numero}/${p.total_parcelas}`} <Badge tom={s?.tom}>{s?.rotulo}</Badge></div>
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {ehHotmart(p) && p.situacao !== 'recebida' && (
          <div className="nota pequeno">
            <b>Pagamento pela Hotmart</b> ({p.conta_nome ?? 'conta não informada'}). O sistema ainda não recebe a atualização da Hotmart sozinho: antes de cobrar, confira no painel da Hotmart (Parcelado Hotmart) se a parcela já foi paga.
          </div>
        )}

        <dl className="gaveta-dados">
          <dt>Valor da parcela</dt><dd>{brl(p.valor)}</dd>
          <dt>Recebido (líquido)</dt><dd className={p.valor_recebido !== null ? 'ok-txt' : ''}>{p.valor_recebido !== null ? brl(p.valor_recebido) : '—'}</dd>
          {taxas !== null && Math.abs(taxas) >= 0.01 && <><dt>{taxas > 0 ? 'Diferença (taxas)' : 'Diferença (juros a mais)'}</dt><dd className="muted">{brl(Math.abs(taxas))}</dd></>}
          <dt>Vencimento</dt><dd>{p.vencimento ? dataBR(p.vencimento) : 'sem data'}{p.situacao === 'atrasada' && <span className="erro-txt"> · {p.dias_atraso} dias em atraso</span>}</dd>
          <dt>Data do recebimento</dt><dd>{dataBR(p.data_recebimento) || '—'}</dd>
          <dt>Forma</dt><dd>{FORMAS[p.forma] ?? p.forma}</dd>
          <dt>Conta</dt><dd>{p.conta_nome ?? 'não informada'}</dd>
          <dt>Vendedora</dt><dd>{p.vendedora_nome ?? '—'}</dd>
          <dt>Comprovante</dt><dd>{p.comprovante ? <LinkArquivo caminho={p.comprovante}>abrir</LinkArquivo> : '—'}</dd>
          {p.hotmart_transacao && <><dt>Transação Hotmart</dt><dd className="num-txt pequeno">{p.hotmart_transacao}</dd></>}
          {p.observacao && <><dt>Observação</dt><dd>{p.observacao}</dd></>}
        </dl>

        <div className="gaveta-acoes">
          {cobrar && <a className="btn btn-ouro" href={cobrar} target="_blank" rel="noreferrer"><Icone nome="whats" tam={16} /> Cobrar no WhatsApp</a>}
          {['a_vencer', 'atrasada', 'sem_vencimento'].includes(p.situacao) && <button className="btn btn-contorno" onClick={() => onAcao({ tipo: 'informar', parcela: p })}>Informar pagamento</button>}
          {p.situacao === 'aguardando_conferencia' && isAdmin && <button className="btn btn-ouro" onClick={() => onAcao({ tipo: 'confirmar', parcela: p })}>Conferir e confirmar</button>}
          {p.status !== 'confirmada' && <button className="btn" onClick={() => onAcao({ tipo: 'editar', parcela: p })}>Editar valor ou data</button>}
          <Link className="btn" to={`/matricula/${p.matricula_id}`}>Abrir matrícula</Link>
        </div>
        <p className="muted pequeno">Informar pagamento não é confirmar: a equipe registra, o administrador confere no extrato ou na Hotmart e confirma.</p>

        {isAdmin && (
          <section>
            <h3>Histórico desta parcela</h3>
            {(hist.dados ?? []).length === 0 ? <Vazio>Sem alterações registradas.</Vazio> : <Historia itens={hist.dados ?? []} />}
          </section>
        )}
      </aside>
    </div>
  )
}
