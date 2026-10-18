import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, dataHoraBR } from '../lib/format'
import { Badge, Campo, Erro, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'

type Integ = {
  id: string; nome: string; tipo: string; descricao: string | null; conta_id: string | null; traz_ofertas: boolean; traz_pagamentos: boolean; ativa: boolean; baixa_automatica: boolean
  credenciais_em: string | null; ultimo_teste_em: string | null; ultimo_teste_ok: boolean | null; ultimo_erro: string | null; ultima_sinc_em: string | null; ultimo_aviso_em: string | null
}
type Pag = {
  id: string; integracao_id: string; status: string | null; comprador_nome: string | null; comprador_email: string | null; produto_nome: string | null
  valor: number | null; valor_liquido: number | null; recorrencia: number | null; parcelas_cartao: number | null; data_aprovacao: string | null; data_pedido: string | null
  aluno_id: string | null; parcela_id: string | null; situacao: string; motivo: string | null
}
type Produto = { id: number; nome: string; status: string | null; curso_id: string | null; mostrar: boolean; sincronizado_em: string; integracao_id: string | null }

const URL_AVISO = 'https://gpvxzkmqiikuftbjvncd.supabase.co/functions/v1/hotmart-aviso?conta='
const SITUACOES: Record<string, { rotulo: string; tom: string }> = {
  sugerido: { rotulo: 'Sugeridos — confirme', tom: 'ouro' }, a_conferir: { rotulo: 'Para conferir', tom: 'alerta' }, baixado: { rotulo: 'Baixados', tom: 'ok' },
  sem_acao: { rotulo: 'Fora dos presenciais', tom: 'neutro' }, ignorado: { rotulo: 'Ignorados', tom: 'neutro' },
}

async function chamar(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('hotmart', { body: corpo })
  if (error) {
    let m = error.message
    try { m = (await (error as { context?: Response }).context?.json())?.erro ?? m } catch { /* mantém */ }
    throw new Error(m)
  }
  return data
}

export function AbaIntegracoes() {
  const lista = useConsulta<Integ[]>(() => supabase.from('integracoes').select('*').order('ordem'))
  const pags = useConsulta<Pag[]>(() => supabase.from('hotmart_pagamentos').select('id,integracao_id,status,comprador_nome,comprador_email,produto_nome,valor,valor_liquido,recorrencia,parcelas_cartao,data_aprovacao,data_pedido,aluno_id,parcela_id,situacao,motivo').order('data_aprovacao', { ascending: false, nullsFirst: false }).limit(300))
  const recarregar = () => { lista.recarregar(); pags.recarregar() }
  const integs = lista.dados ?? []

  return (<>
    <p className="muted pequeno">Todas as integrações do sistema ficam aqui. Elas só <b>leem</b> os outros sistemas: nada é alterado lá. As credenciais ficam cifradas no banco; depois de salvas, ninguém consegue ver de volta pela tela, só trocar.</p>
    <Erro msg={lista.erro} />
    {integs.filter((i) => i.tipo === 'hotmart').map((i) => <CartaoHotmart key={i.id} i={i} onMudou={recarregar} />)}
    <PagamentosHotmart pags={pags.dados ?? []} integs={integs} onMudou={recarregar} />
    <ProdutosHotmart integs={integs} />
    <section className="bloco">
      <h2><Icone nome="mais" className="ouro" /> Outras integrações</h2>
      <div className="integ-futuras">
        <div><b>Sicoob — extrato</b><p className="muted pequeno">Pix são poucos: a conferência continua manual, pelo comprovante que a equipe anexa.</p><Badge>não necessário por enquanto</Badge></div>
        <div><b>Vendas do online (SCK)</b><p className="muted pequeno">Comissão das vendedoras nas vendas online, pelo nome no link da Hotmart. Os nomes de cada vendedora ficam em Comissões.</p><Badge tom="ok">funcionando</Badge></div>
        <div><b>Outro sistema</b><p className="muted pequeno">Agenda, CRM, WhatsApp… Cada nova integração entra aqui como um cartão.</p><Badge>quando precisar</Badge></div>
      </div>
    </section>
  </>)
}

function CartaoHotmart({ i, onMudou }: { i: Integ; onMudou: () => void }) {
  const cad = useCadastros()
  const [campos, setCampos] = useState<string[]>([])
  const [cred, setCred] = useState(false)
  const [passos, setPassos] = useState(!i.credenciais_em)
  const [rodando, setRodando] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const carregarCampos = () => supabase.rpc('campos_integracao', { p_integracao: i.id }).then(({ data }) => setCampos((data as string[]) ?? []))
  useEffect(() => { carregarCampos() }, [i.id, i.credenciais_em]) // eslint-disable-line react-hooks/exhaustive-deps

  const temApi = ['client_id', 'client_secret', 'basic'].every((c) => campos.includes(c))
  const temAviso = campos.includes('hottok')
  const status = !temApi ? { r: 'Não configurada', t: 'neutro' } : i.ultimo_teste_ok === false ? { r: 'Com erro', t: 'erro' } : i.ultimo_teste_ok ? { r: 'Conectada', t: 'ok' } : { r: 'Credenciais salvas — teste a conexão', t: 'alerta' }
  const contasHotmart = cad.contas.filter((c) => c.tipo === 'hotmart')
  const mudar = async (campos: Partial<Integ>) => { await supabase.from('integracoes').update(campos).eq('id', i.id); onMudou() }

  const executar = async (acao: string, rotulo: string, dias?: number) => {
    setRodando(rotulo); setMsg(null); setErro(null)
    try {
      const d = await chamar({ acao, integracao: i.id, dias })
      const r = d?.resultado?.[i.id] ?? {}
      const partes: string[] = []
      if (acao === 'testar') partes.push('Conexão com a Hotmart funcionando.')
      if (r.pagamentos) partes.push(`${r.pagamentos.vendas} pagamento(s) lido(s): ${r.pagamentos.sugerido ?? 0} com baixa sugerida para você confirmar, ${r.pagamentos.a_conferir ?? 0} para conferir, ${r.pagamentos.baixado ?? 0} baixado(s), ${r.pagamentos.sem_acao ?? 0} fora dos presenciais.`)
      if (r.ofertas) partes.push(`${r.ofertas.produtos} produtos · ${r.ofertas.novos} links novos, ${r.ofertas.atualizados} atualizados, ${r.ofertas.desativados} desativados.`)
      if (r.pulada) partes.push('Nada feito: cadastre as credenciais primeiro.')
      setMsg(partes.join(' ') || 'Pronto.')
    } catch (e) { setErro((e as Error).message) }
    setRodando(null); onMudou()
  }
  // histórico completo: mês a mês desde abril/2021 (cada mês é uma chamada curta, para não estourar o tempo)
  const historico = async () => {
    setRodando('historico'); setMsg(null); setErro(null)
    const meses: [number, number][] = []
    for (let d = new Date(2021, 3, 1); d < new Date(); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      meses.push([d.getTime(), Math.min(fim.getTime(), Date.now())])
    }
    let lidos = 0, falhas = 0
    for (let k = meses.length - 1; k >= 0; k--) {
      setMsg(`Trazendo ${new Date(meses[k][0]).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}… (${meses.length - k} de ${meses.length}) · ${lidos} pagamento(s) lidos até agora`)
      try {
        const d = await chamar({ acao: 'pagamentos', integracao: i.id, inicio: meses[k][0], fim: meses[k][1], sem_produtos: k !== meses.length - 1 })
        lidos += Number(d?.resultado?.[i.id]?.pagamentos?.vendas ?? 0)
      } catch { falhas++ }
    }
    setMsg(`Histórico pronto: ${lidos} pagamento(s) lidos desde abril/2021, incluindo reembolsos e cancelamentos.${falhas ? ` ${falhas} mês(es) falharam — clique de novo para tentar.` : ''} Nada foi baixado sem a sua confirmação.`)
    setRodando(null); onMudou()
  }
  const copiar = async () => { try { await navigator.clipboard.writeText(URL_AVISO + i.id); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* sem área de transferência */ } }

  return (
    <section className={`bloco integ ${i.ativa ? '' : 'integ-desligada'}`}>
      <div className="integ-topo">
        <div className="integ-logo">H</div>
        <div className="integ-titulo">
          <h2>{i.nome}</h2>
          <p className="muted pequeno">{i.descricao}</p>
        </div>
        <div className="integ-status">
          <Badge tom={status.t}>{status.r}</Badge>
          <label className="check pequeno"><input type="checkbox" checked={i.ativa} onChange={(e) => mudar({ ativa: e.target.checked })} /> Ligada</label>
        </div>
      </div>

      <div className="integ-grade">
        <div className="integ-dado"><span className="muted pequeno">Credenciais</span><b>{temApi ? 'Cadastradas' : 'Faltando'}</b>{i.credenciais_em && <span className="muted pequeno">em {dataHoraBR(i.credenciais_em)}</span>}</div>
        <div className="integ-dado"><span className="muted pequeno">Aviso automático</span><b>{!temAviso ? 'Não ligado' : i.ultimo_aviso_em ? 'Recebendo' : 'Aguardando o 1º aviso'}</b>{i.ultimo_aviso_em && <span className="muted pequeno">último em {dataHoraBR(i.ultimo_aviso_em)}</span>}</div>
        <div className="integ-dado"><span className="muted pequeno">Última busca</span><b>{i.ultima_sinc_em ? dataHoraBR(i.ultima_sinc_em) : '—'}</b><span className="muted pequeno">automática de hora em hora</span></div>
        <div className="integ-dado"><span className="muted pequeno">Conta de recebimento</span>
          <select value={i.conta_id ?? ''} onChange={(e) => mudar({ conta_id: e.target.value || null })}><option value="">—</option>{contasHotmart.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </div>
      </div>

      <div className="integ-opcoes">
        <label className="check"><input type="checkbox" checked={i.traz_pagamentos} onChange={(e) => mudar({ traz_pagamentos: e.target.checked })} /> Ler os pagamentos dos alunos</label>
        <label className="check"><input type="checkbox" checked={i.traz_ofertas} onChange={(e) => mudar({ traz_ofertas: e.target.checked })} /> Trazer as ofertas como links de pagamento</label>
      </div>
      <label className={`check pequeno integ-auto ${i.baixa_automatica ? 'ligado' : ''}`}>
        <input type="checkbox" checked={i.baixa_automatica} onChange={(e) => mudar({ baixa_automatica: e.target.checked })} />
        <span><b>Dar baixa sozinho, sem eu confirmar</b> — {i.baixa_automatica ? 'LIGADO: pagamentos que baterem com uma parcela são baixados direto.' : 'desligado (recomendado): o sistema só sugere a parcela e você confirma com um clique em “Sugeridos — confirme”.'}</span>
      </label>
      {i.ultimo_teste_ok === false && i.ultimo_erro && <div className="erro">{i.ultimo_erro}</div>}
      {msg && <div className="nota pequeno"><Icone nome="check" tam={14} className="ok" /> {msg}</div>}
      <Erro msg={erro} />

      <div className="acoes">
        <button className="btn btn-ouro" onClick={() => setCred(true)}><Icone nome="documento" tam={16} /> {temApi ? 'Trocar credenciais' : 'Cadastrar credenciais'}</button>
        <button className="btn btn-contorno" disabled={!temApi || !!rodando} onClick={() => executar('testar', 'testar')}>{rodando === 'testar' ? 'Testando…' : 'Testar conexão'}</button>
        <button className="btn btn-contorno" disabled={!temApi || !!rodando} onClick={() => executar('tudo', 'agora', 3)}><Icone nome="historico" tam={16} /> {rodando === 'agora' ? 'Buscando…' : 'Atualizar agora'}</button>
        <button className="btn" disabled={!temApi || !!rodando} onClick={historico} title="Lê todos os pagamentos desde abril/2021, inclusive reembolsos e cancelamentos. Pode levar alguns minutos.">{rodando === 'historico' ? 'Trazendo histórico…' : 'Trazer histórico completo'}</button>
        <button className="link pequeno" onClick={() => setPassos((v) => !v)}>{passos ? 'Esconder passo a passo' : 'Como conectar'}</button>
      </div>

      {passos && (
        <ol className="integ-passos">
          <li><b>Credenciais (para o sistema ler a Hotmart).</b> Entre na Hotmart <b>{i.nome.replace('Hotmart — ', '')}</b> → Ferramentas → <b>Credenciais Hotmart</b> → Criar credencial. Ela mostra três códigos: <b>Client ID</b>, <b>Client Secret</b> e <b>Basic</b>. Clique em <b>Cadastrar credenciais</b> aqui e cole cada um no seu campo.</li>
          <li><b>Aviso automático (para a baixa cair na hora).</b> Na mesma Hotmart → Ferramentas → <b>Webhook</b> → Cadastrar webhook. Cole este endereço, escolha a versão <b>2.0</b> e marque todos os eventos de compra:
            <div className="integ-url"><code>{URL_AVISO + i.id}</code><button className="btn btn-mini" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar'}</button></div>
            Depois, na aba <b>Autenticação</b> do Webhook, copie o <b>Hottok</b> e cole no campo Hottok das credenciais aqui.</li>
          <li><b>Teste.</b> Clique em <b>Testar conexão</b>. Para trazer todo o passado (desde 2021, com reembolsos e cancelamentos), use <b>Trazer histórico completo</b>.</li>
        </ol>
      )}
      {cred && <Credenciais i={i} campos={campos} onFechar={() => setCred(false)} onSalvo={() => { setCred(false); carregarCampos(); onMudou() }} />}
    </section>
  )
}

function Credenciais({ i, campos, onFechar, onSalvo }: { i: Integ; campos: string[]; onFechar: () => void; onSalvo: () => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const CAMPOS = [
    { k: 'client_id', r: 'Client ID', d: 'Ferramentas → Credenciais Hotmart' },
    { k: 'client_secret', r: 'Client Secret', d: 'Ferramentas → Credenciais Hotmart' },
    { k: 'basic', r: 'Basic', d: 'Ferramentas → Credenciais Hotmart (o código longo)' },
    { k: 'hottok', r: 'Hottok do Webhook', d: 'Ferramentas → Webhook → aba Autenticação' },
  ]
  const salvar = async () => {
    const preenchidos = Object.entries(v).filter(([, x]) => x.trim())
    if (!preenchidos.length) return setErro('Cole ao menos um código.')
    setSalvando(true); setErro(null)
    for (const [k, x] of preenchidos) {
      const { error } = await supabase.rpc('salvar_credencial_integracao', { p_integracao: i.id, p_campo: k, p_valor: x })
      if (error) { setSalvando(false); return setErro(msgErro(error)) }
    }
    onSalvo()
  }
  return (
    <Modal titulo={`Credenciais — ${i.nome}`} aberto onFechar={onFechar}>
      <p className="muted pequeno">Cole os códigos da Hotmart. Eles são gravados cifrados no banco e não aparecem mais na tela: para mudar, cole um novo por cima. Deixe em branco o que não quiser trocar.</p>
      {CAMPOS.map((c) => (
        <Campo key={c.k} rotulo={`${c.r}${campos.includes(c.k) ? ' — já cadastrado ✓' : ''}`} dica={c.d}>
          <input type="password" autoComplete="off" value={v[c.k] ?? ''} placeholder={campos.includes(c.k) ? '•••••••• (deixe vazio para manter)' : 'Cole aqui'} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
        </Campo>
      ))}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
    </Modal>
  )
}

function PagamentosHotmart({ pags, integs, onMudou }: { pags: Pag[]; integs: Integ[]; onMudou: () => void }) {
  const [aba, setAba] = useState(pags.some((p) => p.situacao === 'sugerido') ? 'sugerido' : 'a_conferir')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const confirmar = async (p: Pag) => {
    if (!p.parcela_id) return
    setConfirmando(p.id); setErro(null)
    const { error } = await supabase.rpc('vincular_pagamento_hotmart', { p_id: p.id, p_parcelas: [p.parcela_id] })
    setConfirmando(null)
    if (error) return setErro(msgErro(error))
    onMudou()
  }
  const [ligar, setLigar] = useState<Pag | null>(null)
  const [ignorar, setIgnorar] = useState<Pag | null>(null)
  const lista = pags.filter((p) => p.situacao === aba)
  const nomeInteg = (id: string) => integs.find((x) => x.id === id)?.nome.replace('Hotmart — ', '') ?? id
  if (!pags.length) return (
    <section className="bloco"><h2><Icone nome="dinheiro" className="ouro" /> Pagamentos recebidos da Hotmart</h2>
      <p className="muted pequeno">Quando a integração estiver ligada, cada pagamento que a Hotmart aprovar aparece aqui. Os que baterem com uma parcela são baixados sozinhos; os que não baterem ficam em “Para conferir”.</p></section>
  )
  return (
    <section className="bloco">
      <h2><Icone nome="dinheiro" className="ouro" /> Pagamentos recebidos da Hotmart</h2>
      <nav className="abas">
        {Object.entries(SITUACOES).map(([k, s]) => <button key={k} className={aba === k ? 'ativa' : ''} onClick={() => setAba(k)}>{s.rotulo} <span className="muted">{pags.filter((p) => p.situacao === k).length}</span></button>)}
      </nav>
      {aba === 'sugerido' && lista.length > 0 && <p className="muted pequeno">A Hotmart aprovou estes pagamentos e o sistema achou a parcela que eles quitam. Confira e clique em <b>Confirmar baixa</b>. Nada é baixado sem você confirmar.</p>}
      <Erro msg={erro} />
      {lista.length === 0 ? <Vazio>{aba === 'a_conferir' ? 'Nada para conferir.' : aba === 'sugerido' ? 'Nenhuma baixa esperando confirmação.' : 'Nenhum pagamento aqui.'}</Vazio> : (
        <div className="tabela-wrap">
          <table className="tabela compacta">
            <thead><tr><th>Data</th><th>Comprador</th><th>Produto</th><th className="num">Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td className="pequeno">{dataBR(p.data_aprovacao ?? p.data_pedido)}</td>
                  <td><div className="forte">{p.comprador_nome ?? '—'}</div><div className="muted pequeno">{p.comprador_email}</div></td>
                  <td className="pequeno">{p.produto_nome}<div className="muted">{nomeInteg(p.integracao_id)}{p.recorrencia ? ` · cobrança ${p.recorrencia}` : ''}{(p.parcelas_cartao ?? 1) > 1 ? ` · ${p.parcelas_cartao}x no cartão` : ''}</div></td>
                  <td className="num">{brl(p.valor)}{p.valor_liquido ? <div className="muted pequeno">líquido {brl(p.valor_liquido)}</div> : null}</td>
                  <td className="pequeno integ-motivo">{p.motivo ?? (p.situacao === 'baixado' ? 'Parcela baixada' : '')}{p.aluno_id && <> · <Link to={`/alunos/${p.aluno_id}`} className="link">ver aluno</Link></>}</td>
                  <td className="celula-acao acao-curta">
                    {aba === 'sugerido' && <><button className="btn btn-ouro btn-mini" disabled={confirmando === p.id} onClick={() => confirmar(p)}>{confirmando === p.id ? 'Baixando…' : 'Confirmar baixa'}</button> <button className="btn btn-mini" onClick={() => setLigar(p)}>Outra parcela</button> <button className="btn btn-mini" onClick={() => setIgnorar(p)}>Ignorar</button></>}
                    {aba === 'a_conferir' && <><button className="btn btn-ouro btn-mini" onClick={() => setLigar(p)}>Ligar à parcela</button> <button className="btn btn-mini" onClick={() => setIgnorar(p)}>Ignorar</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ligar && <LigarParcela p={ligar} onFechar={() => setLigar(null)} onSalvo={() => { setLigar(null); onMudou() }} />}
      {ignorar && <Ignorar p={ignorar} onFechar={() => setIgnorar(null)} onSalvo={() => { setIgnorar(null); onMudou() }} />}
    </section>
  )
}

type ParcelaV = { id: string; numero: number; total_parcelas: number; valor: number; vencimento: string; forma: string; status: string; turma_nome: string; aluno_nome: string }

function LigarParcela({ p, onFechar, onSalvo }: { p: Pag; onFechar: () => void; onSalvo: () => void }) {
  const [busca, setBusca] = useState(p.aluno_id ? '' : p.comprador_email ?? p.comprador_nome ?? '')
  const [alunos, setAlunos] = useState<{ id: string; nome: string; email: string | null }[]>([])
  const [alunoId, setAlunoId] = useState(p.aluno_id ?? '')
  const [parcelas, setParcelas] = useState<ParcelaV[]>([])
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (alunoId) return
    const t = setTimeout(async () => {
      const s = busca.replace(/[,()%*]/g, ' ').trim()
      if (s.length < 2) return setAlunos([])
      const { data } = await supabase.from('alunos').select('id,nome,email').or(`nome.ilike.%${s}%,email.ilike.%${s}%`).limit(8)
      setAlunos(data ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [busca, alunoId])
  useEffect(() => {
    if (!alunoId) return setParcelas([])
    supabase.from('v_parcelas').select('id,numero,total_parcelas,valor,vencimento,forma,status,turma_nome,aluno_nome').eq('aluno_id', alunoId).in('status', ['prevista', 'informada']).order('vencimento')
      .then(({ data }) => setParcelas((data as ParcelaV[]) ?? []))
  }, [alunoId])
  const soma = parcelas.filter((x) => marcadas.includes(x.id)).reduce((s, x) => s + Number(x.valor), 0)
  const salvar = async () => {
    const { error } = await supabase.rpc('vincular_pagamento_hotmart', { p_id: p.id, p_parcelas: marcadas })
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo="Ligar pagamento da Hotmart à parcela" aberto onFechar={onFechar} largo>
      <div className="nota pequeno"><b>{p.comprador_nome}</b> ({p.comprador_email}) · {p.produto_nome} · <b>{brl(p.valor)}</b>{p.valor_liquido ? ` (líquido ${brl(p.valor_liquido)})` : ''} em {dataBR(p.data_aprovacao ?? p.data_pedido)}</div>
      {!alunoId ? (<>
        <Campo rotulo="Aluno"><input value={busca} autoFocus onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail do aluno" /></Campo>
        <ul className="lista selecionavel">{alunos.map((a) => <li key={a.id} onClick={() => setAlunoId(a.id)}><b>{a.nome}</b><span className="muted pequeno">{a.email}</span></li>)}</ul>
      </>) : (<>
        <div className="bloco-topo"><b>{parcelas[0]?.aluno_nome ?? 'Aluno'}</b><button className="link pequeno" onClick={() => { setAlunoId(''); setMarcadas([]) }}>trocar aluno</button></div>
        {parcelas.length === 0 ? <Vazio>Esse aluno não tem parcela em aberto.</Vazio> : (
          <table className="tabela compacta">
            <thead><tr><th></th><th>Turma</th><th>Parcela</th><th>Forma</th><th>Vencimento</th><th className="num">Valor</th></tr></thead>
            <tbody>{parcelas.map((x) => (
              <tr key={x.id} onClick={() => setMarcadas((m) => m.includes(x.id) ? m.filter((y) => y !== x.id) : [...m, x.id])} style={{ cursor: 'pointer' }}>
                <td><input type="checkbox" readOnly checked={marcadas.includes(x.id)} /></td><td className="pequeno">{x.turma_nome}</td><td>{x.numero}/{x.total_parcelas}</td><td className="pequeno">{x.forma}</td><td>{dataBR(x.vencimento)}</td><td className="num">{brl(x.valor)}</td>
              </tr>))}</tbody>
          </table>
        )}
        {marcadas.length > 0 && <p className="muted pequeno">{marcadas.length} parcela(s) marcada(s), somando {brl(soma)}. Elas ficam como recebidas pela Hotmart, com o valor recebido dividido entre elas.</p>}
      </>)}
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={!marcadas.length} onClick={salvar}>Dar baixa</button></div>
    </Modal>
  )
}

function Ignorar({ p, onFechar, onSalvo }: { p: Pag; onFechar: () => void; onSalvo: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async () => {
    const { error } = await supabase.rpc('ignorar_pagamento_hotmart', { p_id: p.id, p_motivo: motivo })
    if (error) return setErro(msgErro(error))
    onSalvo()
  }
  return (
    <Modal titulo="Ignorar pagamento" aberto onFechar={onFechar}>
      <p className="muted pequeno">{p.comprador_nome} · {p.produto_nome} · {brl(p.valor)}. Ignorar não mexe em nenhuma parcela; o pagamento fica guardado em “Ignorados”.</p>
      <Campo rotulo="Motivo"><input value={motivo} autoFocus onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: venda do online, já baixado à mão" /></Campo>
      <Erro msg={erro} />
      <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={!motivo.trim()} onClick={salvar}>Ignorar</button></div>
    </Modal>
  )
}

type OfertaHotmart = { hotmart_oferta: string; titulo: string; valor: number | null; ativo: boolean; hotmart_produto_id: number }
type OfertaCurso = { oferta_codigo: string; curso_id: string | null; produto_id: number | null }

// Ofertas de um produto, cada uma ligada (ou não) a um curso presencial. É assim que se separa
// o que é venda do online do que é venda do presencial dentro do mesmo produto (ex.: Black).
function OfertasDoProduto({ produto, ofertas, ligacoes, cursos, aoMudar }: { produto: Produto; ofertas: OfertaHotmart[]; ligacoes: OfertaCurso[]; cursos: { id: string; nome: string }[]; aoMudar: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const cursoDa = (codigo: string) => ligacoes.find((l) => l.oferta_codigo === codigo)?.curso_id ?? ''
  const ligar = async (codigo: string, curso: string) => {
    setErro(null)
    const { error } = await supabase.from('hotmart_ofertas_cursos').upsert({ oferta_codigo: codigo, curso_id: curso || null, produto_id: produto.id }, { onConflict: 'oferta_codigo' })
    if (error) return setErro(msgErro(error))
    await supabase.from('links_pagamento').update({ curso_id: curso || null }).eq('hotmart_oferta', codigo)
    aoMudar()
  }
  if (!ofertas.length) return <p className="muted pequeno">As ofertas deste produto ainda não vieram da Hotmart. Elas chegam na próxima busca automática (de hora em hora).</p>
  return (
    <div className="ofertas-produto">
      <Erro msg={erro} />
      <table className="tabela compacta">
        <thead><tr><th>Oferta</th><th>Código</th><th className="num">Valor</th><th>Curso presencial</th></tr></thead>
        <tbody>
          {ofertas.map((o) => (
            <tr key={o.hotmart_oferta} className={o.ativo ? '' : 'linha-arquivada'}>
              <td>{o.titulo}{!o.ativo && <span className="muted pequeno"> · desativada</span>}</td>
              <td className="pequeno muted">{o.hotmart_oferta}</td>
              <td className="num">{o.valor ? brl(o.valor) : '—'}</td>
              <td><select value={cursoDa(o.hotmart_oferta)} onChange={(e) => ligar(o.hotmart_oferta, e.target.value)}><option value="">— (online)</option>{cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProdutosHotmart({ integs }: { integs: Integ[] }) {
  const cad = useCadastros()
  const produtos = useConsulta<Produto[]>(() => supabase.from('hotmart_produtos').select('*').order('nome'))
  const ofertas = useConsulta<OfertaHotmart[]>(() => supabase.from('links_pagamento').select('hotmart_oferta,titulo,valor,ativo,hotmart_produto_id').eq('origem', 'hotmart').order('ativo', { ascending: false }).order('titulo'))
  const ligacoes = useConsulta<OfertaCurso[]>(() => supabase.from('hotmart_ofertas_cursos').select('oferta_codigo,curso_id,produto_id'))
  const [aberto, setAberto] = useState<number | null>(null)
  const [todos, setTodos] = useState(false)
  const ps = (produtos.dados ?? []).filter((p) => p.status !== 'DELETED')
  if (!ps.length) return null
  const visiveis = todos ? ps : ps.filter((p) => p.curso_id || p.mostrar || p.status === 'ACTIVE')
  const atualizar = async (id: number, campos: Partial<Produto>) => { await supabase.from('hotmart_produtos').update(campos).eq('id', id); produtos.recarregar() }
  return (
    <section className="bloco">
      <div className="bloco-topo">
        <h2><Icone nome="livro" className="ouro" /> Produtos da Hotmart e cursos</h2>
        <label className="check pequeno"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Mostrar também os inativos</label>
      </div>
      <p className="muted pequeno">Ligue ao curso só o produto que é <b>só do presencial</b>. Se o produto mistura online e presencial (ex.: “Unique HOF Academy”, com a oferta da Black), deixe o produto como online e clique em <b>Ofertas</b> para ligar ao curso só a <b>oferta</b> do presencial. Pagamento sem curso é tratado como venda do online.</p>
      <div className="tabela-wrap">
        <table className="tabela compacta">
          <thead><tr><th>Produto na Hotmart</th><th>Conta</th><th>Situação</th><th>Curso no sistema</th><th>Trazer ofertas</th><th>Ofertas</th></tr></thead>
          <tbody>
            {visiveis.map((p) => {
              const doProduto = (ofertas.dados ?? []).filter((o) => o.hotmart_produto_id === p.id)
              const ligadas = doProduto.filter((o) => (ligacoes.dados ?? []).some((l) => l.oferta_codigo === o.hotmart_oferta && l.curso_id)).length
              const variasOfertas = doProduto.filter((o) => o.ativo).length > 1
              return (<Fragment key={p.id}>
              <tr>
                <td className="forte">{p.nome}<div className="muted pequeno">#{p.id}</div></td>
                <td className="pequeno">{integs.find((x) => x.id === p.integracao_id)?.nome.replace('Hotmart — ', '') ?? '—'}</td>
                <td>{p.status === 'ACTIVE' ? <Badge tom="ok">Ativo</Badge> : <Badge>{p.status ?? '—'}</Badge>}</td>
                <td><select value={p.curso_id ?? ''} onChange={(e) => atualizar(p.id, { curso_id: e.target.value || null })}><option value="">— (online)</option>{cad.cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                  {p.curso_id && variasOfertas && <div className="erro-txt pequeno">Este produto tem várias ofertas: ligado assim, <b>toda</b> venda dele conta como presencial. Prefira ligar pela oferta.</div>}</td>
                <td><input type="checkbox" checked={p.mostrar || !!p.curso_id} disabled={!!p.curso_id} onChange={(e) => atualizar(p.id, { mostrar: e.target.checked })} /></td>
                <td>{(p.mostrar || p.curso_id) ? <button className="link pequeno" onClick={() => setAberto(aberto === p.id ? null : p.id)}>{doProduto.length} oferta(s){ligadas ? ` · ${ligadas} no presencial` : ''} {aberto === p.id ? '▴' : '▾'}</button> : <span className="muted pequeno">—</span>}</td>
              </tr>
              {aberto === p.id && <tr><td colSpan={6}><OfertasDoProduto produto={p} ofertas={doProduto} ligacoes={ligacoes.dados ?? []} cursos={cad.cursos} aoMudar={() => { ligacoes.recarregar(); ofertas.recarregar() }} /></td></tr>}
              </Fragment>)
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
