import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { msgErro, useCadastros, useConsulta } from '../lib/dados'
import { brl } from '../lib/format'
import { useAuth } from '../auth'
import { Badge, Campo, Erro, InputMoeda, Modal, Vazio } from '../components/ui'

type LinkPg = {
  id: string; titulo: string; curso_id: string | null; tipo: string; endereco: string
  valor: number | null; condicao: string | null; observacao: string | null; ativo: boolean; ordem: number
}

const TIPOS: Record<string, string> = { hotmart: 'Hotmart', pix: 'Pix', link: 'Link', outro: 'Outro' }
const ehUrl = (s: string) => /^https?:\/\//i.test(s.trim())

export default function Links() {
  const { isAdmin } = useAuth()
  const [verInativos, setVerInativos] = useState(false)
  const links = useConsulta<LinkPg[]>(() => {
    let q = supabase.from('links_pagamento').select('*').order('ordem').order('titulo')
    if (!verInativos) q = q.eq('ativo', true)
    return q
  }, [verInativos])
  const cad = useCadastros()
  const [editando, setEditando] = useState<Partial<LinkPg> | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)

  const copiar = async (l: LinkPg) => {
    try { await navigator.clipboard.writeText(l.endereco) } catch {
      const t = document.createElement('textarea'); t.value = l.endereco; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
    }
    setCopiado(l.id); setTimeout(() => setCopiado(null), 1800)
  }

  const lista = links.dados ?? []
  const nomeCurso = (id: string | null) => cad.cursos.find((c) => c.id === id)?.nome ?? 'Geral (qualquer curso)'
  const grupos = new Map<string, LinkPg[]>()
  for (const l of lista) { const k = nomeCurso(l.curso_id); grupos.set(k, [...(grupos.get(k) ?? []), l]) }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Links de pagamento</h1>
          <p className="muted">Links oficiais para mandar ao aluno. Copie e cole no WhatsApp. {isAdmin ? 'Só administrador cadastra e altera.' : 'Precisa de um link que não está aqui? Peça ao administrador — não crie link na Hotmart.'}</p>
        </div>
        <div className="acoes">
          {isAdmin && <label className="check"><input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> mostrar desativados</label>}
          {isAdmin && <button className="btn btn-ouro" onClick={() => setEditando({ tipo: 'hotmart', ativo: true, ordem: 10 })}>+ Novo link</button>}
        </div>
      </header>
      <Erro msg={links.erro} />
      {lista.length === 0 && !links.carregando ? <Vazio>Nenhum link cadastrado ainda.</Vazio> : (
        [...grupos.entries()].map(([curso, ls]) => (
          <section className="links-grupo" key={curso}>
            <h2>{curso}</h2>
            <div className="links-grade">
              {ls.map((l) => {
                const pendente = l.endereco.startsWith('PREENCHER')
                return (
                  <div className={`link-card${l.ativo ? '' : ' inativo'}`} key={l.id}>
                    <div className="link-card-topo">
                      <h3>{l.titulo}</h3>
                      <Badge tom={l.tipo === 'pix' ? 'ok' : l.tipo === 'hotmart' ? 'info' : 'neutro'}>{TIPOS[l.tipo] ?? l.tipo}</Badge>
                    </div>
                    {(l.valor != null || l.condicao) && (
                      <div>{l.valor != null && <span className="link-valor">{brl(l.valor)}</span>} {l.condicao && <span className="muted">{l.condicao}</span>}</div>
                    )}
                    <div className="link-endereco">{pendente ? <span className="erro-txt">Falta cadastrar — {isAdmin ? 'clique em Editar' : 'avise o administrador'}</span> : l.endereco}</div>
                    {l.observacao && <div className="muted pequeno">{l.observacao}</div>}
                    {!l.ativo && <Badge tom="apagado">desativado</Badge>}
                    <div className="acoes">
                      <button className="btn btn-mini btn-ouro" disabled={pendente} onClick={() => copiar(l)}>{copiado === l.id ? 'Copiado ✓' : l.tipo === 'pix' ? 'Copiar chave Pix' : 'Copiar link'}</button>
                      {ehUrl(l.endereco) && <a className="btn btn-mini" href={l.endereco} target="_blank" rel="noreferrer">Abrir</a>}
                      {isAdmin && <button className="btn btn-mini" onClick={() => setEditando(l)}>Editar</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
      {isAdmin && <FormLink link={editando} cursos={cad.cursos} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); links.recarregar() }} />}
    </div>
  )
}

function FormLink({ link, cursos, onFechar, onSalvo }: { link: Partial<LinkPg> | null; cursos: { id: string; nome: string }[]; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<Partial<LinkPg>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState<Partial<LinkPg> | null>(null)
  if (link !== ultimo) { setUltimo(link); setF(link ?? {}); setErro(null) }
  const set = (k: keyof LinkPg, v: unknown) => setF((x) => ({ ...x, [k]: v }))

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.titulo?.trim() || !f.endereco?.trim()) return setErro('Preencha o nome e o link (ou a chave Pix).')
    const dados = {
      titulo: f.titulo.trim(), curso_id: f.curso_id || null, tipo: f.tipo || 'hotmart', endereco: f.endereco.trim(),
      valor: f.valor ?? null, condicao: f.condicao?.trim() || null, observacao: f.observacao?.trim() || null,
      ativo: f.ativo ?? true, ordem: f.ordem ?? 10,
    }
    const { error } = f.id ? await supabase.from('links_pagamento').update(dados).eq('id', f.id) : await supabase.from('links_pagamento').insert(dados)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }

  return (
    <Modal titulo={f.id ? 'Editar link' : 'Novo link de pagamento'} aberto={!!link} onFechar={onFechar}>
      <form onSubmit={salvar} className="form-grade">
        <Campo rotulo="Nome do link" dica="Como as meninas vão reconhecer. Ex.: Mini Residência — 12x no cartão"><input value={f.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} autoFocus /></Campo>
        <Campo rotulo="Curso">
          <select value={f.curso_id ?? ''} onChange={(e) => set('curso_id', e.target.value || null)}>
            <option value="">Geral (qualquer curso)</option>
            {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Tipo">
          <select value={f.tipo ?? 'hotmart'} onChange={(e) => set('tipo', e.target.value)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo rotulo={f.tipo === 'pix' ? 'Chave Pix' : 'Link'} dica={f.tipo === 'hotmart' ? 'Use só links da conta Unique HOF Academy.' : undefined}>
          <input value={f.endereco?.startsWith('PREENCHER') ? '' : f.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} placeholder={f.tipo === 'pix' ? 'CNPJ, e-mail ou chave aleatória' : 'https://pay.hotmart.com/…'} />
        </Campo>
        <Campo rotulo="Valor (opcional)"><InputMoeda valor={f.valor ?? null} onChange={(v) => set('valor', v)} /></Campo>
        <Campo rotulo="Condição (opcional)" dica="Ex.: à vista, 12x sem juros, só matrícula"><input value={f.condicao ?? ''} onChange={(e) => set('condicao', e.target.value)} /></Campo>
        <Campo rotulo="Observação para as vendedoras (opcional)"><input value={f.observacao ?? ''} onChange={(e) => set('observacao', e.target.value)} /></Campo>
        <label className="check"><input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Ativo (desmarque para tirar da lista sem apagar)</label>
        <Erro msg={erro} />
        <div className="modal-acoes"><button type="button" className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro">Salvar</button></div>
      </form>
    </Modal>
  )
}
