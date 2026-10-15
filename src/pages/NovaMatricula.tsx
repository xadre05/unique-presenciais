import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, FORMAS, hojeISO, ORIGENS, somaMeses } from '../lib/format'
import type { Aluno } from '../lib/types'
import { Badge, Campo, Erro, InputMoeda, InputNumero } from '../components/ui'
import { Icone } from '../components/Icone'
import { useAuth } from '../auth'
import { turmaCurta } from './Agenda'

type Linha = { eh_matricula: boolean; forma: string; conta_id: string; valor: number | null; vencimento: string }
type Plano = 'a_vista' | 'parcelado' | 'a_definir'

// Conta sugerida para cada forma de pagamento: só contas ativas e liberadas para novas vendas, preferindo a marcada como padrão.
export const contaPadrao = (forma: string, contas: { id: string; nome: string; tipo: string; ativa?: boolean; uso?: string }[]) => {
  const validas = contas.filter((c) => c.ativa !== false && c.uso !== 'antigas')
  const escolher = (f: (c: { nome: string; tipo: string }) => boolean) => {
    const xs = validas.filter(f)
    return (xs.find((c) => c.uso === 'padrao') ?? xs[0])?.id ?? ''
  }
  if (forma === 'pix' || forma === 'transferencia' || forma === 'boleto') return escolher((c) => c.tipo === 'banco')
  if (forma === 'dinheiro') return escolher((c) => c.tipo === 'especie')
  if (forma.startsWith('hotmart')) return escolher((c) => c.tipo === 'hotmart' || /hotmart/i.test(c.nome))
  return ''
}

const so = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const limpa = (s: string) => s.replace(/[,()%*]/g, ' ').trim()
const intervalo = (a: string, b: string | null) => {
  if (!b || b === a) return dataBR(a)
  const [ya, ma, da] = a.split('-'), [yb, mb, db] = b.split('-')
  return ya === yb && ma === mb ? `${da}–${db}/${mb}/${yb}` : `${dataBR(a)} – ${dataBR(b)}`
}

