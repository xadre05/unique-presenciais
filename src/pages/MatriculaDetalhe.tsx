import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, dataHoraBR, FORMAS, hojeISO, mesAno, ORIGENS, SITUACAO_ALUNO, SITUACAO_PARCELA, STATUS_COMISSAO, STATUS_MATRICULA, whatsLink } from '../lib/format'
import type { Aluno, MatriculaV, ParcelaV } from '../lib/types'
import { Badge, Campo, enviarArquivo, Erro, InputMoeda, Kpi, LinkArquivo, Modal } from '../components/ui'
import { useAuth } from '../auth'
import { contaPadrao } from './NovaMatricula'

export type Acao = { tipo: 'informar' | 'confirmar' | 'editar' | 'nova' | 'cancelar'; parcela?: ParcelaV }

export default function MatriculaDetalhe() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const cad = useCadastros()
  const mat = useConsulta<MatriculaV>(() => supabase.from('v_matriculas').select('*').eq('id', id!).single(), [id])
  const parcelas = useConsulta<ParcelaV[]>(() => supabase.from('v_parcelas').select('*').eq('matricula_id', id!).order('numero'), [id])
  const aluno = useConsulta<Aluno>(() => supabase.from('alunos').select('*').eq('id', mat.dados?.aluno_id ?? '00000000-0000-0000-0000-000000000000').maybeSingle(), [mat.dados?.aluno_id])
  const comissao = useConsulta<{ id: string; valor: number; status: string; competencia: string | null; observacao: string | null; vendedora_nome: string | null } | null>(
    () => supabase.from('v_comissoes').select('id,valor,status,competencia,observacao,vendedora_nome').eq('matricula_id', id!).maybeSingle(), [id])
  const hist = useConsulta<{ id: number; tabela: string; acao: string; usuario_nome: string; em: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }[]>(
    () => isAdmin ? supabase.from('historico').select('*').or(`registro_id.eq.${id},registro_id.in.(${(parcelas.dados ?? []).map((p) => p.id).join(',') || '00000000-0000-0000-0000-000000000000'})`).order('em', { ascending: false }).limit(60) : Promise.resolve({ data: [], error: null }),
    [id, isAdmin, parcelas.dados?.length])

  const [acao, setAcao] = useState<Acao | null>(null)
  const [editMat, setEditMat] = useState(false)
  const [editAluno, setEditAluno] = useState(false)
  const recarregarTudo = () => { mat.recarregar(); parcelas.recarregar(); comissao.recarregar(); hist.recarregar() }

  const m = mat.dados
  if (mat.erro) return <div className="pagina"><Erro msg={mat.erro} /></div>
  if (!m) return <div className="pagina muted">Carregando…</div>
  const s = SITUACAO_ALUNO[m.situacao_financeira]
  const ps = parcelas.dados ?? []

  const mudarComissao = async (status: string) => {
    if (!comissao.dados) return
    const { error } = await supabase.from('comissoes').update({ status }).eq('id', comissao.dados.id)
    if (error) alert(msgErro(error))
    recarregarTudo()
  }

  return (
    <div className="pagina">
      <div className="migalha"><Link to="/turmas">Turmas</Link> / <Link to={`/turmas/${m.turma_id}`}>{m.turma_nome}</Link> / {m.aluno_nome}</div>
      <header className="pagina-topo">
        <div>
          <h1>{m.aluno_nome}</h1>
          <p className="muted">{m.turma_nome} · vendido por {m.vendedora_nome ?? '—'} em {dataBR(m.data_venda)} · {ORIGENS[m.origem]}</p>
          <p><Badge tom={s?.tom}>{s?.rotulo}</Badge> <Badge>{STATUS_MATRICULA[m.status]}</Badge> {m.contrato_assinado ? <Badge tom="ok">contrato assinado</Badge> : <Badge tom="alerta">contrato pendente</Badge>}</p>
          {m.observacoes && <p className="nota">{m.observacoes}</p>}
        </div>
        <div className="acoes">
          {whatsLink(m.aluno_whatsapp) && <a className="btn" href={whatsLink(m.aluno_whatsapp)!} target="_blank" rel="noreferrer">WhatsApp</a>}
          <button className="btn" onClick={() => setEditMat(true)}>Editar matrícula</button>
        </div>
      </header>

      <section className="kpis">
        <Kpi rotulo="Valor fechado" valor={brl(m.valor_fechado)} />
        <Kpi rotulo="Recebido" valor={brl(m.recebido)} tom="ok" sub={`${m.parcelas_pagas} de ${m.parcelas_total} parcelas`} />
        <Kpi rotulo="Aguardando conferência" valor={brl(m.aguardando_conferencia)} tom="info" />
        <Kpi rotulo="A receber" valor={brl(m.a_receber)} sub={m.proximo_vencimento ? `próximo: ${dataBR(m.proximo_vencimento)}` : undefined} />
        <Kpi rotulo="Atrasado" valor={brl(m.atrasado)} tom="erro" sub={m.parcelas_atrasadas ? `${m.parcelas_atrasadas} parcela(s)` : undefined} />
      </section>

      <section className="bloco">
        <div className="bloco-topo"><h2>Pagamentos</h2><button className="btn" onClick={() => setAcao({ tipo: 'nova' })}>+ Adicionar parcela</button></div>
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>#</th><th>Forma / conta</th><th>Vencimento</th><th className="num">Valor</th><th className="num">Recebido</th><th>Situação</th><th>Comprovante</th><th></th></tr></thead>
            <tbody>
              {ps.map((p) => {
                const sp = SITUACAO_PARCELA[p.situacao]
                return (
                  <tr key={p.id} className={p.status === 'cancelada' ? 'linha-apagada' : ''}>
                    <td>{p.numero}/{p.total_parcelas}{p.eh_matricula && <div className="muted pequeno">matrícula</div>}</td>
                    <td>{FORMAS[p.forma]}<div className="muted pequeno">{p.conta_nome ?? 'conta não informada'}</div></td>
                    <td>{dataBR(p.vencimento)}{p.dias_atraso > 0 && <div className="erro-txt pequeno">{p.dias_atraso} dias de atraso</div>}</td>
                    <td className="num">{brl(p.valor)}</td>
                    <td className="num">{p.valor_recebido !== null ? <>{brl(p.valor_recebido)}<div className="muted pequeno">{dataBR(p.data_recebimento)}</div></> : '—'}</td>
                    <td><Badge tom={sp?.tom}>{sp?.rotulo}</Badge>{p.observacao && <div className="muted pequeno obs" title={p.observacao}>{p.observacao}</div>}</td>
                    <td>{p.comprovante ? <LinkArquivo caminho={p.comprovante}>ver</LinkArquivo> : '—'}</td>
                    <td><div className="acoes-linha">
                      {p.status === 'prevista' && <button className="btn btn-mini" onClick={() => setAcao({ tipo: 'informar', parcela: p })}>Informar pagamento</button>}
                      {isAdmin && (p.status === 'informada' || p.status === 'prevista') && <button className="btn btn-mini btn-ouro" onClick={() => setAcao({ tipo: 'confirmar', parcela: p })}>Confirmar recebido</button>}
                      {(p.status !== 'confirmada' || isAdmin) && p.status !== 'cancelada' && <button className="btn btn-mini" onClick={() => setAcao({ tipo: 'editar', parcela: p })}>Editar</button>}
                      {p.status !== 'confirmada' && p.status !== 'cancelada' && <button className="btn btn-mini" onClick={() => setAcao({ tipo: 'cancelar', parcela: p })}>Cancelar</button>}
                      {isAdmin && p.status === 'cancelada' && <button className="btn btn-mini" onClick={async () => {
                        const { error } = await supabase.from('parcelas').update({ status: 'prevista', observacao: 'Reaberta | ' + (p.observacao ?? '') }).eq('id', p.id)
                        if (error) alert(msgErro(error)); recarregarTudo()
                      }}>Reabrir</button>}
                    </div></td>
                  </tr>
                )
              })}
              {ps.length === 0 && <tr><td colSpan={8} className="muted">Nenhum pagamento lançado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grade-2">
        <section className="bloco">
          <div className="bloco-topo"><h2>Dados do aluno</h2><button className="btn btn-mini" onClick={() => setEditAluno(true)}>Editar</button></div>
          {aluno.dados && (
            <dl className="dados">
              <dt>WhatsApp</dt><dd>{aluno.dados.whatsapp ?? '—'}</dd>
              <dt>E-mail</dt><dd>{aluno.dados.email ?? '—'}</dd>
              <dt>CPF</dt><dd>{aluno.dados.cpf ?? '—'}</dd>
              <dt>RG</dt><dd>{aluno.dados.rg ?? '—'}</dd>
              <dt>Conselho</dt><dd>{aluno.dados.conselho ?? '—'}</dd>
              <dt>Instagram</dt><dd>{aluno.dados.instagram ?? '—'}</dd>
              <dt>Jaleco</dt><dd>{aluno.dados.tamanho_jaleco ?? '—'}</dd>
            </dl>
          )}
        </section>
        <section className="bloco">
          <h2>{isAdmin || comissao.dados ? 'Contrato e comissão' : 'Contrato'}</h2>
          <p>Contrato: {m.contrato_assinado ? <Badge tom="ok">assinado</Badge> : <Badge tom="alerta">pendente</Badge>} {m.contrato_arquivo && <LinkArquivo caminho={m.contrato_arquivo}>abrir arquivo</LinkArquivo>}</p>
          {comissao.dados ? (
            <div className="comissao-box">
              <div>Comissão de <b>{comissao.dados.vendedora_nome}</b>: <b>{brl(comissao.dados.valor)}</b> <Badge tom={STATUS_COMISSAO[comissao.dados.status]?.tom}>{STATUS_COMISSAO[comissao.dados.status]?.rotulo}</Badge>
                {comissao.dados.competencia && <span className="muted"> · pagar em {mesAno(comissao.dados.competencia)}</span>}</div>
              {comissao.dados.observacao && <div className="muted pequeno">{comissao.dados.observacao}</div>}
              {m.status === 'reservada' && comissao.dados.status === 'pendente' && <div className="muted pequeno">Só a matrícula foi paga: normalmente a comissão espera a inscrição ser confirmada.</div>}
              {isAdmin && (
                <div className="acoes">
                  {comissao.dados.status === 'pendente' && <button className="btn btn-mini btn-ouro" onClick={() => mudarComissao('liberada')}>Liberar (paga no mês que vem)</button>}
                  {comissao.dados.status === 'liberada' && <button className="btn btn-mini btn-ouro" onClick={() => mudarComissao('paga')}>Marcar como paga</button>}
                  {comissao.dados.status === 'liberada' && <button className="btn btn-mini" onClick={() => mudarComissao('pendente')}>Voltar para pendente</button>}
                  {comissao.dados.status !== 'paga' && comissao.dados.status !== 'cancelada' && <button className="btn btn-mini" onClick={() => mudarComissao('cancelada')}>Cancelar comissão</button>}
                </div>
              )}
            </div>
          ) : isAdmin ? <p className="muted">Sem comissão (venda sem vendedora ou não é venda).</p> : null}
        </section>
      </div>

      {isAdmin && (
        <section className="bloco">
          <h2>Histórico de alterações</h2>
          <Historia itens={hist.dados ?? []} />
        </section>
      )}

      <AcaoParcela acao={acao} matriculaId={m.id} totalParcelas={ps.length} contas={cad.contas} isAdmin={isAdmin} onFechar={() => setAcao(null)} onSalvo={() => { setAcao(null); recarregarTudo() }} />
      <EditarMatricula aberto={editMat} m={m} isAdmin={isAdmin} vendedoras={cad.vendedoras} turmas={cad.turmas} onFechar={() => setEditMat(false)} onSalvo={() => { setEditMat(false); recarregarTudo() }} />
      {aluno.dados && <EditarAluno aberto={editAluno} a={aluno.dados} onFechar={() => setEditAluno(false)} onSalvo={() => { setEditAluno(false); aluno.recarregar(); mat.recarregar() }} />}
    </div>
  )
}

