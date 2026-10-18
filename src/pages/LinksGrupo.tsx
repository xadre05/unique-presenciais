// Grupo de links (ex.: uma campanha como a Black): título e explicação que aparecem acima dos links na tela Links.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { msgErro } from '../lib/dados'
import { Campo, Erro, Modal } from '../components/ui'

export type GrupoLinks = { id: string; nome: string; descricao: string | null; ordem: number; ativo: boolean }

export function FormGrupo({ grupo, onFechar, onSalvo }: { grupo: Partial<GrupoLinks> | null; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<Partial<GrupoLinks>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState<Partial<GrupoLinks> | null>(null)
  if (grupo !== ultimo) { setUltimo(grupo); setF(grupo ?? {}); setErro(null) }
  const set = (k: keyof GrupoLinks, v: unknown) => setF((x) => ({ ...x, [k]: v }))

  const salvar = async () => {
    if (!f.nome?.trim()) return setErro('Dê um nome ao grupo.')
    const dados = { nome: f.nome.trim(), descricao: f.descricao?.trim() || null, ordem: Number(f.ordem ?? 10), ativo: f.ativo ?? true }
    const { error } = f.id ? await supabase.from('links_grupos').update(dados).eq('id', f.id) : await supabase.from('links_grupos').insert(dados)
    if (error) return setErro(msgErro(error))
    onSalvo()
  }

  return (
    <Modal titulo={f.id ? 'Editar grupo de links' : 'Novo grupo de links'} aberto={!!grupo} onFechar={onFechar}>
      <div className="form-grade">
        <Campo rotulo="Nome do grupo" dica="Ex.: Black Friday Limited Edition 2026"><input value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} autoFocus /></Campo>
        <Campo rotulo="Explicação para a equipe" dica="O que a pessoa leva ao comprar e qual opção oferecer primeiro"><textarea rows={4} value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} /></Campo>
        <Campo rotulo="Ordem na tela" dica="Menor aparece primeiro"><input type="number" min={0} value={f.ordem ?? 10} onChange={(e) => set('ordem', e.target.value)} /></Campo>
        <label className="check"><input type="checkbox" checked={f.ativo ?? true} onChange={(e) => set('ativo', e.target.checked)} /> Ativo (desmarque quando a campanha acabar: os links voltam a aparecer no curso)</label>
        <Erro msg={erro} />
        <div className="modal-acoes"><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn btn-ouro" onClick={salvar}>Salvar</button></div>
      </div>
    </Modal>
  )
}
