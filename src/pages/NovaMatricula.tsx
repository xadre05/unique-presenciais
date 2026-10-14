import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros } from '../lib/dados'
import { brl, dataBR, FORMAS, hojeISO, ORIGENS, somaMeses } from '../lib/format'
import type { Aluno } from '../lib/types'
import { Campo, enviarArquivo, Erro, InputMoeda, InputNumero } from '../components/ui'
import { useAuth } from '../auth'

type Linha = { numero: number; total: number; eh_matricula: boolean; forma: string; conta_id: string; valor: number; vencimento: string; pago: boolean }

export const contaPadrao = (forma: string, contas: { id: string; nome: string; tipo: string }[]) => {
  if (forma === 'pix' || forma === 'transferencia' || forma === 'boleto') return contas.find((c) => c.tipo === 'banco')?.id ?? ''
  if (forma === 'dinheiro') return contas.find((c) => c.tipo === 'especie')?.id ?? ''
  if (forma.startsWith('hotmart')) return contas.find((c) => c.nome.includes('Unique HOF'))?.id ?? ''
  return ''
}

export default function NovaMatricula() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { perfil, isAdmin } = useAuth()
  const { contas, vendedoras, turmas } = useCadastros()

  // aluno
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Aluno[]>([])
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [novo, setNovo] = useState<Partial<Aluno>>({})
  const [criandoNovo, setCriandoNovo] = useState(false)

  // matrícula
  const [turmaId, setTurmaId] = useState(params.get('turma') ?? '')
  const [vendedoraId, setVendedoraId] = useState('')
  const [dataVenda, setDataVenda] = useState(hojeISO())
  const [valor, setValor] = useState<number | null>(null)
  const [origem, setOrigem] = useState('venda')
  const [obs, setObs] = useState('')

  // plano
  const [temEntrada, setTemEntrada] = useState(false)
  const [entrada, setEntrada] = useState<number | null>(null)
  const [entradaData, setEntradaData] = useState(hojeISO())
  const [entradaForma, setEntradaForma] = useState('pix')
  const [entradaPaga, setEntradaPaga] = useState(true)
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [nParc, setNParc] = useState(1)
  const [parcForma, setParcForma] = useState('pix')
  const [primeiroVenc, setPrimeiroVenc] = useState(hojeISO())
  const [primeiraPaga, setPrimeiraPaga] = useState(false)

  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const minhaVendedora = perfil ? vendedoras.find((v) => v.perfil_id === perfil.id) : undefined
  useEffect(() => {
    if (!vendedoraId && minhaVendedora) setVendedoraId(minhaVendedora.id)
  }, [minhaVendedora, vendedoraId])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busca.trim().length < 2) return setAchados([])
      const s = busca.trim()
      const { data } = await supabase.from('alunos').select('*').or(`nome.ilike.%${s}%,email.ilike.%${s}%,cpf.ilike.%${s}%`).limit(8)
      setAchados((data as Aluno[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [busca])

  const linhas: Linha[] = useMemo(() => {
    const out: Linha[] = []
    const v = valor ?? 0
    const e = temEntrada ? entrada ?? 0 : 0
    const resto = Math.max(0, Math.round((v - e) * 100) / 100)
    const total = nParc + (temEntrada ? 1 : 0)
    if (temEntrada) out.push({ numero: 1, total, eh_matricula: true, forma: entradaForma, conta_id: contaPadrao(entradaForma, contas), valor: e, vencimento: entradaData, pago: entradaPaga })
    const base = Math.floor((resto / nParc) * 100) / 100
    for (let i = 0; i < nParc; i++) {
      const val = i === nParc - 1 ? Math.round((resto - base * (nParc - 1)) * 100) / 100 : base
      out.push({ numero: out.length + 1, total, eh_matricula: false, forma: parcForma, conta_id: contaPadrao(parcForma, contas), valor: val, vencimento: somaMeses(primeiroVenc, i), pago: i === 0 && primeiraPaga })
    }
    return out
  }, [valor, temEntrada, entrada, entradaData, entradaForma, entradaPaga, nParc, parcForma, primeiroVenc, primeiraPaga, contas])

  const turmaSel = turmas.find((t) => t.id === turmaId)

  const salvar = async () => {
    setErro(null)
    const nomeNovo = novo.nome?.trim()
    if (!aluno && !nomeNovo) return setErro('Escolha um aluno já cadastrado ou cadastre um novo.')
    if (!aluno && !novo.whatsapp?.trim()) return setErro('Informe o WhatsApp do aluno.')
    if (!turmaId) return setErro('Escolha a turma.')
    if (!isAdmin && !minhaVendedora) return setErro('Seu login ainda não está ligado a uma vendedora. Peça ao administrador para fazer isso em Equipe e cadastros.')
    if (origem === 'venda' && !vendedoraId) return setErro('Escolha quem vendeu (é por isso que a comissão é calculada).')
    if (valor === null) return setErro('Informe o valor fechado.')
    if (temEntrada && (entrada ?? 0) <= 0) return setErro('Informe o valor da entrada/matrícula.')
    if (temEntrada && (entrada ?? 0) > valor) return setErro('A entrada é maior que o valor fechado.')
    if (linhas.some((l) => l.pago && (l.forma === 'pix' || l.forma === 'transferencia')) && !comprovante) return setErro('Para pagamento por Pix já feito, anexe o comprovante.')
    setSalvando(true)
    try {
      let alunoId = aluno?.id
      if (!alunoId) {
        const { data, error } = await supabase.from('alunos').insert({ ...novo, nome: nomeNovo }).select('id').single()
        if (error) throw error
        alunoId = data.id
      }
      const algumPago = linhas.some((l) => l.pago)
      const status = algumPago && linhas.some((l) => l.pago && !l.eh_matricula) ? 'confirmada' : 'reservada'
      const { data: m, error: em } = await supabase.from('matriculas').insert({
        aluno_id: alunoId, turma_id: turmaId, vendedora_id: vendedoraId || null, data_venda: dataVenda, valor_fechado: valor, origem, status, observacoes: obs || null,
      }).select('id').single()
      if (em) throw em
      let caminho: string | null = null
      if (comprovante) caminho = await enviarArquivo(`comprovantes/${m.id}`, comprovante)
      let usouComprovante = false
      const regs = linhas.filter((l) => l.valor > 0).map((l) => {
        const anexo = l.pago && !usouComprovante && caminho ? caminho : null
        if (anexo) usouComprovante = true
        return {
          matricula_id: m.id, numero: l.numero, total_parcelas: l.total, eh_matricula: l.eh_matricula, forma: l.forma, conta_id: l.conta_id || null,
          valor: l.valor, vencimento: l.vencimento, status: l.pago ? 'informada' : 'prevista',
          valor_recebido: l.pago ? l.valor : null, data_recebimento: l.pago ? l.vencimento : null, comprovante: anexo,
        }
      })
      if (regs.length) {
        const { error: ep } = await supabase.from('parcelas').insert(regs)
        if (ep) throw ep
      }
      nav(`/matricula/${m.id}`)
    } catch (e) {
      setErro(msgErro(e))
    } finally { setSalvando(false) }
  }

  const soma = linhas.reduce((s, l) => s + l.valor, 0)

  return (
    <div className="pagina estreita">
      <div className="migalha"><Link to="/turmas">Turmas</Link> / Nova matrícula</div>
      <h1>Nova matrícula</h1>

      <section className="bloco">
        <h2>1. Aluno</h2>
        {aluno ? (
          <div className="escolhido">
            <div><b>{aluno.nome}</b><div className="muted pequeno">{aluno.email ?? ''} {aluno.whatsapp ?? ''}</div></div>
            <button className="link" onClick={() => setAluno(null)}>trocar</button>
          </div>
        ) : !criandoNovo ? (
          <>
            <Campo rotulo="Procurar aluno já cadastrado" dica="Nome, e-mail ou CPF"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para procurar…" /></Campo>
            {achados.length > 0 && (
              <ul className="lista selecionavel">
                {achados.map((a) => <li key={a.id} onClick={() => { setAluno(a); setBusca('') }}><b>{a.nome}</b><span className="muted pequeno">{a.email ?? ''} {a.whatsapp ?? ''}</span></li>)}
              </ul>
            )}
            <button className="btn" onClick={() => { setCriandoNovo(true); setNovo({ nome: busca }) }}>+ Cadastrar aluno novo</button>
          </>
        ) : (
          <>
            <div className="form-grade">
              <Campo rotulo="Nome completo"><input value={novo.nome ?? ''} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus /></Campo>
              <Campo rotulo="WhatsApp"><input value={novo.whatsapp ?? ''} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} placeholder="61 99999-9999" /></Campo>
              <Campo rotulo="E-mail"><input type="email" value={novo.email ?? ''} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Campo>
              <Campo rotulo="CPF"><input value={novo.cpf ?? ''} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} /></Campo>
              <Campo rotulo="Conselho (nº)"><input value={novo.conselho ?? ''} onChange={(e) => setNovo({ ...novo, conselho: e.target.value })} placeholder="CRO 12345 DF" /></Campo>
              <Campo rotulo="Instagram"><input value={novo.instagram ?? ''} onChange={(e) => setNovo({ ...novo, instagram: e.target.value })} /></Campo>
              <Campo rotulo="Tamanho do jaleco"><input value={novo.tamanho_jaleco ?? ''} onChange={(e) => setNovo({ ...novo, tamanho_jaleco: e.target.value })} placeholder="Feminino M" /></Campo>
            </div>
            <button className="link" onClick={() => setCriandoNovo(false)}>voltar para a busca</button>
          </>
        )}
      </section>

      <section className="bloco">
        <h2>2. Turma e venda</h2>
        <div className="form-grade">
          <Campo rotulo="Turma" dica={turmaSel ? (turmaSel.data_inicio ? `Começa em ${dataBR(turmaSel.data_inicio)}` : 'Turma sem data definida') : undefined}>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Escolha…</option>
              {turmas.filter((t) => ((t.status === 'confirmada' || t.status === 'planejada') && (t.vendas_abertas || isAdmin)) || t.id === turmaId).map((t) => <option key={t.id} value={t.id}>{t.nome}{t.inscritos >= t.vagas ? ' — lotada' : ` — ${t.vagas - t.inscritos} vaga(s)`}{!t.vendas_abertas ? ' (vendas encerradas)' : ''}</option>)}
            </select>
          </Campo>
          {isAdmin ? (
            <Campo rotulo="Quem vendeu" dica="A comissão de R$ 250 vai para essa pessoa">
              <select value={vendedoraId} onChange={(e) => setVendedoraId(e.target.value)}>
                <option value="">Escolha…</option>
                {vendedoras.filter((v) => v.ativa).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </Campo>
          ) : (
            <Campo rotulo="Quem vendeu" dica="Preenchido pelo seu login. A comissão vai para você.">
              <input value={minhaVendedora?.nome ?? 'Seu login ainda não está ligado a uma vendedora'} disabled />
            </Campo>
          )}
          <Campo rotulo="Data da venda"><input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} /></Campo>
          <Campo rotulo="Tipo">
            <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
              {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor fechado com o aluno"><InputMoeda valor={valor} onChange={setValor} passo={100} /></Campo>
        </div>
      </section>

      <section className="bloco">
        <h2>3. Como o aluno vai pagar</h2>
        <label className="check"><input type="checkbox" checked={temEntrada} onChange={(e) => setTemEntrada(e.target.checked)} /> Tem entrada / matrícula separada</label>
        {temEntrada && (
          <div className="form-grade sub">
            <Campo rotulo="Valor da entrada"><InputMoeda valor={entrada} onChange={setEntrada} /></Campo>
            <Campo rotulo="Data"><input type="date" value={entradaData} onChange={(e) => setEntradaData(e.target.value)} /></Campo>
            <Campo rotulo="Forma"><select value={entradaForma} onChange={(e) => setEntradaForma(e.target.value)}>{Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            <Campo rotulo="Já foi paga?"><select value={entradaPaga ? 's' : 'n'} onChange={(e) => setEntradaPaga(e.target.value === 's')}><option value="s">Sim, já pagou</option><option value="n">Não, vai pagar</option></select></Campo>
          </div>
        )}
        <div className="form-grade sub">
          <Campo rotulo={temEntrada ? 'Restante em quantas vezes' : 'Em quantas vezes'}><InputNumero valor={nParc} onChange={setNParc} max={24} sufixo="x" /></Campo>
          <Campo rotulo="Forma"><select value={parcForma} onChange={(e) => setParcForma(e.target.value)}>{Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <Campo rotulo={nParc > 1 ? 'Vencimento da 1ª' : 'Vencimento'}><input type="date" value={primeiroVenc} onChange={(e) => setPrimeiroVenc(e.target.value)} /></Campo>
          <Campo rotulo={nParc > 1 ? 'A 1ª já foi paga?' : 'Já foi paga?'}><select value={primeiraPaga ? 's' : 'n'} onChange={(e) => setPrimeiraPaga(e.target.value === 's')}><option value="n">Não</option><option value="s">Sim, já pagou</option></select></Campo>
        </div>
        {parcForma.startsWith('hotmart') && <p className="nota">Venda pela Hotmart: use a conta da <b>Unique HOF Academy</b>. Coloque o valor fechado sem os juros; o valor líquido que a Hotmart repassar é registrado quando a parcela cair.</p>}
        {linhas.some((l) => l.pago) && (
          <Campo rotulo="Comprovante do pagamento já feito" dica="Foto ou PDF do Pix/recibo. Obrigatório para Pix.">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
          </Campo>
        )}
        <div className="tabela-wrap">
          <table className="tabela compacta">
            <thead><tr><th>#</th><th>O quê</th><th>Forma</th><th>Vencimento</th><th className="num">Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.numero}><td>{l.numero}/{l.total}</td><td>{l.eh_matricula ? 'Entrada / matrícula' : 'Parcela'}</td><td>{FORMAS[l.forma]}</td><td>{dataBR(l.vencimento)}</td><td className="num">{brl(l.valor)}</td><td>{l.pago ? 'informada como paga (vai para conferência)' : 'a pagar'}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4}>Total programado</td><td className="num">{brl(soma)}</td><td>{valor !== null && Math.abs(soma - valor) > 0.01 && <span className="erro-txt">diferente do valor fechado ({brl(valor)})</span>}</td></tr></tfoot>
          </table>
        </div>
      </section>

      <section className="bloco">
        <Campo rotulo="Observações (opcional)"><textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        <Erro msg={erro} />
        <div className="acoes fim"><Link to="/turmas" className="btn">Cancelar</Link><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar matrícula'}</button></div>
      </section>
    </div>
  )
}