const NOMES_CAMPO: Record<string, string> = {
  status: 'situação', valor: 'valor', valor_recebido: 'valor recebido', data_recebimento: 'data do recebimento', vencimento: 'vencimento', forma: 'forma',
  conta_id: 'conta', comprovante: 'comprovante', observacao: 'observação', valor_fechado: 'valor fechado', vendedora_id: 'vendedora', turma_id: 'turma',
  contrato_assinado: 'contrato assinado', contrato_arquivo: 'arquivo do contrato', observacoes: 'observações', nome: 'nome', whatsapp: 'WhatsApp', email: 'e-mail',
  cpf: 'CPF', data_venda: 'data da venda', origem: 'tipo', motivo_cancelamento: 'motivo do cancelamento', competencia: 'mês de pagamento', papel: 'papel',
  data_inicio: 'início', data_fim: 'fim', vagas: 'vagas', numero: 'número', informado_por: 'informado por', confirmado_por: 'confirmado por', liberada_em: 'liberada em', paga_em: 'paga em',
}
const TABELAS: Record<string, string> = { parcelas: 'Pagamento', matriculas: 'Matrícula', alunos: 'Aluno', comissoes: 'Comissão', turmas: 'Turma', perfis: 'Acesso', vendedoras: 'Vendedora', cursos: 'Curso', contas: 'Conta', encontros: 'Data de curso', links_pagamento: 'Link de pagamento' }