export default function NovaMatricula() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { perfil, isAdmin } = useAuth()
  const { contas, vendedoras, turmas, cursos } = useCadastros()

  // 1. aluno e turma
  const [modoAluno, setModoAluno] = useState<'existente' | 'novo'>('existente')
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Aluno[]>([])
  const [listaAberta, setListaAberta] = useState(false)
  const [aluno, setAluno] = useState<Aluno | null>(null)
  const [novo, setNovo] = useState<Partial<Aluno>>({})
  const [duplicado, setDuplicado] = useState<Aluno | null>(null)
  const [cursoId, setCursoId] = useState(params.get('curso') ?? '')
  const [turmaId, setTurmaId] = useState(params.get('turma') ?? '')

  // 2. venda
  const [vendedoraId, setVendedoraId] = useState('')
  const [dataVenda, setDataVenda] = useState(hojeISO())
  const [valorTabela, setValorTabela] = useState<number | null>(null)
  const [desconto, setDesconto] = useState<number | null>(null)
  const [condicao, setCondicao] = useState('')
  const [origem, setOrigem] = useState('venda')

  // 3. pagamento
  const [plano, setPlano] = useState<Plano>('parcelado')
  const [forma, setForma] = useState('')
  const [contaId, setContaId] = useState('')
  const [entrada, setEntrada] = useState<number | null>(null)
  const [entradaForma, setEntradaForma] = useState('')
  const [entradaData, setEntradaData] = useState(hojeISO())
  const [nParc, setNParc] = useState(0)
  const [primeiroVenc, setPrimeiroVenc] = useState('')
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [assinatura, setAssinatura] = useState('')
  const [obs, setObs] = useState('')
  const [obsAberta, setObsAberta] = useState(false)

  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const caixaBusca = useRef<HTMLDivElement>(null)

  const minhaVendedora = perfil ? vendedoras.find((v) => v.perfil_id === perfil.id) : undefined
  useEffect(() => { if (!vendedoraId && minhaVendedora) setVendedoraId(minhaVendedora.id) }, [minhaVendedora, vendedoraId])

  // atalhos: ?turma= já escolhe o curso; ?aluno= já escolhe o aluno
  const turmaSel = turmas.find((t) => t.id === turmaId)
  useEffect(() => { if (turmaSel && !cursoId) setCursoId(turmaSel.curso_id) }, [turmaSel, cursoId])
  useEffect(() => {
    const id = params.get('aluno')
    if (id) supabase.from('alunos').select('*').eq('id', id).maybeSingle().then(({ data }) => data && setAluno(data as Aluno))
  }, [params])

  useEffect(() => {
    const t = setTimeout(async () => {
      const s = limpa(busca)
      if (s.length < 2) return setAchados([])
      const dig = so(s)
      const filtros = [`nome.ilike.%${s}%`, `email.ilike.%${s}%`]
      if (dig.length >= 3) filtros.push(`cpf.ilike.%${dig}%`, `whatsapp.ilike.%${dig.slice(-8)}%`)
      const { data } = await supabase.from('alunos').select('*').or(filtros.join(',')).order('nome').limit(8)
      setAchados((data as Aluno[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [busca])
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixaBusca.current && !caixaBusca.current.contains(e.target as Node)) setListaAberta(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  // conta acompanha a forma escolhida
  useEffect(() => { setContaId(forma ? contaPadrao(forma, contas) : '') }, [forma, contas])
  useEffect(() => { if (!entradaForma && forma) setEntradaForma(forma) }, [forma, entradaForma])

  const encontros = useConsulta<{ titulo: string; data_inicio: string; data_fim: string | null }[]>(
    () => turmaId ? supabase.from('encontros').select('titulo,data_inicio,data_fim').eq('turma_id', turmaId).eq('cancelado', false).order('data_inicio') : Promise.resolve({ data: [], error: null }), [turmaId])

  const turmasDoCurso = turmas.filter((t) => (!cursoId || t.curso_id === cursoId) &&
    (((t.status === 'confirmada' || t.status === 'planejada') && (t.vendas_abertas || isAdmin)) || t.id === turmaId))
  const cursoSel = cursos.find((c) => c.id === cursoId)
  const vendedoraSel = vendedoras.find((v) => v.id === vendedoraId)
  const contasNovas = contas.filter((c) => c.ativa && c.uso !== 'antigas')

  const total = Math.max(0, Math.round(((valorTabela ?? 0) - (desconto ?? 0)) * 100) / 100)
  const temEntrada = plano === 'parcelado' && (entrada ?? 0) > 0
  const config = JSON.stringify([plano, forma, contaId, total, temEntrada ? entrada : 0, entradaForma, entradaData, nParc, primeiroVenc])
  const desatualizada = linhas !== null && assinatura !== config

  const montar = (): Linha[] | string => {
    if (total <= 0) return 'Informe o valor contratado para gerar as parcelas.'
    if (!forma) return 'Escolha o meio de pagamento.'
    const venc = primeiroVenc || (plano === 'a_vista' ? dataVenda : '')
    if (!venc) return 'Informe o primeiro vencimento.'
    if (plano === 'a_vista') return [{ eh_matricula: false, forma, conta_id: contaId, valor: total, vencimento: venc }]
    const e = temEntrada ? entrada ?? 0 : 0
    if (e >= total) return 'A entrada é igual ou maior que o total da venda. Use “À vista”.'
    if (nParc < 1) return 'Informe o número de parcelas.'
    const out: Linha[] = []
    if (temEntrada) out.push({ eh_matricula: true, forma: entradaForma || forma, conta_id: (entradaForma || forma) === forma ? contaId : contaPadrao(entradaForma, contas), valor: e, vencimento: entradaData })
    const resto = Math.round((total - e) * 100) / 100
    const base = Math.floor((resto / nParc) * 100) / 100
    for (let i = 0; i < nParc; i++) out.push({ eh_matricula: false, forma, conta_id: contaId, valor: i === nParc - 1 ? Math.round((resto - base * (nParc - 1)) * 100) / 100 : base, vencimento: somaMeses(venc, i) })
    return out
  }
  const gerar = () => {
    setErro(null)
    const r = montar()
    if (typeof r === 'string') return setErro(r)
    setLinhas(r); setAssinatura(config)
  }
  const mudarLinha = (i: number, campos: Partial<Linha>) => setLinhas((ls) => ls && ls.map((l, j) => (j === i ? { ...l, ...campos } : l)))
  const soma = (linhas ?? []).reduce((s, l) => s + (l.valor ?? 0), 0)
  const entradaPrevista = (linhas ?? []).filter((l) => l.eh_matricula).reduce((s, l) => s + (l.valor ?? 0), 0) || (temEntrada ? entrada ?? 0 : 0)

  // ao cadastrar aluno novo, avisa se já existe alguém com o mesmo CPF, e-mail ou WhatsApp
  useEffect(() => {
    if (modoAluno !== 'novo') return setDuplicado(null)
    const t = setTimeout(async () => {
      // busca em todos os alunos (inclusive de outra vendedora), mas só devolve id e nome
      const cpf = so(novo.cpf), email = limpa(novo.email ?? ''), whats = so(novo.whatsapp)
      if (cpf.length < 11 && !email.includes('@') && whats.length < 8) return setDuplicado(null)
      const { data } = await supabase.rpc('aluno_ja_cadastrado', { p_cpf: cpf, p_email: email, p_whats: whats })
      setDuplicado((((data as Aluno[]) ?? [])[0] as Aluno) ?? null)
    }, 400)
    return () => clearTimeout(t)
  }, [modoAluno, novo.cpf, novo.email, novo.whatsapp])

  const voltar = () => (window.history.state?.idx > 0 ? nav(-1) : nav('/alunos'))

  const salvar = async (destino: 'matricula' | 'aluno') => {
    setErro(null)
    const nomeNovo = novo.nome?.trim()
    if (modoAluno === 'existente' && !aluno) return setErro('Escolha o aluno na busca ou clique em “Novo aluno”.')
    if (modoAluno === 'novo' && !nomeNovo) return setErro('Informe o nome do aluno novo.')
    if (modoAluno === 'novo' && !novo.whatsapp?.trim()) return setErro('Informe o WhatsApp do aluno novo.')
    if (modoAluno === 'novo' && duplicado) return setErro(`Já existe um aluno com esses dados: ${duplicado.nome}. Use o cadastro existente.`)
    if (!turmaId) return setErro('Escolha a turma.')
    if (!isAdmin && !minhaVendedora) return setErro('Seu login ainda não está ligado a uma vendedora. Peça ao administrador para fazer isso em Configurações → Equipe e acessos.')
    if (origem === 'venda' && !vendedoraId) return setErro('Escolha o vendedor responsável (é por ele que a comissão é calculada).')
    if (valorTabela === null) return setErro('Informe o valor contratado (pode ser zero em cortesia).')
    if ((desconto ?? 0) > valorTabela) return setErro('O desconto é maior que o valor contratado.')
    let parcelas: Linha[] = []
    if (total > 0 && plano !== 'a_definir') {
      if (linhas && !desatualizada) parcelas = linhas
      else { const r = montar(); if (typeof r === 'string') return setErro(r); parcelas = r }
      if (parcelas.some((l) => !l.valor || l.valor <= 0 || !l.vencimento)) return setErro('Toda parcela precisa de valor e vencimento.')
      if (Math.abs(parcelas.reduce((s, l) => s + (l.valor ?? 0), 0) - total) > 0.01) return setErro(`A soma das parcelas (${brl(soma)}) está diferente do total da venda (${brl(total)}).`)
    }
    setSalvando(true)
    try {
      let alunoId = aluno?.id
      if (modoAluno === 'novo') {
        const { data, error } = await supabase.from('alunos').insert({ ...novo, nome: nomeNovo }).select('id').single()
        if (error) throw error
        alunoId = data.id
      }
      const { data: ja } = await supabase.from('matriculas').select('id').eq('aluno_id', alunoId!).eq('turma_id', turmaId).not('status', 'in', '(cancelada,transferida)').limit(1)
      if (ja?.length) { setSalvando(false); return setErro('Esse aluno já tem matrícula ativa nessa turma. Abra a matrícula existente em vez de criar outra.') }
      const { data: m, error: em } = await supabase.from('matriculas').insert({
        aluno_id: alunoId, turma_id: turmaId, vendedora_id: vendedoraId || null, data_venda: dataVenda, origem, status: 'reservada',
        valor_tabela: valorTabela, desconto: desconto ?? 0, valor_fechado: total, condicao_comercial: condicao.trim() || null,
        plano_pagamento: total > 0 ? plano : null, observacoes: obs.trim() || null,
      }).select('id').single()
      if (em) throw em
      if (parcelas.length) {
        const { error: ep } = await supabase.from('parcelas').insert(parcelas.map((l, i) => ({
          matricula_id: m.id, numero: i + 1, total_parcelas: parcelas.length, eh_matricula: l.eh_matricula, forma: l.forma,
          conta_id: l.conta_id || null, valor: l.valor, vencimento: l.vencimento, status: 'prevista',
        })))
        if (ep) throw ep
      }
      nav(destino === 'aluno' ? `/alunos/${alunoId}` : `/matricula/${m.id}`, { replace: true })
    } catch (e) {
      setErro(msgErro(e))
    } finally { setSalvando(false) }
  }

  const nomeAluno = modoAluno === 'novo' ? novo.nome?.trim() : aluno?.nome
  const vagas = turmaSel ? turmaSel.vagas - turmaSel.inscritos : 0

  return (
    <div className="pagina nm">
      <header className="pagina-topo">
        <div><h1>Nova matrícula</h1><p className="muted">Vincule o aluno à turma e registre as condições da venda.</p></div>
        <button className="btn btn-contorno" onClick={voltar}>Cancelar</button>
      </header>

      <div className="nm-grade">
        <div className="nm-passos">
          {/* 1 */}
          <section className="bloco nm-passo">
            <h2><span className="passo-num">1</span> Aluno e turma</h2>
            <div className="segmento">
              <button className={modoAluno === 'existente' ? 'ativo' : ''} onClick={() => setModoAluno('existente')}><Icone nome="usuario" tam={18} /> Aluno existente</button>
              <button className={modoAluno === 'novo' ? 'ativo' : ''} onClick={() => { setModoAluno('novo'); if (!novo.nome && busca && !/\d/.test(busca)) setNovo({ ...novo, nome: busca }) }}><Icone nome="mais" tam={18} /> Novo aluno</button>
            </div>

            {modoAluno === 'existente' ? (
              aluno ? (
                <div className="escolhido">
                  <div><b>{aluno.nome}</b><div className="muted pequeno">{[aluno.whatsapp, aluno.email, aluno.cpf && `CPF ${aluno.cpf}`].filter(Boolean).join(' · ')}</div></div>
                  <div className="acoes"><Link to={`/alunos/${aluno.id}`} target="_blank" className="link pequeno">ver perfil</Link><button className="link pequeno" onClick={() => setAluno(null)}>trocar</button></div>
                </div>
              ) : (
                <Campo rotulo="Buscar aluno por nome, CPF, e-mail ou WhatsApp">
                  <div className="combo" ref={caixaBusca}>
                    <label className="select-icone"><Icone nome="busca" /><input value={busca} placeholder="Digite para buscar o aluno…" onFocus={() => setListaAberta(true)} onChange={(e) => { setBusca(e.target.value); setListaAberta(true) }} /></label>
                    {listaAberta && limpa(busca).length >= 2 && (
                      <ul className="combo-lista">
                        {achados.map((a) => <li key={a.id} onMouseDown={() => { setAluno(a); setBusca(''); setListaAberta(false) }}><b>{a.nome}</b><span className="muted pequeno">{[a.whatsapp, a.email].filter(Boolean).join(' · ')}</span></li>)}
                        <li className="combo-novo" onMouseDown={() => { setModoAluno('novo'); setNovo({ ...novo, nome: /\d/.test(busca) ? '' : busca }); setListaAberta(false) }}><Icone nome="mais" tam={14} /> {achados.length ? 'Não é nenhum desses — cadastrar novo aluno' : 'Nenhum aluno encontrado — cadastrar novo'}</li>
                      </ul>
                    )}
                  </div>
                </Campo>
              )
            ) : (<>
              <div className="form-grade">
                <Campo rotulo="Nome completo"><input value={novo.nome ?? ''} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus /></Campo>
                <Campo rotulo="WhatsApp"><input value={novo.whatsapp ?? ''} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} placeholder="61 99999-9999" /></Campo>
                <Campo rotulo="E-mail"><input type="email" value={novo.email ?? ''} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Campo>
                <Campo rotulo="CPF"><input value={novo.cpf ?? ''} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} /></Campo>
                <Campo rotulo="Conselho (nº)"><input value={novo.conselho ?? ''} onChange={(e) => setNovo({ ...novo, conselho: e.target.value })} placeholder="CRO 12345 DF" /></Campo>
                <Campo rotulo="Instagram"><input value={novo.instagram ?? ''} onChange={(e) => setNovo({ ...novo, instagram: e.target.value })} /></Campo>
                <Campo rotulo="Cidade / UF"><div className="linha-2"><input value={novo.cidade ?? ''} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} /><input value={novo.uf ?? ''} maxLength={2} style={{ width: 64 }} onChange={(e) => setNovo({ ...novo, uf: e.target.value.toUpperCase() })} placeholder="UF" /></div></Campo>
                <Campo rotulo="Tamanho do jaleco"><input value={novo.tamanho_jaleco ?? ''} onChange={(e) => setNovo({ ...novo, tamanho_jaleco: e.target.value })} placeholder="Feminino M" /></Campo>
              </div>
              {duplicado && (
                <div className="faixa-alerta">
                  <Icone nome="alerta" tam={18} />
                  <span><b>{duplicado.nome}</b> já está cadastrado com esse CPF, e-mail ou WhatsApp.</span>
                  <button className="btn btn-contorno btn-mini" onClick={() => { setAluno(duplicado); setModoAluno('existente'); setNovo({}) }}>Usar esse cadastro</button>
                </div>
              )}
            </>)}

            <div className="form-grade">
              <Campo rotulo="Curso">
                <select value={cursoId} onChange={(e) => { setCursoId(e.target.value); if (turmaSel && turmaSel.curso_id !== e.target.value) setTurmaId('') }}>
                  <option value="">Selecione o curso</option>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Turma">
                <select value={turmaId} disabled={!cursoId} onChange={(e) => setTurmaId(e.target.value)}>
                  <option value="">{cursoId ? (turmasDoCurso.length ? 'Selecione a turma' : 'Nenhuma turma com vendas abertas') : 'Escolha o curso primeiro'}</option>
                  {turmasDoCurso.map((t) => <option key={t.id} value={t.id}>{turmaCurta(t.nome)}{t.inscritos >= t.vagas ? ' — lotada' : ` — ${t.vagas - t.inscritos} vaga(s)`}{!t.vendas_abertas ? ' (vendas encerradas)' : ''}</option>)}
                </select>
              </Campo>
            </div>
            {!turmaSel ? <p className="muted pequeno nm-dica">Vagas e datas aparecem ao selecionar a turma.</p> : (
              <div className="nm-turma">
                <span><Icone nome="alunos" tam={15} /> {vagas > 0 ? <><b>{vagas}</b> de {turmaSel.vagas} vagas livres</> : <b className="erro-txt">Turma lotada ({turmaSel.inscritos}/{turmaSel.vagas})</b>}</span>
                {!turmaSel.vendas_abertas && <Badge tom="alerta">vendas encerradas</Badge>}
                {turmaSel.status === 'planejada' && <Badge tom="info">turma planejada</Badge>}
                <span><Icone nome="agenda" tam={15} /> {(encontros.dados ?? []).length > 0
                  ? (encontros.dados ?? []).map((e) => intervalo(e.data_inicio, e.data_fim)).join(' · ')
                  : turmaSel.data_inicio ? intervalo(turmaSel.data_inicio, turmaSel.data_fim) : 'datas a definir'}</span>
              </div>
            )}
          </section>

          {/* 2 */}
          <section className="bloco nm-passo">
            <h2><span className="passo-num">2</span> Dados da venda</h2>
            <div className="form-grade">
              {isAdmin ? (
                <Campo rotulo="Vendedor responsável" dica="A comissão vai para quem vendeu.">
                  <select value={vendedoraId} onChange={(e) => setVendedoraId(e.target.value)}>
                    <option value="">Selecione</option>
                    {vendedoras.filter((v) => v.ativa || v.id === vendedoraId).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </Campo>
              ) : (
                <Campo rotulo="Vendedor responsável" dica="Preenchido pelo seu login. A comissão vai para você.">
                  <input value={minhaVendedora?.nome ?? 'Seu login ainda não está ligado a uma vendedora'} disabled />
                </Campo>
              )}
              <Campo rotulo="Data da venda"><input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} /></Campo>
              <Campo rotulo="Valor contratado"><InputMoeda valor={valorTabela} onChange={setValorTabela} passo={100} /></Campo>
              <Campo rotulo="Desconto"><InputMoeda valor={desconto} onChange={setDesconto} passo={50} /></Campo>
            </div>
            <div className="form-grade nm-condicao">
              <Campo rotulo="Condição comercial"><input value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="Ex.: oferta regular ou campanha especial" /></Campo>
              <Campo rotulo="Tipo">
                <select value={origem} onChange={(e) => setOrigem(e.target.value)}>{Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </Campo>
            </div>
          </section>

          {/* 3 */}
          <section className="bloco nm-passo">
            <h2><span className="passo-num">3</span> Condições de pagamento</h2>
            <div className="radios">
              {([['a_vista', 'À vista'], ['parcelado', 'Parcelado'], ['a_definir', 'A definir']] as [Plano, string][]).map(([k, r]) => (
                <label key={k} className={plano === k ? 'marcado' : ''}><input type="radio" name="plano" checked={plano === k} onChange={() => setPlano(k)} /> {r}</label>
              ))}
            </div>

            {plano !== 'a_definir' && (<>
              <div className="form-grade">
                <Campo rotulo="Meio de pagamento">
                  <select value={forma} onChange={(e) => setForma(e.target.value)}><option value="">Selecione</option>{Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </Campo>
                <Campo rotulo="Conta de recebimento" dica={contas.some((c) => c.uso === 'antigas') ? 'Contas só de contratos antigos não aparecem aqui.' : undefined}>
                  <select value={contaId} onChange={(e) => setContaId(e.target.value)}><option value="">Selecione</option>{contasNovas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.uso === 'padrao' ? ' (padrão)' : ''}</option>)}</select>
                </Campo>
              </div>
              <div className={`nm-plano ${plano === 'a_vista' ? 'avista' : ''}`}>
                {plano === 'parcelado' && <Campo rotulo="Entrada"><InputMoeda valor={entrada} onChange={setEntrada} passo={100} /></Campo>}
                {plano === 'parcelado' && <Campo rotulo="Número de parcelas"><InputNumero valor={nParc} onChange={setNParc} min={0} max={24} placeholder="Quantidade" /></Campo>}
                <Campo rotulo={plano === 'a_vista' ? 'Vencimento' : 'Primeiro vencimento'}><input type="date" value={primeiroVenc || (plano === 'a_vista' ? dataVenda : '')} onChange={(e) => setPrimeiroVenc(e.target.value)} /></Campo>
              </div>
              {temEntrada && (
                <div className="nm-entrada">
                  <span className="muted pequeno">Entrada paga em</span>
                  <select value={entradaForma} onChange={(e) => setEntradaForma(e.target.value)}>{Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <span className="muted pequeno">no dia</span>
                  <input type="date" value={entradaData} onChange={(e) => setEntradaData(e.target.value)} />
                </div>
              )}
              {forma.startsWith('hotmart') && <p className="nota pequeno">Hotmart: use a conta da <b>Unique HOF Academy</b> e coloque o valor fechado sem os juros. O líquido que a Hotmart repassar é registrado quando a parcela cair.</p>}

              <div className="nm-previa">
                <div className="nm-previa-topo"><Icone nome="documento" tam={16} /> <b>Prévia das parcelas</b>
                  {!linhas && <span className="muted pequeno">Informe os valores e vencimentos e clique em “Gerar parcelas”.</span>}
                  {desatualizada && <span className="aviso-txt pequeno">As condições mudaram. Clique em “Gerar de novo”.</span>}
                  <button className="btn btn-contorno nm-gerar" onClick={gerar}>{linhas ? 'Gerar de novo' : 'Gerar parcelas'}</button>
                </div>
                {linhas && (
                  <table className="tabela compacta">
                    <thead><tr><th>#</th><th>O quê</th><th>Forma</th><th>Vencimento</th><th className="num">Valor</th></tr></thead>
                    <tbody>
                      {linhas.map((l, i) => (
                        <tr key={i}>
                          <td>{i + 1}/{linhas.length}</td>
                          <td>{l.eh_matricula ? 'Entrada' : plano === 'a_vista' ? 'À vista' : 'Parcela'}</td>
                          <td className="pequeno">{FORMAS[l.forma]}</td>
                          <td><input type="date" className="input-mini" value={l.vencimento} onChange={(e) => mudarLinha(i, { vencimento: e.target.value })} /></td>
                          <td className="num nm-valor"><InputMoeda valor={l.valor} onChange={(v) => mudarLinha(i, { valor: v })} passo={50} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={4}>Total programado {Math.abs(soma - total) > 0.01 && <span className="erro-txt pequeno"> · diferente do total da venda ({brl(total)})</span>}</td><td className="num forte">{brl(soma)}</td></tr></tfoot>
                  </table>
                )}
              </div>
            </>)}

            {(plano === 'a_definir' || (valorTabela !== null && total === 0)) && (
              <div className="faixa-alerta"><Icone nome="alerta" tam={18} /><span>{total === 0 && plano !== 'a_definir' ? 'Venda sem valor (cortesia/bônus): nenhuma parcela será criada.' : 'Sem condições definidas, a matrícula fica com pendência financeira até alguém cadastrar as parcelas.'}</span></div>
            )}

            <div className="nm-obs">
              <button className="nm-obs-botao" onClick={() => setObsAberta((v) => !v)}><Icone nome="seta" tam={14} className={obsAberta ? 'gira' : ''} /> Observações (opcional){obs && !obsAberta && <span className="muted pequeno"> · preenchida</span>}</button>
              {obsAberta && <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Combinados com o aluno, detalhes da negociação…" />}
            </div>
          </section>
        </div>

        {/* resumo */}
        <aside className="nm-lado">
          <section className="bloco nm-resumo">
            <h2>Resumo da matrícula</h2>
            <dl>
              <dt>Aluno</dt><dd>{nomeAluno || '—'}</dd>
              <dt>Curso</dt><dd>{cursoSel?.nome ?? '—'}</dd>
              <dt>Turma</dt><dd>{turmaSel ? turmaCurta(turmaSel.nome) : '—'}</dd>
              <dt>Vendedor</dt><dd>{vendedoraSel?.nome ?? '—'}</dd>
            </dl>
            <dl className="nm-valores">
              <dt>Valor contratado</dt><dd>{brl(valorTabela ?? 0)}</dd>
              <dt>Desconto</dt><dd>{(desconto ?? 0) > 0 ? `− ${brl(desconto)}` : brl(0)}</dd>
              <dt className="forte">Total da venda</dt><dd className="nm-total">{brl(total)}</dd>
            </dl>
            <dl className="nm-valores">
              <dt>Entrada prevista</dt><dd>{brl(entradaPrevista)}</dd>
              <dt>Saldo previsto</dt><dd>{brl(Math.max(0, total - entradaPrevista))}</dd>
              {linhas && <><dt>Parcelas</dt><dd>{linhas.length}x · {plano === 'a_vista' ? 'à vista' : `1ª em ${dataBR(linhas.find((l) => !l.eh_matricula)?.vencimento ?? linhas[0].vencimento)}`}</dd></>}
            </dl>
            <div className="nm-recebido"><Icone nome="info" tam={18} /> Nenhum recebimento registrado.</div>
          </section>

          <section className="bloco nm-aviso">
            <Icone nome="info" tam={22} className="ouro" />
            <div><b>Pagamento já realizado?</b><p className="muted pequeno">Salve a matrícula e use <b>Informar pagamento</b> na parcela, anexando o comprovante. A confirmação depende da conferência do administrador.</p></div>
          </section>

          <Erro msg={erro} />
          <button className="btn btn-ouro btn-bloco btn-grande" disabled={salvando} onClick={() => salvar('matricula')}>{salvando ? 'Salvando…' : 'Salvar matrícula'}</button>
          <button className="btn btn-contorno btn-bloco btn-grande" disabled={salvando} onClick={() => salvar('aluno')}>Salvar e abrir aluno</button>
        </aside>
      </div>
    </div>
  )
}
