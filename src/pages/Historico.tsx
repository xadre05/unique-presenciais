import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, dataHoraBR, FORMAS, hojeISO, STATUS_COMISSAO, STATUS_MATRICULA, STATUS_TURMA } from '../lib/format'
import { Badge, Erro, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'

type Ev = { id: number; tabela: string; registro_id: string; acao: string; usuario_id: string | null; usuario_nome: string; em: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }

const AREAS: Record<string, { nome: string; icone: string; tom: string }> = {
  parcelas: { nome: 'Pagamento', icone: 'dinheiro', tom: 'ok' }, matriculas: { nome: 'Matrícula', icone: 'documento', tom: 'roxo' },
  alunos: { nome: 'Aluno', icone: 'usuario', tom: 'info' }, comissoes: { nome: 'Comissão', icone: 'comissoes', tom: 'ouro' },
  comissao_regras: { nome: 'Regra de comissão', icone: 'equipe', tom: 'ouro' }, turmas: { nome: 'Turma', icone: 'turmas', tom: 'info' },
  encontros: { nome: 'Data de curso', icone: 'agenda', tom: 'info' }, links_pagamento: { nome: 'Link de pagamento', icone: 'links', tom: 'neutro' },
  perfis: { nome: 'Acesso', icone: 'usuario', tom: 'alerta' }, vendedoras: { nome: 'Vendedora', icone: 'usuario', tom: 'neutro' },
  cursos: { nome: 'Curso', icone: 'livro', tom: 'neutro' }, contas: { nome: 'Conta', icone: 'pagamentos', tom: 'neutro' },
  hotmart_produtos: { nome: 'Produto Hotmart', icone: 'links', tom: 'neutro' },
}
const ROTULOS: Record<string, string> = {
  valor: 'Valor', valor_fechado: 'Valor fechado', valor_recebido: 'Valor recebido', vencimento: 'Vencimento', status: 'Situação', forma: 'Forma',
  conta_id: 'Conta', data_recebimento: 'Data do recebimento', comprovante: 'Comprovante', observacao: 'Observação', observacoes: 'Observações',
  vendedora_id: 'Vendedora', turma_id: 'Turma', curso_id: 'Curso', nome: 'Nome', email: 'E-mail', whatsapp: 'WhatsApp', cpf: 'CPF',
  data_inicio: 'Primeiro dia', data_fim: 'Último dia', vagas: 'Vagas', local: 'Local', vendas_abertas: 'Vendas abertas', titulo: 'Título',
  competencia: 'Mês de pagamento', paga_em: 'Paga em', liberada_em: 'Liberada em', pago_conta: 'Conta de saída', ajuste_motivo: 'Motivo do ajuste',
  liberacao_motivo: 'Motivo da liberação', motivo_cancelamento: 'Motivo do cancelamento', contrato_assinado: 'Contrato assinado',
  papel: 'Acesso', fixo: 'Valor fixo', percentual: 'Percentual', calculo: 'Tipo de cálculo', faixas: 'Faixas', endereco: 'Link ou chave',
  condicao: 'Condição', ativo: 'Ativo', finalidade: 'Finalidade', validade: 'Validade', data_venda: 'Data da venda', origem: 'Origem',
  considerada_paga: 'Considerada paga', numero: 'Parcela', total_parcelas: 'Total de parcelas', horario: 'Horário', cancelado: 'Cancelado',
}
const TECNICOS = new Set(['id', 'criado_em', 'atualizado_em', 'sincronizado_em', 'regra_texto', 'informado_por', 'confirmado_por', 'ordem', 'mostrar'])
const DINHEIRO = new Set(['valor', 'valor_fechado', 'valor_recebido', 'fixo'])
const DATAS = new Set(['vencimento', 'data_recebimento', 'data_inicio', 'data_fim', 'competencia', 'paga_em', 'liberada_em', 'validade', 'data_venda'])
const STATUS_PARCELA: Record<string, string> = { prevista: 'A receber', informada: 'Informada (aguardando conferência)', confirmada: 'Recebida (conferida)', cancelada: 'Cancelada' }

type Ctx = { mat: Map<string, { aluno: string; turma: string }>; nomes: Map<string, string>; comMat: Map<string, string> }

function fmt(campo: string, v: unknown, tabela: string, ctx: Ctx): string {
  if (v === null || v === undefined || v === '') return '—'
  if (DINHEIRO.has(campo)) return brl(Number(v))
  if (campo === 'percentual') return `${String(v).replace('.', ',')}%`
  if (DATAS.has(campo)) return campo === 'competencia' ? dataBR(String(v)).slice(3) : dataBR(String(v))
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (campo === 'forma') return FORMAS[String(v)] ?? String(v)
  if (campo === 'status') return (tabela === 'parcelas' ? STATUS_PARCELA : tabela === 'comissoes' ? Object.fromEntries(Object.entries(STATUS_COMISSAO).map(([k, x]) => [k, x.rotulo])) : tabela === 'turmas' ? STATUS_TURMA : STATUS_MATRICULA)[String(v)] ?? String(v)
  if (campo.endsWith('_id')) return ctx.nomes.get(String(v)) ?? '(registro)'
  if (campo === 'comprovante') return 'arquivo anexado'
  if (campo === 'faixas') return `${(v as unknown[]).length} faixa(s)`
  return String(v)
}

function mudancas(e: Ev) {
  const a = e.antes ?? {}, d = e.depois ?? {}
  return Object.keys({ ...a, ...d }).filter((k) => !TECNICOS.has(k) && JSON.stringify(a[k] ?? null) !== JSON.stringify(d[k] ?? null))
}

function descrever(e: Ev, ctx: Ctx) {
  const d = e.depois ?? {}, a = e.antes ?? {}
  const st = String(d.status ?? ''), stA = String(a.status ?? '')
  const matId = String(d.matricula_id ?? a.matricula_id ?? (e.tabela === 'matriculas' ? e.registro_id : '') ?? '')
  const m = ctx.mat.get(matId)
  const quem = m ? `${m.aluno} · ${m.turma}` : ''
  const mudou = mudancas(e)
  let titulo = `${e.acao === 'INSERT' ? 'Criou' : e.acao === 'DELETE' ? 'Apagou' : 'Alterou'} ${(AREAS[e.tabela]?.nome ?? e.tabela).toLowerCase()}`
  let sub = quem
  if (e.tabela === 'parcelas') {
    if (e.acao === 'INSERT') titulo = 'Lançou uma parcela'
    else if (st !== stA) titulo = st === 'informada' ? 'Informou um pagamento' : st === 'confirmada' ? 'Confirmou um recebimento' : st === 'cancelada' ? (d.considerada_paga ? 'Deu baixa numa parcela (considerada paga)' : 'Cancelou uma parcela') : stA === 'cancelada' ? 'Reabriu uma parcela' : 'Mudou a situação de uma parcela'
    else if (mudou.includes('vencimento')) titulo = 'Mudou o vencimento de uma parcela'
    sub = [quem, d.numero ? `parcela ${d.numero}/${d.total_parcelas}` : ''].filter(Boolean).join(' · ')
  } else if (e.tabela === 'matriculas') {
    titulo = e.acao === 'INSERT' ? 'Criou uma matrícula' : st !== stA ? (st === 'cancelada' ? 'Cancelou uma matrícula' : `Mudou a inscrição para “${STATUS_MATRICULA[st] ?? st}”`) : mudou.includes('vendedora_id') ? 'Trocou quem vendeu' : 'Alterou uma matrícula'
  } else if (e.tabela === 'comissoes') {
    const cm = ctx.mat.get(ctx.comMat.get(e.registro_id) ?? String(d.matricula_id ?? ''))
    sub = cm ? `${cm.aluno} · ${cm.turma}` : ''
    titulo = e.acao === 'INSERT' ? 'Gerou uma comissão' : st !== stA ? (st === 'liberada' ? (d.liberacao_motivo ? 'Liberou comissão por exceção' : 'Liberou uma comissão') : st === 'paga' ? 'Registrou pagamento de comissão' : st === 'cancelada' ? 'Cancelou uma comissão' : 'Mudou a situação de uma comissão') : mudou.includes('valor') ? (d.ajuste_motivo ? 'Ajustou o valor da comissão' : 'Recalculou a comissão') : 'Alterou uma comissão'
  } else if (e.tabela === 'comissao_regras') {
    titulo = e.acao === 'INSERT' ? 'Criou uma regra de comissão' : 'Alterou a regra de comissão'
    sub = d.curso_id ? ctx.nomes.get(String(d.curso_id)) ?? 'curso' : 'Regra padrão'
  } else if (e.tabela === 'alunos') { titulo = e.acao === 'INSERT' ? 'Cadastrou um aluno' : 'Alterou dados do aluno'; sub = String(d.nome ?? '') }
  else if (e.tabela === 'turmas') { titulo = e.acao === 'INSERT' ? 'Criou uma turma' : mudou.some((k) => k.startsWith('data_')) ? 'Mudou as datas da turma' : 'Alterou uma turma'; sub = String(d.nome ?? '') }
  else if (e.tabela === 'encontros') { titulo = e.acao === 'INSERT' ? 'Cadastrou uma data de curso' : d.cancelado ? 'Removeu uma data de curso' : 'Alterou uma data de curso'; sub = `${ctx.nomes.get(String(d.turma_id)) ?? ''} · ${d.titulo ?? ''}` }
  else if (e.tabela === 'links_pagamento') { titulo = e.acao === 'INSERT' ? 'Cadastrou um link de pagamento' : 'Alterou um link de pagamento'; sub = String(d.titulo ?? '') }
  else if (e.tabela === 'perfis') { titulo = mudou.includes('papel') ? 'Mudou o acesso de uma pessoa' : 'Alterou um acesso'; sub = String(d.nome || d.email || '') }
  else if (d.nome) sub = String(d.nome)
  // resumo curto do que mudou
  const resumo = e.acao === 'UPDATE' ? mudou.slice(0, 2).map((k) => `${ROTULOS[k] ?? k}: ${fmt(k, a[k], e.tabela, ctx)} → ${fmt(k, d[k], e.tabela, ctx)}`).join(' · ') : ''
  const motivo = String(d.motivo_cancelamento || d.ajuste_motivo || d.liberacao_motivo || (st === 'cancelada' ? d.observacao : '') || '') || null
  const link = e.tabela === 'matriculas' ? `/matricula/${e.registro_id}` : matId && ['parcelas', 'comissoes'].includes(e.tabela) ? `/matricula/${ctx.comMat.get(e.registro_id) ?? matId}` : e.tabela === 'alunos' ? `/alunos/${e.registro_id}`
    : e.tabela === 'turmas' ? `/turmas/${e.registro_id}` : e.tabela === 'encontros' ? `/turmas/${d.turma_id}` : e.tabela === 'comissao_regras' ? '/comissoes' : e.tabela === 'links_pagamento' ? '/links' : e.tabela === 'perfis' ? '/equipe' : null
  return { titulo, sub, resumo, motivo, link, mudou }
}

export default function Historico() {
  const cad = useCadastros()
  const [busca, setBusca] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [area, setArea] = useState('')
  const [acao, setAcao] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [tecnicas, setTecnicas] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [sel, setSel] = useState<Ev | null>(null)

  const q = useConsulta<Ev[]>(() => {
    let x = supabase.from('historico').select('*').order('em', { ascending: false }).limit(3000)
    if (de) x = x.gte('em', de)
    if (ate) x = x.lt('em', new Date(new Date(ate + 'T00:00:00').getTime() + 864e5).toISOString())
    return x
  }, [de, ate])
  const mats = useConsulta<{ id: string; aluno_nome: string; turma_nome: string }[]>(() => supabase.from('v_matriculas').select('id,aluno_nome,turma_nome'))
  const coms = useConsulta<{ id: string; matricula_id: string }[]>(() => supabase.from('comissoes').select('id,matricula_id'))
  const cursos = useConsulta<{ id: string; nome: string }[]>(() => supabase.from('cursos').select('id,nome'))

  const ctx: Ctx = useMemo(() => {
    const nomes = new Map<string, string>()
    for (const t of cad.turmas) nomes.set(t.id, t.nome)
    for (const c of cad.contas) nomes.set(c.id, c.nome)
    for (const v of cad.vendedoras) nomes.set(v.id, v.nome)
    for (const c of cursos.dados ?? []) nomes.set(c.id, c.nome)
    return {
      nomes,
      mat: new Map((mats.dados ?? []).map((m) => [m.id, { aluno: m.aluno_nome, turma: m.turma_nome.replace(' — ', ' · ') }])),
      comMat: new Map((coms.dados ?? []).map((c) => [c.id, c.matricula_id])),
    }
  }, [cad.turmas, cad.contas, cad.vendedoras, cursos.dados, mats.dados, coms.dados])

  const todos = useMemo(() => (q.dados ?? []).map((e) => ({ e, d: descrever(e, ctx), tecnica: !e.usuario_id })), [q.dados, ctx])
  const termo = busca.trim().toLowerCase()
  const filtrados = todos.filter(({ e, d, tecnica }) =>
    (tecnicas || !tecnica) && (!pessoa || e.usuario_nome === pessoa) && (!area || e.tabela === area) && (!acao || e.acao === acao) &&
    (!termo || `${d.titulo} ${d.sub} ${d.resumo} ${e.usuario_nome}`.toLowerCase().includes(termo)))
  const ocultas = todos.filter((x) => x.tecnica).length
  const POR = 30
  const totalPag = Math.max(1, Math.ceil(filtrados.length / POR))
  const pag = Math.min(pagina, totalPag)
  const visiveis = filtrados.slice((pag - 1) * POR, pag * POR)
  const pessoas = [...new Set((q.dados ?? []).map((e) => e.usuario_nome))].sort()
  const areas = [...new Set((q.dados ?? []).map((e) => e.tabela))]
  const mudar = (f: (v: string) => void) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(ev.target.value); setPagina(1) }

  const exportar = () => {
    const cab = ['Data e hora', 'Quem', 'Área', 'O que fez', 'Registro', 'Mudanças', 'Motivo']
    const linhas = filtrados.map(({ e, d }) => [dataHoraBR(e.em), e.usuario_nome, AREAS[e.tabela]?.nome ?? e.tabela, d.titulo, d.sub,
      d.mudou.map((k) => `${ROTULOS[k] ?? k}: ${fmt(k, e.antes?.[k], e.tabela, ctx)} → ${fmt(k, e.depois?.[k], e.tabela, ctx)}`).join(' | '), d.motivo ?? ''])
    const csv = [cab, ...linhas].map((l) => l.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'historico.csv'; a.click()
  }

  let diaAnterior = ''
  const selD = sel ? descrever(sel, ctx) : null

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Histórico de alterações <span className="selo-admin"><Icone nome="alerta" tam={14} /> Somente administrador</span></h1><p className="muted">Quem fez, quando fez e o que mudou. Nada aqui pode ser editado ou apagado.</p></div>
        <button className="btn btn-contorno btn-grande" onClick={exportar}><Icone nome="exportar" /> Exportar histórico</button>
      </header>

      <label className="select-icone busca-larga"><Icone nome="busca" /><input placeholder="Buscar aluno, turma ou registro…" value={busca} onChange={mudar(setBusca)} /></label>
      <div className="filtros-historico">
        <label className="select-icone"><select value={pessoa} onChange={mudar(setPessoa)}><option value="">Todas as pessoas</option>{pessoas.map((p) => <option key={p} value={p}>{p === 'sistema' ? 'Sistema' : p}</option>)}</select></label>
        <label className="select-icone"><select value={area} onChange={mudar(setArea)}><option value="">Todas as áreas</option>{areas.map((a) => <option key={a} value={a}>{AREAS[a]?.nome ?? a}</option>)}</select></label>
        <label className="select-icone"><select value={acao} onChange={mudar(setAcao)}><option value="">Todas as ações</option><option value="INSERT">Criou</option><option value="UPDATE">Alterou</option><option value="DELETE">Apagou</option></select></label>
        <div className="filtro-datas"><span className="muted">De</span>
          <label className="select-icone"><Icone nome="agenda" tam={16} /><input type="date" value={de} onChange={mudar(setDe)} /></label>
          <span className="muted">Até</span>
          <label className="select-icone"><Icone nome="agenda" tam={16} /><input type="date" value={ate} onChange={mudar(setAte)} /></label>
        </div>
      </div>
      <label className="check" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
        <input type="checkbox" checked={tecnicas} onChange={(e) => { setTecnicas(e.target.checked); setPagina(1) }} /> Mostrar atualizações do sistema
        <span className="muted pequeno">({ocultas} registros automáticos: importação das planilhas, recálculos e sincronizações)</span>
      </label>
      <Erro msg={q.erro} />

      <div className="hist-grade">
        <section className="bloco">
          <h2>Atividades</h2>
          {visiveis.length === 0 && !q.carregando ? <Vazio>{tecnicas ? 'Nenhuma alteração com esses filtros.' : 'Nenhuma alteração feita pela equipe com esses filtros. Marque “Mostrar atualizações do sistema” para ver as automáticas.'}</Vazio> : visiveis.map(({ e, d, tecnica }) => {
            const dia = new Date(e.em).toLocaleDateString('sv-SE')
            const cab = dia !== diaAnterior ? (diaAnterior = dia, <div key={'d' + dia} className="hist-dia">{dia === hojeISO() ? 'Hoje · ' : ''}{dataBR(dia)}</div>) : null
            const ar = AREAS[e.tabela] ?? { nome: e.tabela, icone: 'documento', tom: 'neutro' }
            return (
              <div key={e.id}>
                {cab}
                <button className={`hist-item${sel?.id === e.id ? ' ativo' : ''}`} onClick={() => setSel(e)}>
                  <span className={`hist-icone hi-${ar.tom}`}><Icone nome={ar.icone} tam={18} /></span>
                  <span className="hist-hora"><b>{dataHoraBR(e.em).slice(-5)}</b><span>{tecnica ? 'Sistema' : e.usuario_nome}</span></span>
                  <span className="hist-texto"><b>{d.titulo}</b><span>{[d.sub, d.resumo].filter(Boolean).join(' · ') || '—'}</span></span>
                  {tecnica ? <Badge>Automático</Badge> : <Badge tom={ar.tom === 'roxo' ? 'info' : ar.tom === 'ouro' ? 'alerta' : ar.tom}>{ar.nome}</Badge>}
                  <Icone nome="seta" tam={16} />
                </button>
              </div>
            )
          })}
          {totalPag > 1 && <div className="paginacao">
            <span className="muted pequeno">{filtrados.length} registro(s)</span>
            <div className="acoes">
              <button className="btn btn-mini" disabled={pag === 1} onClick={() => setPagina(pag - 1)}><Icone nome="esquerda" tam={14} /> Anterior</button>
              <span className="muted pequeno">{pag} de {totalPag}</span>
              <button className="btn btn-mini" disabled={pag === totalPag} onClick={() => setPagina(pag + 1)}>Próximo <Icone nome="seta" tam={14} /></button>
            </div>
          </div>}
        </section>

        <aside className="bloco hist-detalhe">
          <h2>Detalhes da alteração</h2>
          {!sel || !selD ? <Vazio>Clique numa atividade para ver o antes e o depois.</Vazio> : (<>
            <div className="hist-det-topo">
              <span className={`hist-icone hi-${AREAS[sel.tabela]?.tom ?? 'neutro'}`}><Icone nome={AREAS[sel.tabela]?.icone ?? 'documento'} tam={20} /></span>
              <div><b>{selD.titulo}</b><div className="muted">{selD.sub || AREAS[sel.tabela]?.nome}</div></div>
            </div>
            <dl className="resumo">
              <dt>Quem</dt><dd>{sel.usuario_id ? sel.usuario_nome : 'Sistema'}</dd>
              <dt>Data e hora</dt><dd>{dataHoraBR(sel.em)}</dd>
              <dt>Origem</dt><dd>{sel.usuario_id ? 'Feito na tela do sistema' : 'Automático (importação, recálculo ou integração)'}</dd>
            </dl>
            {sel.acao === 'UPDATE' ? (selD.mudou.length === 0 ? <p className="muted pequeno">Só mudaram campos internos (sem efeito para a equipe).</p> : (
              <div className="antes-depois">
                {selD.mudou.map((k) => (
                  <div key={k} className="ad-linha">
                    <div className="ad-campo">{ROTULOS[k] ?? k}</div>
                    <div className="ad-antes"><span>Antes</span>{fmt(k, sel.antes?.[k], sel.tabela, ctx)}</div>
                    <div className="ad-depois"><span>Depois</span>{fmt(k, sel.depois?.[k], sel.tabela, ctx)}</div>
                  </div>
                ))}
              </div>
            )) : (
              <div className="antes-depois">
                {Object.entries(sel.depois ?? sel.antes ?? {}).filter(([k, v]) => !TECNICOS.has(k) && !k.endsWith('_por') && v !== null && v !== '' && k !== 'matricula_id').slice(0, 12).map(([k, v]) => (
                  <div key={k} className="ad-simples"><span>{ROTULOS[k] ?? k}</span><b>{fmt(k, v, sel.tabela, ctx)}</b></div>
                ))}
              </div>
            )}
            <div className="ad-motivo"><Icone nome="documento" tam={16} /><div><span className="muted pequeno">Motivo</span><div>{selD.motivo ?? 'Não informado'}</div></div></div>
            {selD.link && <Link to={selD.link} className="btn btn-ouro btn-bloco">Ver registro</Link>}
          </>)}
          <p className="muted pequeno"><Icone nome="info" tam={13} /> Registros do histórico não podem ser editados nem apagados, nem pela tela, nem pelo banco.</p>
        </aside>
      </div>
    </div>
  )
}
