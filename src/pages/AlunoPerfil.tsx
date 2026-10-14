import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, SITUACAO_ALUNO, STATUS_MATRICULA } from '../lib/format'
import type { Aluno, MatriculaV } from '../lib/types'
import { Badge, Erro, LinkArquivo, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import { EditarAluno, Historia } from './MatriculaDetalhe'
import { BotaoWhats, pior } from './Alunos'
import { turmaCurta } from './Agenda'

type Hist = Parameters<typeof Historia>[0]['itens']

export default function AlunoPerfil() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const cad = useCadastros()
  const aluno = useConsulta<Aluno>(() => supabase.from('alunos').select('*').eq('id', id!).single(), [id])
  const mats = useConsulta<MatriculaV[]>(() => supabase.from('v_matriculas').select('*').eq('aluno_id', id!).order('data_venda', { ascending: false }), [id])
  const ms = mats.dados ?? []
  const hist = useConsulta<Hist>(() => isAdmin && ms.length
    ? supabase.from('historico').select('*').in('registro_id', [id!, ...ms.map((m) => m.id)]).order('em', { ascending: false }).limit(40)
    : Promise.resolve({ data: [], error: null }), [id, ms.length, isAdmin])
  const [editando, setEditando] = useState(false)

  const a = aluno.dados
  if (aluno.erro) return <div className="pagina"><Erro msg={aluno.erro} /></div>
  if (!a) return <div className="pagina muted">Carregando…</div>

  const ativas = ms.filter((m) => m.status !== 'cancelada' && m.status !== 'transferida')
  const situacao = pior(ms)
  const soma = (k: keyof MatriculaV) => ativas.reduce((s, m) => s + Number(m[k] ?? 0), 0)
  const cursosFeitos = new Set(ativas.map((m) => m.curso_nome))
  const naoFez = cad.cursos.filter((c) => !cursosFeitos.has(c.nome))

  return (
    <div className="pagina">
      <div className="migalha"><Link to="/alunos">Alunos</Link> / {a.nome}</div>
      <header className="pagina-topo">
        <div>
          <h1>{a.nome}</h1>
          <p className="muted">{ativas.length} curso(s) · <Badge tom={SITUACAO_ALUNO[situacao]?.tom}>{SITUACAO_ALUNO[situacao]?.rotulo}</Badge></p>
        </div>
        <div className="acoes">
          <BotaoWhats tel={a.whatsapp} />
          <button className="btn" onClick={() => setEditando(true)}>Editar dados</button>
          <Link to="/matricula/nova" className="btn btn-ouro"><Icone nome="mais" tam={16} /> Nova matrícula</Link>
        </div>
      </header>

      <div className="perfil-grade">
        <div>
          <section className="bloco">
            <h2><Icone nome="livro" className="ouro" /> Cursos e matrículas</h2>
            {ms.length === 0 ? <Vazio>Nenhuma matrícula.</Vazio> : (
              <ul className="lista">
                {ms.map((m) => {
                  const s = SITUACAO_ALUNO[m.situacao_financeira]
                  return (
                    <li key={m.id} className={m.status === 'cancelada' ? 'linha-apagada' : ''}>
                      <div>
                        <Link to={`/matricula/${m.id}`} className="forte link-ouro">{turmaCurta(m.turma_nome)}</Link>
                        <div className="muted pequeno">{STATUS_MATRICULA[m.status]} · vendido por {m.vendedora_nome ?? '—'} em {dataBR(m.data_venda)}</div>
                        <div className="pequeno">{m.contrato_assinado ? (m.contrato_arquivo ? <LinkArquivo caminho={m.contrato_arquivo}>contrato assinado</LinkArquivo> : <span className="ok-txt">contrato assinado</span>) : <span className="alerta-txt">contrato pendente</span>}</div>
                      </div>
                      <div className="direita">
                        <div className="forte num-txt">{brl(m.valor_fechado)}</div>
                        <Badge tom={s?.tom}>{s?.rotulo}</Badge>
                        {Number(m.a_receber) > 0 && <div className="muted pequeno">falta {brl(m.a_receber)}</div>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="bloco">
            <h2><Icone nome="pagamentos" className="ouro" /> Financeiro (todas as matrículas ativas)</h2>
            <dl className="resumo">
              <dt>Valor fechado</dt><dd>{brl(soma('valor_fechado'))}</dd>
              <dt>Recebido (líquido, conferido)</dt><dd className="ok-txt">{brl(soma('recebido'))}</dd>
              {soma('diferenca_taxas') > 0.01 && <><dt>Taxas e juros da Hotmart</dt><dd>{brl(soma('diferenca_taxas'))}</dd></>}
              {soma('considerado_pago') > 0 && <><dt>Considerado pago na virada (sem comprovante)</dt><dd className="alerta-txt">{brl(soma('considerado_pago'))}</dd></>}
              {soma('aguardando_conferencia') > 0 && <><dt>Aguardando conferência</dt><dd className="info-txt">{brl(soma('aguardando_conferencia'))}</dd></>}
              <dt>A receber</dt><dd>{brl(soma('a_receber'))}</dd>
              {soma('atrasado') > 0 && <><dt>Em atraso</dt><dd className="erro-txt">{brl(soma('atrasado'))}</dd></>}
            </dl>
            <p className="muted pequeno">O detalhe de cada parcela está na matrícula.</p>
          </section>

          {isAdmin && (
            <section className="bloco">
              <h2><Icone nome="historico" className="ouro" /> Histórico</h2>
              {(hist.dados ?? []).length === 0 ? <Vazio>Sem alterações registradas.</Vazio> : <Historia itens={hist.dados ?? []} />}
            </section>
          )}
        </div>

        <aside>
          <section className="bloco">
            <h2><Icone nome="usuario" className="ouro" /> Contato e documentos</h2>
            <dl className="dados">
              <dt>WhatsApp</dt><dd>{a.whatsapp ?? '—'}</dd>
              <dt>E-mail</dt><dd>{a.email ?? '—'}</dd>
              <dt>Instagram</dt><dd>{a.instagram ?? '—'}</dd>
              <dt>CPF</dt><dd>{a.cpf ?? '—'}</dd>
              <dt>RG</dt><dd>{a.rg ?? '—'}</dd>
              <dt>Conselho</dt><dd>{a.conselho ?? '—'}</dd>
              <dt>Cidade</dt><dd>{[a.cidade, a.uf].filter(Boolean).join(' / ') || '—'}</dd>
              <dt>Jaleco</dt><dd>{a.tamanho_jaleco ?? '—'}</dd>
            </dl>
            {a.observacoes && <p className="nota pequeno">{a.observacoes}</p>}
          </section>

          <section className="bloco">
            <h2><Icone nome="sacola" className="ouro" /> Próxima venda</h2>
            <p className="muted pequeno">Já fez: {[...cursosFeitos].join(', ') || 'nenhum curso presencial'}.</p>
            {naoFez.length === 0 ? <p className="ok-txt pequeno">Já fez todos os cursos presenciais ativos.</p> : (
              <ul className="lista">
                {naoFez.map((c) => <li key={c.id}><span>{c.nome}</span><Link to="/matricula/nova" className="btn btn-contorno btn-mini">Oferecer</Link></li>)}
              </ul>
            )}
          </section>
        </aside>
      </div>
      <EditarAluno aberto={editando} a={a} onFechar={() => setEditando(false)} onSalvo={() => { setEditando(false); aluno.recarregar(); mats.recarregar() }} />
    </div>
  )
}