export function Historia({ itens }: { itens: { id: number; tabela: string; acao: string; usuario_nome: string; em: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }[] }) {
  if (!itens.length) return <p className="muted">Sem alterações registradas.</p>
  const fmt = (v: unknown) => v === null || v === undefined || v === '' ? 'vazio' : typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v)
  return (
    <ul className="historia">
      {itens.map((h) => {
        let detalhe = ''
        if (h.acao === 'UPDATE' && h.antes && h.depois) {
          const mud = Object.keys(h.depois).filter((k) => k !== 'criado_em' && JSON.stringify(h.antes![k]) !== JSON.stringify(h.depois![k]))
          detalhe = mud.map((k) => `${NOMES_CAMPO[k] ?? k}: ${fmt(h.antes![k])} → ${fmt(h.depois![k])}`).join(' · ')
          if (!detalhe) return null
        } else if (h.acao === 'INSERT') {
          const d = h.depois ?? {}
          detalhe = d.nome ? String(d.nome) : d.valor !== undefined ? `${fmt(d.status)} · ${brl(d.valor as number)}${d.numero ? ` · parcela ${d.numero}` : ''}` : ''
        }
        return (
          <li key={h.id}>
            <span className="muted pequeno">{dataHoraBR(h.em)}</span> <b>{h.usuario_nome}</b> {h.acao === 'INSERT' ? 'criou' : h.acao === 'UPDATE' ? 'alterou' : 'apagou'} <i>{TABELAS[h.tabela] ?? h.tabela}</i>
            {detalhe && <div className="pequeno">{detalhe}</div>}
          </li>
        )
      })}
    </ul>
  )
}

