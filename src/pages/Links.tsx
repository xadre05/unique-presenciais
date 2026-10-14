import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl, dataBR, dataHoraBR, hojeISO } from '../lib/format'
import { useAuth } from '../auth'
import { Badge, Campo, Erro, InputMoeda, Modal, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'

type LinkPg = {
  id: string; titulo: string; curso_id: string | null; turma_id: string | null; tipo: string; endereco: string
  valor: number | null; condicao: string | null; observacao: string | null; ativo: boolean; ordem: number
  finalidade: string; aluno_id: string | null; validade: string | null; origem: string; sincronizado_em: string | null
}

const FINALIDADES: Record<string, string> = { integral: 'Pagamento integral', matricula: 'Matrícula (entrada)', saldo: 'Saldo restante', exclusivo: 'Exclusivo de um aluno' }
const ehUrl = (s: string) => /^https?:\/\//i.test(s.trim())
const pendente = (l: LinkPg) => l.endereco.startsWith('PREENCHER')

async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto) } catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
  }
}

export default function Links() {
  const { isAdmin } = useAuth()
  const cad = useCadastros()
  const links = useConsulta<LinkPg[]>(() => supabase.from('links_pagamento').select('*').order('ordem').order('titulo'))
  const alunos = useConsulta<{ id: string; nome: string }[]>(() => supabase.from('alunos').select('id,nome').order('nome'))
  const [busca, setBusca] = useState('')
  const [curso, setCurso] = useState('')
  const [turma, setTurma] = useState('')
  const [mostrar, setMostrar] = useState<'ativos' | 'desativados' | 'todos'>('ativos')
  const [editando, setEditando] = useState<Partial<LinkPg> | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [sinc, setSinc] = useState<{ rodando: boolean; msg: string | null; erro: string | null }>({ rodando: false, msg: null, erro: null })

  const hoje = hojeISO()
  const vencido = (l: LinkPg) => !!l.validade && l.validade < hoje
  const nomeCurso = (id: string | null) => cad.cursos.find((c) => c.id === id)?.nome
  const nomeTurma = (id: string | null) => cad.turmas.find((t) => t.id === id)?.nome
  const nomeAluno = (id: string | null) => (alunos.dados ?? []).find((a) => a.id === id)?.nome
  const termo = busca.trim().toLowerCase()
  const todos = (links.dados ?? []).filter((l) =>
    (mostrar === 'todos' || (mostrar === 'ativos' ? l.ativo && !vencido(l) : !l.ativo || vencido(l))) &&
    (!curso || l.curso_id === curso) && (!turma || l.turma_id === turma) &&
    (!termo || `${l.titulo} ${nomeCurso(l.curso_id) ?? ''} ${nomeTurma(l.turma_id) ?? ''} ${nomeAluno(l.aluno_id) ?? ''} ${l.condicao ?? ''}`.toLowerCase().includes(termo)))
  const pix = todos.filter((l) => l.tipo === 'pix' && !l.curso_id)
  const outros = todos.filter((l) => !pix.includes(l))
  const cursosVisiveis = cad.cursos.filter((c) => !curso || c.id === curso)
  const semCurso = outros.filter((l) => !l.curso_id)

  const marcar = (id: string) => { setCopiado(id); setTimeout(() => setCopiado(null), 1800) }
  const mensagem = (l: LinkPg) => {
    const aluno = nomeAluno(l.aluno_id)
    if (l.tipo === 'pix') return `Segue a chave Pix para o pagamento:\n${l.endereco}\n(${l.titulo})\nDepois de pagar, me envie o comprovante por aqui, por favor.`
    const alvo = [nomeCurso(l.curso_id), nomeTurma(l.turma_id) ? `turma ${nomeTurma(l.turma_id)!.split(' — ').pop()}` : ''].filter(Boolean).join(', ')
    const valor = l.valor != null ? ` no valor de ${brl(l.valor)}` : ''
    return `Olá${aluno ? `, ${aluno.split(' ')[0]}` : ''}! Segue o link para ${l.finalidade === 'matricula' ? 'a matrícula' : l.finalidade === 'saldo' ? 'o pagamento do saldo' : 'o pagamento'}${alvo ? ` do ${alvo}` : ''}${valor}${l.condicao ? ` (${l.condicao.toLowerCase()})` : ''}:\n${l.endereco}${l.validade ? `\nVálido até ${dataBR(l.validade)}.` : ''}\nQualquer dúvida, é só me chamar.`
  }

  const sincronizar = async () => {
    setSinc({ rodando: true, msg: null, erro: null })
    const { data, error } = await supabase.functions.invoke('hotmart-ofertas', { method: 'POST' })
    let erro: string | null = null
    if (error) {
      try { erro = (await (error as { context?: Response }).context?.json())?.erro ?? error.message } catch { erro = error.message }
    }
    setSinc({ rodando: false, erro, msg: erro ? null : `Hotmart sincronizada: ${data.produtos} produtos lidos, ${data.novos} links novos, ${data.atualizados} atualizados, ${data.desativados} desativados.` })
    links.recarregar()
  }

  const Linha = ({ l }: { l: LinkPg }) => (
    <div className={`link-linha${!l.ativo || vencido(l) ? ' inativo' : ''}`}>
      <div className="link-linha-info">
        <div className="link-linha-titulo">
          <b>{l.titulo}</b>
          {l.finalidade !== 'integral' && <Badge tom={l.finalidade === 'exclusivo' ? 'alerta' : 'neutro'}>{FINALIDADES[l.finalidade]}</Badge>}
          {l.origem === 'hotmart' && <Badge tom="info">Hotmart</Badge>}
          {!l.ativo && <Badge tom="apagado">desativado</Badge>}
          {vencido(l) && <Badge tom="apagado">vencido</Badge>}
        </div>
        <div className="muted pequeno">
          {[nomeTurma(l.turma_id), l.aluno_id && `só para ${nomeAluno(l.aluno_id)}`, l.validade && `válido até ${dataBR(l.validade)}`, l.observacao].filter(Boolean).join(' · ')}
          {l.origem === 'hotmart' && l.sincronizado_em && <span> · atualizado da Hotmart em {dataHoraBR(l.sincronizado_em)}</span>}
        </div>
      </div>
      <div className="link-linha-valor">{l.valor != null && <b>{brl(l.valor)}</b>}<div className="muted pequeno">{l.condicao}</div></div>
      <div className="link-linha-acoes">
        {pendente(l) ? <span className="erro-txt pequeno">Falta cadastrar o endereço</span> : (<>
          <button className="btn btn-contorno btn-mini" onClick={async () => { await copiar(l.endereco); marcar(l.id + 'l') }}><Icone nome="links" tam={14} /> {copiado === l.id + 'l' ? 'Copiado ✓' : 'Copiar link'}</button>
          <button className="btn btn-contorno btn-mini" onClick={async () => { await copiar(mensagem(l)); marcar(l.id + 'm') }}><Icone nome="whats" tam={14} /> {copiado === l.id + 'm' ? 'Copiada ✓' : 'Copiar mensagem'}</button>
          {ehUrl(l.endereco) && <a className="btn btn-mini btn-quadrado" href={l.endereco} target="_blank" rel="noreferrer" title="Abrir"><Icone nome="seta" tam={14} /></a>}
        </>)}
        {isAdmin && <button className="btn btn-mini" onClick={() => setEditando(l)}>Editar</button>}
      </div>
    </div>
  )

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div><h1>Links de venda e pagamento</h1><p className="muted">Encontre a opção certa e copie o link ou a mensagem pronta para o aluno.</p></div>
        {isAdmin && <div className="acoes">
          <button className="btn btn-contorno btn-grande" disabled={sinc.rodando} onClick={sincronizar}><Icone nome="historico" /> {sinc.rodando ? 'Buscando na Hotmart…' : 'Atualizar da Hotmart'}</button>
          <button className="btn btn-ouro btn-grande" onClick={() => setEditando({ tipo: 'hotmart', ativo: true, ordem: 10, finalidade: 'integral', origem: 'manual' })}><Icone nome="mais" /> Novo link</button>
        </div>}
      </header>
      {sinc.msg && <div className="aviso">{sinc.msg}</div>}
      {sinc.erro && <div className="erro">{sinc.erro}{/credenciais/i.test(sinc.erro) && <> Veja o passo a passo em <Link to="/configuracoes/integracoes" className="link">Configurações → Integrações</Link>.</>}</div>}

      <label className="select-icone busca-larga"><Icone nome="busca" /><input placeholder="Buscar curso, turma, aluno ou link…" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      <div className="filtros-comissoes">
        <label className="select-icone"><select value={curso} onChange={(e) => setCurso(e.target.value)}><option value="">Todos os cursos</option>{cad.cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label className="select-icone"><select value={turma} onChange={(e) => setTurma(e.target.value)}><option value="">Todas as turmas</option>{cad.turmas.filter((t) => !['realizada', 'cancelada'].includes(t.status)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label className="select-icone"><select value={mostrar} onChange={(e) => setMostrar(e.target.value as typeof mostrar)}><option value="ativos">Só os ativos</option><option value="desativados">Desativados e vencidos</option><option value="todos">Todos</option></select></label>
      </div>
      <Erro msg={links.erro} />

      {pix.length > 0 && (<>
        <h2 className="titulo-secao">Pix</h2>
        {pix.map((l) => (
          <section key={l.id} className="bloco pix-bloco">
            <span className="resumo-icone"><Icone nome="dinheiro" tam={22} /></span>
            <div className="pix-info"><b>{l.titulo}</b><div className="muted pequeno">{l.condicao ?? 'À vista'}{l.observacao && ` · ${l.observacao}`}</div></div>
            <div className="pix-chave">{pendente(l) ? <span className="erro-txt">Chave não cadastrada</span> : l.endereco}</div>
            <div className="link-linha-acoes">
              {!pendente(l) && <button className="btn btn-contorno btn-mini" onClick={async () => { await copiar(l.endereco); marcar(l.id + 'l') }}>{copiado === l.id + 'l' ? 'Copiada ✓' : 'Copiar chave'}</button>}
              {!pendente(l) && <button className="btn btn-contorno btn-mini" onClick={async () => { await copiar(mensagem(l)); marcar(l.id + 'm') }}><Icone nome="whats" tam={14} /> {copiado === l.id + 'm' ? 'Copiada ✓' : 'Copiar mensagem'}</button>}
              {isAdmin && <button className="btn btn-mini" onClick={() => setEditando(l)}>Editar</button>}
            </div>
          </section>
        ))}
      </>)}

      {cursosVisiveis.map((c) => {
        const ls = outros.filter((l) => l.curso_id === c.id)
        if (ls.length === 0 && (termo || turma)) return null
        return (
          <section key={c.id} className="bloco">
            <div className="bloco-topo">
              <h2><Icone nome="livro" className="ouro" /> {c.nome} <span className="muted pequeno">{ls.length} link(s)</span></h2>
              {isAdmin && <button className="btn btn-mini" onClick={() => setEditando({ tipo: 'hotmart', ativo: true, ordem: 10, finalidade: 'integral', origem: 'manual', curso_id: c.id })}><Icone nome="mais" tam={14} /> Link</button>}
            </div>
            {ls.length === 0 ? <p className="muted pequeno">Nenhum link {mostrar === 'ativos' ? 'ativo ' : ''}para este curso.{isAdmin && ' Cadastre à mão ou ligue o produto da Hotmart a este curso em Configurações → Integrações.'}</p>
              : ls.map((l) => <Linha key={l.id} l={l} />)}
          </section>
        )
      })}
      {semCurso.length > 0 && !curso && (
        <section className="bloco"><h2><Icone nome="links" className="ouro" /> Outros links</h2>{semCurso.map((l) => <Linha key={l.id} l={l} />)}</section>
      )}
      {todos.length === 0 && !links.carregando && <Vazio>Nenhum link com esses filtros.</Vazio>}

      {isAdmin && <p className="muted pequeno">Para os links da Hotmart virem sozinhos, ligue cada produto da Hotmart a um curso em <Link to="/configuracoes/integracoes" className="link">Configurações → Integrações</Link>.</p>}
      <p className="muted pequeno">Cadastro e edição: administrador. Consulta e cópia: toda a equipe.</p>

      {isAdmin && <FormLink link={editando} cursos={cad.cursos} turmas={cad.turmas} alunos={alunos.dados ?? []} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); links.recarregar() }} />}
    </div>
  )
}

