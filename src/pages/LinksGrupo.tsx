// Grupo de links (ex.: uma campanha como a Black): título, explicação para a equipe e quais links (ofertas) fazem parte.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { msgErro, useConsulta } from '../lib/dados'
import { brl } from '../lib/format'
import { Campo, Erro, Modal } from '../components/ui'

export type GrupoLinks = { id: string; nome: string; descricao: string | null; ordem: number; ativo: boolean }
type LinkDoGrupo = { id: string; titulo: string; valor: number | null; condicao: string | null; ativo: boolean; origem: string; grupo_id: string | null; hotmart_produto_id: number | null }

const FEITOS_A_MAO = 'manual'
const chaveProduto = (l: LinkDoGrupo) => (l.hotmart_produto_id ? String(l.hotmart_produto_id) : FEITOS_A_MAO)

export function FormGrupo({ grupo, links, grupos, onFechar, onSalvo }: {
  grupo: Partial<GrupoLinks> | null; links: LinkDoGrupo[]; grupos: GrupoLinks[]; onFechar: () => void; onSalvo: () => void
}) {
  const produtos = useConsulta<{ id: number; nome: string }[]>(() => supabase.from('hotmart_produtos').select('id,nome').order('nome'))
  const [f, setF] = useState<Partial<GrupoLinks>>({})
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [produto, setProduto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [ultimo, setUltimo] = useState<Partial<GrupoLinks> | null>(null)
  if (grupo !== ultimo) {
    const doGrupo = grupo?.id ? links.filter((l) => l.grupo_id === grupo.id) : []
    setUltimo(grupo); setF(grupo ?? {}); setErro(null)
    setMarcados(new Set(doGrupo.map((l) => l.id)))
    setProduto(doGrupo[0] ? chaveProduto(doGrupo[0]) : '')
  }
  const set = (k: keyof GrupoLinks, v: unknown) => setF((x) => ({ ...x, [k]: v }))
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // produtos que têm links, para escolher de qual produto vêm as ofertas do grupo
  const nomeProduto = (chave: string) => chave === FEITOS_A_MAO ? 'Links cadastrados à mão' : (produtos.dados ?? []).find((p) => String(p.id) === chave)?.nome ?? `Produto ${chave}`
  const chaves = [...new Set(links.map(chaveProduto))].sort((a, b) => nomeProduto(a).localeCompare(nomeProduto(b)))
  const doProduto = links.filter((l) => chaveProduto(l) === produto).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.titulo.localeCompare(b.titulo))
  const outroGrupo = (l: LinkDoGrupo) => l.grupo_id && l.grupo_id !== f.id ? grupos.find((g) => g.id === l.grupo_id)?.nome : null

  const salvar = async () => {
    if (!f.nome?.trim()) return setErro('Dê um nome ao grupo.')
    setSalvando(true); setErro(null)
    const dados = { nome: f.nome.trim(), descricao: f.descricao?.trim() || null, ordem: Number(f.ordem ?? 10), ativo: f.ativo ?? true }
    const r = f.id
      ? await supabase.from('links_grupos').update(dados).eq('id', f.id).select('id').single()
      : await supabase.from('links_grupos').insert(dados).select('id').single()
    if (r.error) { setSalvando(false); return setErro(msgErro(r.error)) }
    const id = r.data.id as string
    const sair = links.filter((l) => l.grupo_id === id && !marcados.has(l.id)).map((l) => l.id)
    const entrar = [...marcados]
    const e1 = sair.length ? (await supabase.from('links_pagamento').update({ grupo_id: null }).in('id', sair)).error : null
    const e2 = entrar.length ? (await supabase.from('links_pagamento').update({ grupo_id: id }).in('id', entrar)).error : null
    setSalvando(false)
    if (e1 || e2) return setErro(msgErro((e1 ?? e2)!))
    onSalvo()
  }

  return (
    <Modal titulo={f.id ? 'Editar grupo de links' : 'Novo grupo de links'} aberto={!!grupo} onFechar={onFechar} largo>
      <div className="form-grade">
        <Campo rotulo="Nome do grupo" dica="Ex.: Black Friday Limited Edition 2026"><input value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} autoFocus /></Campo>
        <Campo rotulo="Ordem na tela" dica="Menor aparece primeiro"><input type="number" min={0} value={f.ordem ?? 10} onChange={(e) => set('ordem', e.target.value)} /></Campo>
        <Campo rotulo="Explicação para a equipe" dica="O que a pessoa leva ao comprar e qual opção oferecer primeiro"><textarea rows={3} value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} /></Campo>

        <Campo rotulo="Links do grupo · produto da Hotmart" dica="Escolha o produto e marque as ofertas que fazem parte deste grupo">
          <select value={produto} onChange={(e) => setProduto(e.target.value)}>
            <option value="">Escolha o produto…</option>
            {chaves.map((c) => <option key={c} value={c}>{nomeProduto(c)}</option>)}
          </select>
        </Campo>
        {produto && (
          <div className="grupo-ofertas">
            {doProduto.length === 0 && <p className="muted pequeno">Nenhum link deste produto.</p>}
            {doProduto.map((l) => (
              <label key={l.id} className={`check grupo-oferta${l.ativo ? '' : ' inativo'}`}>
                <input type="checkbox" checked={marcados.has(l.id)} onChange={() => alternar(l.id)} />
                <span>
                  <b>{l.titulo}</b>{l.valor != null && <> · {brl(l.valor)}</>}
                  <span className="muted pequeno">{[l.condicao, !l.ativo && 'desativado', outroGrupo(l) && `hoje está em “${outroGrupo(l)}” (marcar muda para este)`].filter(Boolean).join(' · ')}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="muted pequeno">{marcados.size} link(s) marcados neste grupo{marcados.size > 0 && ' (contando os de outros produtos)'}.</p>

        <label className="check"><input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Ativo (desmarque quando a campanha acabar: os links voltam a aparecer no curso)</label>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</button></div>
      </div>
    </Modal>
  )
}