export function AcaoParcela({ acao, matriculaId, totalParcelas, contas, isAdmin, onFechar, onSalvo }: {
  acao: Acao | null; matriculaId: string; totalParcelas: number; contas: { id: string; nome: string; tipo: string; ativa: boolean }[]; isAdmin: boolean; onFechar: () => void; onSalvo: () => void
}) {
  const p = acao?.parcela
  const [chave, setChave] = useState<string>('')
  const [valor, setValor] = useState<number | null>(null)
  const [recebido, setRecebido] = useState<number | null>(null)
  const [data, setData] = useState(hojeISO())
  const [venc, setVenc] = useState('')
  const [forma, setForma] = useState('pix')
  const [conta, setConta] = useState('')
  const [obs, setObs] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const k = acao ? acao.tipo + (p?.id ?? '') : ''
  if (k !== chave) {
    setChave(k); setErro(null); setArquivo(null)
    setValor(p?.valor ?? null); setRecebido(p?.valor_recebido ?? p?.valor ?? null)
    setData(p?.data_recebimento ?? hojeISO()); setVenc(p?.vencimento ?? hojeISO())
    setForma(p?.forma ?? 'pix'); setConta(p?.conta_id ?? ''); setObs(acao?.tipo === 'cancelar' ? '' : p?.observacao ?? '')
  }
  if (!acao) return null

  const titulos = { informar: 'Informar pagamento recebido', confirmar: 'Confirmar recebimento (conferido no extrato)', editar: 'Editar parcela', nova: 'Adicionar parcela', cancelar: 'Cancelar parcela' }
  const salvar = async () => {
    setErro(null); setSalvando(true)
    try {
      let comprovante = p?.comprovante ?? null
      if (arquivo) comprovante = await enviarArquivo(`comprovantes/${matriculaId}`, arquivo)
      if (acao.tipo === 'informar') {
        if (!recebido) throw new Error('Informe o valor recebido.')
        if ((forma === 'pix' || forma === 'transferencia') && !comprovante) throw new Error('Anexe o comprovante do Pix.')
        const { error } = await supabase.from('parcelas').update({ status: 'informada', valor_recebido: recebido, data_recebimento: data, forma, conta_id: conta || null, comprovante, observacao: obs || null }).eq('id', p!.id)
        if (error) throw error
      } else if (acao.tipo === 'confirmar') {
        if (!recebido) throw new Error('Informe o valor que entrou na conta.')
        const { error } = await supabase.from('parcelas').update({ status: 'confirmada', valor_recebido: recebido, data_recebimento: data, conta_id: conta || null, comprovante, observacao: obs || null }).eq('id', p!.id)
        if (error) throw error
      } else if (acao.tipo === 'editar') {
        if (valor === null) throw new Error('Informe o valor.')
        const upd: Record<string, unknown> = { valor, vencimento: venc || null, forma, conta_id: conta || null, comprovante, observacao: obs || null }
        if (p!.status !== 'prevista') { upd.valor_recebido = recebido; upd.data_recebimento = data }
        const { error } = await supabase.from('parcelas').update(upd).eq('id', p!.id)
        if (error) throw error
      } else if (acao.tipo === 'nova') {
        if (!valor) throw new Error('Informe o valor.')
        const { error } = await supabase.from('parcelas').insert({ matricula_id: matriculaId, numero: totalParcelas + 1, total_parcelas: totalParcelas + 1, forma, conta_id: conta || null, valor, vencimento: venc || null, status: 'prevista', observacao: obs || null })
        if (error) throw error
      } else if (acao.tipo === 'cancelar') {
        if (obs.trim().length < 3) throw new Error('Escreva o motivo do cancelamento.')
        const { error } = await supabase.from('parcelas').update({ status: 'cancelada', observacao: 'Cancelada: ' + obs.trim() }).eq('id', p!.id)
        if (error) throw error
      }
      onSalvo()
    } catch (e) { setErro(msgErro(e)) } finally { setSalvando(false) }
  }

  const selConta = (
    <Campo rotulo="Conta onde o dinheiro caiu">
      <select value={conta} onChange={(e) => setConta(e.target.value)}>
        <option value="">Não informada</option>
        {contas.filter((c) => c.ativa || c.id === conta).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </Campo>
  )
  const selForma = (
    <Campo rotulo="Forma"><select value={forma} onChange={(e) => { setForma(e.target.value); if (!conta) setConta(contaPadrao(e.target.value, contas)) }}>{Object.entries(FORMAS).map(([k2, v]) => <option key={k2} value={k2}>{v}</option>)}</select></Campo>
  )

  return (
    <Modal titulo={titulos[acao.tipo]} aberto onFechar={onFechar}>
      {p && <p className="muted">Parcela {p.numero}/{p.total_parcelas} · valor {brl(p.valor)} · vencimento {dataBR(p.vencimento)}</p>}
      {acao.tipo === 'cancelar' ? (
        <Campo rotulo="Motivo do cancelamento"><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} autoFocus /></Campo>
      ) : (
        <div className="form-grade">
          {(acao.tipo === 'editar' || acao.tipo === 'nova') && <Campo rotulo="Valor da parcela"><InputMoeda valor={valor} onChange={setValor} /></Campo>}
          {(acao.tipo === 'editar' || acao.tipo === 'nova') && <Campo rotulo="Vencimento"><input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></Campo>}
          {(acao.tipo === 'informar' || acao.tipo === 'confirmar' || (acao.tipo === 'editar' && p?.status !== 'prevista')) && <>
            <Campo rotulo={acao.tipo === 'confirmar' ? 'Valor que entrou na conta' : 'Valor recebido'} dica={acao.tipo === 'confirmar' ? 'Na Hotmart, o líquido repassado.' : undefined}><InputMoeda valor={recebido} onChange={setRecebido} /></Campo>
            <Campo rotulo="Data do recebimento"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          </>}
          {acao.tipo !== 'confirmar' && selForma}
          {selConta}
        </div>
      )}
      {acao.tipo !== 'cancelar' && <>
        <Campo rotulo="Comprovante" dica={p?.comprovante ? 'Já existe um comprovante. Enviar outro substitui.' : 'Foto ou PDF'}><input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
        <Campo rotulo="Observação"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </>}
      {acao.tipo === 'informar' && !isAdmin && <p className="nota">O pagamento fica como "aguardando conferência" até o administrador conferir no extrato.</p>}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Voltar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}

function EditarMatricula({ aberto, m, isAdmin, vendedoras, turmas, onFechar, onSalvo }: {
  aberto: boolean; m: MatriculaV; isAdmin: boolean; vendedoras: { id: string; nome: string; ativa: boolean }[]; turmas: { id: string; nome: string; status: string }[]; onFechar: () => void; onSalvo: () => void
}) {
  const [f, setF] = useState<Partial<MatriculaV>>(m)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto0, setAberto0] = useState(false)
  if (aberto !== aberto0) { setAberto0(aberto); if (aberto) { setF(m); setArquivo(null); setErro(null) } }
  if (!aberto) return null
  const set = (k: keyof MatriculaV, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const salvar = async () => {
    setErro(null)
    try {
      if (f.status === 'cancelada' && !f.motivo_cancelamento?.trim()) throw new Error('Escreva o motivo do cancelamento.')
      let contrato = f.contrato_arquivo ?? null
      if (arquivo) contrato = await enviarArquivo(`contratos/${m.id}`, arquivo)
      const { error } = await supabase.from('matriculas').update({
        turma_id: f.turma_id, vendedora_id: f.vendedora_id || null, data_venda: f.data_venda, valor_fechado: f.valor_fechado, origem: f.origem, status: f.status,
        contrato_assinado: !!(f.contrato_assinado || arquivo), contrato_arquivo: contrato, motivo_cancelamento: f.motivo_cancelamento || null, observacoes: f.observacoes || null,
      }).eq('id', m.id)
      if (error) throw error
      onSalvo()
    } catch (e) { setErro(msgErro(e)) }
  }
  return (
    <Modal titulo="Editar matrícula" aberto onFechar={onFechar} largo>
      <div className="form-grade">
        <Campo rotulo="Turma" dica="Trocar de turma aqui registra no histórico"><select value={f.turma_id} onChange={(e) => set('turma_id', e.target.value)}>{turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></Campo>
        <Campo rotulo="Quem vendeu" dica={isAdmin ? undefined : 'Só o administrador troca quem vendeu'}><select value={f.vendedora_id ?? ''} disabled={!isAdmin} onChange={(e) => set('vendedora_id', e.target.value)}><option value="">Ninguém</option>{vendedoras.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></Campo>
        <Campo rotulo="Data da venda"><input type="date" value={f.data_venda ?? ''} onChange={(e) => set('data_venda', e.target.value)} /></Campo>
        <Campo rotulo="Valor fechado"><InputMoeda valor={f.valor_fechado !== undefined ? Number(f.valor_fechado) : null} onChange={(v) => set('valor_fechado', v ?? 0)} /></Campo>
        <Campo rotulo="Tipo"><select value={f.origem} onChange={(e) => set('origem', e.target.value)}>{Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo rotulo="Inscrição"><select value={f.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(STATUS_MATRICULA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
      </div>
      {f.status === 'cancelada' && <Campo rotulo="Motivo do cancelamento"><input value={f.motivo_cancelamento ?? ''} onChange={(e) => set('motivo_cancelamento', e.target.value)} /></Campo>}
      <label className="check"><input type="checkbox" checked={!!f.contrato_assinado} onChange={(e) => set('contrato_assinado', e.target.checked)} /> Contrato assinado</label>
      <Campo rotulo="Arquivo do contrato" dica={m.contrato_arquivo ? 'Já existe um arquivo. Enviar outro substitui.' : 'PDF assinado'}><input type="file" accept="application/pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
      <Campo rotulo="Observações"><textarea rows={3} value={f.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Voltar</button><button className="btn btn-ouro" onClick={salvar}>Salvar</button></div>
    </Modal>
  )
}

export function EditarAluno({ aberto, a, onFechar, onSalvo }: { aberto: boolean; a: Aluno; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<Aluno>(a)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto0, setAberto0] = useState(false)
  if (aberto !== aberto0) { setAberto0(aberto); if (aberto) { setF(a); setErro(null) } }
  if (!aberto) return null
  const campos: [keyof Aluno, string][] = [['nome', 'Nome completo'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['cpf', 'CPF'], ['rg', 'RG'], ['conselho', 'Conselho'], ['instagram', 'Instagram'], ['cidade', 'Cidade'], ['uf', 'UF'], ['tamanho_jaleco', 'Tamanho do jaleco']]
  const salvar = async () => {
    if (!f.nome?.trim()) return setErro('O nome não pode ficar vazio.')
    const { id, ...resto } = f
    const { error } = await supabase.from('alunos').update(resto).eq('id', id)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo="Dados do aluno" aberto onFechar={onFechar} largo>
      <div className="form-grade">
        {campos.map(([k, r]) => <Campo key={k} rotulo={r}><input value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Campo>)}
      </div>
      <Campo rotulo="Observações"><textarea rows={2} value={f.observacoes ?? ''} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Voltar</button><button className="btn btn-ouro" onClick={salvar}>Salvar</button></div>
    </Modal>
  )
}