function FormLink({ link, cursos, turmas, alunos, onFechar, onSalvo }: {
  link: Partial<LinkPg> | null; cursos: { id: string; nome: string }[]; turmas: { id: string; nome: string; status: string }[]; alunos: { id: string; nome: string }[]; onFechar: () => void; onSalvo: () => void
}) {
  const [f, setF] = useState<Partial<LinkPg>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState<Partial<LinkPg> | null>(null)
  if (link !== ultimo) { setUltimo(link); setF(link ?? {}); setErro(null) }
  const set = (k: keyof LinkPg, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const daHotmart = f.origem === 'hotmart'

  const salvar = async () => {
    if (!f.titulo?.trim() || !f.endereco?.trim()) return setErro('Preencha o nome e o link (ou a chave Pix).')
    if (f.finalidade === 'exclusivo' && !f.aluno_id) return setErro('Escolha o aluno deste link exclusivo.')
    const dados = {
      titulo: f.titulo.trim(), curso_id: f.curso_id || null, turma_id: f.turma_id || null, tipo: f.tipo || 'hotmart', endereco: f.endereco.trim(),
      valor: f.valor ?? null, condicao: f.condicao?.trim() || null, observacao: f.observacao?.trim() || null, ativo: f.ativo ?? true, ordem: f.ordem ?? 10,
      finalidade: f.finalidade || 'integral', aluno_id: f.finalidade === 'exclusivo' ? f.aluno_id : null, validade: f.validade || null,
    }
    const { error } = f.id ? await supabase.from('links_pagamento').update(dados).eq('id', f.id) : await supabase.from('links_pagamento').insert(dados)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }

  return (
    <Modal titulo={f.id ? 'Editar link' : 'Novo link'} aberto={!!link} onFechar={onFechar} largo>
      {daHotmart && <p className="nota pequeno">Este link vem da Hotmart: link, valor e condição são atualizados por lá. Aqui você ajusta nome, turma, finalidade, aluno e validade.</p>}
      <div className="form-grade">
        <Campo rotulo="Nome do link" dica="Como a equipe vai reconhecer. Ex.: Mini Residência — 12x no cartão"><input value={f.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} autoFocus /></Campo>
        <Campo rotulo="Tipo"><select value={f.tipo ?? 'hotmart'} disabled={daHotmart} onChange={(e) => set('tipo', e.target.value)}><option value="hotmart">Hotmart</option><option value="pix">Pix</option><option value="link">Outro link</option></select></Campo>
        <Campo rotulo="Curso"><select value={f.curso_id ?? ''} onChange={(e) => set('curso_id', e.target.value || null)}><option value="">Geral (qualquer curso)</option>{cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
        <Campo rotulo="Turma (opcional)"><select value={f.turma_id ?? ''} onChange={(e) => set('turma_id', e.target.value || null)}><option value="">Qualquer turma</option>{turmas.filter((t) => !['realizada', 'cancelada'].includes(t.status)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></Campo>
        <Campo rotulo="Finalidade"><select value={f.finalidade ?? 'integral'} onChange={(e) => set('finalidade', e.target.value)}>{Object.entries(FINALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        {f.finalidade === 'exclusivo' && <Campo rotulo="Aluno"><select value={f.aluno_id ?? ''} onChange={(e) => set('aluno_id', e.target.value || null)}><option value="">Escolha…</option>{alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Campo>}
        <Campo rotulo={f.tipo === 'pix' ? 'Chave Pix' : 'Link'}><input value={f.endereco?.startsWith('PREENCHER') ? '' : f.endereco ?? ''} disabled={daHotmart} onChange={(e) => set('endereco', e.target.value)} placeholder={f.tipo === 'pix' ? 'CNPJ, e-mail ou chave aleatória' : 'https://pay.hotmart.com/…'} /></Campo>
        <Campo rotulo="Valor (opcional)"><InputMoeda valor={f.valor ?? null} onChange={(v) => set('valor', v)} /></Campo>
        <Campo rotulo="Condição (opcional)" dica="Ex.: à vista, 12x sem juros"><input value={f.condicao ?? ''} disabled={daHotmart} onChange={(e) => set('condicao', e.target.value)} /></Campo>
        <Campo rotulo="Válido até (opcional)"><input type="date" value={f.validade ?? ''} onChange={(e) => set('validade', e.target.value)} /></Campo>
        <Campo rotulo="Observação para a equipe (opcional)"><input value={f.observacao ?? ''} onChange={(e) => set('observacao', e.target.value)} /></Campo>
        <label className="check"><input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Ativo (desmarque para tirar da lista sem apagar)</label>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar</button></div>
      </div>
    </Modal>
  )
}
